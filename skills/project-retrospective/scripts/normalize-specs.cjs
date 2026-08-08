#!/usr/bin/env node
/**
 * normalize-specs.cjs — structure captured Confluence functional specs into a spec pack.
 *
 * ba-spec-writer publishes one functional spec per component to Confluence, in a
 * publish-enforced section schema (Overview + baseType, Component Elements with an
 * ARIA/keyboard contract, Style Options, Component Content → Editable Fields +
 * Dynamic Data) with a Page Properties block carrying Document Status. Those specs
 * are the authored-intent twin of what the retrospective mines from as-built code.
 *
 * The fetch is NOT this script's job: skill scripts are offline (no network, no
 * MCP), so the model captures the pages via the Atlassian MCP into a raw JSON file
 * (see references/spec-capture.md) and this script structures that capture
 * deterministically — the same division of labour archive-memory.cjs uses for
 * project memory. It preserves and structures; it does not summarize.
 *
 * The component label is derived from the page title (its trailing "Client Rebuild
 * | Component" segment). The retrospective resolves that label against the
 * ui-design-brain manifest itself (resolve.cjs), so no external canonical map is
 * needed — the elements ba-spec-writer flagged as un-canonicalizable are still
 * lifted from the spec body as novelLabels.
 *
 * Usage:
 *   node normalize-specs.cjs --raw <specs-raw.json> [--archive <dir>]
 *                            [--status-gate approved] [--out <file>] [--pretty]
 *
 *   --raw          The model's Confluence capture (required)
 *   --archive      Directory to byte-copy each approved spec's raw markdown into
 *                  (the evidence-repo source/ dir); omit for a manifest-only run
 *   --status-gate  Document Status a spec must carry to be included (default: approved)
 *   --out          Write the spec pack JSON here instead of stdout
 *   --pretty       Indent the JSON output
 *
 * Exit codes:
 *   0  success — including a degraded run (see the `warnings` array)
 *   1  unexpected failure
 *   2  invalid invocation
 *   3  --raw is missing, unreadable, or has an unsupported schemaVersion
 *
 * Missing or malformed inputs never throw: each records a warning and the run
 * continues. A spec whose Document Status does not clear the gate is dropped into
 * `skipped`, never silently. A missing section degrades the one spec (a
 * `section-missing:<name>` warning) rather than failing the run.
 *
 * Fetch completeness is verified deterministically here, not in model prose. When the
 * capture's `source.batches` records each batch's search `totalCount` and enumerated
 * `pageIds`, the script dedupes by pageId and reconciles the captured bodies against
 * that enumeration — emitting `batch-enumeration-incomplete` (search truncated),
 * `spec-uncaptured` (an enumerated page was never fetched), `spec-unexpected`, and
 * `duplicate-page` warnings so a partial MCP fetch surfaces instead of passing silently.
 */

'use strict';

const path = require('node:path');
const {
  parseArgs,
  checkArgs,
  readJsonSafe,
  isFile,
  kebab,
  normalizeLabel,
  sections,
  Warnings,
  writeOut,
  usage,
} = require('./lib/util.cjs');
const fs = require('node:fs');

const USAGE = [
  'Usage: node normalize-specs.cjs --raw <specs-raw.json> [--archive <dir>] [--status-gate approved] [--out <file>] [--pretty]',
  '',
  '  --raw          The model\'s Confluence capture (required)',
  '  --archive      Directory to byte-copy each approved spec\'s raw markdown into',
  '  --status-gate  Document Status a spec must carry to be included (default: approved)',
  '  --out          Write the spec pack JSON here instead of stdout',
  '  --pretty       Indent the JSON output',
];

const SUPPORTED_SCHEMA = 1;

// The Component Elements accessibility/keyboard vocabulary — the same broad set
// validate-report.cjs uses to check a pattern draft carries an a11y bullet. A
// spec's per-element contract is the retrospective's cleanest guidance evidence,
// so a bullet naming any of these is lifted into the spec's a11y[].
const A11Y_RE =
  /accessib|keyboard|aria|focus|screen reader|contrast|role=|\brole\b|\balt\b|alt text|landmark|announce|tab order|visually hidden|wcag|reduced motion|pausable|assistive/i;

// ba-spec-writer records an element it could not canonicalize with a rationale
// sentence noting no canonical primitive matched ("do not invent a canonical").
// Those novel labels are the highest-value new-pattern / new-alias candidates.
const NOVEL_RE = /no canonical primitive matched|no canonical (primitive )?match|novel (component|primitive|label)/i;

/**
 * Every pipe-table in `body`, as { headers, rows }. `headers` are the trimmed
 * cells of the first row; each `rows` entry is a trimmed cell array. The separator
 * row (`| --- | --- |`) is dropped. A table is any run of 2+ consecutive lines
 * whose trimmed form starts and ends with a pipe — the shape ba-spec-writer emits
 * for Page Properties, Editable Fields, and Dynamic Data.
 */
function parseTables(body) {
  const tables = [];
  const lines = body.split('\n');
  let block = [];
  const flush = () => {
    if (block.length >= 2) {
      const cells = block.map((l) =>
        l
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim()),
      );
      const headers = cells[0];
      const rows = cells.slice(1).filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c) || c === ''));
      tables.push({ headers, rows });
    }
    block = [];
  };
  for (const line of lines) {
    if (/^\s*\|.*\|\s*$/.test(line)) block.push(line);
    else flush();
  }
  flush();
  return tables;
}

/** Strip markdown bold/code markers (`**`, `` ` ``) and trim. Page Properties
 *  keys and values are plain text, but some Confluence templates bold them
 *  (e.g. `| **Status** | approved |`) — normalize so lookups are markup-agnostic.
 *  Underscores are left intact so a snake_case value (an `in_review` status) is
 *  not mangled — property keys are wrapped in `**`, never `_`, in practice. */
function stripEmphasis(s) {
  return String(s).replace(/[*`]/g, '').trim();
}

/**
 * A 2-column table read as an ordered map of label → value (Page Properties).
 *
 * The properties block has no real header row — its first row ("Batch | 1") is
 * data — so the header is folded back in alongside the rows. Keys and values are
 * stripped of emphasis so a bolded property label still resolves.
 */
function tableToProps(table) {
  const props = {};
  if (!table) return props;
  for (const row of [table.headers, ...table.rows]) {
    if (row.length >= 2 && row[0]) {
      const key = stripEmphasis(row[0]).toLowerCase();
      if (key) props[key] = stripEmphasis(row.slice(1).join(' | '));
    }
  }
  return props;
}

/** The first table whose header cells include every needle (case-insensitive). */
function findTable(tables, needles) {
  return (
    tables.find((t) => needles.every((n) => t.headers.some((h) => h.toLowerCase().includes(n.toLowerCase())))) || null
  );
}

// The Page Properties block, identified by content rather than by position: a spec
// whose body does not lead with it (status lifted to a raw field, or blocks
// reordered) would otherwise have its Editable Fields table misread as properties.
const PROP_KEYS =
  /^(document status|batch|contains pii|approval order|document owner|figjam name|build jira task|client review)$/i;

/** The table that looks like Page Properties (a known property in its first column), else the first table.
 *  Keys are de-emphasized before matching so a bold-keyed properties block (`| **Batch** | 1 |`) is still
 *  identified over an earlier Editable Fields / Dynamic Data table. `status` is deliberately not a PROP_KEYS
 *  anchor — the properties block is already recognized by its other keys, and a stray "Status"-headed table
 *  should not be mistaken for it; the gate reads the status value once the real block is found. */
function findPropsTable(tables) {
  for (const t of tables) {
    if ([t.headers, ...t.rows].some((r) => PROP_KEYS.test(stripEmphasis(r[0] || '')))) return t;
  }
  return tables[0] || null;
}

/** The H2 section whose heading (lowercased) includes `name`; null when absent. */
function findBlock(blocks, name) {
  return blocks.find((b) => b.heading.toLowerCase().includes(name.toLowerCase())) || null;
}

/** Bullet lines (`- ` / `* `) in `body`, trimmed of the marker. */
function bullets(body) {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, '').trim());
}

/**
 * Structure one raw spec page into a spec-pack record. Returns { record, warnings }
 * so a spec that later fails the status gate does not leak its section warnings —
 * they are merged into the run only when the spec is included.
 */
function normalizeSpec(raw) {
  const warnings = new Warnings();
  const title = typeof raw.title === 'string' ? raw.title : '';
  const bodyMd = typeof raw.bodyMarkdown === 'string' ? raw.bodyMarkdown : '';
  const tables = parseTables(bodyMd);
  // H2 sections carry their full body including H3 children (Component Elements ->
  // its numbered element H3s; Component Content -> Editable Fields / Dynamic Data).
  const blocks = sections(bodyMd, 2);

  // Page Properties: the 2-column property table (found by content, not position).
  // documentStatus/containsPII/batch come from it when the capture did not lift
  // them to explicit fields.
  const props = tableToProps(findPropsTable(tables));
  // The gate: an explicit raw field wins; otherwise read the Page Properties row.
  // Some templates label it "Document Status", others just "Status" — prefer the
  // former when present so a spec carrying both is read from the canonical field.
  const documentStatus = String(
    raw.documentStatus != null ? raw.documentStatus : props['document status'] || props['status'] || '',
  ).trim();

  // Label: the title's trailing "Client Rebuild | Component" segment. The
  // retrospective resolves it against the brain itself (resolve.cjs).
  const label = declientTitle(title);
  if (!title.includes('|')) {
    warnings.add('title-no-separator', `Spec "${title || raw.pageId || '?'}" has no "|" separator; used the whole title as the label.`);
  }

  const overviewBlock = findBlock(blocks, 'overview');
  const baseTypeMatch = bodyMd.match(/baseType:\s*`?([A-Za-z0-9_-]+)`?/);

  const elementsBlock = findBlock(blocks, 'component elements');
  const a11y = [];
  const novelLabels = [];
  if (elementsBlock) {
    for (const b of bullets(elementsBlock.body)) if (A11Y_RE.test(b)) a11y.push(b);
    // Element H3s the BA could not canonicalize (novelty flags).
    for (const el of sections(elementsBlock.body, 3)) {
      if (NOVEL_RE.test(el.body)) novelLabels.push(el.heading.replace(/^\d+\.\s*/, '').trim());
    }
  } else {
    warnings.add('section-missing', `Spec "${label}" has no "Component Elements" section — a11y contract not captured.`);
  }

  const styleBlock = findBlock(blocks, 'style options');
  const variants = styleBlock
    ? [...new Set((styleBlock.body.match(/\*\*([^*]+?)\*\*/g) || []).map((m) => m.replace(/\*\*/g, '').trim()))]
    : [];

  const fieldsTable = findTable(tables, ['field name', 'field type']);
  const fields = fieldsTable
    ? fieldsTable.rows
        .filter((r) => r[0])
        .map((r) => ({
          name: r[0] || '',
          type: r[1] || '',
          required: /^(yes|required|true)$/i.test((r[2] || '').trim()),
          notes: r[3] || '',
        }))
    : [];
  if (!fieldsTable) {
    warnings.add('section-missing', `Spec "${label}" has no Editable Fields table — reusable API surface not captured.`);
  }

  // Composition: parents from Used By, children from Editable Fields allowedTypes.
  const usedByBlock = findBlock(blocks, 'used by');
  const parents = usedByBlock
    ? [...new Set((usedByBlock.body.match(/\[([^\]]+)\]\(/g) || []).map((m) => m.slice(1, -2).trim()))]
    : [];
  const children = [
    ...new Set(
      fields
        .map((f) => f.notes.match(/allowedTypes:\s*\\?\[([^\]]*)\]/i))
        .filter(Boolean)
        .flatMap((m) => m[1].split(',').map((c) => c.replace(/['"]/g, '').trim()).filter(Boolean)),
    ),
  ];

  // Dynamic Data is an H3 under Component Content; find its table globally by header.
  const dynamicTable = findTable(tables, ['value name']);
  const dynamicData = dynamicTable
    ? dynamicTable.rows.filter((r) => r[0]).map((r) => ({ name: r[0] || '', description: r.slice(1).join(' — ').trim() }))
    : [];

  const containsPII = /^(yes|true)$/i.test(String(raw.containsPII != null ? raw.containsPII : props['contains pii'] || '').trim())
    ? true
    : /^(no|false)$/i.test(String(raw.containsPII != null ? raw.containsPII : props['contains pii'] || '').trim())
      ? false
      : null;

  const record = {
    pageId: raw.pageId != null ? String(raw.pageId) : null,
    title,
    url: raw.url || null,
    label,
    normalized: normalizeLabel(label),
    documentStatus,
    baseType: baseTypeMatch ? baseTypeMatch[1] : null,
    overview: overviewBlock
      ? overviewBlock.body
          .replace(/^\s*`?baseType:.*$/gim, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      : '',
    fields,
    variants,
    a11y,
    composition: { parents, children },
    dynamicData,
    novelLabels,
    containsPII,
    batch: raw.batch != null ? String(raw.batch) : props.batch || null,
    _bodyMarkdown: bodyMd, // internal — used by --archive, stripped before output
  };
  return { record, warnings };
}

/** Trailing "Client Rebuild | Component" segment, or the whole title when unsplit. */
function declientTitle(title) {
  const parts = String(title).split('|');
  return parts[parts.length - 1].trim();
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    keys: ['raw', 'archive', 'status-gate', 'out'],
    flags: ['pretty'],
  });
  const { values } = args;

  checkArgs(args, USAGE);
  if (!values.raw) usage('--raw is required', USAGE);

  const rawPath = path.resolve(values.raw);
  if (!isFile(rawPath)) {
    process.stderr.write(`error: --raw is not a file: ${rawPath}\n`);
    process.exit(3);
  }
  const rawRead = readJsonSafe(rawPath);
  if (!rawRead.ok) {
    process.stderr.write(`error: --raw could not be parsed: ${rawRead.error}\n`);
    process.exit(3);
  }
  const capture = rawRead.value;
  if (!capture || typeof capture !== 'object' || !Array.isArray(capture.specs)) {
    process.stderr.write('error: --raw must be a JSON object with a "specs" array\n');
    process.exit(3);
  }
  if (capture.schemaVersion !== undefined && capture.schemaVersion !== SUPPORTED_SCHEMA) {
    process.stderr.write(`error: --raw schemaVersion ${capture.schemaVersion} is not supported (expected ${SUPPORTED_SCHEMA})\n`);
    process.exit(3);
  }

  const warnings = new Warnings();

  const gate = String(values['status-gate'] || 'approved').toUpperCase();

  // Deterministic completeness reconciliation — owned by the script, not model prose.
  // The MCP fetch is unavoidably the model's job (scripts are offline), but verifying
  // that the fetch was COMPLETE is mechanical, so it lives here. The model records,
  // per batch, the search's own `totalCount` and the `pageIds` it enumerated; this
  // reconciles the captured bodies against that enumeration so a truncated search or a
  // dropped page surfaces as a warning instead of a silent under-capture.
  const source = capture.source && typeof capture.source === 'object' ? capture.source : {};
  const batches = Array.isArray(source.batches) ? source.batches : [];
  const expectedIds = new Set();
  for (const b of batches) {
    if (!b || typeof b !== 'object') continue;
    const ids = Array.isArray(b.pageIds) ? b.pageIds.map(String) : [];
    for (const id of ids) expectedIds.add(id);
    if (typeof b.totalCount === 'number' && ids.length < b.totalCount) {
      warnings.add(
        'batch-enumeration-incomplete',
        `Batch "${b.label != null ? b.label : '?'}" enumerated ${ids.length} of ${b.totalCount} page(s) — the search returned fewer ids than its own totalCount (a transient truncation). Re-run the label query until they agree before capturing bodies.`,
      );
    }
  }

  // Dedupe raw entries by pageId: one page may carry several batch labels, and
  // normalizeSpec would otherwise emit one record per copy and over-count the pack.
  const capturedIds = new Set();
  const rawSpecs = [];
  let duplicates = 0;
  for (const raw of capture.specs) {
    const id = raw && typeof raw === 'object' && raw.pageId != null ? String(raw.pageId) : null;
    if (id && capturedIds.has(id)) {
      duplicates += 1;
      warnings.add('duplicate-page', `Page ${id} ("${(raw && raw.title) || '?'}") appeared more than once (multiple batch labels); kept one copy.`);
      continue;
    }
    if (id) capturedIds.add(id);
    rawSpecs.push(raw);
  }

  const specs = [];
  const skipped = [];
  for (const raw of rawSpecs) {
    if (!raw || typeof raw !== 'object') {
      warnings.add('spec-entry-unreadable', 'A raw spec entry was not an object and was skipped.');
      continue;
    }
    const { record, warnings: specWarnings } = normalizeSpec(raw);
    if (record.documentStatus.toUpperCase() !== gate) {
      skipped.push({ title: record.title, pageId: record.pageId, documentStatus: record.documentStatus, reason: `status is not ${gate}` });
      continue;
    }
    for (const w of specWarnings.items) warnings.add(w.code, w.message);
    specs.push(record);
  }

  // Reconcile the captured set against the batch enumeration (both directions).
  // Membership is checked against every captured page — before the status gate — so a
  // page the model failed to fetch is not confused with one it fetched and the gate
  // then dropped.
  if (expectedIds.size) {
    for (const id of expectedIds) {
      if (!capturedIds.has(id)) {
        warnings.add('spec-uncaptured', `Enumerated page ${id} was never captured — re-fetch it (or confirm it was intentionally excluded) before trusting the pack.`);
      }
    }
    for (const id of capturedIds) {
      if (!expectedIds.has(id)) {
        warnings.add('spec-unexpected', `Captured page ${id} was not in the batch enumeration — confirm it belongs to this run.`);
      }
    }
  }

  // Archive the near-raw markdown of every included spec (evidence checkout only).
  const archiveDir = values.archive ? path.resolve(values.archive) : null;
  let archived = 0;
  if (archiveDir) {
    const used = new Set();
    for (const s of specs) {
      // Counter-until-unused: two specs sharing a kebab label (or lacking pageIds)
      // must never collide — a fallback that reused a name would silently overwrite
      // one spec's archived markdown and leave the manifest over-counting.
      const stem = kebab(s.label) || (s.pageId ? `page-${s.pageId}` : 'spec');
      let name = `${stem}.md`;
      for (let n = 2; used.has(name); n += 1) name = `${stem}-${n}.md`;
      used.add(name);
      try {
        fs.mkdirSync(archiveDir, { recursive: true });
        fs.writeFileSync(path.join(archiveDir, name), `${s._bodyMarkdown || ''}\n`, 'utf8');
        s.archived = name;
        archived += 1;
      } catch (err) {
        warnings.add('spec-archive-failed', `Could not archive "${s.label}": ${err.message}`);
        s.archived = null;
      }
    }
  }

  // Strip the internal raw-markdown carrier before serializing.
  for (const s of specs) delete s._bodyMarkdown;

  writeOut(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      source: { raw: rawPath },
      mode: gate === 'APPROVED' ? 'approved-only' : `status:${gate.toLowerCase()}`,
      statusGate: gate,
      specs,
      skipped,
      counts: {
        specs: specs.length,
        skipped: skipped.length,
        duplicates,
        expected: expectedIds.size,
        captured: capturedIds.size,
        fields: specs.reduce((n, s) => n + s.fields.length, 0),
        novel: specs.reduce((n, s) => n + s.novelLabels.length, 0),
        archived,
      },
      warnings: warnings.toJSON(),
    },
    values.out,
    values.pretty,
  );
}

try {
  main();
} catch (err) {
  process.stderr.write(`error: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
}
