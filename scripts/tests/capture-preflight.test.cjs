'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runJson, tempFixture, readFile, writeFile, fixture } = require('./helpers.cjs');

const BRAIN = fixture('fake-brain');
const MANIFEST = fixture('fake-brain/skills/ui-design-brain/patterns-manifest.json');

/** A captures/ directory holding just the golden modal capture. */
function tempCaptures() {
  const dir = tempFixture('fake-output');
  return path.join(dir, 'captures');
}

function preflight(captures, library, args = ['--brain', BRAIN]) {
  return runJson('capture-preflight.cjs', ['--captures', captures, '--library', library, ...args]);
}

/** The single component record in a one-capture run. */
function only(result) {
  assert.ok(result.json, `expected JSON output, got:\n${result.stdout}${result.stderr}`);
  assert.equal(result.json.components.length, 1);
  return result.json.components[0];
}

/** Assert a capture is blocked by the named code. */
function assertBlocked(result, code) {
  const record = only(result);
  assert.equal(result.status, 1, `expected exit 1, got ${result.status}`);
  assert.equal(record.status, 'blocked');
  const codes = record.blockers.map((b) => b.code);
  assert.ok(codes.includes(code), `expected blocker "${code}", got: ${JSON.stringify(record.blockers, null, 2)}`);
}

/** Rewrite one named section's fenced JSON without confusing the two JSON blocks. */
function patchJsonSection(captures, heading, patch) {
  const text = readFile(captures, 'modal.md');
  const sectionStart = text.indexOf(`## ${heading}`);
  assert.notEqual(sectionStart, -1, `missing ## ${heading}`);
  const fenceStart = text.indexOf('```json\n', sectionStart);
  assert.notEqual(fenceStart, -1, `missing JSON fence under ## ${heading}`);
  const jsonStart = fenceStart + '```json\n'.length;
  const jsonEnd = text.indexOf('\n```', jsonStart);
  assert.notEqual(jsonEnd, -1, `unclosed JSON fence under ## ${heading}`);
  const value = JSON.parse(text.slice(jsonStart, jsonEnd));
  writeFile(
    captures,
    'modal.md',
    `${text.slice(0, jsonStart)}${JSON.stringify(patch(value), null, 2)}${text.slice(jsonEnd)}`,
  );
}

function patchEntry(captures, patch) {
  patchJsonSection(captures, 'Proposed library entry', patch);
}

function patchArchitecture(captures, patch) {
  patchJsonSection(captures, 'Runtime architecture', patch);
}

function retarget(text, canonical, slug) {
  const symbol = canonical.replace(/[^A-Za-z0-9]+(.)?/g, (_, next) => (next ? next.toUpperCase() : ''));
  return text
    .replace(/\*\*Modal\*\* \(`modal`\)/, `**${canonical}** (\`${slug}\`)`)
    .replace(/"canonical": "Modal"/, `"canonical": "${canonical}"`)
    .replace(/"slug": "modal"/, `"slug": "${slug}"`)
    .replace(/"exportName": "Modal"/, `"exportName": "${symbol}"`)
    .replaceAll('Modal.types.ts', `${symbol}.types.ts`)
    .replaceAll('Modal.tsx', `${symbol}.tsx`)
    .replaceAll('ModalDialog.client.tsx', `${symbol}Dialog.client.tsx`)
    .replaceAll('ModalHeader.tsx', `${symbol}Header.tsx`)
    .replaceAll('useModal.client.ts', `use${symbol}.client.ts`);
}

test('the golden captures pass preflight', () => {
  const result = preflight(tempCaptures(), fixture('fake-library'));
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}${result.stderr}`);
  const record = only(result);
  assert.equal(record.status, 'ready');
  assert.equal(record.canonical, 'Modal');
  assert.equal(record.slug, 'modal');
  assert.equal(record.architecture.mode, 'hybrid');
  assert.equal(record.architecture.serverOutput, 'shell');
  assert.deepEqual(record.blockers, []);
});

test('the envelope carries the documented key order', () => {
  const result = preflight(tempCaptures(), fixture('fake-library'));
  assert.deepEqual(Object.keys(result.json), [
    'schemaVersion',
    'generatedAt',
    'captures',
    'library',
    'manifest',
    'components',
    'orphanedByRun',
    'counts',
    'warnings',
  ]);
  assert.equal(result.json.schemaVersion, 3);
  assert.deepEqual(result.json.counts, {
    captures: 1,
    ready: 1,
    blocked: 0,
    skipped: 0,
    deferred: 0,
    orphanedByRun: 1,
  });
});

test('componentJson matches the library key order, with declienting left to fill', () => {
  const record = only(preflight(tempCaptures(), fixture('fake-library')));
  assert.deepEqual(Object.keys(record.componentJson), [
    'canonical',
    'slug',
    'framework',
    'styling',
    'slots',
    'variants',
    'exportName',
    'rendering',
    'reuseFingerprint',
    'realization',
    'tokens',
    'provenance',
    'declienting',
    'maturity',
  ]);
  assert.deepEqual(record.componentJson.declienting, []);
  assert.deepEqual(record.componentJson.reuseFingerprint, {
    slots: ['heading', 'body', 'action'],
    affordance: 'contain',
    role: 'container',
  });
  assert.equal(record.componentJson.exportName, 'Modal');
  assert.equal(record.componentJson.rendering, 'hybrid');
  assert.equal(record.componentJson.realization.version, 1);
  assert.equal(record.componentJson.maturity, 'candidate');
  assert.ok(!Object.hasOwn(record.componentJson, 'architecture'));
  assert.deepEqual(record.stories, { title: 'Modal', tag: 'maturity:candidate' });
});

test('a valid server architecture passes with full server output and no hydration', () => {
  const captures = tempCaptures();
  patchArchitecture(captures, () => ({
    mode: 'server',
    hydration: [],
    serverOutput: 'full',
    modules: [
      { path: 'index.ts', role: 'facade', runtime: 'server' },
      { path: 'Modal.types.ts', role: 'types', runtime: 'server' },
      { path: 'Modal.tsx', role: 'tree', runtime: 'server' },
      { path: 'parts/ModalHeader.tsx', role: 'leaf', runtime: 'server' },
    ],
  }));
  patchEntry(captures, (entry) => ({ ...entry, rendering: 'server' }));
  const result = preflight(captures, fixture('fake-library'));
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(only(result).architecture.mode, 'server');
});

test('a valid client architecture passes with a client facade and neutral presentation leaf', () => {
  const captures = tempCaptures();
  patchArchitecture(captures, () => ({
    mode: 'client',
    hydration: ['state', 'event-handler'],
    serverOutput: 'none',
    modules: [
      { path: 'index.ts', role: 'facade', runtime: 'client' },
      { path: 'Modal.types.ts', role: 'types', runtime: 'server' },
      { path: 'Modal.client.tsx', role: 'tree', runtime: 'client' },
      { path: 'parts/ModalHeader.tsx', role: 'leaf', runtime: 'server' },
    ],
  }));
  patchEntry(captures, (entry) => ({ ...entry, rendering: 'client' }));
  const result = preflight(captures, fixture('fake-library'));
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(only(result).architecture.mode, 'client');
});

test('a missing Runtime architecture block is a hard blocker', () => {
  const captures = tempCaptures();
  const text = readFile(captures, 'modal.md');
  const start = text.indexOf('## Runtime architecture');
  const end = text.indexOf('## Proposed library entry', start);
  writeFile(captures, 'modal.md', `${text.slice(0, start)}${text.slice(end)}`);
  assertBlocked(preflight(captures, fixture('fake-library')), 'architecture-missing');
});

test('unknown architecture modes, hydration reasons, roles, and runtimes are blocked', () => {
  const captures = tempCaptures();
  patchArchitecture(captures, (architecture) => ({
    ...architecture,
    mode: 'island',
    hydration: ['magic'],
    modules: architecture.modules.map((module, index) =>
      index === 2 ? { ...module, role: 'wrapper', runtime: 'edge' } : module,
    ),
  }));
  const result = preflight(captures, fixture('fake-library'));
  assertBlocked(result, 'architecture-mode');
  const codes = only(result).blockers.map((blocker) => blocker.code);
  assert.ok(codes.includes('architecture-hydration'));
  assert.ok(codes.includes('architecture-module'));
});

test('runtime architecture and module objects reject keys outside the exact contract', () => {
  const cases = [
    (architecture) => ({ ...architecture, rationale: 'not part of the contract' }),
    (architecture) => ({
      ...architecture,
      modules: architecture.modules.map((module, index) =>
        index === 0 ? { ...module, export: 'public' } : module,
      ),
    }),
  ];

  for (const patch of cases) {
    const captures = tempCaptures();
    patchArchitecture(captures, patch);
    const result = preflight(captures, fixture('fake-library'));
    const codes = only(result).blockers.map((blocker) => blocker.code);
    assert.ok(
      codes.includes('architecture-keys') || codes.includes('architecture-module'),
      JSON.stringify(only(result).blockers, null, 2),
    );
  }
});

test('hydration reasons cannot be duplicated', () => {
  const captures = tempCaptures();
  patchArchitecture(captures, (architecture) => ({
    ...architecture,
    hydration: [...architecture.hydration, architecture.hydration[0]],
  }));
  assertBlocked(preflight(captures, fixture('fake-library')), 'architecture-hydration');
});

test('the plan requires exactly one index.ts facade and one server types module', () => {
  const cases = [
    {
      code: 'architecture-facade',
      patch: (architecture) => ({
        ...architecture,
        modules: architecture.modules.filter((module) => module.role !== 'facade'),
      }),
    },
    {
      code: 'architecture-types',
      patch: (architecture) => ({
        ...architecture,
        modules: architecture.modules.filter((module) => module.role !== 'types'),
      }),
    },
    {
      code: 'architecture-types',
      patch: (architecture) => ({
        ...architecture,
        modules: architecture.modules.map((module) =>
          module.role === 'types' ? { ...module, path: 'types/Modal.ts' } : module,
        ),
      }),
    },
    {
      code: 'architecture-types',
      patch: (architecture) => ({
        ...architecture,
        modules: architecture.modules.map((module) =>
          module.role === 'types' ? { ...module, runtime: 'client', path: 'Modal.types.client.ts' } : module,
        ),
      }),
    },
  ];

  for (const fixtureCase of cases) {
    const captures = tempCaptures();
    patchArchitecture(captures, fixtureCase.patch);
    assertBlocked(preflight(captures, fixture('fake-library')), fixtureCase.code);
  }
});

test('mode, hydration, server output, and facade consistency are enforced', () => {
  const cases = [
    {
      name: 'server hydration',
      patch: (architecture) => ({ ...architecture, mode: 'server', hydration: ['state'], serverOutput: 'full' }),
    },
    {
      name: 'hybrid hydration',
      patch: (architecture) => ({ ...architecture, hydration: [] }),
    },
    {
      name: 'hybrid output',
      patch: (architecture) => ({ ...architecture, serverOutput: 'full' }),
    },
    {
      name: 'client facade',
      patch: (architecture) => ({ ...architecture, mode: 'client', serverOutput: 'none' }),
    },
  ];

  for (const fixtureCase of cases) {
    const captures = tempCaptures();
    patchArchitecture(captures, fixtureCase.patch);
    const result = preflight(captures, fixture('fake-library'));
    assertBlocked(result, 'architecture-consistency');
  }
});

test('server, hybrid, and client module-runtime consistency is enforced', () => {
  const cases = [
    {
      message: /server mode cannot declare client modules/,
      patch: (architecture) => ({ ...architecture, mode: 'server', hydration: [], serverOutput: 'full' }),
    },
    {
      message: /hybrid mode requires at least one server implementation module and one client module/,
      patch: (architecture) => ({
        ...architecture,
        modules: architecture.modules.map((module) => ({
          ...module,
          path: module.path.replace('.client.', '.'),
          runtime: 'server',
        })),
      }),
    },
    {
      message: /client mode requires at least one client tree\/branch\/leaf module/,
      patch: (architecture) => ({
        ...architecture,
        mode: 'client',
        serverOutput: 'none',
        modules: architecture.modules.map((module) =>
          module.role === 'facade'
            ? { ...module, runtime: 'client' }
            : module.runtime === 'client'
              ? { ...module, path: module.path.replace('.client.', '.'), runtime: 'server' }
              : module,
        ),
      }),
    },
  ];

  for (const fixtureCase of cases) {
    const captures = tempCaptures();
    patchArchitecture(captures, fixtureCase.patch);
    const result = preflight(captures, fixture('fake-library'));
    assertBlocked(result, 'architecture-consistency');
    assert.ok(only(result).blockers.some((blocker) => fixtureCase.message.test(blocker.message)));
  }
});

test('a hybrid facade does not substitute for a server implementation module', () => {
  const captures = tempCaptures();
  patchArchitecture(captures, (architecture) => ({
    ...architecture,
    modules: architecture.modules.map((module) =>
      ['tree', 'branch', 'leaf'].includes(module.role)
        ? { ...module, path: module.path.replace('.tsx', '.client.tsx'), runtime: 'client' }
        : module,
    ),
  }));
  const result = preflight(captures, fixture('fake-library'));
  assertBlocked(result, 'architecture-consistency');
  assert.ok(only(result).blockers.some((blocker) => /server implementation module/.test(blocker.message)));
});

test('client implementation modules require the .client.ts/.client.tsx suffix', () => {
  const captures = tempCaptures();
  patchArchitecture(captures, (architecture) => ({
    ...architecture,
    modules: architecture.modules.map((module) =>
      module.path === 'parts/ModalDialog.client.tsx'
        ? { ...module, path: 'parts/ModalDialog.tsx' }
        : module,
    ),
  }));
  assertBlocked(preflight(captures, fixture('fake-library')), 'architecture-client-path');
});

test('one-TSX plans are blocked', () => {
  const captures = tempCaptures();
  patchArchitecture(captures, () => ({
    mode: 'server',
    hydration: [],
    serverOutput: 'full',
    modules: [
      { path: 'index.ts', role: 'facade', runtime: 'server' },
      { path: 'Modal.types.ts', role: 'types', runtime: 'server' },
      { path: 'Modal.tsx', role: 'tree', runtime: 'server' },
    ],
  }));
  assertBlocked(preflight(captures, fixture('fake-library')), 'architecture-tsx');
});

test('module paths must be normalized, safe, relative, and unique', () => {
  const captures = tempCaptures();
  patchArchitecture(captures, (architecture) => ({
    ...architecture,
    modules: architecture.modules.map((module, index) =>
      index === 2 ? { ...module, path: '../Modal.tsx' } : index === 4 ? { ...module, path: 'index.ts' } : module,
    ),
  }));
  const result = preflight(captures, fixture('fake-library'));
  assertBlocked(result, 'architecture-path');
  assert.ok(only(result).blockers.some((blocker) => blocker.code === 'architecture-path-duplicate'));
});

test('orphanedByRun names a library component claiming this run with no capture', () => {
  // The real defect: components/badge/ declares runs/fake-project/2026-01-01/ but
  // no captures/badge.md exists. components/link/ claims a different run and must
  // not appear.
  const result = preflight(tempCaptures(), fixture('fake-library'));
  assert.deepEqual(
    result.json.orphanedByRun.map((o) => o.slug),
    ['badge'],
  );
});

test('an unknown flag exits 2', () => {
  const result = preflight(tempCaptures(), fixture('fake-library'), ['--nope', 'x']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown option/);
});

test('a missing --captures directory exits 3', () => {
  const result = preflight('/does/not/exist', fixture('fake-library'));
  assert.equal(result.status, 3);
  assert.match(result.stderr, /--captures is not a directory/);
});

test('a --library that is not a library checkout exits 4', () => {
  const result = preflight(tempCaptures(), fixture('fake-project'));
  assert.equal(result.status, 4);
  assert.match(result.stderr, /not a ui-design-library checkout/);
});

test('a structurally invalid manifest exits 5', () => {
  const brain = tempFixture('fake-brain');
  writeFile(brain, 'skills/ui-design-brain/patterns-manifest.json', '{"not":"an array"}');
  const result = preflight(tempCaptures(), fixture('fake-library'), [
    '--manifest',
    path.join(brain, 'skills/ui-design-brain/patterns-manifest.json'),
  ]);
  assert.equal(result.status, 5);
  assert.match(result.stderr, /top-level JSON array/);
});

test('no --brain or --manifest degrades with a warning instead of failing', () => {
  const result = preflight(tempCaptures(), fixture('fake-library'), []);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}${result.stderr}`);
  assert.equal(result.json.manifest, null);
  assert.ok(result.json.warnings.some((w) => w.code === 'manifest-absent'));
  const record = only(result);
  assert.equal(record.status, 'ready');
  assert.ok(!record.blockers.some((b) => b.code === 'canonical-unknown'));
});

test('a canonical the catalog does not have, with no in-run proposal, is blocked', () => {
  const captures = tempCaptures();
  const brain = tempFixture('fake-brain');
  const manifestPath = path.join(brain, 'skills/ui-design-brain/patterns-manifest.json');
  const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).filter((e) => e.name !== 'Modal');
  fs.writeFileSync(manifestPath, JSON.stringify(entries, null, 2));
  // The sibling proposals/logo-ribbon.md establishes "Logo ribbon", not "Modal", so
  // no deferral applies and Modal stays hard-blocked.
  assertBlocked(preflight(captures, fixture('fake-library'), ['--manifest', manifestPath]), 'canonical-unknown');
});

test('an unknown canonical established by an in-run new-pattern proposal is deferred, not blocked', () => {
  // proposals/logo-ribbon.md (new-pattern, name "Logo ribbon") ships in fake-output, and
  // "Logo ribbon" is absent from fake-brain's manifest — so a logo-ribbon capture defers
  // to that pending promotion instead of hard-blocking. Promote it, re-run, and it is ready.
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Logo ribbon', 'logo-ribbon');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'logo-ribbon.md', text);
  const result = preflight(captures, fixture('fake-library'));
  assert.equal(result.status, 6, `deferred-only must exit 6, got ${result.status}:\n${result.stdout}${result.stderr}`);
  const record = only(result);
  assert.equal(record.status, 'deferred');
  assert.equal(record.deferral.reason, 'pending-promotion');
  assert.match(record.deferral.proposal, /logo-ribbon\.md/);
  assert.ok(!record.blockers.some((b) => b.code === 'canonical-unknown'));
  assert.equal(result.json.counts.deferred, 1);
  assert.equal(result.json.counts.blocked, 0);
});

test('a deferred capture that also has a hard blocker stays blocked, not deferred', () => {
  // Blocked outranks deferred at the terminal gate: an empty slots array is a real
  // defect, so the pending-promotion flag must not launder it into a deferral.
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Logo ribbon', 'logo-ribbon')
    .replace(/"slots": \[[^\]]*\]/, '"slots": []');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'logo-ribbon.md', text);
  const result = preflight(captures, fixture('fake-library'));
  assert.equal(result.status, 1, 'a blocker outranks deferral → exit 1');
  const record = only(result);
  assert.equal(record.status, 'blocked');
  assert.ok(record.deferred, 'the deferral flag is still set even though status is blocked');
  assert.ok(record.blockers.some((b) => b.code === 'slots-empty'));
});

test('a capture named after the project label rather than the canonical is blocked', () => {
  // captures/tag.md declaring **Badge** — the defect the CN run actually carried.
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge')
    .replace('**Badge** (`badge`)', '**Badge** (`tag`)');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'tag.md', text);
  assertBlocked(preflight(captures, fixture('fake-library')), 'slug-mismatch');
});

test('a proposed library entry with no fenced json is blocked', () => {
  const captures = tempCaptures();
  const text = readFile(captures, 'modal.md');
  const sectionStart = text.indexOf('## Proposed library entry');
  const fenceStart = text.indexOf('```json\n', sectionStart);
  const fenceEnd = text.indexOf('\n```', fenceStart) + '\n```'.length;
  writeFile(captures, 'modal.md', `${text.slice(0, fenceStart)}(to be written)${text.slice(fenceEnd)}`);
  assertBlocked(preflight(captures, fixture('fake-library')), 'entry-unparsable');
});

test('a proposed library entry missing provenance.source is blocked', () => {
  const captures = tempCaptures();
  patchEntry(captures, (entry) => {
    delete entry.provenance.source;
    return entry;
  });
  assertBlocked(preflight(captures, fixture('fake-library')), 'provenance-incomplete');
});

test('a proposed library entry with no slots is blocked', () => {
  const captures = tempCaptures();
  patchEntry(captures, (entry) => ({ ...entry, slots: [] }));
  assertBlocked(preflight(captures, fixture('fake-library')), 'slots-empty');
});

test('a missing or ungoverned reuse fingerprint is blocked', () => {
  const missing = tempCaptures();
  patchEntry(missing, (entry) => {
    delete entry.reuseFingerprint;
    return entry;
  });
  assertBlocked(preflight(missing, fixture('fake-library')), 'reuse-fingerprint');

  const ungoverned = tempCaptures();
  patchEntry(ungoverned, (entry) => ({
    ...entry,
    reuseFingerprint: { slots: ['dialog'], affordance: 'overlay', role: 'dialog' },
  }));
  assertBlocked(preflight(ungoverned, fixture('fake-library')), 'reuse-fingerprint');
});

test('exportName, rendering, and realization v1 are hard requirements', () => {
  const missingExport = tempCaptures();
  patchEntry(missingExport, (entry) => {
    delete entry.exportName;
    return entry;
  });
  assertBlocked(preflight(missingExport, fixture('fake-library')), 'export-name');

  const wrongRendering = tempCaptures();
  patchEntry(wrongRendering, (entry) => ({ ...entry, rendering: 'server' }));
  assertBlocked(preflight(wrongRendering, fixture('fake-library')), 'rendering');

  const missingRealization = tempCaptures();
  patchEntry(missingRealization, (entry) => {
    delete entry.realization;
    return entry;
  });
  assertBlocked(preflight(missingRealization, fixture('fake-library')), 'realization-missing');
});

test('realization accessibility evidence and IDREFs must resolve', () => {
  const badEvidence = tempCaptures();
  patchEntry(badEvidence, (entry) => {
    entry.realization.behaviors[0].evidence = 'different-id';
    return entry;
  });
  assertBlocked(preflight(badEvidence, fixture('fake-library')), 'realization-evidence');

  const badRelationship = tempCaptures();
  patchEntry(badRelationship, (entry) => {
    entry.realization.relationships[0].to = 'missing-title';
    return entry;
  });
  assertBlocked(preflight(badRelationship, fixture('fake-library')), 'realization-idref');

  const badStandard = tempCaptures();
  patchEntry(badStandard, (entry) => {
    entry.realization.accessibility.standard = 'WCAG-2.1-AA';
    return entry;
  });
  assertBlocked(preflight(badStandard, fixture('fake-library')), 'realization-accessibility');
});

test('realization v1 accepts governed multi-node bindings and constraints', () => {
  const captures = tempCaptures();
  patchEntry(captures, (entry) => {
    entry.realization.contentBindings = [
      { prop: 'children', nodes: ['title', 'body'] },
    ];
    entry.realization.constraints = [
      { when: { prop: 'title', equals: 'Details' }, requireAny: ['children'] },
    ];
    entry.realization.props.push({ path: 'headingLevel', type: 'enum', required: false, values: [2, 3, 4, 5, 6], default: 2 });
    entry.realization.dom.nodes[0].attributes = { role: 'dialog', 'aria-label': { prop: 'title' }, inert: { state: 'covered' } };
    return entry;
  });
  const result = preflight(captures, fixture('fake-library'));
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('realization v1 rejects malformed collections and incompatible defaults', () => {
  const cases = [
    { code: 'realization-content', patch: (realization) => { realization.contentBindings = {}; } },
    { code: 'realization-attributes', patch: (realization) => { realization.safeAttributes = 'none'; } },
    { code: 'realization-idref', patch: (realization) => { realization.relationships = {}; } },
    { code: 'realization-style', patch: (realization) => { delete realization.styleSlots[0].protectedProperties; } },
    { code: 'realization-constraints', patch: (realization) => { realization.constraints = {}; } },
    { code: 'realization-dom', patch: (realization) => { realization.dom.nodes[0].attributes = { 'aria-labelledby': 'title' }; } },
    { code: 'realization-dom', patch: (realization) => { realization.dom.nodes[0].attributes = { role: { prop: 'missing' } }; } },
    { code: 'realization-props', patch: (realization) => { realization.props.push({ path: 'open', type: 'boolean', required: false, default: 'false' }); } },
    { code: 'realization-props', patch: (realization) => { realization.props.push({ path: 'level', type: 'enum', required: false, values: [2, 3], default: 4 }); } },
    { code: 'realization-props', patch: (realization) => { realization.props.push({ path: 'items', type: 'collection', required: false, default: 'not-a-collection' }); } },
    { code: 'realization-props', patch: (realization) => { realization.props.push({ path: 'onChange', type: 'callback', required: false, default: 'noop' }); } },
  ];
  for (const item of cases) {
    const captures = tempCaptures();
    patchEntry(captures, (entry) => {
      item.patch(entry.realization);
      return entry;
    });
    assertBlocked(preflight(captures, fixture('fake-library')), item.code);
  }
});

test('realization v1 rejects ungrounded style paths, malformed constraints, cycles, and untyped evidence', () => {
  const cases = [
    {
      code: 'realization-style',
      patch: (realization) => {
        realization.styleSlots[0].path = 'classNames.missing';
      },
    },
    {
      code: 'realization-constraints',
      patch: (realization) => {
        realization.constraints = [{ when: { prop: 'missing', predicate: 'truthy' }, requireAny: [] }];
      },
    },
    {
      code: 'realization-dom',
      patch: (realization) => {
        realization.dom.nodes[0].parent = 'body';
        realization.dom.nodes[2].parent = 'dialog';
      },
    },
    {
      code: 'realization-evidence',
      patch: (realization) => {
        delete realization.behaviors[0].evidenceType;
      },
    },
  ];

  for (const fixtureCase of cases) {
    const captures = tempCaptures();
    patchEntry(captures, (entry) => {
      fixtureCase.patch(entry.realization);
      return entry;
    });
    assertBlocked(preflight(captures, fixture('fake-library')), fixtureCase.code);
  }
});

test('conditional, repeated, and alternative DOM shapes require deterministic declarations', () => {
  const cases = [
    (node) => { node.cardinality = 'zero-or-one'; },
    (node) => { node.cardinality = 'zero-or-more'; },
    (node) => { node.element = ['h2', 'h3']; },
  ];
  for (const patchNode of cases) {
    const captures = tempCaptures();
    patchEntry(captures, (entry) => {
      patchNode(entry.realization.dom.nodes[1]);
      return entry;
    });
    assertBlocked(preflight(captures, fixture('fake-library')), 'realization-dom');
  }
});

test('an entry disagreeing with the Canonical line is blocked', () => {
  const captures = tempCaptures();
  patchEntry(captures, (entry) => ({ ...entry, canonical: 'Alert', slug: 'alert' }));
  assertBlocked(preflight(captures, fixture('fake-library')), 'entry-disagrees');
});

test('a half-written component directory is blocked, not overwritten', () => {
  // components/link/ holds only a component.json in the fixture.
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Link', 'link');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'link.md', text);
  assertBlocked(preflight(captures, fixture('fake-library')), 'library-partial');
});

test('an already-applied capture is skipped, not blocked', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);
  const result = preflight(captures, fixture('fake-library'));
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}${result.stderr}`);
  const record = only(result);
  assert.equal(record.status, 'skipped');
  assert.ok(record.library.files.includes('parts/BadgeDialog.client.tsx'));
  assert.deepEqual(record.library.missingModules, []);
});

test('applied inspection follows multiline imports and directives after comments', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);

  const library = tempFixture('fake-library');
  const dialog = path.join(library, 'components/badge/parts/BadgeDialog.client.tsx');
  fs.writeFileSync(
    dialog,
    fs
      .readFileSync(dialog, 'utf8')
      .replace("'use client';", "// Client island.\n'use client';")
      .replace("import { useBadge } from '../hooks/useBadge.client';", "import {\n  useBadge,\n} from '../hooks/useBadge.client';"),
  );
  const result = preflight(captures, library);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(only(result).status, 'skipped');
});

test('planned filenames do not hide component manifest drift', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge').replace(
    'runs/fake-project/2026-01-01/',
    'runs/fake-project/2026-02-02/',
  );
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);
  assertBlocked(preflight(captures, fixture('fake-library')), 'library-drift');
});

test('an empty planned module is not treated as already applied', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);

  const library = tempFixture('fake-library');
  fs.writeFileSync(path.join(library, 'components/badge/parts/BadgeHeader.tsx'), '');
  const result = preflight(captures, library);
  assertBlocked(result, 'library-partial');
  assert.ok(only(result).library.architectureIssues.some((issue) => /is empty/.test(issue)));
});

test('an unexpected implementation module is not treated as already applied', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);

  const library = tempFixture('fake-library');
  fs.writeFileSync(path.join(library, 'components/badge/parts/Unplanned.tsx'), 'export const Unplanned = null;\n');
  const result = preflight(captures, library);
  assertBlocked(result, 'library-partial');
  assert.deepEqual(only(result).library.unexpectedModules, ['parts/Unplanned.tsx']);
});

test('a client module outside the applied client boundary is not treated as complete', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);

  const library = tempFixture('fake-library');
  const dialog = path.join(library, 'components/badge/parts/BadgeDialog.client.tsx');
  fs.writeFileSync(dialog, fs.readFileSync(dialog, 'utf8').replace("'use client';\n\n", ''));
  const result = preflight(captures, library);
  assertBlocked(result, 'library-partial');
  assert.ok(only(result).library.architectureIssues.some((issue) => /not beneath/.test(issue)));
});

test('recursive inspection blocks a component missing one nested planned module', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);

  const library = tempFixture('fake-library');
  fs.rmSync(path.join(library, 'components/badge/parts/BadgeHeader.tsx'));
  const result = preflight(captures, library);
  assertBlocked(result, 'library-partial');
  assert.deepEqual(only(result).library.missingModules, ['parts/BadgeHeader.tsx']);
});

test('a nested story does not make an otherwise complete component look applied', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);

  const library = tempFixture('fake-library');
  fs.renameSync(
    path.join(library, 'components/badge/Badge.stories.tsx'),
    path.join(library, 'components/badge/parts/Badge.stories.tsx'),
  );
  const result = preflight(captures, library);
  assertBlocked(result, 'library-partial');
  assert.equal(only(result).library.has.stories, false);
});

test('a token the semantic layer does not define warns but stays ready', () => {
  const captures = tempCaptures();
  patchEntry(captures, (entry) => ({ ...entry, tokens: [...entry.tokens, 'color-surface-scrim'] }));
  const result = preflight(captures, fixture('fake-library'));
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}${result.stderr}`);
  const record = only(result);
  assert.equal(record.status, 'ready');
  assert.deepEqual(record.tokens.undefined, ['color-surface-scrim']);
  assert.ok(result.json.warnings.some((w) => w.code === 'token-undefined'));
});

test('a capture that is not a component-capture is blocked', () => {
  const captures = tempCaptures();
  writeFile(captures, 'modal.md', readFile(captures, 'modal.md').replace('component-capture', 'new-pattern'));
  assertBlocked(preflight(captures, fixture('fake-library')), 'capture-type');
});

test('an empty captures directory warns and exits 0', () => {
  const captures = tempCaptures();
  fs.rmSync(path.join(captures, 'modal.md'));
  const result = preflight(captures, fixture('fake-library'));
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}${result.stderr}`);
  assert.equal(result.json.counts.captures, 0);
  assert.ok(result.json.warnings.some((w) => w.code === 'no-captures'));
});

test('the library is never written to', () => {
  // Names alone would miss a rewritten component.json or a mutated semantic.css,
  // so fingerprint the whole checkout by content.
  const library = tempFixture('fake-library');
  const snapshot = () =>
    fs
      .readdirSync(library, { recursive: true })
      .sort()
      .map((rel) => {
        const full = path.join(library, rel);
        return fs.statSync(full).isDirectory() ? `${rel}/` : `${rel}:${fs.readFileSync(full, 'utf8')}`;
      })
      .join('\n');
  const before = snapshot();
  preflight(tempCaptures(), library);
  assert.equal(snapshot(), before);
});

test('a canonical the two repos kebab differently is blocked', () => {
  // ui-design-library's own kebab lacks the acronym split, so `CTAButton` becomes
  // `ctabutton` there and `cta-button` here. No current canonical triggers it; this
  // pins the replica so a fix to one repo cannot drift the other silently.
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'CTAButton', 'cta-button');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'cta-button.md', text);

  const brain = tempFixture('fake-brain');
  const manifestPath = path.join(brain, 'skills/ui-design-brain/patterns-manifest.json');
  const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  entries.push({ name: 'CTAButton', slug: 'cta-button', aliases: [], file: 'patterns/cta-button.md' });
  fs.writeFileSync(manifestPath, JSON.stringify(entries, null, 2));

  assertBlocked(preflight(captures, fixture('fake-library'), ['--manifest', manifestPath]), 'kebab-divergence');
});

test('a proposed library entry of null is blocked, not a crash', () => {
  // `null` parses, so reading a field off it would throw past the top-level catch
  // and lose the plan for every other capture in the set.
  const captures = tempCaptures();
  patchEntry(captures, () => null);
  const result = preflight(captures, fixture('fake-library'));
  assert.ok(result.json, `expected a plan even for a null entry, got:\n${result.stdout}${result.stderr}`);
  assertBlocked(result, 'entry-unparsable');
});

test('a slug already held by a different canonical is blocked, not skipped', () => {
  // components/badge/ holds Badge. A capture of a different canonical that kebabs
  // to `badge` is a collision, not a no-op.
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);

  const library = tempFixture('fake-library');
  const existing = path.join(library, 'components/badge/component.json');
  const json = JSON.parse(fs.readFileSync(existing, 'utf8'));
  fs.writeFileSync(existing, JSON.stringify({ ...json, canonical: 'Chip' }, null, 2));

  assertBlocked(preflight(captures, library), 'slug-occupied');
});

test('a capture set declaring no provenance.run warns that the orphan check did not run', () => {
  const captures = tempCaptures();
  patchEntry(captures, (entry) => {
    delete entry.provenance.run;
    return entry;
  });
  const result = preflight(captures, fixture('fake-library'));
  assert.deepEqual(result.json.orphanedByRun, []);
  assert.ok(
    result.json.warnings.some((w) => w.code === 'orphan-check-skipped'),
    'an empty orphanedByRun must not read as a clean bill of health',
  );
});

test('a mixed set reports every status in one plan', () => {
  // The headline claim is "one plan covering all of them" — exercise ready,
  // blocked, skipped, and deferred together, since that combination drives the exit rule.
  const captures = tempCaptures();
  const base = readFile(captures, 'modal.md');

  writeFile(captures, 'badge.md', retarget(base, 'Badge', 'badge')); //                already applied  → skipped
  writeFile(captures, 'link.md', retarget(base, 'Link', 'link')); //                   partial dir      → blocked
  writeFile(captures, 'logo-ribbon.md', retarget(base, 'Logo ribbon', 'logo-ribbon')); // in-run proposal → deferred
  // modal.md stays as-is                                                        //                → ready

  const result = preflight(captures, fixture('fake-library'), ['--brain', BRAIN]);
  assert.equal(result.status, 1, 'a set containing a blocked capture must exit 1 even with a deferred one present');
  const byFile = Object.fromEntries(result.json.components.map((c) => [c.file, c.status]));
  assert.deepEqual(byFile, {
    'badge.md': 'skipped',
    'link.md': 'blocked',
    'logo-ribbon.md': 'deferred',
    'modal.md': 'ready',
  });
  assert.deepEqual(result.json.counts, {
    captures: 4,
    ready: 1,
    blocked: 1,
    skipped: 1,
    deferred: 1,
    orphanedByRun: 0,
  });
});

test('a large plan is not truncated when piped', () => {
  // stdout is async on a pipe; exiting outright would cut the JSON mid-object
  // while still reporting a clean exit code.
  const captures = tempCaptures();
  const base = readFile(captures, 'modal.md');
  for (let i = 0; i < 70; i += 1) {
    const slug = `filler-${String(i).padStart(2, '0')}`;
    writeFile(
      captures,
      `${slug}.md`,
      retarget(base, `Filler ${i}`, slug),
    );
  }
  // --pretty is what SKILL.md's documented invocation uses, and it is what pushes a
  // realistic set past the 64 KB pipe buffer.
  const result = preflight(captures, fixture('fake-library'), ['--pretty']);
  assert.ok(result.stdout.length > 65536, `expected output past the 64 KB pipe buffer, got ${result.stdout.length} bytes`);
  assert.ok(result.json, 'the plan must still parse as JSON');
  assert.equal(result.json.counts.captures, 71);
});

test('--manifest wins over --brain', () => {
  const result = preflight(tempCaptures(), fixture('fake-library'), ['--brain', '/does/not/exist', '--manifest', MANIFEST]);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}${result.stderr}`);
  assert.equal(result.json.manifest.path, MANIFEST);
});
