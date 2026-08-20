#!/usr/bin/env node
/**
 * tracking-targets.cjs — deterministic issue and local-branch routing.
 *
 * The script reads an artifact snapshot, never GitHub or the network. It emits
 * `skip`, `issue-pending`, or `write-ready` for project-retrospective, evidence,
 * brain, library, and ai-orchestration. The caller performs the sanctioned label/issue operations,
 * supplies exact open-issue matches and local-main checks, then reruns before
 * creating a branch.
 *
 * Usage:
 *   node tracking-targets.cjs --input <snapshot.json> [--out <file>] [--pretty]
 *
 * Exit codes: 0 resolved; 1 unexpected failure; 2 invalid invocation;
 * 3 input missing/unreadable/invalid.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseArgs, checkArgs, readJsonSafe, writeOut, usage } = require('./lib/util.cjs');

const USAGE = [
  'Usage: node tracking-targets.cjs --input <snapshot.json> [--out <file>] [--pretty]',
  '',
  '  --input   Artifact/repository-state snapshot (required)',
  '  --out     Write JSON to a file instead of stdout',
  '  --pretty  Indent JSON output',
];

const LABELS = {
  'project-retrospective': ['Feature', 'area:tooling'],
  evidence: ['Feature', 'area: retrospectives'],
  brain: ['Feature', 'area: catalog'],
  library: ['Feature', 'area: components'],
  'ai-orchestration': [],
};

const BRANCH_SUFFIX = {
  brain: 'catalog-promotion',
  library: 'library-capture',
};

const TERMINAL_CAPTURE_STATES = new Set(['blocked', 'skipped', 'deferred', 'landed']);
const CAPTURE_STATES = new Set([
  'ready',
  'figma-pending',
  'evidence-pending',
  ...TERMINAL_CAPTURE_STATES,
]);

function fail(code, message) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(code);
}

function strings(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim()))].sort()
    : [];
}

function issue(value) {
  if (!value || typeof value !== 'object' || !Number.isInteger(value.number) || value.number < 1) return null;
  return {
    number: value.number,
    url: typeof value.url === 'string' && value.url ? value.url : null,
  };
}

function repoReady(repo) {
  return Boolean(
    repo &&
      repo.authenticated === true &&
      repo.labelsReady === true &&
      repo.mainClean === true &&
      repo.mainAligned === true,
  );
}

function branchBlockers(repo) {
  const blockers = [];
  if (!repo || repo.authenticated !== true) blockers.push('github-authentication');
  if (!repo || repo.labelsReady !== true) blockers.push('sanctioned-labels');
  if (!repo || repo.mainClean !== true) blockers.push('dirty-main');
  if (!repo || repo.mainAligned !== true) blockers.push('stale-main');
  return blockers;
}

function issueBlockers(repo) {
  return branchBlockers(repo).filter((blocker) => ['github-authentication', 'sanctioned-labels'].includes(blocker));
}

function issueMatchKey(repository, artifacts) {
  const ids = strings(artifacts);
  if (ids.length === 0) return null;
  // Full SHA-256 keeps shared-repository keys opaque while remaining stable for
  // the exact sorted artifact set. The repository name prevents cross-repo reuse.
  const digest = crypto.createHash('sha256').update(JSON.stringify(ids)).digest('hex');
  return `retrospective:v1:${repository}:${digest}`;
}

function baseTarget(repository, artifacts = []) {
  const artifactIds = strings(artifacts);
  return {
    repository,
    state: 'skip',
    reason: 'no-pending-work',
    artifacts: artifactIds,
    labels: LABELS[repository],
    issueMatchKey: issueMatchKey(repository, artifactIds),
    issueRequired: false,
    existingIssue: null,
    plannedWriteBranch: null,
    requiredWriteBranch: null,
    blockers: [],
  };
}

function issueTarget(repository, artifacts, existingIssue, reason, repo = null) {
  const target = {
    ...baseTarget(repository, artifacts),
    state: 'issue-pending',
    reason,
    issueRequired: true,
    existingIssue: issue(existingIssue),
  };
  if (repo) target.blockers = issueBlockers(repo);
  return target;
}

function writeTarget(repository, artifacts, existingIssue, branch, repo, reason) {
  const target = issueTarget(repository, artifacts, existingIssue, reason);
  target.plannedWriteBranch = branch;
  target.blockers = branchBlockers(repo);
  if (target.existingIssue && branch && repoReady(repo)) {
    target.state = 'write-ready';
    target.requiredWriteBranch = branch;
  }
  return target;
}

function validate(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('input must be a JSON object');
  if (!['analyze', 'ingest-retrospectives', 'promote', 'capture', 'source-parity-audit'].includes(snapshot.action)) {
    throw new Error('action must be analyze, ingest-retrospectives, promote, capture, or source-parity-audit');
  }
  if (snapshot.stage !== undefined && !['prewrite', 'postvalidate'].includes(snapshot.stage)) {
    throw new Error('stage must be prewrite or postvalidate when supplied');
  }
  const captures = Array.isArray(snapshot.captures) ? snapshot.captures : [];
  for (const capture of captures) {
    if (!capture || typeof capture.id !== 'string' || !CAPTURE_STATES.has(capture.status)) {
      throw new Error('each capture requires a string id and governed status');
    }
  }
}

function computeTargets(snapshot) {
  validate(snapshot);
  const repos = snapshot.repositories || {};
  const issues = snapshot.existingIssues || {};
  const proposals = strings(snapshot.proposals);
  const captures = Array.isArray(snapshot.captures) ? snapshot.captures : [];
  const project = typeof snapshot.project === 'string' ? snapshot.project.trim() : '';
  const date = typeof snapshot.date === 'string' ? snapshot.date.trim() : '';
  const evidenceEnabled = snapshot.evidenceCheckout === true && snapshot.homeFallback !== true;
  const postvalidate = snapshot.stage === 'postvalidate';
  const targets = {
    'project-retrospective': baseTarget('project-retrospective'),
    evidence: baseTarget('evidence'),
    brain: baseTarget('brain'),
    library: baseTarget('library'),
    'ai-orchestration': baseTarget('ai-orchestration'),
  };
  targets['ai-orchestration'].reason = 'tracking-forbidden';

  if (snapshot.action === 'source-parity-audit') {
    const work = snapshot.sourceParity && typeof snapshot.sourceParity === 'object' ? snapshot.sourceParity : {};
    const definitions = [
      ['project-retrospective', strings(work.contractArtifacts), 'source-parity-contract'],
      ['evidence', strings(work.evidenceArtifacts), 'source-parity-audit'],
      ['library', strings(work.governanceArtifacts), 'source-parity-governance'],
    ];
    for (const [repository, artifacts, suffix] of definitions) {
      if (artifacts.length === 0) continue;
      const existing = issue(issues[repository]);
      const writeSet = work.writeSets?.[repository] === true;
      const branch = existing && writeSet ? `feat/${existing.number}-${suffix}` : null;
      targets[repository] = writeTarget(repository, artifacts, existing, branch, repos[repository], 'source-parity-foundation');
      if (!existing) targets[repository].blockers.unshift('tracking-issue');
      if (!writeSet) {
        targets[repository].state = 'issue-pending';
        targets[repository].requiredWriteBranch = null;
      }
    }

    const componentTargets = [];
    for (const remediation of Array.isArray(work.componentRemediations) ? work.componentRemediations : []) {
      if (!remediation || typeof remediation.id !== 'string' || remediation.status !== 'actionable') continue;
      const existing = issue(issues[`component:${remediation.id}`]);
      const writeSet = remediation.writeSetNonEmpty === true;
      const branch = existing && writeSet ? `feat/${existing.number}-${remediation.id}-source-parity` : null;
      const target = writeTarget(
        'library',
        [`remediation:${remediation.id}`],
        existing,
        branch,
        repos.library,
        'actionable-source-parity-remediation',
      );
      target.componentKey = remediation.id;
      if (!existing) target.blockers.unshift('tracking-issue');
      if (!writeSet) {
        target.state = 'issue-pending';
        target.requiredWriteBranch = null;
      }
      componentTargets.push(target);
    }

    const brainCanonicals = strings(work.brainCanonicals);
    if (brainCanonicals.length > 0) {
      const existing = issue(issues.brain);
      const branch = existing && work.writeSets?.brain === true ? `feat/${existing.number}-catalog-promotion` : null;
      targets.brain = writeTarget('brain', brainCanonicals, existing, branch, repos.brain, 'source-parity-canonical-change');
      if (!existing) targets.brain.blockers.unshift('tracking-issue');
      if (work.writeSets?.brain !== true) {
        targets.brain.state = 'issue-pending';
        targets.brain.requiredWriteBranch = null;
      }
    }
    return { schemaVersion: 2, action: snapshot.action, targets, componentTargets };
  }

  if (snapshot.action === 'analyze' || snapshot.action === 'ingest-retrospectives') {
    if (evidenceEnabled) {
      const artifacts = strings(snapshot.evidenceArtifacts || [`run:${project}:${date}`]);
      const branch = project && date ? `feat/${project}-${date}-run` : null;
      if (!branch) {
        targets.evidence.reason = 'missing-run-identity';
        targets.evidence.blockers = ['run-identity'];
      } else if (postvalidate) {
        targets.evidence = issueTarget(
          'evidence',
          artifacts,
          issues.evidence,
          'validated-evidence-run',
          repos.evidence,
        );
      } else {
        targets.evidence = {
          ...baseTarget('evidence', artifacts),
          state: repoReady(repos.evidence) ? 'write-ready' : 'issue-pending',
          reason: 'evidence-run-write-set',
          existingIssue: null,
          plannedWriteBranch: branch,
          requiredWriteBranch: repoReady(repos.evidence) ? branch : null,
          blockers: branchBlockers(repos.evidence),
        };
      }
    } else {
      targets.evidence.reason = snapshot.homeFallback === true ? 'home-fallback' : 'not-evidence-checkout';
    }
    if (postvalidate && snapshot.action === 'analyze' && proposals.length > 0) {
      targets.brain = issueTarget('brain', proposals, issues.brain, 'pending-catalog-proposals', repos.brain);
    }
    // Analyze drafts captures but never proves that a library write is actionable.
    targets.library.reason = snapshot.action === 'analyze' && captures.length > 0
      ? 'capture-preflight-required'
      : 'no-actionable-captures';
    return { schemaVersion: 2, action: snapshot.action, targets, componentTargets: [] };
  }

  if (snapshot.action === 'promote') {
    if (proposals.length > 0 && snapshot.proposalApproved === true && snapshot.brainWriteSetNonEmpty === true) {
      const existing = issue(issues.brain);
      const branch = existing ? `feat/${existing.number}-${BRANCH_SUFFIX.brain}` : null;
      targets.brain = writeTarget('brain', proposals, existing, branch, repos.brain, 'approved-catalog-write-set');
      if (!existing) targets.brain.blockers.unshift('tracking-issue');
    } else {
      targets.brain.reason = proposals.length === 0 ? 'no-pending-proposals' : 'proposal-not-write-ready';
    }
    if (evidenceEnabled && snapshot.evidenceWriteSetNonEmpty === true) {
      targets.evidence = writeTarget(
        'evidence',
        strings(snapshot.evidenceArtifacts),
        issues.evidence,
        project && date ? `feat/${project}-${date}-run` : null,
        repos.evidence,
        'applied-marker-write-set',
      );
    }
    return { schemaVersion: 2, action: snapshot.action, targets, componentTargets: [] };
  }

  const actionable = captures.filter((capture) => ['ready', 'figma-pending'].includes(capture.status));
  const reconciliation = captures.filter((capture) => capture.status === 'evidence-pending');
  if (actionable.length > 0) {
    const existing = issue(issues.library);
    const needsFigma = actionable.some((capture) => capture.status === 'figma-pending');
    const capabilityReady = !needsFigma || snapshot.figmaWriteAvailable === true;
    const branch = existing && snapshot.libraryWriteSetNonEmpty === true && capabilityReady
      ? `feat/${existing.number}-${BRANCH_SUFFIX.library}`
      : null;
    targets.library = writeTarget(
      'library',
      actionable.map((capture) => capture.id),
      existing,
      branch,
      repos.library,
      capabilityReady ? 'actionable-library-write-set' : 'figma-writer-unavailable',
    );
    if (!existing) targets.library.blockers.unshift('tracking-issue');
    if (!capabilityReady) targets.library.blockers.unshift('figma-write-capability');
    if (!branch) targets.library.state = 'issue-pending';
  } else {
    targets.library.reason = reconciliation.length > 0 ? 'evidence-only-reconciliation' : 'no-actionable-captures';
  }

  if (evidenceEnabled && reconciliation.length > 0) {
    targets.evidence = writeTarget(
      'evidence',
      reconciliation.map((capture) => capture.id),
      issues.evidence,
      project && date ? `feat/${project}-${date}-run` : null,
      repos.evidence,
      'capture-evidence-reconciliation',
    );
  }
  return { schemaVersion: 2, action: snapshot.action, targets, componentTargets: [] };
}

function main() {
  const args = parseArgs(process.argv.slice(2), { keys: ['input', 'out'], flags: ['pretty'] });
  checkArgs(args, USAGE);
  if (!args.values.input) usage('--input is required', USAGE);
  const input = path.resolve(args.values.input);
  if (!fs.existsSync(input)) fail(3, `--input does not exist: ${input}`);
  const read = readJsonSafe(input);
  if (!read.ok) fail(3, `--input could not be read: ${read.error}`);
  let result;
  try {
    result = computeTargets(read.value);
  } catch (error) {
    fail(3, error.message);
  }
  writeOut(result, args.values.out, args.values.pretty);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`error: ${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  }
}

module.exports = { computeTargets, issueMatchKey };
