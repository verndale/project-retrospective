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

test('missing source accessibility is an explicit remediation gap, never not-required', () => {
  const root = tempFixture('fake-output');
  const artifact = JSON.parse(readFile(root, 'source-parity/modal.json'));
  artifact.status = 'actionable';
  artifact.remediationStatus = 'pending';
  artifact.sourceInspection.accessibility = { status: 'not-present', paths: [] };
  artifact.accessibilityDisposition = {
    status: 'remediation-gap',
    gap: 'The source exposes no accessible name or keyboard contract; the normalized implementation must add both.',
  };
  artifact.observations[0] = {
    ...artifact.observations[0],
    comparison: 'difference',
    classification: 'semantic-public-prop',
    decision: 'accept',
    implementationStatus: 'pending',
    targetSurfaces: ['code', 'storybook'],
  };
  artifact.reviews.sourceParity.phase = 'decision';
  artifact.reviews.adversarial = { status: 'pending', evidence: [] };
  artifact.reviews.design = { status: 'pending', evidence: [] };
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  assert.equal(validate(root).status, 0, 'an explicit accessibility gap stays actionable');

  artifact.remediationStatus = 'not-required';
  artifact.status = 'cleared';
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  const invalid = validate(root);
  assert.equal(invalid.status, 1);
  assert.ok(invalid.json.issues.some((entry) => entry.code === 'accessibility-disposition'));
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
  artifact.reviews.adversarial = { status: 'pending', evidence: [] };
  artifact.reviews.design = { status: 'pending', evidence: [] };
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
  artifact.reviews.sourceParity.phase = 'decision';
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  const decisionPhase = validate(root);
  assert.equal(decisionPhase.status, 1);
  assert.ok(decisionPhase.json.issues.some((entry) => entry.code === 'source-parity-review'));

  artifact.reviews.sourceParity.phase = 'post-remediation';
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  assert.equal(validate(root).status, 0);
});

test('source-parity v2 requires an explicit interaction-state disposition', () => {
  const root = tempFixture('fake-output');
  const artifact = JSON.parse(readFile(root, 'source-parity/modal.json'));
  delete artifact.interactionStates;
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  const result = validate(root);
  assert.equal(result.status, 1);
  assert.ok(result.json.issues.some((entry) => entry.code === 'interaction-states'));
});

test('not-applicable interaction states require a reason and an empty inventory', () => {
  const valid = tempFixture('fake-output');
  const artifact = JSON.parse(readFile(valid, 'source-parity/modal.json'));
  artifact.interactionStates = {
    status: 'not-applicable',
    reason: 'The normalized component is static and exposes no interactive behavior or state.',
    states: [],
  };
  writeFile(valid, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  assert.equal(validate(valid).status, 0);

  const malformed = tempFixture('fake-output');
  const badArtifact = JSON.parse(readFile(malformed, 'source-parity/modal.json'));
  badArtifact.interactionStates = { status: 'not-applicable', reason: '', states: [{}], storyExport: 'InteractionStates' };
  writeFile(malformed, 'source-parity/modal.json', `${JSON.stringify(badArtifact, null, 2)}\n`);
  const result = validate(malformed);
  assert.equal(result.status, 1);
  assert.ok(result.json.issues.filter((entry) => entry.code === 'interaction-states').length >= 2);
});

test('runtime-only states require behavior evidence and cannot claim Figma nodes', () => {
  const root = tempFixture('fake-output');
  const artifact = JSON.parse(readFile(root, 'source-parity/modal.json'));
  const runtime = artifact.interactionStates.states.find((state) => state.classification === 'runtime-only');
  runtime.source.trigger = 'pseudo';
  runtime.reason = '';
  runtime.evidence = [];
  runtime.frameNodeId = '1:2';
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  const result = validate(root);
  assert.equal(result.status, 1);
  assert.ok(result.json.issues.some((entry) => entry.code === 'interaction-state-runtime'));
  assert.ok(result.json.issues.some((entry) => entry.code === 'interaction-state-node-ids'));
});

test('visual states require governed classifications, stable ids, and declared citations', () => {
  const root = tempFixture('fake-output');
  const artifact = JSON.parse(readFile(root, 'source-parity/modal.json'));
  const visual = artifact.interactionStates.states[0];
  visual.id = 'Open State';
  visual.classification = 'screenshot';
  visual.sourceCitationIds = ['src-missing'];
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  const result = validate(root);
  assert.equal(result.status, 1);
  assert.ok(result.json.issues.some((entry) => entry.code === 'interaction-state-id'));
  assert.ok(result.json.issues.some((entry) => entry.code === 'interaction-state-classification'));
  assert.ok(result.json.issues.some((entry) => entry.code === 'interaction-state-citations'));
});

test('legacy v1 is readable only after the matching capture is landed', () => {
  const pending = tempFixture('fake-output');
  const pendingArtifact = JSON.parse(readFile(pending, 'source-parity/modal.json'));
  pendingArtifact.schemaVersion = 1;
  delete pendingArtifact.interactionStates;
  writeFile(pending, 'source-parity/modal.json', `${JSON.stringify(pendingArtifact, null, 2)}\n`);
  const pendingResult = validate(pending);
  assert.equal(pendingResult.status, 1);
  assert.ok(pendingResult.json.issues.some((entry) => entry.code === 'artifact-schema'));

  const landed = tempFixture('fake-output');
  const landedArtifact = JSON.parse(readFile(landed, 'source-parity/modal.json'));
  landedArtifact.schemaVersion = 1;
  delete landedArtifact.interactionStates;
  writeFile(landed, 'source-parity/modal.json', `${JSON.stringify(landedArtifact, null, 2)}\n`);
  writeFile(
    landed,
    'captures/modal.md',
    `${readFile(landed, 'captures/modal.md')}\n## Applied\n\n\`\`\`json\n{ "status": "landed" }\n\`\`\`\n`,
  );
  assert.equal(validate(landed).status, 0);
});

test('source citations reject traversal, alternate path spellings, Windows roots, and control bytes', () => {
  for (const unsafe of ['../secret.tsx', './src/Modal.tsx', 'C:/private/Modal.tsx', 'src/Modal\u0000.tsx']) {
    const root = tempFixture('fake-output');
    const artifact = JSON.parse(readFile(root, 'source-parity/modal.json'));
    artifact.sourceSnapshot.citations[0].path = unsafe;
    writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
    const result = validate(root);
    assert.equal(result.status, 1, `${JSON.stringify(unsafe)} must fail deterministically`);
    assert.ok(result.json.issues.some((entry) => entry.code === 'source-citations'));
  }
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

test('legacy-untracked verification hashes the current non-symlink tree and validates ranges', () => {
  const root = tempFixture('fake-output');
  const project = path.join(root, 'unversioned-project');
  const sourcePath = path.join(project, 'src/components/ui/modal/Modal.tsx');
  const source = 'export const Modal = () => null;\n';
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, source);

  const artifact = JSON.parse(readFile(root, 'source-parity/modal.json'));
  artifact.sourceSnapshot.revision = {
    strategy: 'legacy-untracked',
    commit: null,
    inventoryGeneratedAt: '2026-01-01T00:00:00.000Z',
  };
  artifact.sourceSnapshot.citations[0].endLine = 1;
  artifact.sourceSnapshot.citations[0].sha256 = crypto.createHash('sha256').update(source).digest('hex');
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);

  const verified = validate(root, ['--project', project, '--verify-source']);
  assert.equal(verified.status, 0, verified.stderr || verified.stdout);
  assert.ok(verified.json.warnings.some((entry) => entry.code === 'source-unversioned-current-tree'));

  fs.writeFileSync(sourcePath, `${source}// changed\n`);
  const changed = validate(root, ['--project', project, '--verify-source']);
  assert.equal(changed.status, 1);
  assert.ok(changed.json.issues.some((entry) => entry.code === 'source-hash'));
});

test('legacy-untracked verification rejects symlinked source paths', () => {
  const root = tempFixture('fake-output');
  const project = path.join(root, 'unversioned-project');
  const sourceDir = path.join(project, 'src/components/ui');
  const realDir = path.join(project, 'real-modal');
  const source = 'export const Modal = () => null;\n';
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(realDir, { recursive: true });
  fs.writeFileSync(path.join(realDir, 'Modal.tsx'), source);
  fs.symlinkSync(realDir, path.join(sourceDir, 'modal'));

  const artifact = JSON.parse(readFile(root, 'source-parity/modal.json'));
  artifact.sourceSnapshot.citations[0].endLine = 1;
  artifact.sourceSnapshot.citations[0].sha256 = crypto.createHash('sha256').update(source).digest('hex');
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);

  const result = validate(root, ['--project', project, '--verify-source']);
  assert.equal(result.status, 1);
  assert.ok(result.json.issues.some((entry) =>
    entry.code === 'source-hash' && entry.message.includes('symlink segment is not verifiable')));
});
