'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('./helpers.cjs');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-register-'));
  const actions = path.join(dir, 'actions.json');
  const out = path.join(dir, 'register.md');
  fs.writeFileSync(
    actions,
    JSON.stringify({
      schemaVersion: 1,
      actions: [
        {
          id: 'retro-action-123456789abc',
          title: 'Assign release ownership',
          summary: 'Name the role responsible for the release checklist.',
          sourcePageIds: ['42'],
          destination: 'project',
          owner: null,
          nextStep: 'Assign the delivery lead.',
          status: 'needs-owner',
          evidence: null,
          rationale: null,
        },
      ],
    }),
  );
  const args = [
    '--actions', actions,
    '--client-slug', 'sample',
    '--project-slug', 'sample-project',
    '--run', 'runs/sample-project/2026-08-09/',
    '--out', out,
  ];
  return { dir, actions, out, args };
}

test('renders needs-owner first with source provenance', () => {
  const f = setup();
  try {
    const result = run('update-retrospective-register.cjs', f.args);
    assert.equal(result.status, 0, result.stderr);
    const text = fs.readFileSync(f.out, 'utf8');
    assert.ok(text.indexOf('## Needs owner') < text.indexOf('## Open'));
    assert.match(text, /### retro-action-123456789abc — Assign release ownership/);
    assert.match(text, /- Owner: unassigned/);
    assert.match(text, /- Source runs: runs\/sample-project\/2026-08-09\//);
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test('preserves human lifecycle edits while adding a later source run', () => {
  const f = setup();
  try {
    assert.equal(run('update-retrospective-register.cjs', f.args).status, 0);
    let text = fs.readFileSync(f.out, 'utf8');
    text = text
      .replace('- Status: needs-owner', '- Status: in-progress')
      .replace('- Owner: unassigned', '- Owner: delivery')
      .replace('- Evidence: none', '- Evidence: https://example.test/issues/1');
    fs.writeFileSync(f.out, text);
    const nextArgs = f.args.map((arg) => (arg === 'runs/sample-project/2026-08-09/' ? 'runs/sample-project/2026-08-10/' : arg));
    const result = run('update-retrospective-register.cjs', nextArgs);
    assert.equal(result.status, 0, result.stderr);
    text = fs.readFileSync(f.out, 'utf8');
    assert.match(text, /## In progress[\s\S]*- Status: in-progress/);
    assert.match(text, /- Owner: delivery/);
    assert.match(text, /- Evidence: https:\/\/example\.test\/issues\/1/);
    assert.match(text, /- Source runs: runs\/sample-project\/2026-08-09\/, runs\/sample-project\/2026-08-10\//);
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test('can attach the approved private issue url', () => {
  const f = setup();
  try {
    const result = run('update-retrospective-register.cjs', [...f.args, '--issue-url', 'https://example.test/issues/2']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(fs.readFileSync(f.out, 'utf8'), /- Issue: https:\/\/example\.test\/issues\/2/);
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test('malformed action packs exit 3', () => {
  const f = setup();
  try {
    fs.writeFileSync(f.actions, JSON.stringify({ schemaVersion: 2, actions: [] }));
    const result = run('update-retrospective-register.cjs', f.args);
    assert.equal(result.status, 3);
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});
