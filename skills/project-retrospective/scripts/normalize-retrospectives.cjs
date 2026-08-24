#!/usr/bin/env node
/**
 * normalize-retrospectives.cjs — join a Confluence retrospective capture with
 * model-authored findings, validate action accountability, and optionally
 * preserve the reviewed page bodies in ui-design-evidence.
 *
 * Scripts decide structure; the model writes prose. The network fetch and the
 * semantic synthesis happen before this script. This script deduplicates pages,
 * reconciles discovery enumerations, validates page references, assigns stable
 * action ids, checks as-built corroboration mechanically, and writes two JSON
 * contracts: retrospectives.json and retrospective-actions.json.
 *
 * Usage:
 *   node normalize-retrospectives.cjs --raw <retrospectives-raw.json>
 *     --findings <retrospective-findings.json> --project-slug <slug>
 *     [--inventory <inventory.json>] [--archive <source-dir>]
 *     [--actions-out <retrospective-actions.json>] [--out <retrospectives.json>]
 *     [--pretty]
 *
 * Exit codes:
 *   0 success, including degraded captures whose warnings are recorded
 *   1 unexpected failure
 *   2 invalid invocation or output failure
 *   3 unreadable/unsupported raw or findings input
 */

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  parseArgs,
  checkArgs,
  readJsonSafe,
  normalizeLabel,
  Warnings,
  writeOut,
  usage,
} = require('./lib/util.cjs');

const USAGE = [
  'Usage: node normalize-retrospectives.cjs --raw <file> --findings <file> --project-slug <slug> [--inventory <file>] [--archive <dir>] [--actions-out <file>] [--out <file>] [--pretty]',
];
const SCHEMA = 1;
const STATUSES = new Set(['needs-owner', 'open', 'in-progress', 'blocked', 'done', 'wont-do']);
const DESTINATIONS = new Set([
  'project',
  'ui-design-brain',
  'ui-design-library',
  'ai-orchestration',
  'evidence-wiki',
  'external',
]);
const STRONG_AS_BUILT = new Set(['component-index', 'build-pack', 'fingerprint', 'design-facts', 'memory']);
// Obvious secret assignments are never archived. This intentionally does not
// guess at names or ordinary emails; semantic/customer-data review remains the
// model's responsibility before it creates the raw capture.
const SECRET_RE = /\b(?:api[_-]?key|access[_-]?token|authorization|client[_-]?secret|password|passwd|secret)\s*[:=]\s*\S+/i;

function fail(code, message) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(code);
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim()) : [];
}

function pageKey(page) {
  return String(page && page.pageId != null ? page.pageId : '').trim();
}

function classify(title) {
  const text = String(title || '').toLowerCase();
  const phase = /design/.test(text)
    ? 'design'
    : /build|implementation|development/.test(text)
      ? 'build'
      : /release|launch|deploy/.test(text)
        ? 'release'
        : /incident|outage|issue/.test(text)
          ? 'incident'
          : 'unknown';
  const format = /post[ -]?mortem/.test(text)
    ? 'post-mortem'
    : /lessons?[ -]learned/.test(text)
      ? 'lessons-learned'
      : /retro(spective)?/.test(text)
        ? 'retrospective'
        : 'other';
  return { phase, format };
}

function dedupePages(rawPages, warnings) {
  const byId = new Map();
  for (const page of Array.isArray(rawPages) ? rawPages : []) {
    if (!page || typeof page !== 'object') {
      warnings.add('page-malformed', 'A raw page entry was not an object and was skipped.');
      continue;
    }
    const id = pageKey(page);
    if (!id) {
      warnings.add('page-id-missing', `Page "${page.title || '?'}" has no pageId and was skipped.`);
      continue;
    }
    const previous = byId.get(id);
    if (previous) {
      warnings.add('duplicate-page', `Page ${id} was captured more than once; the highest version was retained.`);
      const prevVersion = Number(previous.version || 0);
      const nextVersion = Number(page.version || 0);
      if (nextVersion < prevVersion) continue;
      page.explicit = Boolean(page.explicit || previous.explicit);
    }
    byId.set(id, { ...page, pageId: id });
  }
  return [...byId.values()].sort((a, b) => a.pageId.localeCompare(b.pageId));
}

function reconcileDiscovery(source, pages, excluded, warnings) {
  const accounted = new Set([
    ...pages.map((page) => page.pageId),
    ...(Array.isArray(excluded) ? excluded.map(pageKey).filter(Boolean) : []),
  ]);
  const expected = new Set();
  for (const space of Array.isArray(source && source.spaces) ? source.spaces : []) {
    for (const query of Array.isArray(space && space.queries) ? space.queries : []) {
      const ids = stringArray(query.pageIds);
      const total = Number(query.totalCount);
      if (Number.isFinite(total) && total !== ids.length) {
        warnings.add(
          'discovery-enumeration-incomplete',
          `${space.space || '?'} query "${query.term || '?'}" enumerated ${ids.length} of ${total} page(s).`,
        );
      }
      for (const id of ids) expected.add(id);
    }
  }
  for (const id of expected) {
    if (!accounted.has(id)) warnings.add('retrospective-uncaptured', `Discovered page ${id} was not captured or excluded.`);
  }
}

function inventoryIndex(inventory, warnings) {
  const index = new Map();
  if (!inventory) return index;
  if (inventory.schemaVersion !== SCHEMA || !Array.isArray(inventory.components)) {
    warnings.add('inventory-unreadable', 'The optional inventory is not a schemaVersion 1 component inventory; corroboration was disabled.');
    return index;
  }
  for (const component of inventory.components) {
    if (!component || typeof component !== 'object') continue;
    const keys = [component.name, component.folder].map(normalizeLabel).filter(Boolean);
    for (const key of keys) index.set(key, component);
  }
  return index;
}

function normalizeSignal(signal, invIndex, warnings, pageId) {
  if (!signal || typeof signal !== 'object') return null;
  const label = String(signal.label || '').trim();
  const normalized = normalizeLabel(label);
  if (!normalized) return null;
  const component = invIndex.get(normalized) || null;
  const sources = component && Array.isArray(component.sources) ? component.sources : [];
  const strongSources = sources.filter((source) => STRONG_AS_BUILT.has(source));
  const corroboratingPaths = stringArray(signal.corroboratingPaths);
  const eligible = Boolean(signal.agreesWithAsBuilt === true && component && strongSources.length && corroboratingPaths.length);
  if (signal.agreesWithAsBuilt === true && !eligible) {
    warnings.add(
      'retrospective-corroboration-ineligible',
      `Page ${pageId} signal "${label}" lacks a matched component, strong as-built source, or corroborating path; it remains contextual.`,
    );
  }
  return {
    label,
    normalized,
    summary: String(signal.summary || '').trim(),
    corroboratingPaths,
    strongSources: [...new Set(strongSources)].sort(),
    eligible,
  };
}

function stableActionId(projectSlug, sourcePageIds, title) {
  const seed = `${projectSlug}\0${[...sourcePageIds].sort().join(',')}\0${normalizeLabel(title)}`;
  return `retro-action-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12)}`;
}

function normalizeAction(action, projectSlug, pageIds, warnings) {
  if (!action || typeof action !== 'object') return null;
  const title = String(action.title || '').trim();
  const summary = String(action.summary || '').trim();
  const sourcePageIds = stringArray(action.sourcePageIds);
  if (!title || !summary || !sourcePageIds.length) {
    warnings.add('action-malformed', 'An action missing title, summary, or sourcePageIds was skipped.');
    return null;
  }
  const unknownPages = sourcePageIds.filter((id) => !pageIds.has(id));
  if (unknownPages.length) {
    warnings.add('action-source-missing', `Action "${title}" cites uncaptured page(s): ${unknownPages.join(', ')}; it was skipped.`);
    return null;
  }
  let status = String(action.status || '').trim().toLowerCase();
  const owner = typeof action.owner === 'string' && action.owner.trim() ? action.owner.trim() : null;
  if (!owner) status = 'needs-owner';
  if (!STATUSES.has(status)) {
    warnings.add('action-status', `Action "${title}" used unknown status "${status || '?'}"; normalized to needs-owner.`);
    status = 'needs-owner';
  }
  let destination = String(action.destination || '').trim();
  if (!DESTINATIONS.has(destination)) {
    warnings.add('action-destination', `Action "${title}" used unknown destination "${destination || '?'}"; normalized to project.`);
    destination = 'project';
  }
  const evidence = String(action.evidence || '').trim();
  const rationale = String(action.rationale || '').trim();
  if (status === 'done' && !evidence) {
    warnings.add('action-completion-proof', `Action "${title}" was marked done without evidence; normalized to open.`);
    status = owner ? 'open' : 'needs-owner';
  }
  if (status === 'wont-do' && !rationale) {
    warnings.add('action-wont-do-rationale', `Action "${title}" was marked wont-do without a rationale; normalized to open.`);
    status = owner ? 'open' : 'needs-owner';
  }
  return {
    id: stableActionId(projectSlug, sourcePageIds, title),
    title,
    summary,
    sourcePageIds: [...new Set(sourcePageIds)].sort(),
    destination,
    owner,
    nextStep: String(action.nextStep || '').trim(),
    status,
    evidence: evidence || null,
    rationale: rationale || null,
    componentLabels: stringArray(action.componentLabels),
    corroboratingPaths: stringArray(action.corroboratingPaths),
  };
}

function archivePages(pages, archiveDir, warnings) {
  if (!archiveDir) return { archived: 0, skippedSensitive: 0 };
  let archived = 0;
  let skippedSensitive = 0;
  for (const page of pages) {
    const body = typeof page.bodyMarkdown === 'string' ? page.bodyMarkdown : '';
    if (SECRET_RE.test(body)) {
      skippedSensitive += 1;
      warnings.add('archive-sensitive-content', `Page ${page.pageId} contains an obvious credential assignment and was not archived.`);
      continue;
    }
    const version = Number(page.version || 0);
    const title = normalizeLabel(page.title || '') || 'page';
    const name = `${page.pageId}-v${version}-${title}.md`;
    try {
      fs.mkdirSync(archiveDir, { recursive: true });
      fs.writeFileSync(path.join(archiveDir, name), body, { encoding: 'utf8', flag: 'wx' });
      page.archived = name;
      archived += 1;
    } catch (err) {
      if (err.code === 'EEXIST') {
        page.archived = name;
        warnings.add('archive-exists', `${name} already exists; it was not overwritten.`);
      } else {
        warnings.add('archive-write', `Could not archive page ${page.pageId}: ${err.message}`);
      }
    }
  }
  return { archived, skippedSensitive };
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    keys: ['raw', 'findings', 'project-slug', 'inventory', 'archive', 'actions-out', 'out'],
    flags: ['pretty'],
  });
  const { values } = args;
  checkArgs(args, USAGE);
  if (!values.raw || !values.findings || !values['project-slug']) {
    usage('--raw, --findings, and --project-slug are required', USAGE);
  }
  const projectSlug = normalizeLabel(values['project-slug']);
  if (!projectSlug || projectSlug !== values['project-slug']) usage('--project-slug must be kebab-case', USAGE);

  const rawRead = readJsonSafe(path.resolve(values.raw));
  const findingsRead = readJsonSafe(path.resolve(values.findings));
  if (!rawRead.ok) fail(3, `raw capture could not be parsed: ${rawRead.error}`);
  if (!findingsRead.ok) fail(3, `findings could not be parsed: ${findingsRead.error}`);
  if (rawRead.value?.schemaVersion !== SCHEMA || !Array.isArray(rawRead.value.pages)) {
    fail(3, 'raw capture must be schemaVersion 1 with a pages array');
  }
  if (findingsRead.value?.schemaVersion !== SCHEMA || !Array.isArray(findingsRead.value.pages) || !Array.isArray(findingsRead.value.actions)) {
    fail(3, 'findings must be schemaVersion 1 with pages and actions arrays');
  }

  const warnings = new Warnings();
  const pages = dedupePages(rawRead.value.pages, warnings);
  reconcileDiscovery(rawRead.value.source, pages, rawRead.value.excluded, warnings);
  const pageIds = new Set(pages.map((page) => page.pageId));
  const findingByPage = new Map();
  for (const finding of findingsRead.value.pages) {
    const id = pageKey(finding);
    if (!id || !pageIds.has(id)) {
      warnings.add('finding-page-missing', `A finding cites uncaptured page ${id || '?'} and was skipped.`);
      continue;
    }
    if (findingByPage.has(id)) warnings.add('finding-duplicate', `Page ${id} has more than one findings entry; the last one was retained.`);
    findingByPage.set(id, finding);
  }

  let inventory = null;
  if (values.inventory) {
    const read = readJsonSafe(path.resolve(values.inventory));
    if (!read.ok) warnings.add('inventory-unreadable', `--inventory could not be parsed: ${read.error}`);
    else inventory = read.value;
  }
  const invIndex = inventoryIndex(inventory, warnings);

  for (const page of pages) {
    const finding = findingByPage.get(page.pageId) || null;
    if (!finding) warnings.add('finding-missing', `Captured page ${page.pageId} has no findings entry.`);
    const classification = classify(page.title);
    page.phase = String(finding?.phase || classification.phase);
    page.format = String(finding?.format || classification.format);
    page.summary = String(finding?.summary || '').trim();
    page.takeaways = stringArray(finding?.takeaways);
    page.componentSignals = (Array.isArray(finding?.componentSignals) ? finding.componentSignals : [])
      .map((signal) => normalizeSignal(signal, invIndex, warnings, page.pageId))
      .filter(Boolean);
  }

  const actionById = new Map();
  for (const candidate of findingsRead.value.actions) {
    const action = normalizeAction(candidate, projectSlug, pageIds, warnings);
    if (!action) continue;
    if (actionById.has(action.id)) {
      warnings.add('action-duplicate', `Action ${action.id} was declared more than once; the first declaration was retained.`);
      continue;
    }
    actionById.set(action.id, action);
  }
  const actions = [...actionById.values()].sort((a, b) => a.id.localeCompare(b.id));
  const archive = archivePages(pages, values.archive ? path.resolve(values.archive) : null, warnings);

  const excluded = (Array.isArray(rawRead.value.excluded) ? rawRead.value.excluded : [])
    .filter((item) => item && typeof item === 'object' && typeof item.reason === 'string' && item.reason.trim())
    .map((item) => ({ pageId: pageKey(item) || null, title: String(item.title || ''), url: String(item.url || ''), reason: item.reason.trim() }));

  const pack = {
    schemaVersion: SCHEMA,
    projectSlug,
    source: rawRead.value.source || { spaces: [] },
    pages: pages.map((page) => Object.fromEntries(Object.entries(page).filter(([key]) => key !== 'bodyMarkdown'))),
    themes: Array.isArray(findingsRead.value.themes) ? findingsRead.value.themes : [],
    contradictions: Array.isArray(findingsRead.value.contradictions) ? findingsRead.value.contradictions : [],
    excluded,
    counts: {
      pages: pages.length,
      excluded: excluded.length,
      findings: findingByPage.size,
      actions: actions.length,
      needsOwner: actions.filter((action) => action.status === 'needs-owner').length,
      eligibleComponentSignals: pages.flatMap((page) => page.componentSignals).filter((signal) => signal.eligible).length,
      archived: archive.archived,
      skippedSensitive: archive.skippedSensitive,
    },
    warnings: warnings.toJSON(),
  };
  const actionPack = { schemaVersion: SCHEMA, projectSlug, actions, counts: { total: actions.length, needsOwner: pack.counts.needsOwner } };

  writeOut(pack, values.out, values.pretty);
  if (values['actions-out']) writeOut(actionPack, values['actions-out'], values.pretty);
}

try {
  main();
} catch (err) {
  process.stderr.write(`error: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
}
