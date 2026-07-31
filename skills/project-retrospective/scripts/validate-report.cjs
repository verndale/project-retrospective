#!/usr/bin/env node
/**
 * validate-report.cjs — is this run's output well-formed?
 *
 * Checks an analyze run's output directory: required files present for the scope,
 * JSON shapes intact, the report's frozen headings present, one verdict per
 * candidate, one proposal file per Promote candidate in the correct per-type
 * shape, and two-way parity between the report's "## Captures" entries and
 * `captures/`.
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
  sections,
  fencedBlock,
  parseCanonicalLine,
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
// their own directory and pair with the report's "## Captures" entries rather than
// with a Promote candidate.
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

function checkMeta(dir, scope, result) {
  const file = path.join(dir, 'meta.json');
  if (!isFile(file)) {
    result.fail('meta-present', 'meta.json is missing');
    return null;
  }
  const read = readJsonSafe(file);
  if (!read.ok) {
    result.fail('meta-parses', `meta.json could not be parsed: ${read.error}`);
    return null;
  }
  const meta = read.value;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    result.fail('meta-parses', 'meta.json is not a JSON object');
    return null;
  }
  if (meta.schemaVersion !== 1) result.fail('meta-schema', `meta.json schemaVersion is ${meta.schemaVersion}, expected 1`);

  const client = meta.client && typeof meta.client === 'object' ? meta.client : {};
  const project = meta.project && typeof meta.project === 'object' ? meta.project : {};
  for (const [label, value] of [
    ['client.name', client.name],
    ['client.slug', client.slug],
    ['project.slug', project.slug],
    ['date', meta.date],
  ]) {
    if (typeof value !== 'string' || !value) result.fail('meta-fields', `meta.json ${label} must be a non-empty string`);
  }
  // platform is required as a key but may be null (code-scan / no build.config.json).
  if (!(typeof meta.platform === 'string' || meta.platform === null)) {
    result.fail('meta-fields', 'meta.json platform must be a string or null');
  }
  if (meta.priorReports !== undefined && !Array.isArray(meta.priorReports)) {
    result.fail('meta-fields', 'meta.json priorReports must be an array');
  }

  if (typeof client.slug === 'string' && client.slug && kebab(client.slug) !== client.slug) {
    result.fail('meta-slug', `meta.json client.slug "${client.slug}" is not kebab-case ("${kebab(client.slug)}")`);
  }
  if (typeof project.slug === 'string' && project.slug && kebab(project.slug) !== project.slug) {
    result.fail('meta-slug', `meta.json project.slug "${project.slug}" is not kebab-case ("${kebab(project.slug)}")`);
  }

  // When the output dir is a real run directory (runs/<slug>/<date>/), meta must
  // agree with it — this is what keeps the wiki, the graph, and captures'
  // provenance.run on the same project-slug. Skipped for ad-hoc output dirs.
  if (path.basename(path.dirname(path.dirname(dir))) === 'runs') {
    const parent = path.basename(path.dirname(dir));
    if (typeof project.slug === 'string' && project.slug && project.slug !== parent) {
      result.fail('meta-dir', `meta.json project.slug "${project.slug}" does not match the run directory "${parent}"`);
    }
    if (typeof meta.date === 'string' && meta.date && meta.date !== path.basename(dir)) {
      result.fail('meta-dir', `meta.json date "${meta.date}" does not match the run directory "${path.basename(dir)}"`);
    }
  }
  return meta;
}

function checkReport(dir, scope, noBrain, result) {
  const file = path.join(dir, 'report.md');
  const text = isFile(file) ? readTextSafe(file) : null;
  if (text === null) {
    result.fail('report-present', 'report.md is missing or unreadable');
    return { promoted: [], candidates: [], captured: [], capturesSectionPresent: false };
  }

  const required = ['Run', 'Summary', 'Inventory', 'Gaps'];
  if (scope !== 'inventory' && !noBrain) required.push('Resolution');
  if (scope !== 'inventory') required.push('Candidates', 'Next steps');
  if (scope === 'full') required.push('Learnings', 'Captures');

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

  if (scope === 'inventory') return { promoted: [], candidates: [], captured: [], capturesSectionPresent: false };

  // Read Captures before the Candidates guard below. A report missing "## Candidates"
  // is already failing `report-sections`; short-circuiting here too would stack a
  // misleading "the report lists no captures" on top of the real failure.
  const capturesSection = topLevel.find((s) => s.heading === 'Captures');
  const captured = capturesSection
    ? sections(capturesSection.body, 3).map((s) => ({ canonical: s.heading }))
    : [];
  const capturesSectionPresent = Boolean(capturesSection);

  const candidatesSection = topLevel.find((s) => s.heading === 'Candidates');
  if (!candidatesSection) return { promoted: [], candidates: [], captured, capturesSectionPresent };

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

  return { promoted: candidates.filter((c) => c.verdict === 'promote'), candidates, captured, capturesSectionPresent };
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

  if (type === CAPTURE_TYPE) {
    // The required-heading loop above is a substring test, so "## Canonical name"
    // satisfies it. Say which of the two is actually wrong rather than reporting a
    // missing bolded line when the heading itself is the defect.
    const canonicalSection = sections(text, 2).find((s) => s.heading === 'Canonical');
    const parsed = canonicalSection ? parseCanonicalLine(canonicalSection.body) : null;
    if (!parsed) {
      result.fail(
        'capture-canonical',
        canonicalSection
          ? `${name} does not open "## Canonical" with a "**Name** (\`slug\`)" line`
          : `${name} has no "## Canonical" section (the heading must match exactly)`,
      );
    } else {
      const expected = kebab(parsed.canonical);
      const stem = path.basename(file, '.md');
      if (parsed.slug !== expected || stem !== expected) {
        result.fail(
          'capture-canonical',
          `${name} declares canonical "${parsed.canonical}" (kebab: "${expected}") but its slug is "${parsed.slug}" and its filename is "${stem}.md" — all three must agree`,
        );
      }
    }
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
      // A new-pattern proposal whose canonical already exists is one of two things: a
      // duplicate (the run proposed something the catalog already names — a real error),
      // or a proposal that has since been promoted and is kept as the run's record. An
      // "## Applied" section is the author's assertion of the latter, so with it a
      // catalog match is expected and without it a match is a collision. The mirror also
      // holds: a proposal marked applied whose canonical is absent is a false claim — the
      // promotion never landed, or was reverted.
      const applied = sections(text, 2).some((s) => s.heading === 'Applied');
      if (clash && !applied) {
        result.fail(
          'proposal-collision',
          `${name} proposes "${entry.name}" but the catalog already has "${clash.name}" (${clash.slug}). If this proposal was promoted, add an "## Applied" section to record it; otherwise it duplicates an existing canonical.`,
        );
      } else if (applied && !clash) {
        result.fail(
          'proposal-applied',
          `${name} is marked "## Applied" but its canonical "${entry.name}" is not in the catalog — the promotion did not land, or was reverted.`,
        );
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

/**
 * Two-way parity between the report's "## Captures" entries and `captures/`, plus
 * the per-file shape check.
 *
 * Mirrors `checkProposals`. A capture the report does not list is how a component
 * reaches ui-design-library with no evidence behind it, and a listed capture with no
 * file is a claim the run cannot support — both are failures, in both directions.
 */
function checkCaptures(dir, captured, capturesSectionPresent, result) {
  const capturesDir = path.join(dir, 'captures');
  const files = isDir(capturesDir)
    ? listEntries(capturesDir).filter((e) => !e.dir && e.name.endsWith('.md'))
    : [];

  if (isDir(capturesDir) && files.length === 0) {
    // Warn, then continue: a report claiming three captures against an empty
    // directory should name all three, not stop at "the directory is empty".
    result.warn('capture-empty', 'captures/ exists but contains no capture files');
  }

  if (captured.length === 0) {
    // A missing "## Captures" heading already failed `report-sections`. Reporting
    // parity against a section that is not there stacks a second failure on one
    // cause — the same stacking the Candidates path deliberately avoids.
    if (files.length > 0 && capturesSectionPresent) {
      result.fail('capture-parity', `captures/ has ${files.length} file(s) but the report's "## Captures" section lists none`);
    }
    return;
  }

  if (!isDir(capturesDir)) {
    result.fail('capture-parity', `report lists ${captured.length} capture(s) but there is no captures/ directory`);
    return;
  }

  const byName = new Map(files.map((f) => [f.name, f.path]));
  // Track what each entry claimed separately from what is left unclaimed. Deleting
  // straight out of `byName` would make a second "### Badge" report its file as
  // missing while the file sits right there, sending the reader to fix the wrong
  // thing and never naming the duplicate.
  const claimed = new Set();
  for (const entry of captured) {
    const expected = `${kebab(entry.canonical)}.md`;
    if (claimed.has(expected)) {
      result.fail('capture-parity', `"## Captures" lists more than one entry resolving to captures/${expected} (last was "${entry.canonical}")`);
      continue;
    }
    if (!byName.has(expected)) {
      result.fail('capture-parity', `capture "${entry.canonical}" has no captures/${expected}`);
      continue;
    }
    claimed.add(expected);
    byName.delete(expected);
  }
  for (const orphan of byName.keys()) {
    result.fail('capture-parity', `captures/${orphan} has no matching entry under "## Captures" in report.md`);
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
  // Identity is required wherever the run has candidates (full and candidates
  // scopes); an inventory-only run has no client wiki to feed.
  if (scope !== 'inventory') checkMeta(dir, scope, result);

  const { promoted, captured, capturesSectionPresent } = checkReport(dir, scope, noBrain, result);

  if (scope === 'full') {
    checkProposals(dir, promoted, manifestEntries, result);
    checkCaptures(dir, captured, capturesSectionPresent, result);
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
