'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, runJson, fixture } = require('./helpers.cjs');

const PROJECT = fixture('fake-project');
const BRAIN = fixture('fake-brain');
const MANIFEST = path.join(BRAIN, 'skills/ui-design-brain/patterns-manifest.json');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-resolve-'));
const INVENTORY = path.join(tmp, 'inventory.json');

test.before(() => {
  const result = run('inventory.cjs', ['--project', PROJECT, '--out', INVENTORY]);
  assert.equal(result.status, 0, `inventory failed: ${result.stderr}`);
});

function resolve(args = ['--brain', BRAIN]) {
  const result = runJson('resolve.cjs', ['--inventory', INVENTORY, ...args]);
  assert.equal(result.status, 0, `expected exit 0, got ${result.status}: ${result.stderr}`);
  assert.ok(result.json, 'expected JSON on stdout');
  return result.json;
}

function findResolved(res, label) {
  return res.resolved.find((r) => r.label === label);
}

function findUnresolved(res, normalized) {
  return res.unresolved.find((u) => u.normalized === normalized);
}

test('a canonical name resolves directly', () => {
  const res = resolve();
  const modal = findResolved(res, 'Modal');
  assert.equal(modal.canonical, 'Modal');
  assert.equal(modal.via, 'name');
  assert.equal(modal.ambiguous, false);
});

test('a plain alias resolves to its canonical', () => {
  const res = resolve();
  const chip = findResolved(res, 'Chip');
  assert.equal(chip.canonical, 'Badge');
  assert.equal(chip.via, 'alias');
  assert.equal(chip.alias, 'Chip');
});

test('camelCase splits so PascalCase labels match multi-word aliases', () => {
  const res = resolve();
  // Component "TextLink" must match the alias "Text link" on Link.
  const link = findResolved(res, 'TextLink');
  assert.ok(link, 'TextLink should resolve');
  assert.equal(link.canonical, 'Link');
  assert.equal(link.via, 'alias');
  assert.equal(link.alias, 'Text link');
});

test('a context alias owned by two canonicals is ambiguous, never guessed', () => {
  const res = resolve();
  const banner = findResolved(res, 'Banner');
  assert.equal(banner.ambiguous, true);
  assert.equal(banner.canonical, null, 'the script must not pick a canonical');
  assert.equal(banner.via, 'context-alias');

  const names = banner.candidates.map((c) => c.canonical).sort();
  assert.deepEqual(names, ['Alert', 'Hero']);
  assert.ok(banner.candidates.every((c) => typeof c.context === 'string' && c.context.length > 0));
  assert.equal(res.counts.ambiguous, 1);
});

test('novel labels are grouped with occurrences and locations', () => {
  const res = resolve();
  const ribbon = findUnresolved(res, 'logo-ribbon');
  assert.equal(ribbon.occurrences, 2, 'two components share the label LogoRibbon');
  assert.equal(ribbon.locations.length, 2);
  assert.ok(ribbon.sources.includes('build-pack'));
  assert.ok(ribbon.sources.includes('memory'));
  // Highest-occurrence label sorts first.
  assert.equal(res.unresolved[0].normalized, 'logo-ribbon');
});

test('plurals are never folded onto a canonical', () => {
  const res = resolve();
  // The catalog has "Card"; the project built "Cards". These are different labels.
  assert.ok(findUnresolved(res, 'cards'), '"Cards" must stay unresolved, not fold to "Card"');
  assert.equal(findResolved(res, 'Cards'), undefined);
});

test('no nearest-match suggestion field is emitted', () => {
  const res = resolve();
  for (const entry of res.unresolved) {
    assert.ok(!('suggestion' in entry), 'unresolved entries must not carry a guess');
    assert.ok(!('nearest' in entry));
  }
});

test('counts reconcile with the inventory', () => {
  const res = resolve();
  const inventory = JSON.parse(fs.readFileSync(INVENTORY, 'utf8'));
  assert.equal(res.counts.components, inventory.components.length);
  const unresolvedTotal = res.unresolved.reduce((sum, u) => sum + u.occurrences, 0);
  assert.equal(res.counts.components, res.counts.resolved + res.counts.ambiguous + unresolvedTotal);
  assert.equal(res.manifest.entries, 6);
});

test('--manifest is equivalent to --brain', () => {
  const viaBrain = resolve();
  const viaManifest = resolve(['--manifest', MANIFEST]);
  assert.deepEqual(viaManifest.counts, viaBrain.counts);
});

test('an invalid manifest exits 4 with the offending entry named', () => {
  const bad = path.join(tmp, 'bad-manifest.json');
  fs.writeFileSync(bad, JSON.stringify([{ name: 'Broken', slug: 'broken' }]), 'utf8');
  const result = run('resolve.cjs', ['--inventory', INVENTORY, '--manifest', bad]);
  assert.equal(result.status, 4);
  assert.match(result.stderr, /Broken/);
});

test('a manifest that is not an array exits 4', () => {
  const bad = path.join(tmp, 'object-manifest.json');
  fs.writeFileSync(bad, JSON.stringify({ patterns: [] }), 'utf8');
  const result = run('resolve.cjs', ['--inventory', INVENTORY, '--manifest', bad]);
  assert.equal(result.status, 4);
  assert.match(result.stderr, /top-level JSON array/);
});

test('a missing manifest exits 4, not 1', () => {
  const result = run('resolve.cjs', ['--inventory', INVENTORY, '--brain', fixture('no-such-brain')]);
  assert.equal(result.status, 4);
  assert.match(result.stderr, /manifest not found/);
});

test('an unsupported inventory schemaVersion exits 3', () => {
  const bad = path.join(tmp, 'future-inventory.json');
  fs.writeFileSync(bad, JSON.stringify({ schemaVersion: 99, components: [] }), 'utf8');
  const result = run('resolve.cjs', ['--inventory', bad, '--brain', BRAIN]);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /schemaVersion/);
});

test('omitting both --brain and --manifest exits 2', () => {
  const result = run('resolve.cjs', ['--inventory', INVENTORY]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--brain or --manifest/);
});

// --specs: authored functional specs as a cross-referenced evidence source.
const SPECS = path.join(tmp, 'specs.json');
test.before(() => {
  const r = run('normalize-specs.cjs', ['--raw', fixture('fake-specs', 'specs-raw.json'), '--out', SPECS]);
  assert.equal(r.status, 0, `normalize-specs failed: ${r.stderr}`);
});

test('without --specs the output has no specs key (baseline is unchanged)', () => {
  const res = resolve();
  assert.ok(!('specs' in res), 'a spec-unaware run must not carry a specs block');
  const ribbon = findUnresolved(res, 'logo-ribbon');
  assert.ok(!ribbon.sources.includes('spec'));
});

test('--specs adds spec as a second evidence source on a matched novel label', () => {
  const res = resolve(['--brain', BRAIN, '--specs', SPECS]);
  const ribbon = findUnresolved(res, 'logo-ribbon');
  assert.ok(ribbon.sources.includes('spec'), 'the approved Logo Ribbon spec should back the novel label');
});

test('--specs joins each spec to the as-built resolution and counts spec-only intent', () => {
  const res = resolve(['--brain', BRAIN, '--specs', SPECS]);
  assert.equal(res.specs.counts.total, 3);
  assert.equal(res.specs.counts.specOnly, 1, 'Highlight Panel is specced but not built');
  const modal = res.specs.entries.find((e) => e.label === 'Modal');
  assert.equal(modal.matchedResolution, 'Modal');
  assert.equal(res.specs.counts.matched, 2, 'Modal and Logo Ribbon are both built; Highlight Panel is not');
  const highlight = res.specs.entries.find((e) => e.label === 'Highlight Panel');
  assert.equal(highlight.specOnly, true);
});

test('a malformed --specs degrades to a warning, not a failure', () => {
  const bad = path.join(tmp, 'not-a-spec-pack.json');
  fs.writeFileSync(bad, JSON.stringify({ hello: 'world' }), 'utf8');
  const res = resolve(['--brain', BRAIN, '--specs', bad]);
  assert.ok(!('specs' in res), 'a broken pack yields no specs block');
  assert.ok(res.warnings.map((w) => w.code).includes('specs-unreadable'));
});

// --retrospectives: team-authored evidence only after normalizer corroboration.
const RETROSPECTIVES = path.join(tmp, 'retrospectives.json');
test.before(() => {
  fs.writeFileSync(
    RETROSPECTIVES,
    JSON.stringify({
      schemaVersion: 1,
      pages: [
        {
          pageId: 'retro-1',
          componentSignals: [
            {
              label: 'LogoRibbon',
              normalized: 'logo-ribbon',
              summary: 'The reusable logo strip avoided repeated markup.',
              corroboratingPaths: ['artifacts/build-packs/logo-ribbon/master.md'],
              strongSources: ['build-pack'],
              eligible: true,
            },
            {
              label: 'Cards',
              normalized: 'cards',
              summary: 'Context only.',
              corroboratingPaths: [],
              strongSources: [],
              eligible: false,
            },
          ],
        },
      ],
    }),
    'utf8',
  );
});

test('--retrospectives adds only eligible team-retrospective evidence', () => {
  const res = resolve(['--brain', BRAIN, '--retrospectives', RETROSPECTIVES]);
  assert.ok(findUnresolved(res, 'logo-ribbon').sources.includes('team-retrospective'));
  assert.ok(!findUnresolved(res, 'cards').sources.includes('team-retrospective'));
  assert.equal(res.retrospectives.counts.eligibleSignals, 1);
  assert.equal(res.retrospectives.counts.matchedUnresolved, 1);
});

test('a malformed --retrospectives pack warns and leaves evidence unchanged', () => {
  const bad = path.join(tmp, 'not-a-retrospective-pack.json');
  fs.writeFileSync(bad, JSON.stringify({ schemaVersion: 1, pages: 'nope' }), 'utf8');
  const res = resolve(['--brain', BRAIN, '--retrospectives', bad]);
  assert.ok(!('retrospectives' in res));
  assert.ok(!findUnresolved(res, 'logo-ribbon').sources.includes('team-retrospective'));
  assert.ok(res.warnings.some((warning) => warning.code === 'retrospectives-unreadable'));
});
