#!/usr/bin/env node
/**
 * capture-preflight.cjs — can these captures be applied to this library checkout?
 *
 * Reads a run's whole `captures/` directory, checks every capture against the
 * ui-design-brain manifest and the state of a local ui-design-library checkout,
 * and emits one plan covering all of them: which are ready to execute, which are
 * blocked and why, and which are already applied. For each ready capture it emits
 * the exact `component.json` object to write, in that repo's key order.
 *
 * What it deliberately does NOT do:
 *   - Write into the library. Not one byte. Executing a capture is a rewrite, not
 *     a copy, so the implementation, the stories, and the `declienting` record are
 *     the model's to author. A scaffolded component.json alone would leave the
 *     library failing its own contracts until the rewrite landed.
 *   - Spawn `pnpm contracts` or anything else. This pre-flights the inputs to that
 *     checker so a rewrite is not wasted; it does not restate its verdicts, and it
 *     stays runnable with no node_modules anywhere.
 *
 * Usage:
 *   node capture-preflight.cjs --captures <dir> --library <dir>
 *                              [--brain <dir> | --manifest <file>]
 *                              [--out <file>] [--pretty]
 *
 * Exit codes:
 *   0  every capture is ready or already applied
 *   1  one or more captures are blocked, or an unexpected failure
 *   2  invalid invocation
 *   3  --captures is missing or is not a directory
 *   4  --library is missing or is not a ui-design-library checkout
 *   5  the manifest is missing, unreadable, or structurally invalid
 *
 * A missing manifest is the one input that degrades rather than fails: without
 * --brain or --manifest the run records a warning and skips the catalog check.
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
  normalizeLabel,
  kebab,
  sections,
  fencedBlock,
  parseCanonicalLine,
  Warnings,
  writeOut,
  usage,
} = require('./lib/util.cjs');

const USAGE = [
  'Usage: node capture-preflight.cjs --captures <dir> --library <dir> [--brain <dir> | --manifest <file>] [--out <file>] [--pretty]',
  '',
  "  --captures  A run's captures/ directory, applied as a set (required)",
  '  --library   Local ui-design-library checkout (required)',
  '  --brain     Local ui-design-brain checkout, for the canonical check',
  '  --manifest  patterns-manifest.json directly; wins over --brain',
  '  --out       Write the plan to a file instead of stdout',
  '  --pretty    Indent the JSON output',
];

const MANIFEST_REL = 'skills/ui-design-brain/patterns-manifest.json';
const CAPTURE_TYPE = 'component-capture';

// Semantic tokens are declared in component.json without the leading dashes, so
// harvest the names the same way the library's own contract checker does.
const TOKEN_DECL_RE = /^\s*--([a-z0-9-]+):/gm;

// ui-design-library's own kebab lacks the acronym split and the accent fold that
// normalizeLabel applies. No canonical in the catalog triggers the difference
// today, but a capture that did would produce a directory this repo and that one
// disagree about — cheap to detect here, expensive to find there.
function libraryKebab(input) {
  return String(input)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function fail(code, message) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(code);
}

/**
 * Load the patterns manifest, or return null when none was requested.
 *
 * Strict when a path was given: a structurally broken manifest makes every
 * canonical check meaningless, so exiting beats reporting confident nonsense.
 */
function loadManifest(manifestPath, warnings) {
  if (!manifestPath) {
    warnings.add(
      'manifest-absent',
      'No --brain or --manifest given, so no capture was checked against the catalog. Canonical names are taken on trust.',
    );
    return null;
  }
  if (!isFile(manifestPath)) fail(5, `manifest not found: ${manifestPath}`);
  const read = readJsonSafe(manifestPath);
  if (!read.ok) fail(5, `manifest could not be parsed: ${read.error}`);
  const entries = read.value;
  if (!Array.isArray(entries)) fail(5, 'manifest must be a top-level JSON array');
  entries.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object' || typeof entry.name !== 'string' || !entry.name) {
      fail(5, `manifest entry ${i} has no string "name"`);
    }
  });
  return entries;
}

/** Semantic token names the library defines, without the leading `--`. */
function loadTokens(libraryDir, warnings) {
  const tokensPath = path.join(libraryDir, 'src/tokens/semantic.css');
  const css = readTextSafe(tokensPath, 2 * 1024 * 1024, warnings);
  if (css === null) {
    warnings.add(
      'tokens-unreadable',
      `${tokensPath} could not be read, so declared tokens were not checked against the semantic layer.`,
    );
    return null;
  }
  const names = new Set();
  for (const match of css.matchAll(TOKEN_DECL_RE)) names.add(match[1]);
  return names;
}

/** What `components/<slug>/` currently holds, if anything. */
function inspectLibraryDir(libraryDir, slug) {
  const dir = path.join(libraryDir, 'components', slug);
  if (!isDir(dir)) {
    return { dir: `components/${slug}`, exists: false, has: { componentJson: false, impl: false, stories: false } };
  }
  const files = listEntries(dir).filter((e) => !e.dir).map((e) => e.name);
  return {
    dir: `components/${slug}`,
    exists: true,
    has: {
      componentJson: files.includes('component.json'),
      impl: files.some((f) => f.endsWith('.tsx') && !f.endsWith('.stories.tsx')),
      stories: files.some((f) => f.endsWith('.stories.tsx')),
    },
  };
}

/**
 * Read one capture file into a record: canonical, slug, the proposed
 * component.json, and every blocker that would waste a rewrite.
 */
function readCapture(file, ctx) {
  const name = path.basename(file.path);
  const stem = path.basename(file.path, '.md');
  const record = {
    file: name,
    canonical: null,
    slug: stem,
    status: 'blocked',
    blockers: [],
    manifest: null,
    library: null,
    componentJson: null,
    stories: null,
    tokens: { declared: [], undefined: [] },
  };
  const block = (code, message) => record.blockers.push({ code, message });

  const text = readTextSafe(file.path, 2 * 1024 * 1024, ctx.warnings);
  if (text === null) {
    ctx.warnings.add('capture-unreadable', `${name} could not be read and was skipped.`);
    block('capture-unreadable', `${name} could not be read.`);
    return record;
  }

  const topLevel = sections(text, 2);
  const typeSection = topLevel.find((s) => s.heading === 'Proposal type');
  if (!typeSection || !new RegExp(`\\b${CAPTURE_TYPE}\\b`).test(typeSection.body)) {
    block('capture-type', `${name} does not declare "## Proposal type" of ${CAPTURE_TYPE}.`);
    return record;
  }

  // Canonical, slug, filename — all three or the library gets a mis-slugged directory.
  const canonicalSection = topLevel.find((s) => s.heading === 'Canonical');
  const parsed = canonicalSection ? parseCanonicalLine(canonicalSection.body) : null;
  if (!parsed) {
    block(
      'canonical-missing',
      canonicalSection
        ? `${name} does not open "## Canonical" with a "**Name** (\`slug\`)" line.`
        : `${name} has no "## Canonical" section (the heading must match exactly).`,
    );
    return record;
  }
  const { canonical, slug: declaredSlug } = parsed;
  const expected = kebab(canonical);
  record.canonical = canonical;
  record.slug = expected;

  if (declaredSlug !== expected || stem !== expected) {
    block(
      'slug-mismatch',
      `canonical "${canonical}" kebabs to "${expected}", but the declared slug is "${declaredSlug}" and the filename is "${stem}.md" — all three must agree.`,
    );
  }
  if (libraryKebab(canonical) !== expected) {
    block(
      'kebab-divergence',
      `this repo kebabs "${canonical}" to "${expected}" but ui-design-library's own checker produces "${libraryKebab(canonical)}" — the component directory would fail its slug-equality contract.`,
    );
  }

  if (ctx.manifest) {
    const entry = ctx.manifest.find((e) => normalizeLabel(e.name) === normalizeLabel(canonical)) || null;
    record.manifest = { matched: Boolean(entry), entry };
    if (!entry) {
      block(
        'canonical-unknown',
        `"${canonical}" is not a canonical in the catalog. Promote it first — the library keys on names the catalog resolves to.`,
      );
    }
  }

  const entrySection = topLevel.find((s) => s.heading === 'Proposed library entry');
  const entryJson = entrySection ? fencedBlock(entrySection.body, 'json') : null;
  if (!entryJson) {
    block('entry-unparsable', `${name} has no fenced json block under "## Proposed library entry".`);
    return record;
  }
  let entry;
  try {
    entry = JSON.parse(entryJson);
  } catch (err) {
    block('entry-unparsable', `${name} proposed library entry is not valid JSON: ${err.message}`);
    return record;
  }
  // `null`, an array, and a bare string all parse. Reading a field off any of them
  // would throw past the top-level catch and lose the plan for every other capture
  // in the set, so reject the shape before touching it.
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    block('entry-unparsable', `${name} proposed library entry is not a JSON object.`);
    return record;
  }

  if (entry.canonical !== canonical || entry.slug !== expected) {
    block(
      'entry-disagrees',
      `the proposed entry declares "${entry.canonical}" (${entry.slug}) but "## Canonical" declares "${canonical}" (${expected}).`,
    );
  }
  if (!Array.isArray(entry.slots) || entry.slots.length === 0) {
    block('slots-empty', 'the proposed entry declares no slots; ui-design-library requires a non-empty slots array.');
  }
  for (const key of ['project', 'source']) {
    if (!entry.provenance || !entry.provenance[key]) {
      block('provenance-incomplete', `the proposed entry has no provenance.${key}, which ui-design-library requires.`);
    }
  }

  const declared = Array.isArray(entry.tokens) ? entry.tokens : [];
  record.tokens.declared = declared;
  if (ctx.tokens) {
    record.tokens.undefined = declared.filter((t) => !ctx.tokens.has(t));
    for (const token of record.tokens.undefined) {
      ctx.warnings.add(
        'token-undefined',
        `${name} declares "${token}", which the library's semantic layer does not define — add the token during the rewrite rather than inlining a value.`,
      );
    }
  }

  // Key order matches ui-design-library's own component.json so the model can
  // paste it verbatim. `declienting` is left for the rewrite to fill: it records
  // what was actually removed, which only the rewrite knows.
  record.componentJson = {
    canonical,
    slug: expected,
    framework: entry.framework || 'react',
    styling: entry.styling || 'tailwind',
    slots: Array.isArray(entry.slots) ? entry.slots : [],
    variants: Array.isArray(entry.variants) ? entry.variants : [],
    tokens: declared,
    provenance: {
      project: entry.provenance?.project ?? null,
      run: entry.provenance?.run ?? null,
      source: entry.provenance?.source ?? null,
    },
    declienting: [],
    maturity: 'candidate',
  };
  record.stories = { title: canonical, tag: 'maturity:candidate' };

  const library = inspectLibraryDir(ctx.libraryDir, expected);
  record.library = library;
  const { componentJson, impl, stories } = library.has;
  if (library.exists && componentJson && impl && stories) {
    // "Already applied" has to be decided on what the directory contains, not on
    // filenames alone: two projects capturing different canonicals that kebab to
    // the same slug would otherwise read as a no-op instead of a collision.
    const existing = readJsonSafe(path.join(ctx.libraryDir, 'components', expected, 'component.json'));
    if (!existing.ok) {
      block('library-partial', `components/${expected}/component.json exists but could not be parsed: ${existing.error}`);
    } else if (existing.value?.canonical !== canonical) {
      block(
        'slug-occupied',
        `components/${expected}/ already holds "${existing.value?.canonical}", not "${canonical}". Two canonicals kebab to the same slug — resolve it in the catalog before capturing.`,
      );
    }
    // Already applied is a no-op rather than an error — but only when nothing
    // else blocks it. A mis-slugged capture that happens to point at an occupied
    // directory is still mis-slugged, and reporting it as "already applied"
    // would hide exactly the defect this script exists to catch.
    if (record.blockers.length === 0) record.status = 'skipped';
    return record;
  }
  if (library.exists && (componentJson || impl || stories)) {
    block(
      'library-partial',
      `components/${expected}/ already exists holding only ${[componentJson && 'component.json', impl && 'an implementation', stories && 'a stories file'].filter(Boolean).join(' + ')}. Finish or remove it before applying this capture.`,
    );
  }

  if (record.blockers.length === 0) record.status = 'ready';
  return record;
}

/**
 * Library components claiming a run this capture set covers, with no capture
 * behind them — a component that reached the library with no evidence.
 */
function findOrphanedByRun(libraryDir, records, warnings) {
  const runs = new Set(
    records.map((r) => r.componentJson?.provenance?.run).filter((run) => typeof run === 'string' && run),
  );
  // `provenance.run` is not a required field, so a capture set can legitimately
  // declare none. An empty result then means "not checked", not "nothing found" —
  // say so, or the handback reports a clean bill of health for a check that never ran.
  if (runs.size === 0) {
    if (records.length > 0) {
      warnings.add(
        'orphan-check-skipped',
        'No capture declares a provenance.run, so no library component could be checked for a run it claims without evidence. An empty orphanedByRun here means the check did not run.',
      );
    }
    return [];
  }

  const captured = new Set(records.map((r) => r.slug));
  const componentsDir = path.join(libraryDir, 'components');
  const orphans = [];

  for (const entry of listEntries(componentsDir).filter((e) => e.dir)) {
    const read = readJsonSafe(path.join(entry.path, 'component.json'));
    if (!read.ok) {
      warnings.add('component-unreadable', `components/${entry.name}/component.json could not be read.`);
      continue;
    }
    const provenance = read.value?.provenance;
    if (provenance && runs.has(provenance.run) && !captured.has(entry.name)) {
      orphans.push({ slug: entry.name, provenance });
    }
  }
  return orphans;
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    keys: ['captures', 'library', 'brain', 'manifest', 'out'],
    flags: ['pretty'],
  });
  const { values } = args;

  checkArgs(args, USAGE);
  if (!values.captures) usage('--captures is required', USAGE);
  if (!values.library) usage('--library is required', USAGE);

  const capturesDir = path.resolve(values.captures);
  if (!isDir(capturesDir)) fail(3, `--captures is not a directory: ${capturesDir}`);

  const libraryDir = path.resolve(values.library);
  // Shape test, not a version check: the two paths every capture writes against.
  if (!isDir(path.join(libraryDir, 'components')) || !isFile(path.join(libraryDir, 'src/tokens/semantic.css'))) {
    fail(4, `--library is not a ui-design-library checkout (needs components/ and src/tokens/semantic.css): ${libraryDir}`);
  }

  const warnings = new Warnings();
  const manifestPath = values.manifest
    ? path.resolve(values.manifest)
    : values.brain
      ? path.resolve(values.brain, MANIFEST_REL)
      : null;
  const manifest = loadManifest(manifestPath, warnings);
  const tokens = loadTokens(libraryDir, warnings);

  const files = listEntries(capturesDir).filter((e) => !e.dir && e.name.endsWith('.md'));
  if (files.length === 0) {
    warnings.add('no-captures', `${capturesDir} contains no capture files — nothing to apply.`);
  }

  const ctx = { manifest, tokens, libraryDir, warnings };
  const components = files.map((file) => readCapture(file, ctx));
  const orphanedByRun = findOrphanedByRun(libraryDir, components, warnings);

  const counts = {
    captures: components.length,
    ready: components.filter((c) => c.status === 'ready').length,
    blocked: components.filter((c) => c.status === 'blocked').length,
    skipped: components.filter((c) => c.status === 'skipped').length,
    orphanedByRun: orphanedByRun.length,
  };

  writeOut(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      captures: capturesDir,
      library: libraryDir,
      manifest: manifest ? { path: manifestPath, entries: manifest.length } : null,
      components,
      orphanedByRun,
      counts,
      warnings: warnings.toJSON(),
    },
    values.out,
    values.pretty,
  );

  // A blocked capture is not something to shrug past: exit 0 means every capture
  // in the set can be executed as-is.
  //
  // `process.exitCode` rather than `process.exit()`: stdout is async on a pipe, and
  // exiting outright truncates it at the pipe buffer — a large plan would emit
  // syntactically broken JSON alongside a successful exit code.
  process.exitCode = counts.blocked > 0 ? 1 : 0;
}

try {
  main();
} catch (err) {
  process.stderr.write(`error: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
}
