'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { runJson, tempFixture, readFile, writeFile } = require('./helpers.cjs');

function validate(root, args = []) {
  return runJson('source-parity.cjs', [
    '--source-parity', path.join(root, 'source-parity'),
    '--captures', path.join(root, 'captures'),
    ...args,
  ]);
}

test('the synthetic capture has one valid source-parity companion', () => {
  const root = tempFixture('fake-output');
  const result = validate(root);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(result.json.counts, { artifacts: 1, actionable: 0, cleared: 1 });
  assert.deepEqual(result.json.issues, []);
});

test('capture-to-artifact cardinality is exact in both directions', () => {
  const missing = tempFixture('fake-output');
  fs.rmSync(path.join(missing, 'source-parity/modal.json'));
  assert.equal(validate(missing).status, 1);

  const orphan = tempFixture('fake-output');
  writeFile(orphan, 'source-parity/orphan.json', readFile(orphan, 'source-parity/modal.json').replaceAll('modal', 'orphan'));
  const result = validate(orphan);
  assert.equal(result.status, 1);
  assert.ok(result.json.issues.some((entry) => entry.code === 'source-parity-cardinality'));
});

test('differences require a governed classification and accepted target surface', () => {
  const root = tempFixture('fake-output');
  const artifact = JSON.parse(readFile(root, 'source-parity/modal.json'));
  artifact.status = 'actionable';
  artifact.remediationStatus = 'pending';
  artifact.observations[0] = {
    ...artifact.observations[0],
    comparison: 'difference',
    classification: 'semantic-public-prop',
    decision: 'accept',
    implementationStatus: 'pending',
    targetSurfaces: [],
  };
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  const result = validate(root);
  assert.equal(result.status, 1);
  assert.ok(result.json.issues.some((entry) => entry.code === 'target-surfaces'));
});

test('intentional de-clienting cannot smuggle remediation targets', () => {
  const root = tempFixture('fake-output');
  const artifact = JSON.parse(readFile(root, 'source-parity/modal.json'));
  artifact.observations[0] = {
    ...artifact.observations[0],
    comparison: 'difference',
    classification: 'intentional-declienting',
    decision: 'document',
    implementationStatus: 'not-required',
    targetSurfaces: ['code'],
  };
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  const result = validate(root);
  assert.equal(result.status, 1);
  assert.ok(result.json.issues.some((entry) => entry.code === 'target-surfaces'));
});

test('every governed source inspection category is explicit and grounded by paths', () => {
  const missing = tempFixture('fake-output');
  const missingArtifact = JSON.parse(readFile(missing, 'source-parity/modal.json'));
  delete missingArtifact.sourceInspection.tests;
  writeFile(missing, 'source-parity/modal.json', `${JSON.stringify(missingArtifact, null, 2)}\n`);
  assert.ok(validate(missing).json.issues.some((entry) => entry.code === 'source-inspection'));

  const vacuous = tempFixture('fake-output');
  const vacuousArtifact = JSON.parse(readFile(vacuous, 'source-parity/modal.json'));
  vacuousArtifact.sourceInspection.entryPoints.paths = [];
  writeFile(vacuous, 'source-parity/modal.json', `${JSON.stringify(vacuousArtifact, null, 2)}\n`);
  assert.ok(validate(vacuous).json.issues.some((entry) => entry.code === 'source-inspection'));
});

test('accepted decisions require explicit implementation status and completed review evidence', () => {
  const root = tempFixture('fake-output');
  const artifact = JSON.parse(readFile(root, 'source-parity/modal.json'));
  artifact.status = 'cleared';
  artifact.remediationStatus = 'complete';
  artifact.observations[0] = {
    ...artifact.observations[0],
    comparison: 'difference',
    classification: 'semantic-public-prop',
    decision: 'accept',
    implementationStatus: 'complete',
    targetSurfaces: ['code'],
  };
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  const result = validate(root);
  assert.equal(result.status, 1);
  assert.ok(result.json.issues.some((entry) => entry.code === 'review-status'));
});

test('completed remediation requires a post-remediation source-parity pass', () => {
  const root = tempFixture('fake-output');
  const artifact = JSON.parse(readFile(root, 'source-parity/modal.json'));
  artifact.status = 'cleared';
  artifact.remediationStatus = 'complete';
  artifact.observations[0] = {
    ...artifact.observations[0],
    comparison: 'difference',
    classification: 'semantic-public-prop',
    decision: 'accept',
    implementationStatus: 'complete',
    targetSurfaces: ['code'],
  };
  artifact.reviews.adversarial = { status: 'passed', evidence: ['review/adversarial.md'] };
  artifact.reviews.design = { status: 'passed', evidence: ['review/design.md'] };
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  const decisionPhase = validate(root);
  assert.equal(decisionPhase.status, 1);
  assert.ok(decisionPhase.json.issues.some((entry) => entry.code === 'source-parity-review'));

  artifact.reviews.sourceParity.phase = 'post-remediation';
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  assert.equal(validate(root).status, 0);
});

test('source citations cannot escape the analyzed repository', () => {
  const root = tempFixture('fake-output');
  const artifact = JSON.parse(readFile(root, 'source-parity/modal.json'));
  artifact.sourceSnapshot.citations[0].path = '../secret.tsx';
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  const result = validate(root);
  assert.equal(result.status, 1);
  assert.ok(result.json.issues.some((entry) => entry.code === 'source-citations'));
});

test('verified citation ranges cannot extend beyond the pinned file', () => {
  const root = tempFixture('fake-output');
  const project = path.join(root, 'project');
  const sourcePath = path.join(project, 'src/components/ui/modal/Modal.tsx');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  const source = 'export const Modal = () => null;\n';
  fs.writeFileSync(sourcePath, source);
  for (const args of [
    ['init', '-q'],
    ['config', 'user.email', 'fixture@example.test'],
    ['config', 'user.name', 'Fixture'],
    ['add', '.'],
    ['commit', '-qm', 'fixture'],
  ]) {
    assert.equal(spawnSync('git', ['-C', project, ...args]).status, 0);
  }
  const commit = spawnSync('git', ['-C', project, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const artifact = JSON.parse(readFile(root, 'source-parity/modal.json'));
  artifact.sourceSnapshot.revision = {
    strategy: 'recorded',
    commit,
    inventoryGeneratedAt: '2026-01-01T00:00:00.000Z',
  };
  artifact.sourceSnapshot.citations[0].endLine = 99;
  artifact.sourceSnapshot.citations[0].sha256 = crypto.createHash('sha256').update(source).digest('hex');
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  const result = validate(root, ['--project', project, '--verify-source']);
  assert.equal(result.status, 1);
  assert.ok(result.json.issues.some((entry) => entry.code === 'source-citations' && entry.message.includes('beyond pinned file length')));
});
