#!/usr/bin/env node
/**
 * execution-ledger.cjs — maintain the deterministic run execution ledger.
 *
 * The JSON ledger is canonical. The Markdown file is always rendered from it, so
 * a human-readable audit cannot drift from the machine-readable history. Events
 * are append-only and idempotent by explicit id: replaying the same event is a
 * no-op; reusing an id with different content is a hard conflict.
 *
 * Usage:
 *   node execution-ledger.cjs init --output <dir> --run <slug/date>
 *     [--publication merge|pull-request|working-tree]
 *   node execution-ledger.cjs record --output <dir> --id <stable-id>
 *     --phase <phase> --action <action> --status <status> --summary <text>
 *     [--repository <role>] [--evidence <json-array>]
 *   node execution-ledger.cjs finish --output <dir>
 *     --status complete|stopped|blocked|failed --summary <text>
 *     [--remaining <json-array>]
 *   node execution-ledger.cjs render --output <dir>
 *
 * Exit codes:
 *   0  success, including an exact idempotent replay
 *   1  unexpected failure
 *   2  invalid invocation
 *   3  --output is missing or is not a directory
 *   4  ledger is missing, malformed, or conflicts with the requested mutation
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs, checkArgs, isDir, isFile, readJsonSafe, usage } = require('./lib/util.cjs');

const JSON_NAME = 'execution-log.json';
const MARKDOWN_NAME = 'execution-log.md';
const PUBLICATIONS = ['merge', 'pull-request', 'working-tree'];
const RUN_STATUSES = ['running', 'complete', 'stopped', 'blocked', 'failed'];
const FINAL_STATUSES = ['complete', 'stopped', 'blocked', 'failed'];
const PHASES = ['analyze', 'publish-evidence', 'promote', 'capture', 'reconcile'];
const EVENT_STATUSES = ['passed', 'warning', 'skipped', 'blocked', 'failed'];
const REPOSITORIES = ['project', 'evidence', 'brain', 'library', 'orchestration', 'none'];
const TOKEN_RE = /^[a-z0-9][a-z0-9.-]*$/;
const EVENT_ID_RE = /^[a-z0-9][a-z0-9._-]*$/;

const USAGE = [
  'Usage:',
  '  node execution-ledger.cjs init --output <dir> --run <slug/date> [--publication merge|pull-request|working-tree]',
  '  node execution-ledger.cjs record --output <dir> --id <stable-id> --phase <phase> --action <action> --status <status> --summary <text> [--repository <role>] [--evidence <json-array>]',
  '  node execution-ledger.cjs finish --output <dir> --status complete|stopped|blocked|failed --summary <text> [--remaining <json-array>]',
  '  node execution-ledger.cjs render --output <dir>',
];

function die(message, code = 4) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(code);
}

function oneLine(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && !/[\r\n]/.test(value);
}

function parseStringArray(raw, flag) {
  if (raw === undefined) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    usage(`--${flag} must be a JSON array of strings: ${err.message}`, USAGE);
  }
  if (!Array.isArray(parsed) || parsed.some((value) => !oneLine(value))) {
    usage(`--${flag} must be a JSON array of non-empty one-line strings`, USAGE);
  }
  return parsed;
}

function eventComparable(event) {
  return {
    id: event.id,
    phase: event.phase,
    action: event.action,
    status: event.status,
    summary: event.summary,
    repository: event.repository,
    evidence: event.evidence,
  };
}

function phaseStatus(ledger, phase) {
  const event = [...ledger.events].reverse().find((item) => item.phase === phase);
  return event ? { status: event.status, event: event.id } : { status: 'pending', event: '—' };
}

function titleCase(value) {
  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

function renderLedger(ledger) {
  const lines = [
    '# Retrospective execution log',
    '',
    `Run: \`${ledger.run}\``,
    '',
    `Publication: \`${ledger.publication}\``,
    '',
    `Status: ${titleCase(ledger.status)}`,
    '',
    `Summary: ${ledger.summary}`,
    '',
    '## Phase status',
    '',
    '| Phase | Status | Last event |',
    '|---|---|---|',
  ];

  for (const phase of PHASES) {
    const current = phaseStatus(ledger, phase);
    lines.push(`| ${titleCase(phase)} | ${titleCase(current.status)} | ${current.event === '—' ? current.event : `\`${current.event}\``} |`);
  }

  lines.push('', '## Events', '');
  if (ledger.events.length === 0) {
    lines.push('No events recorded.');
  } else {
    lines.push('| # | Phase | Action | Status | Repository | Result | Evidence |', '|---:|---|---|---|---|---|---|');
    for (const event of ledger.events) {
      const evidence = event.evidence.length > 0
        ? event.evidence.map((item) => `\`${escapeCell(item)}\``).join('<br>')
        : '—';
      lines.push(
        `| ${event.sequence} | ${titleCase(event.phase)} | \`${event.action}\` | ${titleCase(event.status)} | ${titleCase(event.repository)} | ${escapeCell(event.summary)} | ${evidence} |`,
      );
    }
  }

  const exceptions = ledger.events.filter((event) => ['warning', 'blocked', 'failed'].includes(event.status));
  lines.push('', '## Warnings and blockers', '');
  if (exceptions.length === 0) lines.push('- None.');
  else {
    for (const event of exceptions) lines.push(`- ${titleCase(event.status)} — \`${event.id}\`: ${event.summary}`);
  }

  lines.push('', '## Remaining work', '');
  for (const item of ledger.remaining) lines.push(`- ${item}`);
  lines.push('');
  return lines.join('\n');
}

function ledgerProblems(ledger) {
  const problems = [];
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) return ['ledger is not a JSON object'];
  if (ledger.schemaVersion !== 1) problems.push('schemaVersion must be 1');
  if (!oneLine(ledger.run) || !/^[a-z0-9][a-z0-9-]*\/\d{4}-\d{2}-\d{2}$/.test(ledger.run)) {
    problems.push('run must be <kebab-project-slug>/<YYYY-MM-DD>');
  }
  if (!PUBLICATIONS.includes(ledger.publication)) problems.push(`publication must be one of: ${PUBLICATIONS.join(', ')}`);
  if (!RUN_STATUSES.includes(ledger.status)) problems.push(`status must be one of: ${RUN_STATUSES.join(', ')}`);
  if (!oneLine(ledger.summary)) problems.push('summary must be a non-empty one-line string');
  if (!Array.isArray(ledger.remaining) || ledger.remaining.length === 0 || ledger.remaining.some((item) => !oneLine(item))) {
    problems.push('remaining must be a non-empty array of one-line strings');
  }
  if (ledger.status === 'complete' && (ledger.remaining.length !== 1 || ledger.remaining[0] !== 'None.')) {
    problems.push('a complete ledger must set remaining to exactly ["None."]');
  }
  if (!Array.isArray(ledger.events)) return [...problems, 'events must be an array'];

  const ids = new Set();
  for (let index = 0; index < ledger.events.length; index += 1) {
    const event = ledger.events[index];
    const label = `events[${index}]`;
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      problems.push(`${label} must be an object`);
      continue;
    }
    if (event.sequence !== index + 1) problems.push(`${label}.sequence must be ${index + 1}`);
    if (!oneLine(event.id) || !EVENT_ID_RE.test(event.id)) problems.push(`${label}.id is not a stable lowercase id`);
    else if (ids.has(event.id)) problems.push(`${label}.id duplicates ${event.id}`);
    else ids.add(event.id);
    if (!PHASES.includes(event.phase)) problems.push(`${label}.phase must be one of: ${PHASES.join(', ')}`);
    if (!oneLine(event.action) || !TOKEN_RE.test(event.action)) problems.push(`${label}.action is not a lowercase action token`);
    if (!EVENT_STATUSES.includes(event.status)) problems.push(`${label}.status must be one of: ${EVENT_STATUSES.join(', ')}`);
    if (!oneLine(event.summary)) problems.push(`${label}.summary must be a non-empty one-line string`);
    if (!REPOSITORIES.includes(event.repository)) problems.push(`${label}.repository must be one of: ${REPOSITORIES.join(', ')}`);
    if (!Array.isArray(event.evidence) || event.evidence.some((item) => !oneLine(item))) {
      problems.push(`${label}.evidence must be an array of one-line strings`);
    }
  }
  if (ledger.status === 'blocked' && !ledger.events.some((event) => event.status === 'blocked')) {
    problems.push('a blocked ledger must contain at least one blocked event');
  }
  if (ledger.status === 'failed' && !ledger.events.some((event) => event.status === 'failed')) {
    problems.push('a failed ledger must contain at least one failed event');
  }
  return problems;
}

function readLedger(output) {
  const file = path.join(output, JSON_NAME);
  if (!isFile(file)) return { ok: false, error: `${JSON_NAME} is missing` };
  const read = readJsonSafe(file);
  if (!read.ok) return { ok: false, error: `${JSON_NAME} could not be parsed: ${read.error}` };
  const problems = ledgerProblems(read.value);
  if (problems.length > 0) return { ok: false, error: problems.join('; ') };
  return { ok: true, value: read.value };
}

function writeLedger(output, ledger) {
  const problems = ledgerProblems(ledger);
  if (problems.length > 0) die(problems.join('; '));
  fs.writeFileSync(path.join(output, JSON_NAME), `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(output, MARKDOWN_NAME), renderLedger(ledger), 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    keys: ['output', 'run', 'publication', 'id', 'phase', 'action', 'status', 'summary', 'repository', 'evidence', 'remaining'],
  });
  checkArgs(args, USAGE);
  if (args.positional.length !== 1 || !['init', 'record', 'finish', 'render'].includes(args.positional[0])) {
    usage('exactly one command is required: init, record, finish, or render', USAGE);
  }
  if (!args.values.output) usage('--output is required', USAGE);
  const output = path.resolve(args.values.output);
  if (!isDir(output)) die(`--output is not a directory: ${output}`, 3);
  const command = args.positional[0];

  if (command === 'init') {
    if (!args.values.run) usage('--run is required for init', USAGE);
    const requested = {
      schemaVersion: 1,
      run: args.values.run,
      publication: args.values.publication || 'merge',
      status: 'running',
      summary: 'Retrospective execution is in progress.',
      events: [],
      remaining: ['Complete analyze, publication, promotion, capture, and evidence reconciliation.'],
    };
    const existing = readLedger(output);
    if (existing.ok) {
      if (existing.value.run !== requested.run || existing.value.publication !== requested.publication) {
        die(`existing ledger is for ${existing.value.run} (${existing.value.publication}), not ${requested.run} (${requested.publication})`);
      }
      writeLedger(output, existing.value);
      process.stdout.write(`NOOP ${path.join(output, JSON_NAME)}\n`);
      return;
    }
    if (isFile(path.join(output, JSON_NAME))) die(existing.error);
    writeLedger(output, requested);
    process.stdout.write(`INITIALIZED ${path.join(output, JSON_NAME)}\n`);
    return;
  }

  const read = readLedger(output);
  if (!read.ok) die(read.error);
  const ledger = read.value;

  if (command === 'render') {
    writeLedger(output, ledger);
    process.stdout.write(`RENDERED ${path.join(output, MARKDOWN_NAME)}\n`);
    return;
  }

  if (command === 'record') {
    for (const key of ['id', 'phase', 'action', 'status', 'summary']) {
      if (!args.values[key]) usage(`--${key} is required for record`, USAGE);
    }
    const event = {
      sequence: ledger.events.length + 1,
      id: args.values.id,
      phase: args.values.phase,
      action: args.values.action,
      status: args.values.status,
      summary: args.values.summary,
      repository: args.values.repository || 'none',
      evidence: parseStringArray(args.values.evidence, 'evidence'),
    };
    const existing = ledger.events.find((item) => item.id === event.id);
    if (existing) {
      if (JSON.stringify(eventComparable(existing)) !== JSON.stringify(eventComparable(event))) {
        die(`event id "${event.id}" already exists with different content`);
      }
      writeLedger(output, ledger);
      process.stdout.write(`NOOP ${event.id}\n`);
      return;
    }
    ledger.events.push(event);
    writeLedger(output, ledger);
    process.stdout.write(`RECORDED ${event.id}\n`);
    return;
  }

  if (!args.values.status || !args.values.summary) usage('--status and --summary are required for finish', USAGE);
  if (!FINAL_STATUSES.includes(args.values.status)) usage(`--status must be one of: ${FINAL_STATUSES.join(', ')}`, USAGE);
  ledger.status = args.values.status;
  ledger.summary = args.values.summary;
  ledger.remaining = args.values.status === 'complete'
    ? ['None.']
    : parseStringArray(args.values.remaining, 'remaining');
  if (ledger.remaining.length === 0) usage('--remaining is required when finish status is stopped, blocked, or failed', USAGE);
  writeLedger(output, ledger);
  process.stdout.write(`FINISHED ${ledger.status}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`error: ${err && err.stack ? err.stack : err}\n`);
    process.exit(1);
  }
}

module.exports = {
  EVENT_STATUSES,
  JSON_NAME,
  MARKDOWN_NAME,
  PHASES,
  PUBLICATIONS,
  REPOSITORIES,
  RUN_STATUSES,
  ledgerProblems,
  renderLedger,
};
