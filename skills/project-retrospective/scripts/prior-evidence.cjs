#!/usr/bin/env node
/**
 * prior-evidence.cjs — select current cross-project recurrence evidence.
 *
 * For each project, only its latest eligible triage.json from automatic Data
 * discovery plus explicit PriorReports is considered. Older runs are reported
 * as superseded and can never promote a candidate that disappeared from a newer
 * run. The current project is excluded: repeated files in one repository are
 * not independent project evidence.
 *
 * Usage:
 *   node prior-evidence.cjs --project <slug> [--data <ui-design-evidence>]
 *     [--prior-reports <comma-separated paths>] [--out <file>] [--pretty]
 *
 * Exit codes: 0 success (including warnings); 1 unexpected failure;
 * 2 invalid invocation; 3 a supplied Data is not a readable evidence checkout.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  parseArgs,
  checkArgs,
  readJsonSafe,
  readTextSafe,
  isDir,
  isFile,
  listEntries,
  normalizeLabel,
  kebab,
  sections,
  Warnings,
  writeOut,
  usage,
} = require('./lib/util.cjs');
const { cmsForKey } = require('./lib/cms-taxonomy.cjs');

const USAGE = [
  'Usage: node prior-evidence.cjs --project <slug> [--data <ui-design-evidence>] [--prior-reports <paths>] [--out <file>] [--pretty]',
  '',
  '  --data           Local ui-design-evidence checkout (optional with --prior-reports)',
  '  --project        Current project slug to exclude from recurrence (required)',
  '  --prior-reports  Legacy comma-separated report.md paths (optional explicit evidence)',
  '  --out            Write JSON here instead of stdout',
  '  --pretty          Indent JSON output',
];

function provisionalCanonical(note) {
  if (typeof note !== 'string') return null;
  const match = /^provisional canonical:\s*([^—\n]+?)\s*(?:—|$)/i.exec(note);
  return match && match[1].trim() ? match[1].trim() : null;
}

function isIsoCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isSymlink(file) {
  try {
    return fs.lstatSync(file).isSymbolicLink();
  } catch {
    return false;
  }
}

function symlinkedRunSurface(runDir) {
  const surfaces = [
    path.dirname(runDir),
    runDir,
    ...['report.md', 'triage.json', 'meta.json', 'inventory.json', 'resolution.json']
      .map((name) => path.join(runDir, name)),
  ];
  return surfaces.find(isSymlink) || null;
}

function eligibleInventory(runDir) {
  const read = readJsonSafe(path.join(runDir, 'inventory.json'));
  const inventory = read.ok ? read.value : null;
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory) || inventory.schemaVersion !== 1) {
    return { ok: false, reason: 'inventory.json is not a schema-v1 object' };
  }
  if (!['artifacts', 'code-scan'].includes(inventory.mode) || !Array.isArray(inventory.components) ||
    !Array.isArray(inventory.warnings) || inventory.counts?.components !== inventory.components.length) {
    return { ok: false, reason: 'inventory.json does not satisfy its mode/component/count contract' };
  }
  const cmsKey = inventory.config?.cmsKey ?? null;
  const cmsLabel = inventory.config?.cmsLabel ?? null;
  const cms = cmsForKey(cmsKey);
  if ((cmsKey === null) !== (cmsLabel === null) || (cmsKey !== null && cms?.label !== cmsLabel)) {
    return { ok: false, reason: 'inventory.json CMS metadata is not an exact canonical key/label pair' };
  }
  const adapter = cmsForKey(inventory.config?.stackAdapter ?? null);
  if (adapter && inventory.config?.platformSource === 'build-config' &&
    (cmsKey !== adapter.key || cmsLabel !== adapter.label)) {
    return { ok: false, reason: 'inventory.json build-config platform metadata disagrees with stackAdapter' };
  }
  const snapshot = inventory.sourceSnapshot;
  if (snapshot !== undefined && (!snapshot || typeof snapshot !== 'object' ||
    !['recorded', 'unavailable'].includes(snapshot.strategy) ||
    (snapshot.strategy === 'recorded' && !/^[a-f0-9]{40}$/.test(String(snapshot.commit || ''))))) {
    return { ok: false, reason: 'inventory.json sourceSnapshot is malformed' };
  }
  return { ok: true, value: inventory };
}

function eligibleMeta(runDir, project, run, inventory) {
  const read = readJsonSafe(path.join(runDir, 'meta.json'));
  const meta = read.ok ? read.value : null;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta) || meta.schemaVersion !== 1) {
    return { ok: false, reason: 'meta.json is not a schema-v1 object' };
  }
  const required = [meta.client?.name, meta.client?.slug, meta.project?.slug, meta.date];
  if (required.some((value) => typeof value !== 'string' || !value)) {
    return { ok: false, reason: 'meta.json is missing required client/project/date identity' };
  }
  if (meta.project.slug !== project || meta.date !== run || kebab(meta.client.slug) !== meta.client.slug ||
    kebab(meta.project.slug) !== meta.project.slug) {
    return { ok: false, reason: 'meta.json does not prove the same safe project/date identity' };
  }
  if (!(typeof meta.platform === 'string' || meta.platform === null)) {
    return { ok: false, reason: 'meta.json platform must be a canonical key or null' };
  }
  const cms = cmsForKey(meta.platform);
  if ((meta.platform === null && meta.platformDisplay !== null) ||
    (meta.platform !== null && (!cms || meta.platformDisplay !== cms.label))) {
    return { ok: false, reason: 'meta.json platform metadata is not an exact canonical key/label or null/null pair' };
  }
  if (meta.platform !== (inventory.config?.cmsKey ?? null) ||
    meta.platformDisplay !== (inventory.config?.cmsLabel ?? null)) {
    return { ok: false, reason: 'meta.json platform identity disagrees with inventory.json' };
  }
  if (meta.priorReports !== undefined && !Array.isArray(meta.priorReports)) {
    return { ok: false, reason: 'meta.json priorReports must be an array when present' };
  }
  return { ok: true, value: meta };
}

function eligibleReport(runDir, meta) {
  const text = readTextSafe(path.join(runDir, 'report.md'));
  if (text === null) return { ok: false, reason: 'report.md is missing or unreadable' };
  const runSections = sections(text, 2).filter((section) => section.heading === 'Run');
  const expected = meta.platform === null
    ? '| Platform | unknown |'
    : `| Platform | \`${meta.platformDisplay}\` (\`${meta.platform}\`) |`;
  const rows = runSections[0]?.body.split('\n').map((line) => line.trim()) || [];
  if (runSections.length !== 1 || !rows.includes(expected)) {
    return { ok: false, reason: `report.md Run table does not contain exact platform row ${expected}` };
  }
  return { ok: true };
}

function eligibleTriage(file, project, run) {
  const runDir = path.dirname(file);
  const symlink = symlinkedRunSurface(runDir);
  if (symlink) return { ok: false, reason: `run surface is a symlink: ${symlink}` };
  if (!isIsoCalendarDate(run)) {
    return { ok: false, reason: 'run directory is not an ISO calendar date' };
  }
  const read = readJsonSafe(file);
  if (!read.ok) return { ok: false, reason: `triage.json could not be parsed: ${read.error}` };
  const value = read.value;
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1) {
    return { ok: false, reason: 'triage.json is not a schema-v1 object' };
  }
  if (value.run !== `${project}/${run}`) return { ok: false, reason: `triage.run does not equal ${project}/${run}` };
  const verdictArrays = { promote: 'Promote', watch: 'Watch', reject: 'Reject' };
  if (!Object.keys(verdictArrays).every((key) => Array.isArray(value[key]))) {
    return { ok: false, reason: 'triage.json is missing a verdict array' };
  }
  const labels = new Set();
  for (const [key, verdict] of Object.entries(verdictArrays)) {
    for (const entry of value[key]) {
      const normalized = normalizeLabel(entry?.label);
      if (!entry || typeof entry !== 'object' || !normalized || entry.verdict !== verdict) {
        return { ok: false, reason: `triage.${key} contains an invalid label/verdict entry` };
      }
      if (labels.has(normalized)) {
        return { ok: false, reason: `triage candidate ${entry.label} appears in more than one verdict entry` };
      }
      labels.add(normalized);
    }
  }
  if (!value.counts || typeof value.counts !== 'object' || Array.isArray(value.counts) ||
    Object.entries(verdictArrays).some(([key, verdict]) => value.counts[verdict] !== value[key].length)) {
    return { ok: false, reason: 'triage.counts does not exactly match the verdict arrays' };
  }
  const inventoryChecked = eligibleInventory(runDir);
  if (!inventoryChecked.ok) return inventoryChecked;
  const metaChecked = eligibleMeta(runDir, project, run, inventoryChecked.value);
  if (!metaChecked.ok) return metaChecked;
  if (metaChecked.value.scope === 'retrospectives') {
    return { ok: false, reason: 'retrospectives-only runs are not recurrence evidence' };
  }
  const resolutionRead = readJsonSafe(path.join(runDir, 'resolution.json'));
  const resolution = resolutionRead.ok ? resolutionRead.value : null;
  if (!resolution || resolution.schemaVersion !== 1 || !Array.isArray(resolution.resolved) ||
    !Array.isArray(resolution.unresolved) || !Number.isInteger(resolution.manifest?.entries) ||
    resolution.manifest.entries < 0) {
    return { ok: false, reason: 'resolution.json is not an eligible schema-v1 resolution result' };
  }
  if (resolution.unresolved.some((entry) => !entry || typeof entry !== 'object' ||
    !normalizeLabel(entry.label || entry.normalized))) {
    return { ok: false, reason: 'resolution.json contains an invalid unresolved entry' };
  }
  const unresolved = new Set(resolution.unresolved.flatMap((entry) =>
    [entry?.label, entry?.normalized].filter((label) => typeof label === 'string').map(normalizeLabel)));
  const candidates = [...value.promote, ...value.watch, ...value.reject];
  if (candidates.some((entry) => typeof entry?.label !== 'string' || !unresolved.has(normalizeLabel(entry.label)))) {
    return { ok: false, reason: 'triage candidates do not join to resolution.json unresolved labels' };
  }
  const reportChecked = eligibleReport(runDir, metaChecked.value);
  if (!reportChecked.ok) return reportChecked;
  return { ok: true, value };
}

function selectLatestRuns(dataDir, currentProject, warnings) {
  const runsDir = path.join(dataDir, 'runs');
  const selected = [];
  const superseded = [];
  for (const projectEntry of listEntries(runsDir).filter((entry) => entry.dir)) {
    const project = projectEntry.name;
    if (projectEntry.symlink) {
      warnings.add('prior-run-ineligible', `${project}: project directory is a symlink; ignored.`);
      continue;
    }
    if (normalizeLabel(project) === normalizeLabel(currentProject)) continue;
    const eligible = [];
    for (const runEntry of listEntries(projectEntry.path).filter((entry) => entry.dir)) {
      if (runEntry.symlink) {
        warnings.add('prior-run-ineligible', `${project}/${runEntry.name}: run directory is a symlink; ignored.`);
        continue;
      }
      const triagePath = path.join(runEntry.path, 'triage.json');
      if (!isFile(triagePath)) continue;
      const checked = eligibleTriage(triagePath, project, runEntry.name);
      if (!checked.ok) {
        warnings.add('prior-run-ineligible', `${project}/${runEntry.name}: ${checked.reason}; ignored.`);
        continue;
      }
      eligible.push({
        project,
        run: runEntry.name,
        triage: triagePath,
        report: isFile(path.join(runEntry.path, 'report.md')) ? path.join(runEntry.path, 'report.md') : null,
        value: checked.value,
      });
    }
    eligible.sort((left, right) => right.run.localeCompare(left.run));
    if (eligible.length === 0) continue;
    selected.push(eligible[0]);
    for (const old of eligible.slice(1)) superseded.push({ project: old.project, run: old.run, triage: old.triage });
  }
  selected.sort((left, right) => left.project.localeCompare(right.project));
  superseded.sort((left, right) => left.project.localeCompare(right.project) || right.run.localeCompare(left.run));
  return { selected, superseded };
}

function selectExplicitRuns(reportPaths, currentProject, warnings) {
  const selected = [];
  for (const report of [...new Set(reportPaths)].sort()) {
    if (!isFile(report)) {
      warnings.add('prior-report-missing', `Explicit PriorReports path does not exist and was ignored: ${report}`);
      continue;
    }
    if (path.basename(report) !== 'report.md') {
      warnings.add('prior-report-ineligible', `Explicit PriorReports path must name report.md and was ignored: ${report}`);
      continue;
    }
    const runDir = path.dirname(report);
    const run = path.basename(runDir);
    const project = path.basename(path.dirname(runDir));
    if (normalizeLabel(project) === normalizeLabel(currentProject)) {
      warnings.add(
        'prior-report-current-project',
        `Explicit PriorReports path belongs to the current project and was ignored: ${report}`,
      );
      continue;
    }
    const triage = path.join(runDir, 'triage.json');
    const checked = eligibleTriage(triage, project, run);
    if (!checked.ok) {
      warnings.add('prior-report-ineligible', `${project}/${run}: ${checked.reason}; explicit path ignored.`);
      continue;
    }
    selected.push({ project, run, triage, report, value: checked.value });
  }
  return selected;
}

function supersededRecord(run) {
  return { project: run.project, run: run.run, triage: run.triage };
}

function mergeLatestRuns(automatic, explicit, superseded, warnings) {
  const byProject = new Map(automatic.map((run) => [run.project, run]));
  const allSuperseded = [...superseded];
  const orderedExplicit = [...explicit].sort((left, right) =>
    left.project.localeCompare(right.project) || right.run.localeCompare(left.run) || left.report.localeCompare(right.report));

  for (const candidate of orderedExplicit) {
    const current = byProject.get(candidate.project);
    if (!current) {
      byProject.set(candidate.project, candidate);
      continue;
    }
    if (candidate.run > current.run) {
      allSuperseded.push(supersededRecord(current));
      byProject.set(candidate.project, candidate);
      continue;
    }
    if (candidate.run < current.run) {
      allSuperseded.push(supersededRecord(candidate));
      warnings.add(
        'prior-report-superseded',
        `Explicit PriorReports path ${candidate.report} is older than selected ${current.report} and was ignored.`,
      );
      continue;
    }
    if (candidate.report !== current.report) {
      allSuperseded.push(supersededRecord(candidate));
      warnings.add(
        'prior-report-conflict',
        `Explicit PriorReports path ${candidate.report} duplicates ${candidate.project}/${candidate.run}; selected ${current.report}.`,
      );
    }
  }

  const selected = [...byProject.values()].sort((left, right) => left.project.localeCompare(right.project));
  const seenSuperseded = new Set();
  const dedupedSuperseded = allSuperseded
    .filter((run) => {
      const key = `${run.project}\u0000${run.run}\u0000${run.triage}`;
      if (seenSuperseded.has(key)) return false;
      seenSuperseded.add(key);
      return true;
    })
    .sort((left, right) => left.project.localeCompare(right.project) || right.run.localeCompare(left.run));
  return { selected, superseded: dedupedSuperseded };
}

function recurrenceFrom(runs) {
  const groups = new Map();
  for (const run of runs) {
    for (const entry of [...run.value.promote, ...run.value.watch]) {
      if (!entry || typeof entry.label !== 'string' || !entry.label.trim()) continue;
      if (!['Promote', 'Watch'].includes(entry.verdict)) continue;
      const canonical = provisionalCanonical(entry.note);
      const key = normalizeLabel(canonical || entry.label);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, { key, provisionalCanonical: canonical, occurrences: new Map() });
      const occurrence = {
        project: run.project,
        run: `${run.project}/${run.run}`,
        label: entry.label,
        verdict: entry.verdict,
        report: run.report,
        triage: run.triage,
        sources: Array.isArray(entry.sources) ? entry.sources : [],
      };
      const existing = groups.get(key).occurrences.get(run.project);
      if (!existing || (existing.verdict !== 'Promote' && occurrence.verdict === 'Promote')) {
        groups.get(key).occurrences.set(run.project, occurrence);
      }
    }
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      occurrences: [...group.occurrences.values()].sort((a, b) => a.project.localeCompare(b.project)),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    keys: ['data', 'project', 'prior-reports', 'out'],
    flags: ['pretty'],
  });
  checkArgs(args, USAGE);
  if (!args.values.project) usage('--project is required', USAGE);

  const explicitReports = String(args.values['prior-reports'] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => path.resolve(value));
  if (!args.values.data && explicitReports.length === 0) {
    usage('one of --data or --prior-reports is required', USAGE);
  }

  const dataDir = args.values.data ? path.resolve(args.values.data) : null;
  if (dataDir && (isSymlink(path.join(dataDir, 'runs')) || !isDir(path.join(dataDir, 'runs')))) {
    process.stderr.write(`error: --data has no readable runs/ directory: ${dataDir}\n`);
    process.exit(3);
  }
  const warnings = new Warnings();
  const automatic = dataDir
    ? selectLatestRuns(dataDir, args.values.project, warnings)
    : { selected: [], superseded: [] };
  const explicit = selectExplicitRuns(explicitReports, args.values.project, warnings);
  const { selected, superseded } = mergeLatestRuns(
    automatic.selected,
    explicit,
    automatic.superseded,
    warnings,
  );
  const requestedReports = new Set(explicitReports);

  writeOut({
    schemaVersion: 1,
    data: dataDir,
    currentProject: args.values.project,
    latestRuns: selected.map((run) => ({
      project: run.project,
      run: run.run,
      triage: run.triage,
      report: run.report,
    })),
    supersededRuns: superseded,
    recurrence: recurrenceFrom(selected),
    legacyReports: selected.map((run) => run.report).filter((report) => requestedReports.has(report)),
    warnings: warnings.toJSON(),
  }, args.values.out, args.values.pretty);
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
  eligibleTriage,
  isIsoCalendarDate,
  mergeLatestRuns,
  provisionalCanonical,
  recurrenceFrom,
  selectExplicitRuns,
  selectLatestRuns,
};
