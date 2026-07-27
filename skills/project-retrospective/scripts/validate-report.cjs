#!/usr/bin/env node
/**
 * validate-report.cjs — is this run's output well-formed?
 *
 * Checks an analyze run's output directory: required files present for the scope,
 * JSON shapes intact, the report's frozen headings present, one verdict per
 * candidate, one proposal file per Promote candidate in the correct per-type
 * shape, and — when present — well-formed component captures.
 *
 * This is the skill's own feedback loop (run it, fix what it reports, re-run) and
 * the shape the test suite asserts against. It checks structure, not judgment: it
 * cannot tell you a verdict is wrong, only that the output is malformed.
 *
 * Usage:
 *   node validate-report.cjs --output <dir> [--scope full|inventory|candidates]
 *                            [--no-brain] [--manifest <file>] [--json]
 *
 * Exit codes:
 *   0  pass (warnings are allowed)
 *   1  one or more failures
 *   2  invalid invocation
 *   3  --output is missing or is not a directory
 */

'use strict';

const path = require('node:path');
const {
  parseArgs,
  checkArgs,
  readJsonSafe,
  readTextSafe,
  isDir,
  isFile,
  listEntries,
  kebab,
  usage,
} = require('./lib/util.cjs');

const USAGE = [
  'Usage: node validate-report.cjs --output <dir> [--scope full|inventory|candidates] [--no-brain] [--manifest <file>] [--json]',
  '',
  '  --output    Run output directory to validate (required)',
  '  --scope     Scope the run used: full (default), inventory, or candidates',
  '  --no-brain  The run had no Brain path, so resolution.json is not expected',
  '  --manifest  patterns-manifest.json to check new-pattern proposals against',
  '  --json      Emit a JSON result instead of PASS/FAIL lines',
];

const SCOPES = ['full', 'inventory', 'candidates'];
const PROPOSAL_TYPES = ['new-pattern', 'new-alias', 'guidance-edit'];
// Captures target the component library rather than the catalog, so they live in
// their own directory and have no Promote candidate to pair with.
const CAPTURE_TYPE = 'component-capture';

const REQUIRED_SECTIONS = {
  'new-pattern': ['## Pattern draft', '## Manifest entry', '## Evidence', '## Integrity checklist delta', '## Suggested commit'],
  'new-alias': ['## Target', '## Alias', '## Consumer evidence', '## Edits', '## Suggested commit'],
  'guidance-edit': ['## Target file(s)', '## Edit', '## Incident evidence', '## Suggested commit'],
  'component-capture': ['## Canonical', '## Source', '## Reuse evidence', '## De-client work', '## Proposed library entry', '## Suggested commit'],
};

// Categories the rubric never promotes. Matching here is advisory: the model may
// have a defensible reason, so this warns rather than fails.
const EXCLUDED_RE = /\b(page|checkout|auth|login|signup|cart|route|routing|commerce|search-api)\b/i;

// A pattern's Best practices must carry at least one accessibility bullet — a hard
// requirement of the ui-design-brain pattern-file structure. The vocabulary is broad
// because the catalog asks for a concrete technique, and which technique is relevant
// depends on the pattern: alt text for a logo band, focus trapping for a modal,
// pausable motion for a carousel.
const A11Y_RE =
  /accessib|keyboard|aria|focus|screen reader|contrast|role=|\balt\b|alt text|landmark|announce|tab order|visually hidden|wcag|reduced motion|pausable|assistive/i;

const VERDICT_RE = /^(?:\*\*)?Verdict:?(?:\*\*)?\s*(Promote|Watch|Reject)\s*$/i;

class Result {
  constructor() {
    this.failures = [];
    this.warnings = [];
  }

  fail(check, detail) {
    this.failures.push({ check, detail });
  }

  warn(check, detail) {
    this.warnings.push({ check, detail });
  }
}

/**
 * Split markdown into { heading, body } blocks at the given heading level.
 *
 * Fence-aware: a proposal's pattern draft is a fenced block whose content is
 * itself markdown with `##` headings, and those must not split the section that
 * contains them.
 */
function sections(markdown, level) {
  const marker = `${'#'.repeat(level)} `;
  const lines = markdown.split('\n');
  const out = [];
  let current = null;
  let fence = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (fenceMatch) {
      const [, ticks, rest] = fenceMatch;
      if (fence === null) {
        fence = ticks;
      } else if (ticks[0] === fence[0] && ticks.length >= fence.length && rest.trim() === '') {
        fence = null;
      }
    } else if (fence === null && line.startsWith(marker)) {
      if (current) out.push(current);
      current = { heading: line.slice(marker.length).trim(), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) out.push(current);
  return out.map((s) => ({ heading: s.heading, body: s.body.join('\n') }));
}

/**
 * First fenced code block in `body`, optionally filtered by info string.
 *
 * Uses the same fence rules as `sections()` rather than a regex: tilde fences,
 * indented fences, and longer fences wrapping shorter ones all appear in these
 * templates, and a regex that mishandles them produces confident-but-wrong
 * "missing block" failures.
 */
function fencedBlock(body, lang) {
  const lines = body.split('\n');
  let open = null;
  let indent = 0;
  const collected = [];

  for (const line of lines) {
    const match = line.match(/^(\s*)(`{3,}|~{3,})\s*(\S*)/);
    if (match) {
      const [, lead, ticks, info] = match;
      if (open === null) {
        if (lang && info.toLowerCase() !== lang.toLowerCase()) continue;
        open = ticks;
        indent = lead.length;
        continue;
      }
      if (ticks[0] === open[0] && ticks.length >= open.length && !info) {
        return collected.join('\n');
      }
    }
    if (open !== null) {
      // Strip only the opening fence's indentation so an indented block keeps its
      // own internal structure.
      collected.push(line.slice(0, indent).trim() === '' ? line.slice(indent) : line);
    }
  }

  // An unclosed fence is malformed; report it as absent rather than guessing.
  return null;
}

function checkInventory(dir, result) {
  const file = path.join(dir, 'inventory.json');
  if (!isFile(file)) {
    result.fail('inventory-present', 'inventory.json is missing');
    return null;
  }
  const read = readJsonSafe(file);
  if (!read.ok) {
    result.fail('inventory-parses', `inventory.json could not be parsed: ${read.error}`);
    return null;
  }
  const inv = read.value;
  if (!inv || typeof inv !== 'object' || Array.isArray(inv)) {
    result.fail('inventory-parses', 'inventory.json is not a JSON object');
    return null;
  }
  if (inv.schemaVersion !== 1) result.fail('inventory-schema', `inventory.json schemaVersion is ${inv.schemaVersion}, expected 1`);
  if (!['artifacts', 'code-scan'].includes(inv.mode)) result.fail('inventory-mode', `inventory.json mode "${inv.mode}" is not artifacts or code-scan`);
  if (!Array.isArray(inv.components)) result.fail('inventory-components', 'inventory.json has no components array');
  if (!Array.isArray(inv.warnings)) result.fail('inventory-warnings', 'inventory.json has no warnings array');
  if (Array.isArray(inv.components) && inv.counts?.components !== inv.components.length) {
    result.fail('inventory-counts', `inventory.json counts.components (${inv.counts?.components}) does not match components.length (${inv.components.length})`);
  }
  return inv;
}

function checkResolution(dir, result) {
  const file = path.join(dir, 'resolution.json');
  if (!isFile(file)) {
    result.fail('resolution-present', 'resolution.json is missing (pass --no-brain if the run had no Brain path)');
    return null;
  }
  const read = readJsonSafe(file);
  if (!read.ok) {
    result.fail('resolution-parses', `resolution.json could not be parsed: ${read.error}`);
    return null;
  }
  const res = read.value;
  if (!res || typeof res !== 'object' || Array.isArray(res)) {
    result.fail('resolution-parses', 'resolution.json is not a JSON object');
    return null;
  }
  if (res.schemaVersion !== 1) result.fail('resolution-schema', `resolution.json schemaVersion is ${res.schemaVersion}, expected 1`);
  if (!Array.isArray(res.resolved)) result.fail('resolution-resolved', 'resolution.json has no resolved array');
  if (!Array.isArray(res.unresolved)) result.fail('resolution-unresolved', 'resolution.json has no unresolved array');
  if (typeof res.manifest?.entries !== 'number') result.fail('resolution-manifest', 'resolution.json has no manifest.entries count');
  return res;
}

function checkReport(dir, scope, noBrain, result) {
  const file = path.join(dir, 'report.md');
  const text = isFile(file) ? readTextSafe(file) : null;
  if (text === null) {
    result.fail('report-present', 'report.md is missing or unreadable');
    return { promoted: [], candidates: [] };
  }

  const required = ['Run', 'Summary', 'Inventory', 'Gaps'];
  if (scope !== 'inventory' && !noBrain) required.push('Resolution');
  if (scope !== 'inventory') required.push('Candidates', 'Next steps');
  if (scope === 'full') required.push('Learnings');

  // Headings are matched exactly, from the same fence-aware parse used to read the
  // sections. A substring test would accept "## Candidates (3 evaluated)" here and
  // then fail to find it below, silently skipping every candidate check.
  const topLevel = sections(text, 2);
  const present = new Set(topLevel.map((s) => s.heading));
  for (const heading of required) {
    if (!present.has(heading)) {
      result.fail('report-sections', `report.md is missing the "## ${heading}" section (headings must match exactly)`);
    }
  }

  if (scope === 'inventory') return { promoted: [], candidates: [] };

  const candidatesSection = topLevel.find((s) => s.heading === 'Candidates');
  if (!candidatesSection) return { promoted: [], candidates: [] };

  const candidates = [];
  for (const candidate of sections(candidatesSection.body, 3)) {
    const verdicts = candidate.body
      .split('\n')
      .map((line) => line.trim().match(VERDICT_RE))
      .filter(Boolean)
      .map((m) => m[1].toLowerCase());

    if (verdicts.length !== 1) {
      result.fail(
        'candidate-verdict',
        `candidate "${candidate.heading}" has ${verdicts.length} verdict lines, expected exactly 1 (form: "Verdict: Promote|Watch|Reject")`,
      );
      continue;
    }
    candidates.push({ label: candidate.heading, verdict: verdicts[0] });
  }

  return { promoted: candidates.filter((c) => c.verdict === 'promote'), candidates };
}

function checkProposalFile(file, manifestEntries, result, allowedTypes = PROPOSAL_TYPES) {
  const text = readTextSafe(file);
  const name = path.basename(file);
  if (text === null) {
    result.fail('proposal-readable', `${name} could not be read`);
    return;
  }

  const typeSection = sections(text, 2).find((s) => s.heading === 'Proposal type');
  if (!typeSection) {
    result.fail('proposal-type', `${name} has no "## Proposal type" section`);
    return;
  }
  // Longest first, so "component-capture" is not shadowed by a shorter prefix.
  const type = [...allowedTypes]
    .sort((a, b) => b.length - a.length)
    .find((t) => new RegExp(`\\b${t}\\b`).test(typeSection.body));
  if (!type) {
    result.fail('proposal-type', `${name} does not name a valid proposal type (${allowedTypes.join(', ')})`);
    return;
  }

  for (const heading of REQUIRED_SECTIONS[type]) {
    if (!text.includes(`\n${heading}`) && !text.startsWith(heading)) {
      result.fail('proposal-sections', `${name} (${type}) is missing the "${heading}" section`);
    }
  }

  if (EXCLUDED_RE.test(name)) {
    result.warn('proposal-exclusion', `${name} matches an excluded category — confirm it is reusable UI vocabulary, not a page or flow`);
  }

  if (type !== 'new-pattern') return;

  const entrySection = sections(text, 2).find((s) => s.heading === 'Manifest entry');
  const draftSection = sections(text, 2).find((s) => s.heading === 'Pattern draft');

  let entry = null;
  const entryJson = entrySection ? fencedBlock(entrySection.body, 'json') : null;
  if (!entryJson) {
    result.fail('proposal-manifest-entry', `${name} has no fenced json block under "## Manifest entry"`);
  } else {
    try {
      entry = JSON.parse(entryJson);
    } catch (err) {
      result.fail('proposal-manifest-entry', `${name} manifest entry is not valid JSON: ${err.message}`);
    }
  }

  if (entry) {
    for (const key of ['name', 'slug', 'file']) {
      if (typeof entry[key] !== 'string' || !entry[key]) {
        result.fail('proposal-manifest-entry', `${name} manifest entry has no string "${key}"`);
      }
    }
    if (!Array.isArray(entry.aliases)) {
      result.fail('proposal-manifest-entry', `${name} manifest entry has no aliases array`);
    }
    if (entry.name && entry.slug && kebab(entry.name) !== entry.slug) {
      result.fail('proposal-slug', `${name} slug "${entry.slug}" is not kebab("${entry.name}") ("${kebab(entry.name)}")`);
    }
    if (entry.slug && entry.file !== `patterns/${entry.slug}.md`) {
      result.fail('proposal-file-path', `${name} manifest file is "${entry.file}", expected "patterns/${entry.slug}.md"`);
    }
    if (manifestEntries) {
      const clash = manifestEntries.find(
        (m) => kebab(m.name) === kebab(entry.name || '') || m.slug === entry.slug,
      );
      if (clash) {
        result.fail('proposal-collision', `${name} proposes "${entry.name}" but the catalog already has "${clash.name}" (${clash.slug})`);
      }
      const proposedAliases = (Array.isArray(entry.aliases) ? entry.aliases : [])
        .map((a) => (typeof a === 'string' ? a : a?.name))
        .filter(Boolean);
      for (const alias of proposedAliases) {
        const owner = manifestEntries.find((m) =>
          (m.aliases || []).some((a) => kebab(typeof a === 'string' ? a : a?.name || '') === kebab(alias)),
        );
        if (owner) {
          result.warn('proposal-alias-duplicate', `${name} proposes alias "${alias}", which "${owner.name}" already claims — it must be context-scoped or dropped`);
        }
      }
    }
  }

  const draft = draftSection ? fencedBlock(draftSection.body) : null;
  if (!draft) {
    result.fail('proposal-pattern-draft', `${name} has no fenced block under "## Pattern draft"`);
    return;
  }

  const lines = draft.split('\n').map((l) => l.trimEnd());
  const first = lines.find((l) => l.trim());
  const last = [...lines].reverse().find((l) => l.trim());

  if (!first || !first.startsWith('## ')) {
    result.fail('proposal-pattern-draft', `${name} pattern draft must start with an H2 canonical name ("## Name")`);
  } else if (entry?.name && first.slice(3).trim() !== entry.name) {
    result.fail('proposal-pattern-draft', `${name} pattern draft H2 "${first.slice(3).trim()}" does not match the manifest name "${entry.name}"`);
  }
  if (last !== '---') {
    result.fail('proposal-pattern-draft', `${name} pattern draft must end with a "---" rule`);
  }
  for (const marker of ['**Best practices:**', '**Common layouts:**']) {
    if (!draft.includes(marker)) {
      result.fail('proposal-pattern-draft', `${name} pattern draft is missing the "${marker}" block`);
    }
  }

  const practices = draft.split('**Best practices:**')[1]?.split('**Common layouts:**')[0] || '';
  const bullets = practices.split('\n').filter((l) => l.trim().startsWith('-'));
  if (!bullets.some((b) => A11Y_RE.test(b))) {
    result.fail('proposal-pattern-draft', `${name} pattern draft has no accessibility/keyboard bullet under Best practices`);
  }
}

function checkProposals(dir, promoted, manifestEntries, result) {
  const proposalsDir = path.join(dir, 'proposals');
  const files = isDir(proposalsDir)
    ? listEntries(proposalsDir).filter((e) => !e.dir && e.name.endsWith('.md'))
    : [];

  if (promoted.length === 0) {
    if (files.length > 0) {
      result.fail('proposal-parity', `proposals/ has ${files.length} file(s) but the report has no Promote candidates`);
    }
    return;
  }

  if (!isDir(proposalsDir)) {
    result.fail('proposal-parity', `report has ${promoted.length} Promote candidate(s) but there is no proposals/ directory`);
    return;
  }

  const byName = new Map(files.map((f) => [f.name, f.path]));
  for (const candidate of promoted) {
    const expected = `${kebab(candidate.label)}.md`;
    if (!byName.has(expected)) {
      result.fail('proposal-parity', `Promote candidate "${candidate.label}" has no proposals/${expected}`);
      continue;
    }
    byName.delete(expected);
  }
  for (const orphan of byName.keys()) {
    result.fail('proposal-parity', `proposals/${orphan} has no matching Promote candidate in report.md`);
  }

  for (const file of files) {
    checkProposalFile(file.path, manifestEntries, result);
  }
}

/** Captures are optional; when present each must be a well-formed capture file. */
function checkCaptures(dir, result) {
  const capturesDir = path.join(dir, 'captures');
  if (!isDir(capturesDir)) return;

  const files = listEntries(capturesDir).filter((e) => !e.dir && e.name.endsWith('.md'));
  if (files.length === 0) {
    result.warn('capture-empty', 'captures/ exists but contains no capture files');
    return;
  }
  for (const file of files) {
    checkProposalFile(file.path, null, result, [CAPTURE_TYPE]);
  }
}

function checkOrchestrationDrafts(dir, result) {
  const file = path.join(dir, 'orchestration-drafts.md');
  const text = isFile(file) ? readTextSafe(file) : null;
  if (text === null) {
    result.fail('drafts-present', 'orchestration-drafts.md is missing');
    return;
  }
  // A run with nothing pipeline-shaped to say records that explicitly rather than
  // shipping an empty file.
  if (/no pipeline learnings/i.test(text)) return;
  for (const heading of ['## Purpose', '## Guardrails']) {
    if (!text.includes(`\n${heading}`) && !text.startsWith(heading)) {
      result.fail('drafts-shape', `orchestration-drafts.md has no "${heading}" section (and no "no pipeline learnings" note)`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    keys: ['output', 'scope', 'manifest'],
    flags: ['no-brain', 'json'],
  });
  const { values } = args;

  checkArgs(args, USAGE);
  if (!values.output) usage('--output is required', USAGE);

  const scope = values.scope || 'full';
  if (!SCOPES.includes(scope)) usage(`--scope must be one of: ${SCOPES.join(', ')}`, USAGE);

  const dir = path.resolve(values.output);
  if (!isDir(dir)) {
    process.stderr.write(`error: --output is not a directory: ${dir}\n`);
    process.exit(3);
  }

  const result = new Result();
  const noBrain = Boolean(values['no-brain']);

  let manifestEntries = null;
  if (values.manifest) {
    const read = readJsonSafe(path.resolve(values.manifest));
    if (!read.ok || !Array.isArray(read.value)) {
      result.warn('manifest-load', `--manifest could not be read as a JSON array; catalog collision checks skipped`);
    } else {
      manifestEntries = read.value;
    }
  }

  checkInventory(dir, result);
  if (scope !== 'inventory' && !noBrain) checkResolution(dir, result);

  const { promoted } = checkReport(dir, scope, noBrain, result);

  if (scope === 'full') {
    checkProposals(dir, promoted, manifestEntries, result);
    checkCaptures(dir, result);
    checkOrchestrationDrafts(dir, result);
  }

  const pass = result.failures.length === 0;

  if (values.json) {
    process.stdout.write(`${JSON.stringify({ pass, failures: result.failures, warnings: result.warnings }, null, 2)}\n`);
  } else {
    for (const warning of result.warnings) {
      process.stdout.write(`WARN [${warning.check}] ${warning.detail}\n`);
    }
    for (const failure of result.failures) {
      process.stdout.write(`FAIL [${failure.check}] ${failure.detail}\n`);
    }
    process.stdout.write(
      pass
        ? `PASS ${path.basename(dir)} (scope: ${scope})${result.warnings.length ? ` — ${result.warnings.length} warning(s)` : ''}\n`
        : `FAILED ${result.failures.length} check(s) in ${path.basename(dir)}\n`,
    );
  }

  process.exit(pass ? 0 : 1);
}

try {
  main();
} catch (err) {
  process.stderr.write(`error: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
}
