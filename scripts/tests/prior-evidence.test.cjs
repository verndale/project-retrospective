'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runJson } = require('./helpers.cjs');

function writeRun(data, project, date, watchEntries, promote = [], reject = []) {
  const dir = path.join(data, 'runs', project, date);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'report.md'), [
    `# ${project} ${date}`,
    '',
    '## Run',
    '',
    '| Field | Value |',
    '|---|---|',
    '| Platform | unknown |',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    schemaVersion: 1,
    date,
    client: { name: 'Synthetic client', slug: 'synthetic-client' },
    project: { slug: project },
    platform: null,
    platformDisplay: null,
  }));
  fs.writeFileSync(path.join(dir, 'inventory.json'), JSON.stringify({
    schemaVersion: 1,
    mode: 'code-scan',
    config: { stackAdapter: null, cmsKey: null, cmsLabel: null },
    sourceSnapshot: { strategy: 'unavailable', commit: null, dirty: null },
    components: [],
    warnings: [],
    counts: { components: 0 },
  }));
  const all = [...promote, ...watchEntries, ...reject];
  fs.writeFileSync(path.join(dir, 'resolution.json'), JSON.stringify({
    schemaVersion: 1,
    manifest: { entries: 0 },
    resolved: [],
    unresolved: all.map((entry) => ({ label: entry.label, normalized: entry.label })),
  }));
  fs.writeFileSync(path.join(dir, 'triage.json'), JSON.stringify({
    schemaVersion: 1,
    run: `${project}/${date}`,
    promote,
    watch: watchEntries,
    reject,
    counts: { Promote: promote.length, Watch: watchEntries.length, Reject: reject.length },
  }));
  return dir;
}

function watch(label, canonical, sources = ['code-scan']) {
  return {
    label,
    verdict: 'Watch',
    rule: 'single-project evidence',
    note: `provisional canonical: ${canonical} — synthetic reusable pattern`,
    bucket: 'ui',
    domain: null,
    entry: `src/components/${label}.tsx`,
    sources,
  };
}

function setPlatform(dir, platform, platformDisplay) {
  const metaPath = path.join(dir, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.platform = platform;
  meta.platformDisplay = platformDisplay;
  fs.writeFileSync(metaPath, JSON.stringify(meta));
  const inventoryPath = path.join(dir, 'inventory.json');
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  inventory.config.cmsKey = platform;
  inventory.config.cmsLabel = platformDisplay;
  fs.writeFileSync(inventoryPath, JSON.stringify(inventory));
  const reportPath = path.join(dir, 'report.md');
  const expected = platform === null
    ? '| Platform | unknown |'
    : `| Platform | \`${platformDisplay}\` (\`${platform}\`) |`;
  fs.writeFileSync(reportPath, fs.readFileSync(reportPath, 'utf8').replace('| Platform | unknown |', expected));
}

test('only the latest eligible run per other project contributes recurrence', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-evidence-'));
  const stale = writeRun(data, 'alpha', '2026-01-01', [watch('notice', 'Notice')]);
  const latest = writeRun(data, 'alpha', '2026-02-01', [watch('banner', 'Banner')]);
  writeRun(data, 'beta', '2026-03-01', [watch('notice', 'Notice')]);
  writeRun(data, 'current', '2026-04-01', [watch('notice', 'Notice')]);

  const result = runJson('prior-evidence.cjs', ['--data', data, '--project', 'current']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.latestRuns.map((run) => run.run), ['2026-02-01', '2026-03-01']);
  assert.ok(result.json.supersededRuns.some((run) => run.triage === path.join(stale, 'triage.json')));
  assert.ok(result.json.latestRuns.some((run) => run.triage === path.join(latest, 'triage.json')));
  assert.deepEqual(result.json.recurrence.map((entry) => entry.key), ['banner', 'notice']);
  assert.equal(result.json.recurrence.find((entry) => entry.key === 'notice').occurrences.length, 1);
});

test('code, colocated tests, and stories from one project remain one occurrence', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-family-'));
  writeRun(data, 'alpha', '2026-01-01', [
    watch('notice', 'Notice', ['code-scan', 'storybook']),
  ]);
  const result = runJson('prior-evidence.cjs', ['--data', data, '--project', 'current']);
  assert.equal(result.status, 0, result.stderr);
  const occurrence = result.json.recurrence.find((entry) => entry.key === 'notice').occurrences;
  assert.equal(occurrence.length, 1, 'one implementation family does not multiply into independent evidence');
  assert.deepEqual(occurrence[0].sources, ['code-scan', 'storybook']);
});

test('the latest run contributes Promote and Watch evidence but never Reject', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-verdicts-'));
  const promoted = { ...watch('notice', 'Notice'), verdict: 'Promote' };
  const rejected = { ...watch('checkout-panel', 'Checkout panel'), verdict: 'Reject' };
  writeRun(data, 'alpha', '2026-01-01', [watch('banner', 'Banner')], [promoted], [rejected]);
  const result = runJson('prior-evidence.cjs', ['--data', data, '--project', 'current']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.recurrence.map((entry) => entry.key), ['banner', 'notice']);
  assert.equal(result.json.recurrence.find((entry) => entry.key === 'notice').occurrences[0].verdict, 'Promote');
});

test('triage without matching run identity and resolution cannot drive recurrence', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-identity-'));
  const dir = writeRun(data, 'alpha', '2026-01-01', [watch('notice', 'Notice')]);
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ schemaVersion: 1, date: '2025-01-01', project: { slug: 'alpha' } }));
  const result = runJson('prior-evidence.cjs', ['--data', data, '--project', 'current']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.latestRuns, []);
  assert.deepEqual(result.json.recurrence, []);
  assert.ok(result.json.warnings.some((warning) => warning.code === 'prior-run-ineligible'));
});

test('invalid resolution identity and verdict grouping cannot drive recurrence', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-resolution-'));
  const invalidResolution = writeRun(data, 'alpha', '2026-01-01', [watch('notice', 'Notice')]);
  const resolution = JSON.parse(fs.readFileSync(path.join(invalidResolution, 'resolution.json'), 'utf8'));
  delete resolution.manifest;
  fs.writeFileSync(path.join(invalidResolution, 'resolution.json'), JSON.stringify(resolution));

  const invalidVerdict = writeRun(data, 'beta', '2026-01-01', [watch('banner', 'Banner')]);
  const triage = JSON.parse(fs.readFileSync(path.join(invalidVerdict, 'triage.json'), 'utf8'));
  triage.watch[0].verdict = 'Reject';
  fs.writeFileSync(path.join(invalidVerdict, 'triage.json'), JSON.stringify(triage));

  const result = runJson('prior-evidence.cjs', ['--data', data, '--project', 'current']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.latestRuns, []);
  assert.deepEqual(result.json.recurrence, []);
  assert.equal(result.json.warnings.filter((warning) => warning.code === 'prior-run-ineligible').length, 2);
});

test('only exact canonical or null platform contracts can drive recurrence', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-platform-valid-'));
  const canonical = writeRun(data, 'alpha', '2026-01-01', [watch('notice', 'Notice')]);
  setPlatform(canonical, 'contentful', 'Contentful');
  writeRun(data, 'beta', '2026-01-01', [watch('banner', 'Banner')]);

  const result = runJson('prior-evidence.cjs', ['--data', data, '--project', 'current']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.latestRuns.map((entry) => entry.project), ['alpha', 'beta']);
  assert.deepEqual(result.json.recurrence.map((entry) => entry.key), ['banner', 'notice']);
  assert.deepEqual(result.json.warnings, []);
});

test('unknown, malformed, mismatched, or misreported platform metadata is ineligible', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-platform-invalid-'));

  const unknown = writeRun(data, 'unknown-platform', '2026-01-01', [watch('unknown', 'Unknown')]);
  setPlatform(unknown, 'sitecore', 'Sitecore');

  const halfNull = writeRun(data, 'half-null', '2026-01-01', [watch('half-null', 'Half null')]);
  const halfNullMetaPath = path.join(halfNull, 'meta.json');
  const halfNullMeta = JSON.parse(fs.readFileSync(halfNullMetaPath, 'utf8'));
  halfNullMeta.platformDisplay = 'Unknown';
  fs.writeFileSync(halfNullMetaPath, JSON.stringify(halfNullMeta));

  const mismatch = writeRun(data, 'platform-mismatch', '2026-01-01', [watch('mismatch', 'Mismatch')]);
  setPlatform(mismatch, 'contentful', 'Contentful');
  const mismatchInventoryPath = path.join(mismatch, 'inventory.json');
  const mismatchInventory = JSON.parse(fs.readFileSync(mismatchInventoryPath, 'utf8'));
  mismatchInventory.config.cmsKey = 'contentstack';
  mismatchInventory.config.cmsLabel = 'Contentstack';
  fs.writeFileSync(mismatchInventoryPath, JSON.stringify(mismatchInventory));

  const wrongReport = writeRun(data, 'wrong-report', '2026-01-01', [watch('report', 'Report')]);
  setPlatform(wrongReport, 'contentful', 'Contentful');
  fs.writeFileSync(
    path.join(wrongReport, 'report.md'),
    fs.readFileSync(path.join(wrongReport, 'report.md'), 'utf8')
      .replace('| Platform | `Contentful` (`contentful`) |', '| Platform | unknown |'),
  );

  const result = runJson('prior-evidence.cjs', ['--data', data, '--project', 'current']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.latestRuns, []);
  assert.deepEqual(result.json.recurrence, []);
  assert.equal(result.json.warnings.filter((warning) => warning.code === 'prior-run-ineligible').length, 4);
});

test('retrospectives-only runs are never component recurrence evidence', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-retrospectives-'));
  const dir = writeRun(data, 'alpha', '2026-01-01', [watch('notice', 'Notice')]);
  const metaPath = path.join(dir, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.scope = 'retrospectives';
  fs.writeFileSync(metaPath, JSON.stringify(meta));

  const result = runJson('prior-evidence.cjs', ['--data', data, '--project', 'current']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.latestRuns, []);
  assert.ok(result.json.warnings.some((warning) =>
    warning.code === 'prior-run-ineligible' && warning.message.includes('retrospectives-only')));
});

test('automatic discovery rejects symlinked project, run, and run-file injection', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-symlink-auto-'));
  writeRun(data, 'alpha', '2026-01-01', [watch('safe', 'Safe')]);

  const externalProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-symlink-project-'));
  const externalProjectRun = writeRun(externalProjectRoot, 'injected-project', '2026-02-01', [watch('project-link', 'Project link')]);
  fs.symlinkSync(path.dirname(externalProjectRun), path.join(data, 'runs/injected-project'), 'dir');

  const externalRunRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-symlink-run-'));
  const externalRun = writeRun(externalRunRoot, 'unused', '2026-03-01', [watch('run-link', 'Run link')]);
  fs.mkdirSync(path.join(data, 'runs/injected-run'), { recursive: true });
  fs.symlinkSync(externalRun, path.join(data, 'runs/injected-run/2026-03-01'), 'dir');

  const linkedFileRun = writeRun(data, 'injected-file', '2026-04-01', [watch('file-link', 'File link')]);
  const triagePath = path.join(linkedFileRun, 'triage.json');
  const outsideTriage = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'prior-symlink-file-')), 'triage.json');
  fs.copyFileSync(triagePath, outsideTriage);
  fs.rmSync(triagePath);
  fs.symlinkSync(outsideTriage, triagePath);

  const result = runJson('prior-evidence.cjs', ['--data', data, '--project', 'current']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.latestRuns.map((entry) => entry.project), ['alpha']);
  assert.deepEqual(result.json.recurrence.map((entry) => entry.key), ['safe']);
  assert.equal(result.json.warnings.filter((warning) => warning.code === 'prior-run-ineligible').length, 3);
});

test('Data rejects a symlinked owned runs root', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-symlink-runs-root-'));
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-symlink-runs-target-'));
  writeRun(external, 'alpha', '2026-01-01', [watch('notice', 'Notice')]);
  fs.symlinkSync(path.join(external, 'runs'), path.join(data, 'runs'), 'dir');

  const result = runJson('prior-evidence.cjs', ['--data', data, '--project', 'current']);
  assert.equal(result.status, 3);
  assert.equal(result.json, null);
  assert.match(result.stderr, /no readable runs\/ directory/);
});

test('explicit PriorReports rejects symlinked run files', () => {
  for (const name of ['report.md', 'triage.json', 'meta.json', 'inventory.json', 'resolution.json']) {
    const external = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-symlink-explicit-'));
    const run = writeRun(external, 'alpha', '2026-04-01', [watch('notice', 'Notice')]);
    const file = path.join(run, name);
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-symlink-target-'));
    const target = path.join(targetDir, name);
    fs.copyFileSync(file, target);
    fs.rmSync(file);
    fs.symlinkSync(target, file);

    const result = runJson('prior-evidence.cjs', [
      '--project', 'current',
      '--prior-reports', path.join(run, 'report.md'),
    ]);
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    assert.deepEqual(result.json.latestRuns, []);
    assert.ok(result.json.warnings.some((warning) => warning.code === 'prior-report-ineligible'));
  }
});

test('a malformed newer run is ineligible and produces a warning', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-ineligible-'));
  writeRun(data, 'alpha', '2026-01-01', [watch('notice', 'Notice')]);
  const broken = path.join(data, 'runs', 'alpha', '2026-02-01');
  fs.mkdirSync(broken, { recursive: true });
  fs.writeFileSync(path.join(broken, 'triage.json'), '{ broken');
  const result = runJson('prior-evidence.cjs', ['--data', data, '--project', 'current']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.latestRuns[0].run, '2026-01-01');
  assert.ok(result.json.warnings.some((warning) => warning.code === 'prior-run-ineligible'));
});

test('a lexically newer but impossible calendar date cannot shadow the latest valid run', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-calendar-'));
  writeRun(data, 'alpha', '2026-02-28', [watch('notice', 'Notice')]);
  writeRun(data, 'alpha', '2026-99-99', [watch('banner', 'Banner')]);

  const result = runJson('prior-evidence.cjs', ['--data', data, '--project', 'current']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.latestRuns.map((run) => run.run), ['2026-02-28']);
  assert.deepEqual(result.json.recurrence.map((entry) => entry.key), ['notice']);
  assert.ok(result.json.warnings.some((warning) =>
    warning.code === 'prior-run-ineligible' && warning.message.includes('2026-99-99')));
});

test('an explicit PriorReports run outside Data contributes to recurrence', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-explicit-data-'));
  fs.mkdirSync(path.join(data, 'runs'), { recursive: true });
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-explicit-run-'));
  const run = writeRun(external, 'external-project', '2026-04-01', [watch('notice', 'Notice')]);
  const report = path.join(run, 'report.md');

  const result = runJson('prior-evidence.cjs', [
    '--data', data,
    '--project', 'current',
    '--prior-reports', report,
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.latestRuns.map((entry) => entry.report), [report]);
  assert.deepEqual(result.json.legacyReports, [report]);
  assert.deepEqual(result.json.recurrence.map((entry) => entry.key), ['notice']);
});

test('PriorReports is a functional escape hatch when Data is unavailable', () => {
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-explicit-only-'));
  const run = writeRun(external, 'external-project', '2026-04-01', [watch('notice', 'Notice')]);
  const report = path.join(run, 'report.md');

  const result = runJson('prior-evidence.cjs', [
    '--project', 'current',
    '--prior-reports', report,
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.data, null);
  assert.deepEqual(result.json.latestRuns.map((entry) => entry.report), [report]);
  assert.deepEqual(result.json.legacyReports, [report]);
  assert.equal(result.json.recurrence[0].occurrences[0].project, 'external-project');
});

test('an older explicit report cannot displace the automatic latest run for its project', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-explicit-stale-data-'));
  const latest = writeRun(data, 'alpha', '2026-04-01', [watch('banner', 'Banner')]);
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-explicit-stale-run-'));
  const stale = writeRun(external, 'alpha', '2026-03-01', [watch('notice', 'Notice')]);
  const staleReport = path.join(stale, 'report.md');

  const result = runJson('prior-evidence.cjs', [
    '--data', data,
    '--project', 'current',
    '--prior-reports', staleReport,
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.latestRuns.map((entry) => entry.report), [path.join(latest, 'report.md')]);
  assert.deepEqual(result.json.legacyReports, []);
  assert.deepEqual(result.json.recurrence.map((entry) => entry.key), ['banner']);
  assert.ok(result.json.warnings.some((warning) => warning.code === 'prior-report-superseded'));
});

test('a newer eligible explicit report wins the same latest-per-project merge', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-explicit-newer-data-'));
  const automatic = writeRun(data, 'alpha', '2026-03-01', [watch('notice', 'Notice')]);
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-explicit-newer-run-'));
  const newest = writeRun(external, 'alpha', '2026-04-01', [watch('banner', 'Banner')]);
  const newestReport = path.join(newest, 'report.md');

  const result = runJson('prior-evidence.cjs', [
    '--data', data,
    '--project', 'current',
    '--prior-reports', newestReport,
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.latestRuns.map((entry) => entry.report), [newestReport]);
  assert.deepEqual(result.json.legacyReports, [newestReport]);
  assert.ok(result.json.supersededRuns.some((entry) => entry.triage === path.join(automatic, 'triage.json')));
  assert.deepEqual(result.json.recurrence.map((entry) => entry.key), ['banner']);
});

test('an explicit report must retain the same eligible sibling run contract', () => {
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'prior-explicit-invalid-'));
  const run = writeRun(external, 'alpha', '2026-04-01', [watch('notice', 'Notice')]);
  const report = path.join(run, 'report.md');
  fs.writeFileSync(path.join(run, 'meta.json'), JSON.stringify({
    schemaVersion: 1,
    date: '2026-03-01',
    project: { slug: 'alpha' },
  }));

  const result = runJson('prior-evidence.cjs', [
    '--project', 'current',
    '--prior-reports', report,
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.latestRuns, []);
  assert.deepEqual(result.json.legacyReports, []);
  assert.deepEqual(result.json.recurrence, []);
  assert.ok(result.json.warnings.some((warning) => warning.code === 'prior-report-ineligible'));
});
