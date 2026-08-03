'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('./helpers.cjs');

const { adfToMarkdown, extractDoc } = require('../../skills/project-retrospective/scripts/adf-to-markdown.cjs');

const p = (...c) => ({ type: 'paragraph', content: c });
const t = (text, marks) => ({ type: 'text', text, ...(marks ? { marks } : {}) });
const doc = (...content) => ({ type: 'doc', version: 1, content });

/** A Page Properties "details" macro wrapping a 2-column table. */
function pageProps(rows) {
  return {
    type: 'bodiedExtension',
    attrs: { extensionKey: 'details' },
    content: [
      {
        type: 'table',
        content: rows.map(([k, v]) => ({
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [p(t(k))] },
            { type: 'tableCell', content: [Array.isArray(v) ? { type: 'paragraph', content: v } : p(t(String(v)))] },
          ],
        })),
      },
    ],
  };
}

test('the Page Properties status lozenge survives as a pipe-table row', () => {
  const md = adfToMarkdown(
    doc(pageProps([['Batch', '1'], ['Document Status', [{ type: 'status', attrs: { text: 'APPROVED' } }]]])),
  );
  assert.match(md, /\| Document Status \| APPROVED \|/);
  assert.match(md, /\| Batch \| 1 \|/);
});

test('heading levels and paragraphs render as ATX markdown', () => {
  const md = adfToMarkdown(
    doc({ type: 'heading', attrs: { level: 2 }, content: [t('Overview')] }, p(t('Body copy.'))),
  );
  assert.match(md, /^## Overview$/m);
  assert.match(md, /^Body copy\.$/m);
});

test('a numbered bold Component Element lead is promoted to an H3', () => {
  // ba-spec-writer writes elements as bold leads; normalize splits Component Elements
  // by H3, so the converter must promote them.
  const md = adfToMarkdown(doc(p(t('1. Wrapper', [{ type: 'strong' }]), t(' The outer section.'))));
  assert.match(md, /^### 1\. Wrapper$/m);
  assert.match(md, /The outer section\./);
});

test('emphasis keeps trailing whitespace outside the delimiters so it renders', () => {
  // ADF often includes the trailing space inside the strong run; CommonMark renders
  // literal asterisks unless the whitespace is moved outside the closing delimiter.
  const md = adfToMarkdown(doc(p(t('Description & layout: ', [{ type: 'strong' }]), t('The form title.'))));
  assert.match(md, /\*\*Description & layout:\*\* The form title\./);
  assert.doesNotMatch(md, /layout: \*\*The/);
});

test('a whitespace-only strong run is not wrapped in empty emphasis', () => {
  const md = adfToMarkdown(doc(p(t('   ', [{ type: 'strong' }]))));
  assert.doesNotMatch(md, /\*\*/, 'a run of only whitespace must not become **  **');
});

test('bold Style Options survive as **bold** for variant extraction', () => {
  const md = adfToMarkdown(doc(p(t('Light', [{ type: 'strong' }])), p(t('Dark', [{ type: 'strong' }]))));
  assert.match(md, /\*\*Light\*\*/);
  assert.match(md, /\*\*Dark\*\*/);
});

test('an Editable Fields table renders with a header and separator', () => {
  const md = adfToMarkdown(
    doc({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: ['Field Name', 'Field Type', 'Required'].map((h) => ({ type: 'tableHeader', content: [p(t(h))] })),
        },
        {
          type: 'tableRow',
          content: ['Heading', 'string', 'Yes'].map((c) => ({ type: 'tableCell', content: [p(t(c))] })),
        },
      ],
    }),
  );
  assert.match(md, /\| Field Name \| Field Type \| Required \|/);
  assert.match(md, /\| --- \| --- \| --- \|/);
  assert.match(md, /\| Heading \| string \| Yes \|/);
});

test('bullet lists and links convert', () => {
  const md = adfToMarkdown(
    doc({
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [p(t('ARIA: role="dialog"'))] },
        { type: 'listItem', content: [p(t('See', undefined), t(' docs', [{ type: 'link', attrs: { href: 'https://x' } }]))] },
      ],
    }),
  );
  assert.match(md, /^- ARIA: role="dialog"$/m);
  // The space stays OUTSIDE the link brackets (well-formed), so " docs" → " [docs](…)".
  assert.match(md, / \[docs\]\(https:\/\/x\)/);
});

test('a file-attachment media node renders as a markdown link (not an embed) with its caption', () => {
  const md = adfToMarkdown(
    doc({
      type: 'mediaSingle',
      content: [
        { type: 'media', attrs: { type: 'file', id: 'abc', collection: 'contentId-999', alt: 'shot.png' } },
        { type: 'caption', content: [t('Desktop — 4-Column Variation')] },
      ],
    }),
    { baseUrl: 'https://acme.atlassian.net' },
  );
  // A link, not an embed — no leading "!" — so a git viewer shows clickable text, not a broken image.
  assert.match(md, /\[shot\.png\]\(https:\/\/acme\.atlassian\.net\/wiki\/download\/attachments\/999\/shot\.png\)/);
  assert.doesNotMatch(md, /!\[shot\.png\]/);
  assert.match(md, /\*Desktop — 4-Column Variation\*/);
});

test('an external media node uses its own url', () => {
  const md = adfToMarkdown(doc({ type: 'media', attrs: { type: 'external', url: 'https://img.example/x.png', alt: 'x' } }));
  assert.match(md, /\[x\]\(https:\/\/img\.example\/x\.png\)/);
  assert.doesNotMatch(md, /!\[x\]/);
});

test('without a base url, attachment links are site-relative', () => {
  const md = adfToMarkdown(doc({ type: 'media', attrs: { type: 'file', id: 'a', collection: 'contentId-5', alt: 'p.png' } }));
  assert.match(md, /\[p\.png\]\(\/wiki\/download\/attachments\/5\/p\.png\)/);
});

test('extractDoc unwraps a v2 API response and accepts a bare doc', () => {
  const bare = doc(p(t('hi')));
  const wrapped = { body: { atlas_doc_format: { value: JSON.stringify(bare) } } };
  assert.deepEqual(extractDoc(wrapped), bare);
  assert.deepEqual(extractDoc(bare), bare);
});

test('an empty or malformed doc yields empty output, not a throw', () => {
  assert.equal(adfToMarkdown(null), '');
  assert.equal(adfToMarkdown({ type: 'doc' }), '');
});

test('--adf-dir converts every page and reports the count', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adf-in-'));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adf-out-'));
  try {
    fs.writeFileSync(path.join(dir, '111.json'), JSON.stringify({ body: { atlas_doc_format: { value: JSON.stringify(doc({ type: 'heading', attrs: { level: 2 }, content: [t('Overview')] })) } } }));
    const r = run('adf-to-markdown.cjs', ['--adf-dir', dir, '--out-dir', outDir]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(fs.readFileSync(path.join(outDir, '111.md'), 'utf8'), /## Overview/);
    assert.match(r.stdout, /converted 1 file/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('a bad invocation exits 2 and a missing file exits 3', () => {
  assert.equal(run('adf-to-markdown.cjs', []).status, 2);
  assert.equal(run('adf-to-markdown.cjs', ['--adf', '/no/such/file.json']).status, 3);
});
