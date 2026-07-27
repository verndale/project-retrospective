'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runJson, tempFixture, readFile, writeFile, fixture } = require('./helpers.cjs');

const BRAIN = fixture('fake-brain');
const MANIFEST = fixture('fake-brain/skills/ui-design-brain/patterns-manifest.json');

/** A captures/ directory holding just the golden modal capture. */
function tempCaptures() {
  const dir = tempFixture('fake-output');
  return path.join(dir, 'captures');
}

function preflight(captures, library, args = ['--brain', BRAIN]) {
  return runJson('capture-preflight.cjs', ['--captures', captures, '--library', library, ...args]);
}

/** The single component record in a one-capture run. */
function only(result) {
  assert.ok(result.json, `expected JSON output, got:\n${result.stdout}${result.stderr}`);
  assert.equal(result.json.components.length, 1);
  return result.json.components[0];
}

/** Assert a capture is blocked by the named code. */
function assertBlocked(result, code) {
  const record = only(result);
  assert.equal(result.status, 1, `expected exit 1, got ${result.status}`);
  assert.equal(record.status, 'blocked');
  const codes = record.blockers.map((b) => b.code);
  assert.ok(codes.includes(code), `expected blocker "${code}", got: ${JSON.stringify(record.blockers, null, 2)}`);
}

/** Rewrite the golden capture's fenced json entry. */
function patchEntry(captures, patch) {
  const text = readFile(captures, 'modal.md');
  const entry = JSON.parse(text.match(/```json\n([\s\S]*?)\n```/)[1]);
  writeFile(
    captures,
    'modal.md',
    text.replace(/```json\n[\s\S]*?\n```/, `\`\`\`json\n${JSON.stringify(patch(entry), null, 2)}\n\`\`\``),
  );
}

test('the golden captures pass preflight', () => {
  const result = preflight(tempCaptures(), fixture('fake-library'));
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}${result.stderr}`);
  const record = only(result);
  assert.equal(record.status, 'ready');
  assert.equal(record.canonical, 'Modal');
  assert.equal(record.slug, 'modal');
  assert.deepEqual(record.blockers, []);
});

test('the envelope carries the documented key order', () => {
  const result = preflight(tempCaptures(), fixture('fake-library'));
  assert.deepEqual(Object.keys(result.json), [
    'schemaVersion',
    'generatedAt',
    'captures',
    'library',
    'manifest',
    'components',
    'orphanedByRun',
    'counts',
    'warnings',
  ]);
  assert.equal(result.json.schemaVersion, 1);
  assert.deepEqual(result.json.counts, {
    captures: 1,
    ready: 1,
    blocked: 0,
    skipped: 0,
    orphanedByRun: 1,
  });
});

test('componentJson matches the library key order, with declienting left to fill', () => {
  const record = only(preflight(tempCaptures(), fixture('fake-library')));
  assert.deepEqual(Object.keys(record.componentJson), [
    'canonical',
    'slug',
    'framework',
    'styling',
    'slots',
    'variants',
    'tokens',
    'provenance',
    'declienting',
    'maturity',
  ]);
  assert.deepEqual(record.componentJson.declienting, []);
  assert.equal(record.componentJson.maturity, 'candidate');
  assert.deepEqual(record.stories, { title: 'Modal', tag: 'maturity:candidate' });
});

test('orphanedByRun names a library component claiming this run with no capture', () => {
  // The real defect: components/badge/ declares runs/fake-project/2026-01-01/ but
  // no captures/badge.md exists. components/link/ claims a different run and must
  // not appear.
  const result = preflight(tempCaptures(), fixture('fake-library'));
  assert.deepEqual(
    result.json.orphanedByRun.map((o) => o.slug),
    ['badge'],
  );
});

test('an unknown flag exits 2', () => {
  const result = preflight(tempCaptures(), fixture('fake-library'), ['--nope', 'x']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown option/);
});

test('a missing --captures directory exits 3', () => {
  const result = preflight('/does/not/exist', fixture('fake-library'));
  assert.equal(result.status, 3);
  assert.match(result.stderr, /--captures is not a directory/);
});

test('a --library that is not a library checkout exits 4', () => {
  const result = preflight(tempCaptures(), fixture('fake-project'));
  assert.equal(result.status, 4);
  assert.match(result.stderr, /not a ui-design-library checkout/);
});

test('a structurally invalid manifest exits 5', () => {
  const brain = tempFixture('fake-brain');
  writeFile(brain, 'skills/ui-design-brain/patterns-manifest.json', '{"not":"an array"}');
  const result = preflight(tempCaptures(), fixture('fake-library'), [
    '--manifest',
    path.join(brain, 'skills/ui-design-brain/patterns-manifest.json'),
  ]);
  assert.equal(result.status, 5);
  assert.match(result.stderr, /top-level JSON array/);
});

test('no --brain or --manifest degrades with a warning instead of failing', () => {
  const result = preflight(tempCaptures(), fixture('fake-library'), []);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}${result.stderr}`);
  assert.equal(result.json.manifest, null);
  assert.ok(result.json.warnings.some((w) => w.code === 'manifest-absent'));
  const record = only(result);
  assert.equal(record.status, 'ready');
  assert.ok(!record.blockers.some((b) => b.code === 'canonical-unknown'));
});

test('a canonical the catalog does not have is blocked', () => {
  const captures = tempCaptures();
  const brain = tempFixture('fake-brain');
  const manifestPath = path.join(brain, 'skills/ui-design-brain/patterns-manifest.json');
  const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).filter((e) => e.name !== 'Modal');
  fs.writeFileSync(manifestPath, JSON.stringify(entries, null, 2));
  assertBlocked(preflight(captures, fixture('fake-library'), ['--manifest', manifestPath]), 'canonical-unknown');
});

test('a capture named after the project label rather than the canonical is blocked', () => {
  // captures/tag.md declaring **Badge** — the defect the CN run actually carried.
  const captures = tempCaptures();
  const text = readFile(captures, 'modal.md')
    .replace(/\*\*Modal\*\* \(`modal`\)/, '**Badge** (`tag`)')
    .replace(/"canonical": "Modal"/, '"canonical": "Badge"')
    .replace(/"slug": "modal"/, '"slug": "badge"');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'tag.md', text);
  assertBlocked(preflight(captures, fixture('fake-library')), 'slug-mismatch');
});

test('a proposed library entry with no fenced json is blocked', () => {
  const captures = tempCaptures();
  writeFile(captures, 'modal.md', readFile(captures, 'modal.md').replace(/```json\n[\s\S]*?\n```/, '(to be written)'));
  assertBlocked(preflight(captures, fixture('fake-library')), 'entry-unparsable');
});

test('a proposed library entry missing provenance.source is blocked', () => {
  const captures = tempCaptures();
  patchEntry(captures, (entry) => {
    delete entry.provenance.source;
    return entry;
  });
  assertBlocked(preflight(captures, fixture('fake-library')), 'provenance-incomplete');
});

test('a proposed library entry with no slots is blocked', () => {
  const captures = tempCaptures();
  patchEntry(captures, (entry) => ({ ...entry, slots: [] }));
  assertBlocked(preflight(captures, fixture('fake-library')), 'slots-empty');
});

test('an entry disagreeing with the Canonical line is blocked', () => {
  const captures = tempCaptures();
  patchEntry(captures, (entry) => ({ ...entry, canonical: 'Alert', slug: 'alert' }));
  assertBlocked(preflight(captures, fixture('fake-library')), 'entry-disagrees');
});

test('a half-written component directory is blocked, not overwritten', () => {
  // components/link/ holds only a component.json in the fixture.
  const captures = tempCaptures();
  const text = readFile(captures, 'modal.md')
    .replace(/\*\*Modal\*\* \(`modal`\)/, '**Link** (`link`)')
    .replace(/"canonical": "Modal"/, '"canonical": "Link"')
    .replace(/"slug": "modal"/, '"slug": "link"');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'link.md', text);
  assertBlocked(preflight(captures, fixture('fake-library')), 'library-partial');
});

test('an already-applied capture is skipped, not blocked', () => {
  const captures = tempCaptures();
  const text = readFile(captures, 'modal.md')
    .replace(/\*\*Modal\*\* \(`modal`\)/, '**Badge** (`badge`)')
    .replace(/"canonical": "Modal"/, '"canonical": "Badge"')
    .replace(/"slug": "modal"/, '"slug": "badge"');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);
  const result = preflight(captures, fixture('fake-library'));
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}${result.stderr}`);
  assert.equal(only(result).status, 'skipped');
});

test('a token the semantic layer does not define warns but stays ready', () => {
  const captures = tempCaptures();
  patchEntry(captures, (entry) => ({ ...entry, tokens: [...entry.tokens, 'color-surface-scrim'] }));
  const result = preflight(captures, fixture('fake-library'));
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}${result.stderr}`);
  const record = only(result);
  assert.equal(record.status, 'ready');
  assert.deepEqual(record.tokens.undefined, ['color-surface-scrim']);
  assert.ok(result.json.warnings.some((w) => w.code === 'token-undefined'));
});

test('a capture that is not a component-capture is blocked', () => {
  const captures = tempCaptures();
  writeFile(captures, 'modal.md', readFile(captures, 'modal.md').replace('component-capture', 'new-pattern'));
  assertBlocked(preflight(captures, fixture('fake-library')), 'capture-type');
});

test('an empty captures directory warns and exits 0', () => {
  const captures = tempCaptures();
  fs.rmSync(path.join(captures, 'modal.md'));
  const result = preflight(captures, fixture('fake-library'));
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}${result.stderr}`);
  assert.equal(result.json.counts.captures, 0);
  assert.ok(result.json.warnings.some((w) => w.code === 'no-captures'));
});

test('the library is never written to', () => {
  // Names alone would miss a rewritten component.json or a mutated semantic.css,
  // so fingerprint the whole checkout by content.
  const library = tempFixture('fake-library');
  const snapshot = () =>
    fs
      .readdirSync(library, { recursive: true })
      .sort()
      .map((rel) => {
        const full = path.join(library, rel);
        return fs.statSync(full).isDirectory() ? `${rel}/` : `${rel}:${fs.readFileSync(full, 'utf8')}`;
      })
      .join('\n');
  const before = snapshot();
  preflight(tempCaptures(), library);
  assert.equal(snapshot(), before);
});

test('a canonical the two repos kebab differently is blocked', () => {
  // ui-design-library's own kebab lacks the acronym split, so `CTAButton` becomes
  // `ctabutton` there and `cta-button` here. No current canonical triggers it; this
  // pins the replica so a fix to one repo cannot drift the other silently.
  const captures = tempCaptures();
  const text = readFile(captures, 'modal.md')
    .replace(/\*\*Modal\*\* \(`modal`\)/, '**CTAButton** (`cta-button`)')
    .replace(/"canonical": "Modal"/, '"canonical": "CTAButton"')
    .replace(/"slug": "modal"/, '"slug": "cta-button"');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'cta-button.md', text);

  const brain = tempFixture('fake-brain');
  const manifestPath = path.join(brain, 'skills/ui-design-brain/patterns-manifest.json');
  const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  entries.push({ name: 'CTAButton', slug: 'cta-button', aliases: [], file: 'patterns/cta-button.md' });
  fs.writeFileSync(manifestPath, JSON.stringify(entries, null, 2));

  assertBlocked(preflight(captures, fixture('fake-library'), ['--manifest', manifestPath]), 'kebab-divergence');
});

test('a proposed library entry of null is blocked, not a crash', () => {
  // `null` parses, so reading a field off it would throw past the top-level catch
  // and lose the plan for every other capture in the set.
  const captures = tempCaptures();
  writeFile(captures, 'modal.md', readFile(captures, 'modal.md').replace(/```json\n[\s\S]*?\n```/, '```json\nnull\n```'));
  const result = preflight(captures, fixture('fake-library'));
  assert.ok(result.json, `expected a plan even for a null entry, got:\n${result.stdout}${result.stderr}`);
  assertBlocked(result, 'entry-unparsable');
});

test('a slug already held by a different canonical is blocked, not skipped', () => {
  // components/badge/ holds Badge. A capture of a different canonical that kebabs
  // to `badge` is a collision, not a no-op.
  const captures = tempCaptures();
  const text = readFile(captures, 'modal.md')
    .replace(/\*\*Modal\*\* \(`modal`\)/, '**Badge** (`badge`)')
    .replace(/"canonical": "Modal"/, '"canonical": "Badge"')
    .replace(/"slug": "modal"/, '"slug": "badge"');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);

  const library = tempFixture('fake-library');
  const existing = path.join(library, 'components/badge/component.json');
  const json = JSON.parse(fs.readFileSync(existing, 'utf8'));
  fs.writeFileSync(existing, JSON.stringify({ ...json, canonical: 'Chip' }, null, 2));

  assertBlocked(preflight(captures, library), 'slug-occupied');
});

test('a capture set declaring no provenance.run warns that the orphan check did not run', () => {
  const captures = tempCaptures();
  patchEntry(captures, (entry) => {
    delete entry.provenance.run;
    return entry;
  });
  const result = preflight(captures, fixture('fake-library'));
  assert.deepEqual(result.json.orphanedByRun, []);
  assert.ok(
    result.json.warnings.some((w) => w.code === 'orphan-check-skipped'),
    'an empty orphanedByRun must not read as a clean bill of health',
  );
});

test('a mixed set reports every status in one plan', () => {
  // The headline claim is "one plan covering all of them" — exercise ready,
  // blocked, and skipped together, since that combination drives the exit rule.
  const captures = tempCaptures();
  const base = readFile(captures, 'modal.md');
  const retarget = (canonical, slug) =>
    base
      .replace(/\*\*Modal\*\* \(`modal`\)/, `**${canonical}** (\`${slug}\`)`)
      .replace(/"canonical": "Modal"/, `"canonical": "${canonical}"`)
      .replace(/"slug": "modal"/, `"slug": "${slug}"`);

  writeFile(captures, 'badge.md', retarget('Badge', 'badge')); // already applied  → skipped
  writeFile(captures, 'link.md', retarget('Link', 'link')); //    partial dir      → blocked
  // modal.md stays as-is                                        //                → ready

  const result = preflight(captures, fixture('fake-library'), ['--brain', BRAIN]);
  assert.equal(result.status, 1, 'a set containing a blocked capture must exit 1');
  const byFile = Object.fromEntries(result.json.components.map((c) => [c.file, c.status]));
  assert.deepEqual(byFile, { 'badge.md': 'skipped', 'link.md': 'blocked', 'modal.md': 'ready' });
  assert.deepEqual(result.json.counts, {
    captures: 3,
    ready: 1,
    blocked: 1,
    skipped: 1,
    orphanedByRun: 0,
  });
});

test('a large plan is not truncated when piped', () => {
  // stdout is async on a pipe; exiting outright would cut the JSON mid-object
  // while still reporting a clean exit code.
  const captures = tempCaptures();
  const base = readFile(captures, 'modal.md');
  for (let i = 0; i < 70; i += 1) {
    const slug = `filler-${String(i).padStart(2, '0')}`;
    writeFile(
      captures,
      `${slug}.md`,
      base
        .replace(/\*\*Modal\*\* \(`modal`\)/, `**Filler ${i}** (\`${slug}\`)`)
        .replace(/"canonical": "Modal"/, `"canonical": "Filler ${i}"`)
        .replace(/"slug": "modal"/, `"slug": "${slug}"`),
    );
  }
  // --pretty is what SKILL.md's documented invocation uses, and it is what pushes a
  // realistic set past the 64 KB pipe buffer.
  const result = preflight(captures, fixture('fake-library'), ['--pretty']);
  assert.ok(result.stdout.length > 65536, `expected output past the 64 KB pipe buffer, got ${result.stdout.length} bytes`);
  assert.ok(result.json, 'the plan must still parse as JSON');
  assert.equal(result.json.counts.captures, 71);
});

test('--manifest wins over --brain', () => {
  const result = preflight(tempCaptures(), fixture('fake-library'), ['--brain', '/does/not/exist', '--manifest', MANIFEST]);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}${result.stderr}`);
  assert.equal(result.json.manifest.path, MANIFEST);
});
