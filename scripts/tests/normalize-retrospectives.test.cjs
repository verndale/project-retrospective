'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('./helpers.cjs');

function fixture({ raw, findings, inventory = null, archive = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-team-'));
  const rawFile = path.join(dir, 'raw.json');
  const findingsFile = path.join(dir, 'findings.json');
  const inventoryFile = path.join(dir, 'inventory.json');
  const out = path.join(dir, 'retrospectives.json');
  const actions = path.join(dir, 'actions.json');
  fs.writeFileSync(rawFile, JSON.stringify(raw), 'utf8');
  fs.writeFileSync(findingsFile, JSON.stringify(findings), 'utf8');
  if (inventory) fs.writeFileSync(inventoryFile, JSON.stringify(inventory), 'utf8');
  const args = [
    '--raw', rawFile,
    '--findings', findingsFile,
    '--project-slug', 'sample-project',
    '--out', out,
    '--actions-out', actions,
    '--pretty',
  ];
  if (inventory) args.push('--inventory', inventoryFile);
  if (archive) args.push('--archive', path.join(dir, 'archive'));
  const result = run('normalize-retrospectives.cjs', args);
  return {
    dir,
    result,
    pack: fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null,
    actions: fs.existsSync(actions) ? JSON.parse(fs.readFileSync(actions, 'utf8')) : null,
  };
}

function baseRaw() {
  return {
    schemaVersion: 1,
    source: {
      spaces: [
        {
          site: 'https://example.atlassian.net',
          space: 'SAMPLE',
          queries: [{ term: 'retrospective', totalCount: 2, pageIds: ['10', '11'] }],
        },
      ],
    },
    pages: [
      {
        pageId: '10',
        version: 2,
        title: 'Design Retrospective',
        url: 'https://example.atlassian.net/wiki/pages/10',
        explicit: true,
        bodyMarkdown: '# Design Retrospective\n\n## Worked\n\n- Shared tokens helped.\n',
      },
      {
        pageId: '11',
        version: 1,
        title: 'Release Issues Post-mortem',
        url: 'https://example.atlassian.net/wiki/pages/11',
        explicit: false,
        bodyMarkdown: '# Release Issues\n\n- [ ] Document deployment ownership.\n',
      },
    ],
    excluded: [{ pageId: '12', title: 'Retro playlist', url: 'https://example/12', reason: 'Not a team retrospective.' }],
  };
}

function baseFindings() {
  return {
    schemaVersion: 1,
    pages: [
      {
        pageId: '10',
        summary: 'The design phase benefited from shared tokens.',
        takeaways: ['Reuse shared tokens.'],
        componentSignals: [
          {
            label: 'Modal',
            summary: 'The modal contract avoided rework.',
            agreesWithAsBuilt: true,
            corroboratingPaths: ['src/components/modal/Modal.tsx'],
          },
        ],
      },
      { pageId: '11', summary: 'Release ownership was unclear.', takeaways: ['Assign release ownership.'], componentSignals: [] },
    ],
    themes: [{ title: 'Ownership', summary: 'Ownership needs to be explicit.', pageIds: ['11'] }],
    contradictions: [],
    actions: [
      {
        title: 'Document release ownership',
        summary: 'Name the role responsible for each release step.',
        sourcePageIds: ['11'],
        destination: 'ai-design-brain',
        owner: '',
        nextStep: 'Assign the delivery lead.',
        status: 'open',
      },
    ],
  };
}

const inventory = {
  schemaVersion: 1,
  components: [
    { name: 'Modal', folder: 'modal', path: 'src/components/modal', sources: ['build-pack', 'code-scan'] },
  ],
};

test('normalizes heterogeneous pages, exclusions, actions, and corroborated component signals', () => {
  const f = fixture({ raw: baseRaw(), findings: baseFindings(), inventory, archive: true });
  try {
    assert.equal(f.result.status, 0, f.result.stderr);
    assert.equal(f.pack.counts.pages, 2);
    assert.equal(f.pack.counts.excluded, 1);
    assert.equal(f.pack.pages.find((p) => p.pageId === '10').phase, 'design');
    assert.equal(f.pack.pages.find((p) => p.pageId === '11').format, 'post-mortem');
    assert.equal(f.pack.counts.eligibleComponentSignals, 1);
    assert.equal(f.actions.actions[0].status, 'needs-owner');
    assert.equal(f.actions.actions[0].destination, 'project', 'unknown destinations degrade safely');
    assert.match(f.actions.actions[0].id, /^retro-action-[a-f0-9]{12}$/);
    assert.equal(fs.readdirSync(path.join(f.dir, 'archive')).length, 2);
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test('stable action ids do not depend on source-page order', () => {
  const one = baseFindings();
  one.actions[0].sourcePageIds = ['11', '10'];
  const two = baseFindings();
  two.actions[0].sourcePageIds = ['10', '11'];
  const a = fixture({ raw: baseRaw(), findings: one });
  const b = fixture({ raw: baseRaw(), findings: two });
  try {
    assert.equal(a.actions.actions[0].id, b.actions.actions[0].id);
  } finally {
    fs.rmSync(a.dir, { recursive: true, force: true });
    fs.rmSync(b.dir, { recursive: true, force: true });
  }
});

test('done and wont-do require evidence or rationale', () => {
  const findings = baseFindings();
  findings.actions = [
    { ...findings.actions[0], owner: 'delivery', status: 'done', destination: 'project' },
    { ...findings.actions[0], title: 'Drop obsolete checklist', owner: 'delivery', status: 'wont-do', destination: 'project' },
  ];
  const f = fixture({ raw: baseRaw(), findings });
  try {
    assert.deepEqual(f.actions.actions.map((a) => a.status), ['open', 'open']);
    const codes = f.pack.warnings.map((w) => w.code);
    assert.ok(codes.includes('action-completion-proof'));
    assert.ok(codes.includes('action-wont-do-rationale'));
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test('discovery incompleteness and uncaptured page ids surface as warnings', () => {
  const raw = baseRaw();
  raw.source.spaces[0].queries[0] = { term: 'retro', totalCount: 4, pageIds: ['10', '11', '99'] };
  const f = fixture({ raw, findings: baseFindings() });
  try {
    const codes = f.pack.warnings.map((w) => w.code);
    assert.ok(codes.includes('discovery-enumeration-incomplete'));
    assert.ok(codes.includes('retrospective-uncaptured'));
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test('a discovered page with an audited exclusion is complete, not uncaptured', () => {
  const raw = {
    schemaVersion: 1,
    source: { spaces: [{ space: 'SYN', queries: [{ term: 'retro', totalCount: 2, pageIds: ['101', '102'] }] }] },
    pages: [{ pageId: '101', title: 'Build retrospective', version: 1, bodyMarkdown: 'Reviewed.' }],
    excluded: [{ pageId: '102', title: 'Template', reason: 'Unfilled template with no project observations.' }],
  };
  const findings = { schemaVersion: 1, pages: [{ pageId: '101', summary: 'Reviewed.', takeaways: [], componentSignals: [] }], themes: [], contradictions: [], actions: [] };
  const { result, pack } = fixture({ raw, findings });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!pack.warnings.some((warning) => warning.code === 'retrospective-uncaptured'));
  assert.equal(pack.counts.excluded, 1);
});

test('duplicate pages retain the highest version and explicit provenance', () => {
  const raw = baseRaw();
  raw.pages.push({ ...raw.pages[0], version: 3, explicit: false, bodyMarkdown: '# Updated' });
  const f = fixture({ raw, findings: baseFindings() });
  try {
    const page = f.pack.pages.find((p) => p.pageId === '10');
    assert.equal(page.version, 3);
    assert.equal(page.explicit, true);
    assert.ok(f.pack.warnings.some((w) => w.code === 'duplicate-page'));
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test('obvious credential assignments are not archived', () => {
  const raw = baseRaw();
  raw.pages[0].bodyMarkdown += '\napi_key = should-not-be-here\n';
  const f = fixture({ raw, findings: baseFindings(), archive: true });
  try {
    assert.equal(f.pack.counts.skippedSensitive, 1);
    assert.equal(f.pack.counts.archived, 1);
    assert.ok(f.pack.warnings.some((w) => w.code === 'archive-sensitive-content'));
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test('unsupported inputs exit 3 and malformed actions degrade instead of crashing', () => {
  const bad = fixture({ raw: { schemaVersion: 9, pages: [] }, findings: baseFindings() });
  try {
    assert.equal(bad.result.status, 3);
  } finally {
    fs.rmSync(bad.dir, { recursive: true, force: true });
  }
  const findings = baseFindings();
  findings.actions.push({ title: 'No source', summary: 'Missing source page ids.', sourcePageIds: [] });
  const degraded = fixture({ raw: baseRaw(), findings });
  try {
    assert.equal(degraded.result.status, 0, degraded.result.stderr);
    assert.ok(degraded.pack.warnings.some((w) => w.code === 'action-malformed'));
  } finally {
    fs.rmSync(degraded.dir, { recursive: true, force: true });
  }
});
