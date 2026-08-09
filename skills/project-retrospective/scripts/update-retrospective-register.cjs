#!/usr/bin/env node
/**
 * update-retrospective-register.cjs — merge one run's immutable action pack into
 * a living, human-editable per-project Markdown register.
 *
 * Existing owner/status/next-step/evidence/rationale/issue fields win for a known
 * action id, so a later ingestion cannot erase follow-through. Source page ids and
 * run paths are additive. The output is deterministic and safe to regenerate.
 *
 * Usage:
 *   node update-retrospective-register.cjs --actions <file>
 *     --client-slug <slug> --project-slug <slug> --run <runs/.../>
 *     [--issue-url <url>] --out <wiki/actions/...md>
 *
 * Exit codes: 0 success, 1 unexpected failure, 2 invalid invocation/write,
 * 3 unreadable/unsupported action pack.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  parseArgs,
  checkArgs,
  readJsonSafe,
  readTextSafe,
  normalizeLabel,
  usage,
} = require('./lib/util.cjs');

const USAGE = [
  'Usage: node update-retrospective-register.cjs --actions <file> --client-slug <slug> --project-slug <slug> --run <runs/.../> [--issue-url <url>] --out <file>',
];
const STATUS_ORDER = ['needs-owner', 'open', 'in-progress', 'blocked', 'done', 'wont-do'];
const STATUS_HEADINGS = {
  'needs-owner': 'Needs owner',
  open: 'Open',
  'in-progress': 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  'wont-do': "Won't do",
};

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item && item !== 'none');
}

function parseExisting(text) {
  const entries = new Map();
  const re = /^### (retro-action-[a-f0-9]{12}) — (.+)\n([\s\S]*?)(?=^### |^## |(?![\s\S]))/gm;
  for (const match of String(text || '').matchAll(re)) {
    const fields = {};
    for (const line of match[3].split('\n')) {
      const field = /^- ([A-Za-z ]+):\s*(.*)$/.exec(line.trim());
      if (field) fields[field[1].toLowerCase().replace(/ /g, '')] = field[2].trim();
    }
    entries.set(match[1], {
      id: match[1],
      title: match[2].trim(),
      status: fields.status,
      owner: fields.owner === 'unassigned' || fields.owner === 'none' ? null : fields.owner,
      destination: fields.destination,
      nextStep: fields.nextstep === 'none' ? '' : fields.nextstep,
      sourcePageIds: parseList(fields.sourcepages),
      sourceRuns: parseList(fields.sourceruns),
      evidence: fields.evidence === 'none' ? null : fields.evidence,
      rationale: fields.rationale === 'none' ? null : fields.rationale,
      issueUrl: fields.issue === 'none' ? null : fields.issue,
    });
  }
  return entries;
}

function mergeAction(incoming, existing, run, issueUrl) {
  const preserve = existing || {};
  const status = STATUS_ORDER.includes(preserve.status) ? preserve.status : incoming.status;
  return {
    ...incoming,
    title: preserve.title || incoming.title,
    status,
    owner: preserve.owner !== undefined ? preserve.owner : incoming.owner,
    destination: preserve.destination || incoming.destination,
    nextStep: preserve.nextStep !== undefined ? preserve.nextStep : incoming.nextStep,
    evidence: preserve.evidence !== undefined ? preserve.evidence : incoming.evidence,
    rationale: preserve.rationale !== undefined ? preserve.rationale : incoming.rationale,
    issueUrl: preserve.issueUrl || issueUrl || null,
    sourcePageIds: [...new Set([...(preserve.sourcePageIds || []), ...(incoming.sourcePageIds || [])])].sort(),
    sourceRuns: [...new Set([...(preserve.sourceRuns || []), run])].sort(),
  };
}

function value(v, fallback = 'none') {
  const text = v == null ? '' : String(v).trim();
  return text || fallback;
}

function render(clientSlug, projectSlug, entries) {
  const lines = [
    '---',
    `client: ${clientSlug}`,
    `project: ${projectSlug}`,
    '---',
    `# ${projectSlug} — Retrospective Actions`,
    '',
    'Living follow-through for actions grounded in captured team retrospectives. Run artifacts remain immutable; update status, owner, and proof here.',
    '',
  ];
  for (const status of STATUS_ORDER) {
    lines.push(`## ${STATUS_HEADINGS[status]}`, '');
    const group = entries.filter((entry) => entry.status === status).sort((a, b) => a.id.localeCompare(b.id));
    if (!group.length) {
      lines.push('- none', '');
      continue;
    }
    for (const entry of group) {
      lines.push(
        `### ${entry.id} — ${entry.title}`,
        `- Status: ${entry.status}`,
        `- Owner: ${value(entry.owner, 'unassigned')}`,
        `- Destination: ${entry.destination}`,
        `- Next step: ${value(entry.nextStep)}`,
        `- Source pages: ${entry.sourcePageIds.join(', ') || 'none'}`,
        `- Source runs: ${entry.sourceRuns.join(', ') || 'none'}`,
        `- Evidence: ${value(entry.evidence)}`,
        `- Rationale: ${value(entry.rationale)}`,
        `- Issue: ${value(entry.issueUrl)}`,
        '',
        entry.summary,
        '',
      );
    }
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    keys: ['actions', 'client-slug', 'project-slug', 'run', 'issue-url', 'out'],
  });
  const { values } = args;
  checkArgs(args, USAGE);
  for (const key of ['actions', 'client-slug', 'project-slug', 'run', 'out']) {
    if (!values[key]) usage(`--${key} is required`, USAGE);
  }
  for (const key of ['client-slug', 'project-slug']) {
    if (normalizeLabel(values[key]) !== values[key]) usage(`--${key} must be kebab-case`, USAGE);
  }
  const read = readJsonSafe(path.resolve(values.actions));
  if (!read.ok) {
    process.stderr.write(`error: action pack could not be parsed: ${read.error}\n`);
    process.exit(3);
  }
  const pack = read.value;
  if (pack?.schemaVersion !== 1 || !Array.isArray(pack.actions)) {
    process.stderr.write('error: action pack must be schemaVersion 1 with an actions array\n');
    process.exit(3);
  }
  const out = path.resolve(values.out);
  const existing = parseExisting(readTextSafe(out) || '');
  const merged = new Map(existing);
  for (const action of pack.actions) {
    if (!action || typeof action !== 'object' || !/^retro-action-[a-f0-9]{12}$/.test(String(action.id || ''))) continue;
    merged.set(action.id, mergeAction(action, existing.get(action.id), values.run, values['issue-url']));
  }
  const markdown = render(values['client-slug'], values['project-slug'], [...merged.values()]);
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, markdown, 'utf8');
  } catch (err) {
    process.stderr.write(`error: could not write ${out}: ${err.message}\n`);
    process.exit(2);
  }
}

try {
  main();
} catch (err) {
  process.stderr.write(`error: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
}
