'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { run, runJson, fixture } = require('./helpers.cjs');

const PROJECT = fixture('fake-project');
const BARE = fixture('fake-project-bare');

function inventory(project) {
  const result = runJson('inventory.cjs', ['--project', project]);
  assert.equal(result.status, 0, `expected exit 0, got ${result.status}: ${result.stderr}`);
  assert.ok(result.json, 'expected JSON on stdout');
  return result.json;
}

test('artifacts mode is detected when pipeline evidence exists', () => {
  const inv = inventory(PROJECT);
  assert.equal(inv.schemaVersion, 1);
  assert.equal(inv.mode, 'artifacts');
  assert.deepEqual(inv.warnings, [], 'a complete fixture project should produce no warnings');
  assert.equal(inv.config.present, true);
  assert.equal(inv.config.artifactsRoot, 'artifacts');
});

test('component-index entries and build-pack-only components are unioned', () => {
  const inv = inventory(PROJECT);
  // 8 from the component index + 1 build pack with no index entry.
  assert.equal(inv.counts.components, 9);
  assert.equal(inv.counts.components, inv.components.length);

  const folders = inv.components.map((c) => c.folder);
  assert.ok(folders.includes('orphan-pack'), 'a build pack without an index entry still counts as built');
  assert.deepEqual([...folders].sort(), folders, 'components are sorted by folder');
});

test('both dir-style and flat build packs are attributed', () => {
  const inv = inventory(PROJECT);
  assert.equal(inv.evidence.buildPacksDir, 2);
  assert.equal(inv.evidence.buildPacksFlat, 1);

  const modal = inv.components.find((c) => c.folder === 'modal');
  assert.equal(modal.buildPack.style, 'dir');
  assert.ok(modal.buildPack.files.includes('master.md'));

  const ribbon = inv.components.find((c) => c.folder === 'logo-ribbon');
  assert.equal(ribbon.buildPack.style, 'flat');
  assert.ok(ribbon.sources.includes('build-pack'));
});

test('a fingerprint on disk wins over a null in the component index', () => {
  const inv = inventory(PROJECT);
  const modal = inv.components.find((c) => c.folder === 'modal');
  assert.ok(modal.fingerprint, 'fingerprint.json exists on disk and must be read');
  assert.equal(modal.fingerprint.role, 'dialog');
  assert.ok(modal.sources.includes('fingerprint'));
  assert.equal(inv.evidence.fingerprints, 1);
});

test('project memory naming a component counts as an evidence source', () => {
  const inv = inventory(PROJECT);
  const ribbon = inv.components.find((c) => c.folder === 'logo-ribbon');
  // Memory says "LogoRibbon"; the folder is "logo-ribbon". Normalization must bridge them.
  assert.ok(ribbon.sources.includes('memory'), 'memory prose naming the component should be detected');

  const chip = inv.components.find((c) => c.folder === 'chip');
  assert.ok(!chip.sources.includes('memory'), 'a component memory never mentions must not gain the source');
});

test('bucket and domain carry through from the component index', () => {
  const inv = inventory(PROJECT);
  const banner = inv.components.find((c) => c.folder === 'banner');
  assert.equal(banner.bucket, 'rendering');
  assert.equal(banner.domain, 'marketing');
});

test('a project with no config or artifacts degrades to a code scan', () => {
  const inv = inventory(BARE);
  assert.equal(inv.mode, 'code-scan');

  const codes = inv.warnings.map((w) => w.code);
  assert.ok(codes.includes('no-build-config'));
  assert.ok(codes.includes('no-artifacts-root'));
  assert.ok(codes.includes('heuristic-buckets'));

  assert.equal(inv.counts.components, 1);
  const widget = inv.components[0];
  assert.equal(widget.folder, 'foo-widget');
  assert.equal(widget.name, 'FooWidget', 'the PascalCase entry file names the component');
  assert.deepEqual(widget.sources, ['code-scan']);
});

test('a missing project directory exits 3, not 1', () => {
  const result = run('inventory.cjs', ['--project', fixture('does-not-exist')]);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /not a directory/);
});

test('a missing --project exits 2 with usage', () => {
  const result = run('inventory.cjs', []);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--project is required/);
  assert.match(result.stderr, /Usage:/);
});

test('an unknown option exits 2 rather than being ignored', () => {
  const result = run('inventory.cjs', ['--project', PROJECT, '--projekt', 'typo']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown option/);
});
