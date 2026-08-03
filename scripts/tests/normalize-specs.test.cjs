'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, runJson, fixture } = require('./helpers.cjs');

const RAW = fixture('fake-specs', 'specs-raw.json');

function normalize(args) {
  return runJson('normalize-specs.cjs', args);
}

function specOf(pack, label) {
  return pack.specs.find((s) => s.label === label);
}

/** Write a throwaway raw capture and return its path; caller removes the dir. */
function tempRaw(specs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-specs-'));
  const file = path.join(dir, 'specs-raw.json');
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, specs }), 'utf8');
  return { dir, file };
}

test('the component label is derived from the page title', () => {
  const r = normalize(['--raw', RAW]);
  assert.equal(r.status, 0, r.stderr);
  // "Acme Rebuild | Modal" de-clients to "Modal".
  const modal = specOf(r.json, 'Modal');
  assert.ok(modal, 'Modal should be present');
  assert.equal(modal.normalized, 'modal');
  assert.equal(modal.baseType, '_component');
});

test('the accessibility/interaction contract is lifted from Component Elements', () => {
  const r = normalize(['--raw', RAW]);
  const modal = specOf(r.json, 'Modal');
  // Both the ARIA and Keyboard bullets under "### 1. Wrapper" are captured, even
  // though they live under an H3 child of the H2 section.
  assert.equal(modal.a11y.length, 2);
  assert.ok(modal.a11y.some((b) => /role="dialog"/.test(b)));
});

test('elements the BA could not canonicalize become novelLabels', () => {
  const r = normalize(['--raw', RAW]);
  const ribbon = specOf(r.json, 'Logo Ribbon');
  assert.deepEqual(ribbon.novelLabels, ['Marquee Effect']);
  assert.equal(r.json.counts.novel, 1);
});

test('Editable Fields, variants, and composition are structured', () => {
  const r = normalize(['--raw', RAW]);
  const modal = specOf(r.json, 'Modal');
  assert.deepEqual(
    modal.fields.map((f) => f.name),
    ['Heading', 'Items'],
  );
  assert.equal(modal.fields.find((f) => f.name === 'Heading').required, true);
  assert.deepEqual(modal.variants, ['Small', 'Large']);
  // allowedTypes in a field note becomes a composition child; Used By becomes a parent.
  assert.deepEqual(modal.composition.children, ['ModalItem']);
  assert.deepEqual(modal.composition.parents, ['Page Template']);
  assert.equal(modal.dynamicData.length, 1);
  assert.equal(modal.batch, '1');
});

test('only APPROVED specs are included; others are skipped, not dropped silently', () => {
  const r = normalize(['--raw', RAW]);
  assert.equal(r.json.counts.specs, 3);
  assert.equal(r.json.counts.skipped, 1);
  assert.equal(r.json.mode, 'approved-only');
  assert.equal(r.json.skipped[0].documentStatus, 'DRAFT');
  assert.equal(specOf(r.json, 'Draft Card'), undefined);
});

test('a skipped spec does not leak section warnings', () => {
  const r = normalize(['--raw', RAW]);
  // The DRAFT Card has no Component Elements, but it is skipped, so its
  // section-missing warnings must not appear.
  assert.deepEqual(r.json.warnings, []);
});

test('a title with no "|" separator uses the whole title and warns', () => {
  const { dir, file } = tempRaw([
    { pageId: '1', title: 'Standalone Widget', documentStatus: 'APPROVED', bodyMarkdown: '## Overview\n\nNo client prefix.\n' },
  ]);
  try {
    const r = normalize(['--raw', file]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(specOf(r.json, 'Standalone Widget'));
    assert.ok(r.json.warnings.map((w) => w.code).includes('title-no-separator'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--archive byte-copies each approved spec near-raw', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-specs-dest-'));
  try {
    const source = path.join(dest, 'source');
    const r = normalize(['--raw', RAW, '--archive', source]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.counts.archived, 3);
    assert.ok(fs.existsSync(path.join(source, 'modal.md')));
    assert.match(fs.readFileSync(path.join(source, 'modal.md'), 'utf8'), /role="dialog"/);
  } finally {
    fs.rmSync(dest, { recursive: true, force: true });
  }
});

test('a missing Component Elements section degrades with a warning, not a crash', () => {
  const { dir, file } = tempRaw([
    {
      pageId: '1',
      title: 'Acme | Thin Spec',
      documentStatus: 'APPROVED',
      bodyMarkdown: '## Overview\n\nA spec with no elements or fields.\n',
    },
  ]);
  try {
    const r = normalize(['--raw', file]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.counts.specs, 1);
    assert.ok(r.json.warnings.map((w) => w.code).includes('section-missing'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--status-gate can widen the gate beyond approved', () => {
  const r = normalize(['--raw', RAW, '--status-gate', 'draft']);
  // Only the DRAFT spec clears a draft gate.
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.json.statusGate, 'DRAFT');
  assert.equal(r.json.counts.specs, 1);
  assert.equal(r.json.specs[0].label, 'Draft Card');
});

test('--archive never overwrites when two specs share a kebab label', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-specs-collide-'));
  const { dir, file } = tempRaw([
    { title: 'Acme | Modal', documentStatus: 'APPROVED', bodyMarkdown: '## Overview\n\nFirst modal.\n' },
    { title: 'Acme | Modal', documentStatus: 'APPROVED', bodyMarkdown: '## Overview\n\nSecond modal.\n' },
  ]);
  try {
    const source = path.join(dest, 'source');
    const r = normalize(['--raw', file, '--archive', source]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.counts.archived, 2);
    const names = r.json.specs.map((s) => s.archived);
    assert.equal(new Set(names).size, 2, 'archived filenames must be unique');
    const onDisk = fs.readdirSync(source).filter((f) => f.endsWith('.md'));
    assert.equal(onDisk.length, 2, 'both specs must land on disk — neither overwritten');
  } finally {
    fs.rmSync(dest, { recursive: true, force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Document Status is read from the properties table even when it is not the first table', () => {
  const { dir, file } = tempRaw([
    {
      pageId: '9',
      title: 'Acme | Reordered',
      bodyMarkdown:
        '## Component Content\n\n### Editable Fields\n\n| Field Name | Field Type | Required | Notes |\n| --- | --- | --- | --- |\n| Heading | string | Yes | h2 |\n\n## Properties\n\n| Batch | 1 |\n| --- | --- |\n| Document Status | APPROVED |\n',
    },
  ]);
  try {
    const r = normalize(['--raw', file]);
    assert.equal(r.status, 0, r.stderr);
    // With positional detection the Editable Fields table would be misread as
    // properties, the status would parse empty, and the spec would be skipped.
    assert.equal(r.json.counts.specs, 1);
    assert.equal(r.json.counts.skipped, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a missing --raw exits 2', () => {
  const r = run('normalize-specs.cjs', []);
  assert.equal(r.status, 2);
});

test('a --raw file that does not exist exits 3', () => {
  const r = run('normalize-specs.cjs', ['--raw', fixture('fake-specs', 'no-such.json')]);
  assert.equal(r.status, 3);
});

test('an unsupported raw schemaVersion exits 3', () => {
  const { dir, file } = tempRaw([]);
  try {
    fs.writeFileSync(file, JSON.stringify({ schemaVersion: 99, specs: [] }), 'utf8');
    const r = run('normalize-specs.cjs', ['--raw', file]);
    assert.equal(r.status, 3);
    assert.match(r.stderr, /schemaVersion/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
