#!/usr/bin/env node
/**
 * source-parity.cjs — validate source-to-normalized component decisions.
 *
 * The model authors the evidence and decisions. This script owns their shape,
 * capture cardinality, closed classification vocabulary, safe source citations,
 * and (when a Project checkout is supplied) whole-file hashes at the pinned Git
 * revision. It writes nothing unless --out is explicitly supplied.
 *
 * Usage:
 *   node source-parity.cjs --source-parity <dir> [--captures <dir>]
 *     [--project <dir>] [--verify-source] [--out <file>] [--pretty]
 *
 * Exit codes: 0 valid; 1 validation failures; 2 invalid invocation;
 * 3 missing/unreadable input.
 */

'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  parseArgs,
  checkArgs,
  readJsonSafe,
  isDir,
  listEntries,
  writeOut,
  usage,
} = require('./lib/util.cjs');

const USAGE = [
  'Usage: node source-parity.cjs --source-parity <dir> [--captures <dir>] [--project <dir>] [--verify-source] [--out <file>] [--pretty]',
  '',
  '  --source-parity  Directory containing one <component-key>.json per capture',
  '  --captures       Optional captures/ directory for one-to-one parity checks',
  '  --project        Read-only source repository used with --verify-source',
  '  --verify-source  Re-hash every citation from its pinned Git revision',
  '  --out            Write the validation result instead of stdout',
  '  --pretty         Indent JSON output',
];

const COVERAGE_KEYS = [
  'sourceBehavior',
  'sourceVisualLayout',
  'sourceInvariants',
  'normalizedCode',
  'storybook',
  'figma',
  'aiRegistry',
];
const INSPECTION_KEYS = ['entryPoints', 'tests', 'styles', 'buildPacks', 'directImporters', 'composedConsumers'];
const INSPECTION_STATUSES = new Set(['reviewed', 'not-present']);
const NORMALIZED_KEYS = ['code', 'storybook', 'figma', 'aiRegistry'];
const CLASSIFICATIONS = new Set([
  'intentional-declienting',
  'semantic-public-prop',
  'composition-specimen',
  'structural-alternate',
  'new-brain-canonical',
  'rejection',
]);
const ACCEPTED_CLASSIFICATIONS = new Set([
  'semantic-public-prop',
  'composition-specimen',
  'structural-alternate',
  'new-brain-canonical',
]);
const KINDS = new Set(['behavior', 'visual-layout', 'invariant']);
const TARGET_SURFACES = new Set(['code', 'storybook', 'figma', 'ai-registry', 'brain', 'evidence']);
const REVISION_STRATEGIES = new Set(['recorded', 'reconstructed', 'legacy-untracked']);
const IMPLEMENTATION_STATUSES = new Set(['not-required', 'pending', 'complete']);

function issue(componentKey, code, message) {
  return { componentKey: componentKey || null, code, message };
}

function safeRelative(value) {
  return typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) &&
    !value.split(/[\\/]+/).includes('..') && !value.includes('\\');
}

function expectedCapture(componentKey) {
  return `captures/${componentKey}.md`;
}

function validateArtifact(value, options = {}) {
  const issues = [];
  const warnings = [];
  const fileKey = options.fileKey || null;
  const componentKey = typeof value?.componentKey === 'string' ? value.componentKey : fileKey;
  const fail = (code, message) => issues.push(issue(componentKey, code, message));

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('artifact-shape', 'source-parity artifact must be a JSON object.');
    return { componentKey, artifact: null, issues, warnings };
  }
  if (value.schemaVersion !== 1) fail('artifact-schema', `schemaVersion must equal 1, got ${value.schemaVersion}.`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(componentKey || '')) {
    fail('component-key', 'componentKey must be a canonical kebab key with an optional --variant suffix.');
  }
  if (fileKey && componentKey !== fileKey) fail('component-key', `componentKey "${componentKey}" disagrees with ${fileKey}.json.`);
  if (typeof value.canonical !== 'string' || !value.canonical.trim()) fail('canonical', 'canonical must be a non-empty string.');
  if (value.capture !== expectedCapture(componentKey)) {
    fail('capture-reference', `capture must equal ${expectedCapture(componentKey)}.`);
  }
  if (!['cleared', 'actionable'].includes(value.status)) fail('artifact-status', 'status must be cleared or actionable.');
  if (!IMPLEMENTATION_STATUSES.has(value.remediationStatus)) {
    fail('remediation-status', 'remediationStatus must be not-required, pending, or complete.');
  }

  const snapshot = value.sourceSnapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    fail('source-snapshot', 'sourceSnapshot must be an object.');
  } else {
    if (typeof snapshot.project !== 'string' || !snapshot.project.trim()) fail('source-snapshot', 'sourceSnapshot.project is required.');
    if (typeof snapshot.entry !== 'string' || !safeRelative(snapshot.entry)) {
      fail('source-snapshot', 'sourceSnapshot.entry must be a safe repository-relative path.');
    }
    const revision = snapshot.revision;
    if (!revision || typeof revision !== 'object' || !REVISION_STRATEGIES.has(revision.strategy)) {
      fail('source-revision', `sourceSnapshot.revision.strategy must be one of ${[...REVISION_STRATEGIES].join(', ')}.`);
    } else {
      if (revision.commit !== null && !/^[a-f0-9]{40}$/.test(String(revision.commit || ''))) {
        fail('source-revision', 'sourceSnapshot.revision.commit must be a full lowercase Git SHA or null.');
      }
      if (revision.strategy !== 'legacy-untracked' && !revision.commit) {
        fail('source-revision', `${revision.strategy} provenance requires a pinned commit.`);
      }
      if (typeof revision.inventoryGeneratedAt !== 'string' || Number.isNaN(Date.parse(revision.inventoryGeneratedAt))) {
        fail('source-revision', 'sourceSnapshot.revision.inventoryGeneratedAt must be an ISO date-time.');
      }
    }
  }

  const citations = Array.isArray(snapshot?.citations) ? snapshot.citations : [];
  if (citations.length === 0) fail('source-citations', 'sourceSnapshot.citations must contain at least one citation.');
  const citationIds = new Set();
  for (const citation of citations) {
    if (!citation || typeof citation !== 'object' || !/^src-[a-z0-9-]+$/.test(String(citation.id || ''))) {
      fail('source-citations', 'each citation requires a stable src-<slug> id.');
      continue;
    }
    if (citationIds.has(citation.id)) fail('source-citations', `citation id ${citation.id} is duplicated.`);
    citationIds.add(citation.id);
    if (!safeRelative(citation.path)) fail('source-citations', `${citation.id} path must be safe and repository-relative.`);
    if (!Number.isInteger(citation.startLine) || citation.startLine < 1 ||
      !Number.isInteger(citation.endLine) || citation.endLine < citation.startLine) {
      fail('source-citations', `${citation.id} requires a positive inclusive line range.`);
    }
    if (!/^[a-f0-9]{64}$/.test(String(citation.sha256 || ''))) {
      fail('source-citations', `${citation.id} sha256 must be a lowercase whole-file SHA-256 digest.`);
    }
  }

  const inspection = value.sourceInspection;
  if (!inspection || typeof inspection !== 'object' || Array.isArray(inspection)) {
    fail('source-inspection', 'sourceInspection must record every governed source category.');
  } else {
    const actualKeys = Object.keys(inspection).sort();
    if (JSON.stringify(actualKeys) !== JSON.stringify([...INSPECTION_KEYS].sort())) {
      fail('source-inspection', `sourceInspection keys must be exactly ${INSPECTION_KEYS.join(', ')}.`);
    }
    for (const key of INSPECTION_KEYS) {
      const category = inspection[key];
      if (!category || typeof category !== 'object' || Array.isArray(category) ||
        !INSPECTION_STATUSES.has(category.status) || !Array.isArray(category.paths)) {
        fail('source-inspection', `sourceInspection.${key} requires status reviewed|not-present and a paths array.`);
        continue;
      }
      if (category.paths.length !== new Set(category.paths).size || category.paths.some((entry) => !safeRelative(entry))) {
        fail('source-inspection', `sourceInspection.${key}.paths must contain unique safe repository-relative paths.`);
      }
      if (category.status === 'reviewed' && category.paths.length === 0) {
        fail('source-inspection', `sourceInspection.${key} cannot be reviewed without an inspected path.`);
      }
      if (category.status === 'not-present' && category.paths.length !== 0) {
        fail('source-inspection', `sourceInspection.${key} must have no paths when status is not-present.`);
      }
      if (key === 'entryPoints' && category.status !== 'reviewed') {
        fail('source-inspection', 'sourceInspection.entryPoints must be reviewed.');
      }
    }
  }

  for (const key of COVERAGE_KEYS) {
    if (value.coverage?.[key] !== 'reviewed') fail('coverage', `coverage.${key} must equal reviewed.`);
  }
  if (value.coverage && Object.keys(value.coverage).some((key) => !COVERAGE_KEYS.includes(key))) {
    fail('coverage', 'coverage contains an ungoverned surface.');
  }

  const observations = Array.isArray(value.observations) ? value.observations : [];
  if (observations.length === 0) fail('observations', 'observations must contain at least one source fact.');
  const observationIds = new Set();
  let acceptedCount = 0;
  let pendingAcceptedCount = 0;
  for (const observation of observations) {
    if (!observation || typeof observation !== 'object') {
      fail('observations', 'each observation must be an object.');
      continue;
    }
    if (!new RegExp(`^sp-${componentKey}-[0-9]{3}$`).test(String(observation.id || ''))) {
      fail('observation-id', `observation id must match sp-${componentKey}-NNN.`);
    } else if (observationIds.has(observation.id)) {
      fail('observation-id', `observation id ${observation.id} is duplicated.`);
    }
    observationIds.add(observation.id);
    if (!KINDS.has(observation.kind)) fail('observation-kind', `${observation.id} has an ungoverned kind.`);
    if (typeof observation.sourceFact !== 'string' || !observation.sourceFact.trim()) {
      fail('source-fact', `${observation.id} requires a non-empty sourceFact.`);
    }
    if (!observation.sourceValues || typeof observation.sourceValues !== 'object' || Array.isArray(observation.sourceValues)) {
      fail('source-values', `${observation.id} sourceValues must be an object.`);
    }
    if (!IMPLEMENTATION_STATUSES.has(observation.implementationStatus)) {
      fail('implementation-status', `${observation.id} implementationStatus must be not-required, pending, or complete.`);
    }
    if (!Array.isArray(observation.sourceCitationIds) || observation.sourceCitationIds.length === 0 ||
      observation.sourceCitationIds.some((id) => !citationIds.has(id))) {
      fail('observation-citations', `${observation.id} must reference one or more declared citations.`);
    }
    for (const key of NORMALIZED_KEYS) {
      if (!Array.isArray(observation.normalizedEvidence?.[key])) {
        fail('normalized-evidence', `${observation.id} normalizedEvidence.${key} must be an array.`);
      }
    }
    if (!['preserved', 'difference'].includes(observation.comparison)) {
      fail('comparison', `${observation.id} comparison must be preserved or difference.`);
      continue;
    }
    const targets = Array.isArray(observation.targetSurfaces) ? observation.targetSurfaces : [];
    if (targets.some((surface) => !TARGET_SURFACES.has(surface)) || new Set(targets).size !== targets.length) {
      fail('target-surfaces', `${observation.id} has duplicate or ungoverned target surfaces.`);
    }
    if (observation.comparison === 'preserved') {
      if (observation.classification !== null) fail('classification', `${observation.id} preserved behavior must use classification null.`);
      if (observation.decision !== 'document') fail('decision', `${observation.id} preserved behavior must use decision document.`);
      if (targets.length > 0) fail('target-surfaces', `${observation.id} preserved behavior cannot target remediation surfaces.`);
    } else {
      if (!CLASSIFICATIONS.has(observation.classification)) {
        fail('classification', `${observation.id} difference requires a governed classification.`);
      }
      const accepted = ACCEPTED_CLASSIFICATIONS.has(observation.classification);
      if (accepted) {
        acceptedCount += 1;
        if (observation.implementationStatus === 'pending') pendingAcceptedCount += 1;
        if (observation.decision !== 'accept') fail('decision', `${observation.id} accepted classification requires decision accept.`);
        if (targets.length === 0) fail('target-surfaces', `${observation.id} accepted classification requires at least one target surface.`);
        if (!['pending', 'complete'].includes(observation.implementationStatus)) {
          fail('implementation-status', `${observation.id} accepted classification requires pending or complete implementationStatus.`);
        }
      } else if (observation.classification === 'rejection') {
        if (observation.decision !== 'reject') fail('decision', `${observation.id} rejection requires decision reject.`);
        if (targets.length > 0) fail('target-surfaces', `${observation.id} rejection cannot target remediation surfaces.`);
        if (observation.implementationStatus !== 'not-required') {
          fail('implementation-status', `${observation.id} rejection requires implementationStatus not-required.`);
        }
      } else if (observation.decision !== 'document') {
        fail('decision', `${observation.id} intentional de-clienting requires decision document.`);
      } else if (targets.length > 0) {
        fail('target-surfaces', `${observation.id} intentional de-clienting cannot target remediation surfaces.`);
      } else if (observation.implementationStatus !== 'not-required') {
        fail('implementation-status', `${observation.id} intentional de-clienting requires implementationStatus not-required.`);
      }
    }
    if (observation.comparison === 'preserved' && observation.implementationStatus !== 'not-required') {
      fail('implementation-status', `${observation.id} preserved behavior requires implementationStatus not-required.`);
    }
  }
  const expectedRemediationStatus = acceptedCount === 0
    ? 'not-required'
    : pendingAcceptedCount > 0
      ? 'pending'
      : 'complete';
  const expectedStatus = expectedRemediationStatus === 'pending' ? 'actionable' : 'cleared';
  if (value.remediationStatus !== expectedRemediationStatus) {
    fail('remediation-status', `remediationStatus must equal ${expectedRemediationStatus} for the recorded decisions.`);
  }
  if (value.status !== expectedStatus) {
    fail('artifact-status', `status must equal ${expectedStatus} for remediationStatus ${expectedRemediationStatus}.`);
  }

  const sourceParityReview = value.reviews?.sourceParity;
  if (sourceParityReview?.status !== 'passed' ||
    !['decision', 'post-remediation'].includes(sourceParityReview?.phase) ||
    !Array.isArray(sourceParityReview?.evidence) || sourceParityReview.evidence.length === 0 ||
    sourceParityReview.evidence.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    fail('source-parity-review', 'reviews.sourceParity must be passed in the decision or post-remediation phase with evidence.');
  } else {
    const selfReferences = new Set([
      `source-parity/${componentKey}.json`,
      `audits/library-source-parity/components/${componentKey}.json`,
    ]);
    if (sourceParityReview.evidence.some((entry) => selfReferences.has(entry))) {
      fail('source-parity-review', 'reviews.sourceParity evidence cannot cite the decision artifact itself.');
    }
    const expectedPhase = value.remediationStatus === 'complete' ? 'post-remediation' : 'decision';
    if (sourceParityReview.phase !== expectedPhase) {
      fail('source-parity-review', `reviews.sourceParity.phase must equal ${expectedPhase} for remediationStatus ${value.remediationStatus}.`);
    }
  }
  for (const pass of ['adversarial', 'design']) {
    if (!['pending', 'passed', 'not-required'].includes(value.reviews?.[pass]?.status)) {
      fail('review-status', `reviews.${pass}.status must be pending, passed, or not-required.`);
    }
    if (value.reviews?.[pass]?.status === 'passed' && !Array.isArray(value.reviews?.[pass]?.evidence)) {
      fail('review-status', `reviews.${pass}.evidence must be an array when passed.`);
    }
    if (value.remediationStatus === 'complete' &&
      (value.reviews?.[pass]?.status !== 'passed' || !Array.isArray(value.reviews?.[pass]?.evidence) ||
        value.reviews[pass].evidence.length === 0)) {
      fail('review-status', `completed remediation requires reviews.${pass} passed with evidence.`);
    }
  }

  if (options.verifySource && snapshot?.revision?.commit) {
    const projectDir = options.projectDir;
    if (!projectDir || !isDir(projectDir)) {
      fail('source-project', 'pinned source verification requires a readable Project checkout.');
    } else {
      const pinned = new Map();
      const readPinned = (relativePath) => {
        if (pinned.has(relativePath)) return pinned.get(relativePath);
        const shown = spawnSync('git', ['-C', projectDir, 'show', `${snapshot.revision.commit}:${relativePath}`], {
          encoding: null,
          maxBuffer: 20 * 1024 * 1024,
        });
        pinned.set(relativePath, shown);
        return shown;
      };
      for (const citation of citations.filter((entry) => safeRelative(entry?.path))) {
        const shown = readPinned(citation.path);
        if (shown.status !== 0) {
          fail('source-hash', `${citation.id} could not be read from ${snapshot.revision.commit}: ${String(shown.stderr || '').trim() || 'git show failed'}.`);
          continue;
        }
        const actual = crypto.createHash('sha256').update(shown.stdout).digest('hex');
        if (actual !== citation.sha256) fail('source-hash', `${citation.id} hash does not match the pinned revision.`);
        const source = shown.stdout.toString('utf8');
        const lines = source.length === 0 ? [] : source.split(/\r\n|\n|\r/);
        if (lines.at(-1) === '') lines.pop();
        if (citation.endLine > lines.length) {
          fail('source-citations', `${citation.id} ends at line ${citation.endLine}, beyond pinned file length ${lines.length}.`);
        }
      }
      const inspectedPaths = INSPECTION_KEYS.flatMap((key) => inspection?.[key]?.paths ?? []);
      for (const inspectedPath of new Set(inspectedPaths.filter(safeRelative))) {
        if (readPinned(inspectedPath).status !== 0) {
          fail('source-inspection', `${inspectedPath} could not be read from the pinned revision.`);
        }
      }
    }
  } else if (options.verifySource && snapshot?.revision?.strategy === 'legacy-untracked') {
    warnings.push(issue(componentKey, 'source-hash-unverified', 'legacy-untracked provenance cannot be re-hashed from a pinned revision.'));
  }

  return { componentKey, artifact: value, issues, warnings };
}

function validateSourceParityDirectory(options) {
  const sourceParityDir = path.resolve(options.sourceParityDir);
  const issues = [];
  const warnings = [];
  const records = [];
  if (!isDir(sourceParityDir)) {
    issues.push(issue(null, 'source-parity-directory', `source-parity directory is missing: ${sourceParityDir}.`));
    return { sourceParityDir, records, issues, warnings, counts: { artifacts: 0, actionable: 0, cleared: 0 } };
  }

  const files = listEntries(sourceParityDir).filter((entry) => !entry.dir && entry.name.endsWith('.json'));
  const byName = new Map();
  for (const file of files) {
    const fileKey = path.basename(file.name, '.json');
    const read = readJsonSafe(file.path);
    if (!read.ok) {
      issues.push(issue(fileKey, 'artifact-parse', `${file.name} could not be parsed: ${read.error}.`));
      continue;
    }
    const checked = validateArtifact(read.value, {
      fileKey,
      projectDir: options.projectDir,
      verifySource: options.verifySource === true,
    });
    records.push({ file: file.name, componentKey: checked.componentKey, artifact: checked.artifact });
    issues.push(...checked.issues);
    warnings.push(...checked.warnings);
    byName.set(`${fileKey}.json`, file.path);
  }

  if (options.capturesDir) {
    const capturesDir = path.resolve(options.capturesDir);
    const captureFiles = isDir(capturesDir)
      ? listEntries(capturesDir).filter((entry) => !entry.dir && entry.name.endsWith('.md'))
      : [];
    const expected = new Set(captureFiles.map((entry) => `${path.basename(entry.name, '.md')}.json`));
    for (const name of expected) {
      if (!byName.has(name)) issues.push(issue(path.basename(name, '.json'), 'source-parity-cardinality', `captures/${name.replace(/\.json$/, '.md')} has no source-parity/${name}.`));
    }
    for (const name of byName.keys()) {
      if (!expected.has(name)) issues.push(issue(path.basename(name, '.json'), 'source-parity-cardinality', `source-parity/${name} has no matching capture.`));
    }
  }

  records.sort((a, b) => a.file.localeCompare(b.file));
  return {
    sourceParityDir,
    records,
    issues,
    warnings,
    counts: {
      artifacts: records.length,
      actionable: records.filter((record) => record.artifact?.status === 'actionable').length,
      cleared: records.filter((record) => record.artifact?.status === 'cleared').length,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    keys: ['source-parity', 'captures', 'project', 'out'],
    flags: ['verify-source', 'pretty'],
  });
  checkArgs(args, USAGE);
  if (!args.values['source-parity']) usage('--source-parity is required', USAGE);
  const sourceParityDir = path.resolve(args.values['source-parity']);
  if (!isDir(sourceParityDir)) {
    process.stderr.write(`error: --source-parity is not a directory: ${sourceParityDir}\n`);
    process.exit(3);
  }
  const result = validateSourceParityDirectory({
    sourceParityDir,
    capturesDir: args.values.captures ? path.resolve(args.values.captures) : null,
    projectDir: args.values.project ? path.resolve(args.values.project) : null,
    verifySource: Boolean(args.values['verify-source']),
  });
  writeOut(result, args.values.out, args.values.pretty);
  process.exitCode = result.issues.length === 0 ? 0 : 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`error: ${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  }
}

module.exports = {
  ACCEPTED_CLASSIFICATIONS,
  CLASSIFICATIONS,
  COVERAGE_KEYS,
  IMPLEMENTATION_STATUSES,
  INSPECTION_KEYS,
  validateArtifact,
  validateSourceParityDirectory,
};
