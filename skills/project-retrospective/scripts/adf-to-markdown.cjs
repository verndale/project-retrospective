#!/usr/bin/env node
/**
 * adf-to-markdown.cjs — convert Confluence ADF (Atlas Doc Format) into the Markdown
 * that normalize-specs.cjs parses.
 *
 * The skill captures approved functional specs from Confluence. The reliable, offline
 * path is the Atlassian REST API: fetch each page as ADF
 * (`GET /wiki/api/v2/pages/{id}?body-format=atlas_doc_format`) — deterministic, id-
 * addressed, no truncated searches or wrong-page returns — then convert here. This
 * replaces relying on an MCP's own markdown rendering; the fetch is still the model's
 * job (scripts are offline, no network), but the *rendering* is now deterministic and
 * vendored, so the same input always yields the same markdown.
 *
 * It is NOT a general ADF renderer — only the node types ba-spec-writer spec pages
 * use: the Page Properties table (so `| Document Status | APPROVED |` survives), H2/H3
 * headings, Editable Fields / Dynamic Data pipe tables, bold Style Options, and the
 * numbered Component Elements (ba-spec-writer writes these as bold leads; the markdown
 * promotes them to `### N. Name` so normalize can split elements and lift novelLabels).
 *
 * Usage:
 *   node adf-to-markdown.cjs --adf <page.json> [--out <file.md>]
 *   node adf-to-markdown.cjs --adf-dir <dir> --out-dir <dir>
 *
 *   --adf       A v2 API page response ({ body.atlas_doc_format.value }) or a bare ADF
 *               doc; writes markdown to --out or stdout.
 *   --adf-dir   Convert every *.json in the directory to <out-dir>/<basename>.md.
 *   --out-dir   Destination for --adf-dir (required with it).
 *
 * Exit codes:
 *   0  success        2  invalid invocation        3  input missing / unreadable / not ADF
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs, checkArgs, readJsonSafe, isFile, usage } = require('./lib/util.cjs');

const USAGE = [
  'Usage: node adf-to-markdown.cjs --adf <page.json> [--out <file.md>]',
  '       node adf-to-markdown.cjs --adf-dir <dir> --out-dir <dir>',
  '',
  '  --adf      A v2 API page response or a bare ADF doc → markdown on --out/stdout',
  '  --adf-dir  Convert every *.json in the dir to <out-dir>/<basename>.md',
  '  --out-dir  Destination directory (required with --adf-dir)',
];

/** Inline text for a node, applying the marks normalize cares about. */
function inline(node) {
  if (!node) return '';
  if (node.type === 'text') {
    let t = node.text || '';
    for (const m of node.marks || []) {
      if (m.type === 'strong') t = `**${t}**`;
      else if (m.type === 'em') t = `*${t}*`;
      else if (m.type === 'code') t = `\`${t}\``;
      else if (m.type === 'link' && m.attrs && m.attrs.href) t = `[${t}](${m.attrs.href})`;
    }
    return t;
  }
  if (node.type === 'hardBreak') return ' ';
  if (node.type === 'status') return (node.attrs && node.attrs.text) || '';
  if (node.type === 'mention') return (node.attrs && (node.attrs.text || node.attrs.id)) || '';
  if (node.type === 'inlineCard') return (node.attrs && node.attrs.url) || '';
  if (node.type === 'date') return (node.attrs && node.attrs.timestamp) || '';
  if (node.type === 'emoji') return (node.attrs && (node.attrs.text || node.attrs.shortName)) || '';
  return (node.content || []).map(inline).join('');
}

/** Flatten a table cell's blocks to a single line — pipe tables cannot hold newlines. */
function cellText(cell) {
  return (cell.content || [])
    .map((n) => inline(n).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function renderTable(node) {
  const rows = (node.content || []).filter((r) => r.type === 'tableRow');
  if (!rows.length) return '';
  const lines = [];
  rows.forEach((row, i) => {
    const cells = (row.content || []).map(cellText);
    lines.push(`| ${cells.join(' | ')} |`);
    if (i === 0) lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
  });
  return `${lines.join('\n')}\n\n`;
}

function renderList(node, ordered, depth) {
  const out = [];
  (node.content || []).forEach((li, idx) => {
    const marker = ordered ? `${idx + 1}.` : '-';
    const pad = '  '.repeat(depth);
    const parts = [];
    const subLists = [];
    for (const child of li.content || []) {
      if (child.type === 'bulletList') subLists.push(renderList(child, false, depth + 1));
      else if (child.type === 'orderedList') subLists.push(renderList(child, true, depth + 1));
      else parts.push(inline(child).trim());
    }
    out.push(`${pad}${marker} ${parts.filter(Boolean).join(' ')}`.trimEnd());
    for (const s of subLists) out.push(s);
  });
  return out.join('\n');
}

function block(node) {
  switch (node.type) {
    case 'heading': {
      const level = (node.attrs && node.attrs.level) || 2;
      return `${'#'.repeat(level)} ${inline(node).trim()}\n\n`;
    }
    case 'paragraph': {
      const t = inline(node).trim();
      if (!t) return '';
      // ba-spec-writer numbers Component Elements as bold leads (**1. Wrapper** …);
      // promote them to H3 so normalize can split elements and read novelLabels.
      const m = t.match(/^\*\*(\d+\.\s+[^*]+?)\*\*\s*(.*)$/s);
      if (m) return `### ${m[1].trim()}\n\n${m[2].trim() ? `${m[2].trim()}\n\n` : ''}`;
      return `${t}\n\n`;
    }
    case 'bulletList':
      return `${renderList(node, false, 0)}\n\n`;
    case 'orderedList':
      return `${renderList(node, true, 0)}\n\n`;
    case 'taskList':
      return `${(node.content || [])
        .map((ti) => `- [${ti.attrs && ti.attrs.state === 'DONE' ? 'x' : ' '}] ${inline(ti).trim()}`)
        .join('\n')}\n\n`;
    case 'table':
      return renderTable(node);
    case 'codeBlock':
      return `\`\`\`\n${inline(node)}\n\`\`\`\n\n`;
    case 'rule':
      return '---\n\n';
    case 'blockquote':
      return `${(node.content || []).map(block).join('').replace(/^/gm, '> ')}\n`;
    case 'panel':
    case 'expand':
    case 'nestedExpand':
    case 'bodiedExtension':
    case 'extension':
      // Unwrap: the Page Properties "details" macro holds its table as inner content.
      return (node.content || []).map(block).join('');
    case 'mediaSingle':
    case 'mediaGroup':
    case 'media':
      return ''; // images are not textual evidence
    default:
      return (node.content || []).map(block).join('');
  }
}

/** Convert an ADF document node to markdown. */
function adfToMarkdown(doc) {
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.content)) return '';
  return `${(doc.content || [])
    .map(block)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}

/** Pull an ADF doc out of a v2 API page response, or accept a bare ADF doc. */
function extractDoc(value) {
  if (value && value.body && value.body.atlas_doc_format) {
    const v = value.body.atlas_doc_format.value;
    return typeof v === 'string' ? JSON.parse(v) : v;
  }
  if (typeof value === 'string') return JSON.parse(value);
  return value; // already a doc
}

function convertFile(file) {
  const read = readJsonSafe(file);
  if (!read.ok) return { ok: false, error: read.error };
  try {
    const doc = extractDoc(read.value);
    return { ok: true, md: adfToMarkdown(doc) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    keys: ['adf', 'out', 'adf-dir', 'out-dir'],
    flags: [],
  });
  checkArgs(args, USAGE);
  const { values } = args;

  if (values['adf-dir']) {
    const dir = path.resolve(values['adf-dir']);
    const outDir = values['out-dir'] ? path.resolve(values['out-dir']) : null;
    if (!outDir) usage('--out-dir is required with --adf-dir', USAGE);
    let files;
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    } catch (err) {
      process.stderr.write(`error: --adf-dir is not a readable directory: ${err.message}\n`);
      process.exit(3);
    }
    fs.mkdirSync(outDir, { recursive: true });
    let converted = 0;
    let failed = 0;
    for (const f of files) {
      const res = convertFile(path.join(dir, f));
      if (!res.ok) {
        process.stderr.write(`warn: ${f}: ${res.error}\n`);
        failed += 1;
        continue;
      }
      fs.writeFileSync(path.join(outDir, `${path.basename(f, '.json')}.md`), res.md, 'utf8');
      converted += 1;
    }
    process.stdout.write(`converted ${converted} file(s), ${failed} failed, into ${outDir}\n`);
    process.exit(0);
  }

  if (!values.adf) usage('--adf (or --adf-dir) is required', USAGE);
  const file = path.resolve(values.adf);
  if (!isFile(file)) {
    process.stderr.write(`error: --adf is not a file: ${file}\n`);
    process.exit(3);
  }
  const res = convertFile(file);
  if (!res.ok) {
    process.stderr.write(`error: could not convert ${file}: ${res.error}\n`);
    process.exit(3);
  }
  if (values.out) {
    const out = path.resolve(values.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, res.md, 'utf8');
  } else {
    process.stdout.write(res.md);
  }
  process.exit(0);
}

module.exports = { adfToMarkdown, extractDoc };

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`error: ${err && err.stack ? err.stack : err}\n`);
    process.exit(1);
  }
}
