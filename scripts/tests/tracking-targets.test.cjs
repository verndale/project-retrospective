'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runJson } = require('./helpers.cjs');

const READY_REPOS = {
  'project-retrospective': { authenticated: true, labelsReady: true, mainClean: true, mainAligned: true },
  evidence: { authenticated: true, labelsReady: true, mainClean: true, mainAligned: true },
  brain: { authenticated: true, labelsReady: true, mainClean: true, mainAligned: true },
  library: { authenticated: true, labelsReady: true, mainClean: true, mainAligned: true },
};

function resolve(snapshot) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracking-targets-'));
  const input = path.join(dir, 'input.json');
  fs.writeFileSync(input, `${JSON.stringify(snapshot)}\n`);
  return runJson('tracking-targets.cjs', ['--input', input]);
}

function base(action) {
  return {
    action,
    project: 'synthetic-shop',
    date: '2026-08-19',
    evidenceCheckout: true,
    repositories: READY_REPOS,
    existingIssues: {
      'project-retrospective': { number: 5, url: 'https://example.test/project-retrospective/5' },
      evidence: { number: 10, url: 'https://example.test/evidence/10' },
      brain: { number: 20, url: 'https://example.test/brain/20' },
      library: { number: 30, url: 'https://example.test/library/30' },
    },
  };
}

test('analyze routes the run to evidence, proposals to brain, and never branches downstream', () => {
  const result = resolve({ ...base('analyze'), stage: 'postvalidate', proposals: ['proposal:banner'], captures: [] });
  assert.equal(result.status, 0);
  assert.equal(result.json.targets.evidence.state, 'issue-pending');
  assert.equal(result.json.targets.evidence.requiredWriteBranch, null);
  assert.equal(result.json.targets.brain.state, 'issue-pending');
  assert.equal(result.json.targets.brain.requiredWriteBranch, null);
  assert.equal(result.json.targets.library.state, 'skip');
});

test('source-parity audit routes foundation work and only actionable component remediation', () => {
  const result = resolve({
    ...base('source-parity-audit'),
    sourceParity: {
      contractArtifacts: ['contract:source-parity:v1'],
      evidenceArtifacts: ['audit:library-source-parity:2026-08-19'],
      governanceArtifacts: ['governance:source-parity:v1'],
      writeSets: {
        'project-retrospective': true,
        evidence: true,
        library: true,
        brain: false,
      },
      componentRemediations: [
        { id: 'carousel', status: 'actionable', writeSetNonEmpty: true },
        { id: 'modal', status: 'cleared', writeSetNonEmpty: false },
      ],
      brainCanonicals: [],
    },
    existingIssues: {
      ...base('source-parity-audit').existingIssues,
      'component:carousel': { number: 40, url: 'https://example.test/library/40' },
    },
  });
  assert.equal(result.status, 0);
  assert.equal(result.json.schemaVersion, 2);
  assert.equal(result.json.targets['project-retrospective'].requiredWriteBranch, 'feat/5-source-parity-contract');
  assert.equal(result.json.targets.evidence.requiredWriteBranch, 'feat/10-source-parity-audit');
  assert.equal(result.json.targets.library.requiredWriteBranch, 'feat/30-source-parity-governance');
  assert.equal(result.json.componentTargets.length, 1);
  assert.equal(result.json.componentTargets[0].componentKey, 'carousel');
  assert.equal(result.json.componentTargets[0].requiredWriteBranch, 'feat/40-carousel-source-parity');
  assert.equal(result.json.targets.brain.state, 'skip');
});

test('source-parity brain tracking exists only for a confirmed canonical change', () => {
  const result = resolve({
    ...base('source-parity-audit'),
    sourceParity: {
      contractArtifacts: [],
      evidenceArtifacts: [],
      governanceArtifacts: [],
      writeSets: { brain: true },
      componentRemediations: [],
      brainCanonicals: ['canonical:disclosure-rail'],
    },
  });
  assert.equal(result.json.targets.brain.requiredWriteBranch, 'feat/20-catalog-promotion');
  assert.deepEqual(result.json.componentTargets, []);
});

test('analyze with no proposals or captures creates no shared-repository work', () => {
  const result = resolve({ ...base('analyze'), stage: 'postvalidate', proposals: [], captures: [] });
  assert.equal(result.json.targets.brain.state, 'skip');
  assert.equal(result.json.targets.library.state, 'skip');
});

test('home fallback creates no evidence issue or branch', () => {
  const result = resolve({ ...base('analyze'), homeFallback: true, proposals: [] });
  assert.equal(result.json.targets.evidence.state, 'skip');
  assert.equal(result.json.targets.evidence.reason, 'home-fallback');
  assert.equal(result.json.targets.evidence.requiredWriteBranch, null);
});

test('analyze prewrite creates only the evidence branch and no premature issue', () => {
  const result = resolve({ ...base('analyze'), proposals: ['proposal:not-yet-validated'] });
  assert.equal(result.json.targets.evidence.state, 'write-ready');
  assert.equal(result.json.targets.evidence.reason, 'evidence-run-write-set');
  assert.equal(result.json.targets.evidence.issueRequired, false);
  assert.equal(result.json.targets.evidence.existingIssue, null);
  assert.equal(result.json.targets.evidence.requiredWriteBranch, 'feat/synthetic-shop-2026-08-19-run');
  assert.equal(result.json.targets.brain.state, 'skip');
});

test('retrospective ingestion is evidence-only and uses the governed run branch', () => {
  const result = resolve({ ...base('ingest-retrospectives'), proposals: ['must-not-route'] });
  assert.equal(result.json.targets.evidence.state, 'write-ready');
  assert.equal(result.json.targets.evidence.requiredWriteBranch, 'feat/synthetic-shop-2026-08-19-run');
  assert.equal(result.json.targets.brain.state, 'skip');
  assert.equal(result.json.targets.library.state, 'skip');
});

test('validated retrospective ingestion files only the evidence issue and creates no new branch', () => {
  const result = resolve({ ...base('ingest-retrospectives'), stage: 'postvalidate' });
  assert.equal(result.json.targets.evidence.state, 'issue-pending');
  assert.equal(result.json.targets.evidence.issueRequired, true);
  assert.equal(result.json.targets.evidence.requiredWriteBranch, null);
  assert.equal(result.json.targets.brain.state, 'skip');
  assert.equal(result.json.targets.library.state, 'skip');
});

test('promote creates the exact client-neutral brain branch only for an approved write set', () => {
  const result = resolve({
    ...base('promote'),
    proposals: ['proposal:banner'],
    proposalApproved: true,
    brainWriteSetNonEmpty: true,
  });
  assert.equal(result.json.targets.brain.state, 'write-ready');
  assert.equal(result.json.targets.brain.requiredWriteBranch, 'feat/20-catalog-promotion');
});

test('capture creates a library branch only for actionable work with an issue and capability', () => {
  const result = resolve({
    ...base('capture'),
    captures: [{ id: 'modal--compact', status: 'ready' }],
    libraryWriteSetNonEmpty: true,
    figmaWriteAvailable: true,
  });
  assert.equal(result.json.targets.library.state, 'write-ready');
  assert.equal(result.json.targets.library.requiredWriteBranch, 'feat/30-library-capture');
});

test('deferred, blocked, skipped, and landed captures create no issue or branch', () => {
  for (const status of ['deferred', 'blocked', 'skipped', 'landed']) {
    const result = resolve({ ...base('capture'), captures: [{ id: `modal-${status}`, status }] });
    assert.equal(result.json.targets.library.state, 'skip', status);
    assert.equal(result.json.targets.library.requiredWriteBranch, null, status);
  }
});

test('Figma unavailable keeps the issue pending and creates no empty library branch', () => {
  const result = resolve({
    ...base('capture'),
    captures: [{ id: 'modal', status: 'figma-pending' }],
    libraryWriteSetNonEmpty: true,
    figmaWriteAvailable: false,
  });
  assert.equal(result.json.targets.library.state, 'issue-pending');
  assert.equal(result.json.targets.library.requiredWriteBranch, null);
  assert.ok(result.json.targets.library.blockers.includes('figma-write-capability'));
});

test('evidence-only reconciliation creates no library branch', () => {
  const result = resolve({ ...base('capture'), captures: [{ id: 'modal', status: 'evidence-pending' }] });
  assert.equal(result.json.targets.library.state, 'skip');
  assert.equal(result.json.targets.library.reason, 'evidence-only-reconciliation');
  assert.equal(result.json.targets.evidence.state, 'write-ready');
});

test('missing issue, authentication, dirty main, and stale main stop before branch creation', () => {
  const cases = [
    { issue: null, repo: READY_REPOS.library, blocker: 'tracking-issue' },
    { issue: { number: 30 }, repo: { ...READY_REPOS.library, authenticated: false }, blocker: 'github-authentication' },
    { issue: { number: 30 }, repo: { ...READY_REPOS.library, mainClean: false }, blocker: 'dirty-main' },
    { issue: { number: 30 }, repo: { ...READY_REPOS.library, mainAligned: false }, blocker: 'stale-main' },
  ];
  for (const fixtureCase of cases) {
    const snapshot = {
      ...base('capture'),
      captures: [{ id: 'modal', status: 'ready' }],
      libraryWriteSetNonEmpty: true,
      repositories: { ...READY_REPOS, library: fixtureCase.repo },
      existingIssues: { ...base('capture').existingIssues, library: fixtureCase.issue },
    };
    const target = resolve(snapshot).json.targets.library;
    assert.equal(target.state, 'issue-pending');
    assert.equal(target.requiredWriteBranch, null);
    assert.ok(target.blockers.includes(fixtureCase.blocker));
  }
});

test('blocked repository state exposes a plan but never an executable branch instruction', () => {
  const result = resolve({
    ...base('promote'),
    proposals: ['proposal:banner'],
    proposalApproved: true,
    brainWriteSetNonEmpty: true,
    repositories: { ...READY_REPOS, brain: { ...READY_REPOS.brain, mainClean: false } },
  });
  const target = result.json.targets.brain;
  assert.equal(target.state, 'issue-pending');
  assert.equal(target.plannedWriteBranch, 'feat/20-catalog-promotion');
  assert.equal(target.requiredWriteBranch, null);
});

test('an existing exact open issue is reused in the emitted target', () => {
  const result = resolve({
    ...base('capture'),
    captures: [{ id: 'modal', status: 'ready' }],
    libraryWriteSetNonEmpty: true,
  });
  assert.deepEqual(result.json.targets.library.existingIssue, {
    number: 30,
    url: 'https://example.test/library/30',
  });
  assert.match(result.json.targets.library.issueMatchKey, /^retrospective:v1:library:[a-f0-9]{64}$/);
});

test('issue matching keys are stable for an exact artifact set and change with the work set', () => {
  const first = resolve({ ...base('analyze'), stage: 'postvalidate', proposals: ['proposal:banner', 'proposal:alert'] });
  const reordered = resolve({ ...base('analyze'), stage: 'postvalidate', proposals: ['proposal:alert', 'proposal:banner'] });
  const changed = resolve({ ...base('analyze'), stage: 'postvalidate', proposals: ['proposal:banner'] });
  assert.equal(first.json.targets.brain.issueMatchKey, reordered.json.targets.brain.issueMatchKey);
  assert.notEqual(first.json.targets.brain.issueMatchKey, changed.json.targets.brain.issueMatchKey);
});
