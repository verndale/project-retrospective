'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('./helpers.cjs');
const { ledgerProblems, renderLedger } = require('../../skills/project-retrospective/scripts/execution-ledger.cjs');

function tempOutput() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'retro-ledger-'));
}

function readLedger(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'execution-log.json'), 'utf8'));
}

test('init writes canonical JSON and its deterministic Markdown twin', () => {
  const dir = tempOutput();
  const result = run('execution-ledger.cjs', [
    'init', '--output', dir, '--run', 'sample-project/2026-01-01', '--publication', 'merge',
  ]);
  assert.equal(result.status, 0, result.stderr);
  const ledger = readLedger(dir);
  assert.deepEqual(ledgerProblems(ledger), []);
  assert.equal(fs.readFileSync(path.join(dir, 'execution-log.md'), 'utf8'), renderLedger(ledger));
});

test('record appends one sequenced event and an exact retry is a no-op', () => {
  const dir = tempOutput();
  assert.equal(run('execution-ledger.cjs', ['init', '--output', dir, '--run', 'sample-project/2026-01-01']).status, 0);
  const args = [
    'record', '--output', dir,
    '--id', 'analyze.inventory',
    '--phase', 'analyze',
    '--action', 'inventory',
    '--status', 'passed',
    '--summary', 'Inventoried three synthetic components.',
    '--repository', 'project',
    '--evidence', '["inventory.json","report.md"]',
  ];
  assert.equal(run('execution-ledger.cjs', args).status, 0);
  const replay = run('execution-ledger.cjs', args);
  assert.equal(replay.status, 0, replay.stderr);
  assert.match(replay.stdout, /^NOOP analyze\.inventory/m);
  const ledger = readLedger(dir);
  assert.equal(ledger.events.length, 1);
  assert.equal(ledger.events[0].sequence, 1);
  assert.deepEqual(ledger.events[0].evidence, ['inventory.json', 'report.md']);
});

test('record rejects conflicting reuse of a stable event id', () => {
  const dir = tempOutput();
  assert.equal(run('execution-ledger.cjs', ['init', '--output', dir, '--run', 'sample-project/2026-01-01']).status, 0);
  const base = [
    'record', '--output', dir, '--id', 'analyze.inventory', '--phase', 'analyze',
    '--action', 'inventory', '--status', 'passed', '--repository', 'project',
  ];
  assert.equal(run('execution-ledger.cjs', [...base, '--summary', 'First result.']).status, 0);
  const conflict = run('execution-ledger.cjs', [...base, '--summary', 'Different result.']);
  assert.equal(conflict.status, 4);
  assert.match(conflict.stderr, /already exists with different content/);
  assert.equal(readLedger(dir).events.length, 1);
});

test('finish makes complete status and remaining work unambiguous', () => {
  const dir = tempOutput();
  assert.equal(run('execution-ledger.cjs', ['init', '--output', dir, '--run', 'sample-project/2026-01-01']).status, 0);
  assert.equal(run('execution-ledger.cjs', [
    'record', '--output', dir, '--id', 'reconcile.complete', '--phase', 'reconcile',
    '--action', 'complete', '--status', 'passed', '--summary', 'All scoped work is merged.', '--repository', 'evidence',
  ]).status, 0);
  const finish = run('execution-ledger.cjs', [
    'finish', '--output', dir, '--status', 'complete', '--summary', 'The full chain completed.',
  ]);
  assert.equal(finish.status, 0, finish.stderr);
  const ledger = readLedger(dir);
  assert.equal(ledger.status, 'complete');
  assert.deepEqual(ledger.remaining, ['None.']);
  assert.match(fs.readFileSync(path.join(dir, 'execution-log.md'), 'utf8'), /Status: Complete/);
});

test('finish requires a matching blocker and explicit remaining work', () => {
  const dir = tempOutput();
  assert.equal(run('execution-ledger.cjs', ['init', '--output', dir, '--run', 'sample-project/2026-01-01']).status, 0);
  const result = run('execution-ledger.cjs', [
    'finish', '--output', dir, '--status', 'blocked', '--summary', 'A capability is unavailable.',
    '--remaining', '["Restore the required capability."]',
  ]);
  assert.equal(result.status, 4);
  assert.match(result.stderr, /must contain at least one blocked event/);
});

test('render repairs Markdown drift from the canonical JSON', () => {
  const dir = tempOutput();
  assert.equal(run('execution-ledger.cjs', ['init', '--output', dir, '--run', 'sample-project/2026-01-01']).status, 0);
  fs.writeFileSync(path.join(dir, 'execution-log.md'), 'stale\n');
  const result = run('execution-ledger.cjs', ['render', '--output', dir]);
  assert.equal(result.status, 0, result.stderr);
  const ledger = readLedger(dir);
  assert.equal(fs.readFileSync(path.join(dir, 'execution-log.md'), 'utf8'), renderLedger(ledger));
});

test('invalid invocation and missing output use documented exit codes', () => {
  assert.equal(run('execution-ledger.cjs', []).status, 2);
  assert.equal(run('execution-ledger.cjs', [
    'init', '--output', path.join(os.tmpdir(), 'retro-ledger-missing'), '--run', 'sample-project/2026-01-01',
  ]).status, 3);
});
