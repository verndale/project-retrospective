'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runJson, tempFixture, readFile, writeFile, fixture } = require('./helpers.cjs');

const BRAIN = fixture('fake-brain');
const MANIFEST = fixture('fake-brain/skills/ui-design-brain/patterns-manifest.json');
const SIBLING_LIBRARY = path.resolve(__dirname, '..', '..', '..', 'ui-design-library');

/** A captures/ directory holding just the golden modal capture. */
function tempCaptures() {
  const dir = tempFixture('fake-output');
  return path.join(dir, 'captures');
}

function syncSourceParity(captures) {
  const parityDir = path.resolve(captures, '..', 'source-parity');
  const templatePath = path.join(parityDir, 'modal.json');
  const template = fs.existsSync(templatePath) ? JSON.parse(fs.readFileSync(templatePath, 'utf8')) : null;
  if (!template) return;
  const sourceProject = fixture('fake-project');
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const inventoryPath = path.resolve(captures, '..', 'inventory.json');
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const meta = JSON.parse(fs.readFileSync(path.resolve(captures, '..', 'meta.json'), 'utf8'));
  const resolutionPath = path.resolve(captures, '..', 'resolution.json');
  const resolution = JSON.parse(fs.readFileSync(resolutionPath, 'utf8'));
  const catalogCanonicals = new Set(
    JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).map((entry) => entry.name),
  );
  inventory.project = sourceProject;
  inventory.sourceSnapshot = { strategy: 'recorded', commit, dirty: false };
  fs.rmSync(parityDir, { recursive: true, force: true });
  fs.mkdirSync(parityDir, { recursive: true });
  for (const name of fs.readdirSync(captures).filter((entry) => entry.endsWith('.md'))) {
    const componentKey = path.basename(name, '.md');
    const source = fs.readFileSync(path.join(captures, name), 'utf8');
    const canonical = source.match(/\*\*([^*]+)\*\* \(`/)?.[1] || componentKey;
    const baseSlug = source.match(/\*\*[^*]+\*\* \(`([^`]+)`\)/)?.[1] || componentKey.split('--')[0];
    const sourceEntry = source.match(/^- Entry:\s*`([^`]+)`\s*$/m)?.[1] || template.sourceSnapshot.entry;
    const existingSource = inventory.components.find((candidate) => candidate.entry === sourceEntry);
    if (!existingSource) {
      inventory.components.push({
        name: canonical,
        folder: baseSlug,
        bucket: 'ui',
        domain: null,
        path: path.posix.dirname(sourceEntry),
        entry: sourceEntry,
        sources: ['code-scan'],
        facets: null,
        partOf: null,
        buildPack: null,
        fingerprint: null,
      });
    }
    const sourceFolder = existingSource?.folder || baseSlug;
    if (catalogCanonicals.has(canonical)) {
      resolution.resolved = resolution.resolved.filter((row) =>
        !(row.component === sourceFolder && row.canonical === canonical));
      resolution.resolved.push({
        label: canonical,
        component: sourceFolder,
        canonical,
        slug: baseSlug,
        via: 'name',
        ambiguous: false,
      });
    } else if (!resolution.unresolved.some((row) =>
      row.locations?.some((location) => location.component === sourceFolder) &&
      [row.label, row.normalized].some((identity) => identity === canonical || identity === baseSlug))) {
      resolution.unresolved.push({
        label: canonical,
        normalized: baseSlug,
        occurrences: 1,
        locations: [{ component: sourceFolder, path: path.posix.dirname(sourceEntry), bucket: 'ui', domain: null }],
        sources: ['code-scan'],
      });
    }
    const artifact = structuredClone(template);
    artifact.componentKey = componentKey;
    artifact.canonical = canonical;
    artifact.capture = `captures/${name}`;
    artifact.sourceSnapshot.project = meta.project.slug;
    artifact.sourceSnapshot.run = `runs/${meta.project.slug}/${meta.date}/`;
    artifact.observations[0].id = `sp-${componentKey}-001`;
    artifact.sourceSnapshot.revision = {
      strategy: 'recorded',
      commit,
      inventoryGeneratedAt: inventory.generatedAt,
    };
    artifact.sourceSnapshot.entry = sourceEntry;
    artifact.sourceSnapshot.citations[0].path = sourceEntry;
    artifact.sourceInspection.entryPoints.paths = [sourceEntry];
    artifact.sourceInspection.accessibility.paths = [sourceEntry];
    artifact.sourceSnapshot.citations[0].startLine = 1;
    artifact.sourceSnapshot.citations[0].endLine = 1;
    artifact.sourceSnapshot.citations[0].sha256 = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(sourceProject, artifact.sourceSnapshot.citations[0].path)))
      .digest('hex');
    fs.writeFileSync(path.join(parityDir, `${componentKey}.json`), `${JSON.stringify(artifact, null, 2)}\n`);
  }
  fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  fs.writeFileSync(resolutionPath, `${JSON.stringify(resolution, null, 2)}\n`);
}

function runPreparedPreflight(captures, library, args = ['--brain', BRAIN], withCapability = true) {
  const capability = withCapability
    ? ['--figma-writer', 'figma-use', '--figma-live-validated', '--project', fixture('fake-project')]
    : ['--project', fixture('fake-project')];
  return runJson('capture-preflight.cjs', ['--captures', captures, '--library', library, ...capability, ...args]);
}

function preflight(captures, library, args = ['--brain', BRAIN], withCapability = true) {
  syncSourceParity(captures);
  return runPreparedPreflight(captures, library, args, withCapability);
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

function registerReviewedFigma(library, canonical, componentPath, variant = null) {
  const registry = JSON.parse(readFile(library, 'figma/library.json'));
  registry.components.push({
    id: `${canonical.toLowerCase().replaceAll(' ', '-')}-reviewed`,
    canonical,
    ...(variant ? { variant } : {}),
    componentPath,
    figma: {
      nodeId: '100:200',
      nodeKey: 'stable-node-key',
      status: 'ready-for-dev',
      publicationStatus: 'unpublished',
      presentationEvidence: {
        contractVersion: 1,
        referencePageId: '10:1',
        referencePageName: 'Button — Light',
        sections: {
          documentation: { nodeId: '10:2', order: 1 },
          main: { nodeId: '10:3', order: 2 },
          interactionStates: { nodeId: '10:4', order: 3 },
          publishSource: { nodeId: '10:5', order: null },
        },
      },
      tokenBindingAudit: {
        contractVersion: 1,
        stateRequirements: { 'dialog.open': ['color/border/focus'] },
      },
      review: { status: 'passed', passes: ['source-parity', 'adversarial', 'design'] },
      stateCoverage: {
        status: 'covered',
        storyExport: 'InteractionStates',
        states: [
          {
            id: 'dialog.open',
            label: 'Open',
            source: { trigger: 'derived-state', value: 'open=true' },
            target: 'Dialog surface',
            classification: 'rendered',
            frameNodeId: '200:1',
            instanceNodeId: '200:2',
            componentNodeId: '99:1',
          },
          {
            id: 'dialog.focus-containment',
            label: 'Focus containment and restoration',
            source: { trigger: 'behavior', value: 'Tab containment while open and focus restoration on close' },
            target: 'Dialog focus lifecycle',
            classification: 'runtime-only',
            reason: 'Focus movement across time cannot be represented honestly in a static Figma frame.',
          },
        ],
      },
    },
  });
  writeFile(library, 'figma/library.json', `${JSON.stringify(registry, null, 2)}\n`);
}

function appliedBlock(library, canonical, componentPath) {
  const registry = JSON.parse(readFile(library, 'figma/library.json'));
  const registration = registry.components.find((entry) =>
    entry.canonical === canonical && entry.componentPath === componentPath);
  assert.ok(registration, `missing ${canonical} Figma registration`);
  return [
    '## Applied',
    '',
    '```json',
    JSON.stringify({
      status: 'landed',
      componentPath,
      figma: {
        nodeId: registration.figma.nodeId,
        nodeKey: registration.figma.nodeKey,
        status: registration.figma.status,
        publicationStatus: registration.figma.publicationStatus,
        presentationEvidence: registration.figma.presentationEvidence,
        tokenBindingAudit: registration.figma.tokenBindingAudit,
        review: registration.figma.review,
        stateCoverage: registration.figma.stateCoverage,
      },
    }, null, 2),
    '```',
    '',
  ].join('\n');
}

function retarget(text, canonical, slug) {
  const symbol = canonical.replace(/[^A-Za-z0-9]+(.)?/g, (_, next) => (next ? next.toUpperCase() : ''));
  return text
    .replace(/\*\*Modal\*\* \(`modal`\)/, `**${canonical}** (\`${slug}\`)`)
    .replaceAll('"canonical": "Modal"', `"canonical": "${canonical}"`)
    .replace('"componentKey": "modal"', `"componentKey": "${slug}"`)
    .replace(/"slug": "modal"/, `"slug": "${slug}"`)
    .replace(/"exportName": "Modal"/, `"exportName": "${symbol}"`)
    .replaceAll('Modal.types.ts', `${symbol}.types.ts`)
    .replaceAll('Modal.tsx', `${symbol}.tsx`)
    .replaceAll('ModalDialog.client.tsx', `${symbol}Dialog.client.tsx`)
    .replaceAll('ModalHeader.tsx', `${symbol}Header.tsx`)
    .replaceAll('useModal.client.ts', `use${symbol}.client.ts`)
    // Retargeting exercises canonical/library mechanics; keep the capture's
    // Source entry attached to the one exact inventoried source fixture.
    .replace(
      `- Entry: \`src/components/ui/modal/${symbol}.tsx\``,
      '- Entry: `src/components/ui/modal/Modal.tsx`',
    );
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
  assert.equal(record.interactionStates.status, 'covered');
  assert.equal(record.interactionStates.storyExport, 'InteractionStates');
  assert.deepEqual(record.blockers, []);
});

test('a capture without its source-parity companion is blocked', () => {
  const captures = tempCaptures();
  syncSourceParity(captures);
  fs.rmSync(path.resolve(captures, '..', 'source-parity/modal.json'));
  const result = runJson('capture-preflight.cjs', [
    '--captures', captures,
    '--library', fixture('fake-library'),
    '--brain', BRAIN,
    '--figma-writer', 'figma-use',
    '--figma-live-validated',
    '--project', fixture('fake-project'),
  ]);
  assertBlocked(result, 'source-parity');
});

test('the envelope carries the documented key order', () => {
  const result = preflight(tempCaptures(), fixture('fake-library'));
  assert.deepEqual(Object.keys(result.json), [
    'schemaVersion',
    'captures',
    'selection',
    'source',
    'sourceParity',
    'library',
    'figmaPromotion',
    'manifest',
    'components',
    'orphanedByRun',
    'counts',
    'warnings',
  ]);
  assert.equal(result.json.schemaVersion, 6);
  assert.equal(result.json.selection, null);
  assert.equal(result.json.source.verified, true);
  assert.deepEqual(result.json.figmaPromotion, {
    required: true,
    ready: true,
    contractReady: true,
    capabilityReady: true,
    writeCapabilityRequired: true,
    status: 'ready-for-dev',
    publicationStatus: 'unpublished',
    reviewPasses: ['source-parity', 'adversarial', 'design'],
    registry: 'figma/library.json',
    checklist: 'figma/PROMOTION-CHECKLIST.md',
    codeContractsCommand: 'pnpm contracts:code',
    codeTestCommand: 'pnpm test:code',
    coverageCommand: 'pnpm figma:coverage',
    liveValidationCommand: 'pnpm figma:live',
    validationCommand: 'pnpm figma:validate',
    writer: 'figma-use',
    liveValidated: true,
    issues: [],
  });
  assert.deepEqual(result.json.counts, {
    captures: 1,
    ready: 1,
    figmaPending: 0,
    evidencePending: 0,
    blocked: 0,
    skipped: 0,
    deferred: 0,
    orphanedByRun: 1,
  });
});

test('fresh and resumed captures require writer capability and current live validation', () => {
  const fresh = preflight(tempCaptures(), fixture('fake-library'), ['--brain', BRAIN], false);
  assertBlocked(fresh, 'figma-promotion-unavailable');

  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);
  const resumed = preflight(captures, fixture('fake-library'), ['--brain', BRAIN], false);
  assertBlocked(resumed, 'figma-promotion-unavailable');
});

test('a REST token or arbitrary capability label cannot impersonate the supported Figma writer', () => {
  for (const writer of ['rest-token', 'read-only', 'true', 'some-tool']) {
    const captures = tempCaptures();
    syncSourceParity(captures);
    const result = runJson('capture-preflight.cjs', [
      '--captures', captures,
      '--library', fixture('fake-library'),
      '--brain', BRAIN,
      '--figma-writer', writer,
      '--figma-live-validated',
      '--project', fixture('fake-project'),
    ]);
    assertBlocked(result, 'figma-promotion-unavailable');
    assert.equal(result.json.figmaPromotion.writer, null);
    assert.ok(result.json.figmaPromotion.issues.some((issue) => issue.includes('expected figma-use')));
  }
});

test('the current library registry interaction-state schema satisfies preflight', () => {
  const library = fixture('fake-library');
  const registry = JSON.parse(readFile(library, 'figma/library.json'));
  assert.deepEqual(registry.library.promotionPattern.interactionStates, {
    presentationName: 'Interaction states',
    storyExport: 'InteractionStates',
    specimenRole: 'documentation',
    masterProperties: 'unchanged',
    instanceConnection: 'registered-master',
    labelPlacement: 'outside-component-instance',
    visualSource: 'semantic-variables',
    rasterScreenshots: false,
  });
  const result = preflight(tempCaptures(), library);
  assert.equal(result.json.figmaPromotion.contractReady, true, result.json.figmaPromotion.issues.join('; '));
});

test('the byte-current sibling library registry and checklist satisfy promotion preflight', {
  skip: !fs.existsSync(path.join(SIBLING_LIBRARY, 'figma/library.json')) ||
    !fs.existsSync(path.join(SIBLING_LIBRARY, 'figma/PROMOTION-CHECKLIST.md')) ||
    !fs.readFileSync(path.join(SIBLING_LIBRARY, 'figma/PROMOTION-CHECKLIST.md'), 'utf8').includes('figma.presentationEvidence') ||
    !JSON.parse(fs.readFileSync(path.join(SIBLING_LIBRARY, 'figma/library.json'), 'utf8')).library?.tokenPolicy?.componentVariableIds,
}, () => {
  const result = preflight(tempCaptures(), SIBLING_LIBRARY);
  assert.equal(
    result.json.figmaPromotion.contractReady,
    true,
    result.json.figmaPromotion.issues.join('; '),
  );
});

test('current Figma registry acceptance still fails closed when a required field is absent', () => {
  const library = tempFixture('fake-library');
  const registry = JSON.parse(readFile(library, 'figma/library.json'));
  delete registry.library.promotionPattern.interactionStates.storyExport;
  writeFile(library, 'figma/library.json', `${JSON.stringify(registry, null, 2)}\n`);

  const result = preflight(tempCaptures(), library);
  assertBlocked(result, 'figma-promotion-unavailable');
  assert.ok(result.json.figmaPromotion.issues.includes(
    'figma/library.json does not expose the governed Interaction states presentation contract',
  ));
});

test('CaptureKeys selects a deterministic subset without orphaning its siblings', () => {
  const captures = tempCaptures();
  writeFile(captures, 'badge.md', retarget(readFile(captures, 'modal.md'), 'Badge', 'badge'));
  const result = preflight(captures, fixture('fake-library'), ['--brain', BRAIN, '--capture-keys', 'modal']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(result.json.selection, ['modal']);
  assert.deepEqual(result.json.components.map((component) => component.componentKey), ['modal']);
});

test('capture source hashes and sibling inventory revision must stay pinned', () => {
  const captures = tempCaptures();
  syncSourceParity(captures);
  const parityPath = path.resolve(captures, '..', 'source-parity/modal.json');
  const artifact = JSON.parse(fs.readFileSync(parityPath, 'utf8'));
  artifact.sourceSnapshot.citations[0].sha256 = '0'.repeat(64);
  fs.writeFileSync(parityPath, `${JSON.stringify(artifact, null, 2)}\n`);
  const result = runJson('capture-preflight.cjs', [
    '--captures', captures,
    '--library', fixture('fake-library'),
    '--brain', BRAIN,
    '--figma-writer', 'figma-use',
    '--figma-live-validated',
    '--project', fixture('fake-project'),
  ]);
  assertBlocked(result, 'source-parity');
});

test('capture preflight accepts explicitly unversioned source after exact current-tree verification', () => {
  const captures = tempCaptures();
  syncSourceParity(captures);
  const inventoryPath = path.resolve(captures, '..', 'inventory.json');
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  inventory.sourceSnapshot = { strategy: 'unavailable', commit: null, dirty: null };
  fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);

  const parityPath = path.resolve(captures, '..', 'source-parity/modal.json');
  const artifact = JSON.parse(fs.readFileSync(parityPath, 'utf8'));
  artifact.sourceSnapshot.revision = {
    strategy: 'legacy-untracked',
    commit: null,
    inventoryGeneratedAt: inventory.generatedAt,
  };
  fs.writeFileSync(parityPath, `${JSON.stringify(artifact, null, 2)}\n`);

  const result = runPreparedPreflight(captures, fixture('fake-library'));
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(only(result).status, 'ready');
  assert.ok(result.json.warnings.some((entry) => entry.code === 'source-unversioned-current-tree'));
});

test('unavailable inventory cannot claim recorded source parity', () => {
  const captures = tempCaptures();
  syncSourceParity(captures);
  const inventoryPath = path.resolve(captures, '..', 'inventory.json');
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  inventory.sourceSnapshot = { strategy: 'unavailable', commit: null, dirty: null };
  fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);

  const result = runPreparedPreflight(captures, fixture('fake-library'));
  assertBlocked(result, 'source-inventory');
  assert.ok(only(result).blockers.some((blocker) =>
    blocker.code === 'source-inventory' && blocker.message.includes('legacy-untracked')));
});

test('capture Source must match the exact inventoried entry verified by source parity', () => {
  const captures = tempCaptures();
  syncSourceParity(captures);
  const parityPath = path.resolve(captures, '..', 'source-parity/modal.json');
  const artifact = JSON.parse(fs.readFileSync(parityPath, 'utf8'));
  const otherEntry = 'src/components/renderings/marketing/checkout-panel/CheckoutPanel.tsx';
  writeFile(
    captures,
    'modal.md',
    readFile(captures, 'modal.md').replace(
      '- Entry: `src/components/ui/modal/Modal.tsx`',
      `- Entry: \`${otherEntry}\``,
    ),
  );
  artifact.sourceSnapshot.entry = otherEntry;
  artifact.sourceSnapshot.citations[0].path = otherEntry;
  artifact.sourceSnapshot.citations[0].startLine = 1;
  artifact.sourceSnapshot.citations[0].endLine = 1;
  artifact.sourceSnapshot.citations[0].sha256 = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(fixture('fake-project'), otherEntry)))
    .digest('hex');
  artifact.sourceInspection.entryPoints.paths = [otherEntry];
  artifact.sourceInspection.accessibility.paths = [otherEntry];
  fs.writeFileSync(parityPath, `${JSON.stringify(artifact, null, 2)}\n`);

  const result = runJson('capture-preflight.cjs', [
    '--captures', captures,
    '--library', fixture('fake-library'),
    '--brain', BRAIN,
    '--figma-writer', 'figma-use',
    '--figma-live-validated',
    '--project', fixture('fake-project'),
  ]);
  assertBlocked(result, 'source-inventory');
  assert.match(
    only(result).blockers.find((blocker) => blocker.code === 'source-inventory').message,
    /CheckoutPanel\.tsx belongs to inventory component .*checkout-panel.*does not resolve that component to capture canonical "Modal"/,
  );
});

test('resolution identity allows a legitimate source label alias to its capture canonical', () => {
  const captures = tempCaptures();
  syncSourceParity(captures);
  const inventoryPath = path.resolve(captures, '..', 'inventory.json');
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const source = inventory.components.find((component) => component.folder === 'modal');
  source.name = 'Dialog';
  source.folder = 'dialog';
  fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  const resolutionPath = path.resolve(captures, '..', 'resolution.json');
  const resolution = JSON.parse(fs.readFileSync(resolutionPath, 'utf8'));
  resolution.resolved = [{
    label: 'Dialog',
    component: 'dialog',
    canonical: 'Modal',
    slug: 'modal',
    via: 'alias',
    ambiguous: false,
  }];
  fs.writeFileSync(resolutionPath, `${JSON.stringify(resolution, null, 2)}\n`);

  const result = runJson('capture-preflight.cjs', [
    '--captures', captures,
    '--library', fixture('fake-library'),
    '--brain', BRAIN,
    '--figma-writer', 'figma-use',
    '--figma-live-validated',
    '--project', fixture('fake-project'),
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(only(result).status, 'ready');
});

test('source-parity project and run identity must join the sibling run metadata', () => {
  for (const mutate of [
    (artifact) => { artifact.sourceSnapshot.project = 'another-project'; },
    (artifact) => { artifact.sourceSnapshot.run = 'runs/fake-project/2025-12-31/'; },
  ]) {
    const captures = tempCaptures();
    syncSourceParity(captures);
    const parityPath = path.resolve(captures, '..', 'source-parity/modal.json');
    const artifact = JSON.parse(fs.readFileSync(parityPath, 'utf8'));
    mutate(artifact);
    fs.writeFileSync(parityPath, `${JSON.stringify(artifact, null, 2)}\n`);

    const result = runPreparedPreflight(captures, fixture('fake-library'));
    assertBlocked(result, 'source-inventory');
    assert.ok(only(result).blockers.some((blocker) =>
      blocker.code === 'source-inventory' && blocker.message.includes('sibling meta.json')));
  }
});

test('malformed sibling run metadata cannot become capture provenance', () => {
  for (const patch of [
    (meta) => { meta.project.slug = '../fake-project'; },
    (meta) => { meta.date = '2026-02-30'; },
  ]) {
    const captures = tempCaptures();
    syncSourceParity(captures);
    const metaPath = path.resolve(captures, '..', 'meta.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    patch(meta);
    fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    const result = runPreparedPreflight(captures, fixture('fake-library'));
    assertBlocked(result, 'source-inventory');
    assert.ok(only(result).blockers.some((blocker) =>
      blocker.code === 'source-inventory' && blocker.message.includes('sibling meta.json')));
  }
});

test('one source entry with multiple inventory owners is ambiguous and blocks capture', () => {
  const captures = tempCaptures();
  syncSourceParity(captures);
  const inventoryPath = path.resolve(captures, '..', 'inventory.json');
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const modal = inventory.components.find((component) => component.folder === 'modal');
  inventory.components.push({
    ...structuredClone(modal),
    name: 'CheckoutPanel',
    folder: 'checkout-panel',
    path: 'src/components/renderings/marketing/checkout-panel',
  });
  fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);

  const result = runPreparedPreflight(captures, fixture('fake-library'));
  assertBlocked(result, 'source-inventory');
  assert.ok(only(result).blockers.some((blocker) =>
    blocker.code === 'source-inventory' && blocker.message.includes('ambiguous sibling inventory owners')));
});

test('capture Source requires exactly one safe repository-relative Entry', () => {
  for (const replacement of [
    '- Entry: `/private/client/Modal.tsx`',
    '- Entry: `src/components/ui/modal/Modal.tsx`\n- Entry: `src/components/ui/modal/Modal.tsx`',
    '- Entry: `src/components/ui/modal/Modal.tsx`\n- Entry: src/components/ui/modal/Modal.types.ts',
    '- Entry: `src/components/ui/modal/Modal.tsx`\n* Entry: `src/components/ui/modal/Modal.types.ts`',
  ]) {
    const captures = tempCaptures();
    syncSourceParity(captures);
    writeFile(
      captures,
      'modal.md',
      readFile(captures, 'modal.md').replace(
        '- Entry: `src/components/ui/modal/Modal.tsx`',
        replacement,
      ),
    );
    const result = runJson('capture-preflight.cjs', [
      '--captures', captures,
      '--library', fixture('fake-library'),
      '--brain', BRAIN,
      '--figma-writer', 'figma-use',
      '--figma-live-validated',
      '--project', fixture('fake-project'),
    ]);
    assertBlocked(result, 'source-entry');
  }
});

test('source parity must hash-cite its exact sourceSnapshot entry', () => {
  const captures = tempCaptures();
  syncSourceParity(captures);
  const parityPath = path.resolve(captures, '..', 'source-parity/modal.json');
  const artifact = JSON.parse(fs.readFileSync(parityPath, 'utf8'));
  const otherEntry = 'src/components/renderings/marketing/checkout-panel/CheckoutPanel.tsx';
  artifact.sourceSnapshot.citations[0].path = otherEntry;
  artifact.sourceSnapshot.citations[0].startLine = 1;
  artifact.sourceSnapshot.citations[0].endLine = 1;
  artifact.sourceSnapshot.citations[0].sha256 = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(fixture('fake-project'), otherEntry)))
    .digest('hex');
  fs.writeFileSync(parityPath, `${JSON.stringify(artifact, null, 2)}\n`);

  const result = runJson('capture-preflight.cjs', [
    '--captures', captures,
    '--library', fixture('fake-library'),
    '--brain', BRAIN,
    '--figma-writer', 'figma-use',
    '--figma-live-validated',
    '--project', fixture('fake-project'),
  ]);
  assertBlocked(result, 'source-inventory');
  assert.ok(only(result).blockers.some((blocker) =>
    blocker.code === 'source-inventory' && blocker.message.includes('whole-file hash')));
});

test('missing governed Figma promotion surfaces block capture', () => {
  const cases = [
    ['figma/library.json', 'figma/library.json is missing'],
    ['figma/PROMOTION-CHECKLIST.md', 'figma/PROMOTION-CHECKLIST.md is missing'],
    ['package.json', 'package.json could not be read'],
  ];

  for (const [missing, expected] of cases) {
    const library = tempFixture('fake-library');
    fs.rmSync(path.join(library, missing));
    const result = preflight(tempCaptures(), library);
    assertBlocked(result, 'figma-promotion-unavailable');
    assert.equal(result.json.figmaPromotion.ready, false);
    assert.ok(result.json.figmaPromotion.issues.some((issue) => issue.includes(expected)));
  }
});

test('missing Figma package scripts block capture', () => {
  const library = tempFixture('fake-library');
  const packageJson = JSON.parse(readFile(library, 'package.json'));
  delete packageJson.scripts['figma:coverage'];
  writeFile(library, 'package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
  const result = preflight(tempCaptures(), library);
  assertBlocked(result, 'figma-promotion-unavailable');
  assert.ok(result.json.figmaPromotion.issues.includes('package.json has no figma:coverage script'));
});

test('placeholder Figma files and commands do not satisfy promotion preflight', () => {
  const cases = [
    {
      mutate(library) {
        writeFile(library, 'figma/library.json', '{}\n');
      },
      expected: 'figma/library.json schemaVersion must equal 1',
    },
    {
      mutate(library) {
        writeFile(library, 'figma/PROMOTION-CHECKLIST.md', '# Placeholder\n');
      },
      expected: 'figma/PROMOTION-CHECKLIST.md does not require the 528px left documentation rail',
    },
    {
      mutate(library) {
        const packageJson = JSON.parse(readFile(library, 'package.json'));
        packageJson.scripts['figma:validate'] = 'echo pnpm figma:coverage && exit 0';
        writeFile(library, 'package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
      },
      expected: 'package.json figma:validate must equal',
    },
    {
      mutate(library) {
        const packageJson = JSON.parse(readFile(library, 'package.json'));
        packageJson.scripts['test:code'] = 'pnpm contracts:code';
        writeFile(library, 'package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
      },
      expected: 'package.json test:code must equal',
    },
  ];

  for (const testCase of cases) {
    const library = tempFixture('fake-library');
    testCase.mutate(library);
    const result = preflight(tempCaptures(), library);
    assertBlocked(result, 'figma-promotion-unavailable');
    assert.ok(result.json.figmaPromotion.issues.some((issue) => issue.includes(testCase.expected)));
  }
});

test('Code Connect surfaces block capture', () => {
  const cases = [
    {
      mutate(library) {
        const packageJson = JSON.parse(readFile(library, 'package.json'));
        packageJson.devDependencies = { '@figma/code-connect': '2.0.0' };
        writeFile(library, 'package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
      },
      expected: 'package.json installs @figma/code-connect',
    },
    {
      mutate(library) {
        const packageJson = JSON.parse(readFile(library, 'package.json'));
        packageJson.scripts.devmode = 'npx @figma/code-connect publish';
        writeFile(library, 'package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
      },
      expected: 'package.json exposes a Code Connect script',
    },
    {
      mutate(library) {
        const registry = JSON.parse(readFile(library, 'figma/library.json'));
        registry.library.codeConnect = { enabled: false };
        writeFile(library, 'figma/library.json', `${JSON.stringify(registry, null, 2)}\n`);
      },
      expected: 'figma/library.json exposes Code Connect',
    },
    {
      mutate(library) {
        fs.mkdirSync(path.join(library, 'figma/components'));
      },
      expected: 'figma/components must not exist',
    },
    {
      mutate(library) {
        fs.mkdirSync(path.join(library, 'tools'));
        writeFile(library, 'tools/alert.figma.ts', 'export {};\n');
      },
      expected: 'tools/alert.figma.ts must not exist',
    },
    {
      mutate(library) {
        writeFile(library, 'pnpm-lock.yaml', "packages:\n  '@figma/code-connect@2.0.0': {}\n");
      },
      expected: 'pnpm-lock.yaml must not retain Code Connect',
    },
  ];

  for (const testCase of cases) {
    const library = tempFixture('fake-library');
    testCase.mutate(library);
    const result = preflight(tempCaptures(), library);
    assertBlocked(result, 'figma-promotion-unavailable');
    assert.ok(result.json.figmaPromotion.issues.some((issue) => issue.includes(testCase.expected)));
  }
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

test('a new-pattern proposal alias can join its source-linked unresolved component', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Logo ribbon', 'logo-ribbon');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'logo-ribbon.md', text);
  syncSourceParity(captures);
  const resolutionPath = path.resolve(captures, '..', 'resolution.json');
  const resolution = JSON.parse(fs.readFileSync(resolutionPath, 'utf8'));
  const row = resolution.unresolved.find((entry) =>
    entry.locations?.some((location) => location.component === 'modal') && entry.normalized === 'logo-ribbon');
  row.label = 'Logo cloud';
  row.normalized = 'logo-cloud';
  fs.writeFileSync(resolutionPath, `${JSON.stringify(resolution, null, 2)}\n`);

  const result = runPreparedPreflight(captures, fixture('fake-library'));
  assert.equal(result.status, 6, result.stderr || result.stdout);
  assert.equal(only(result).status, 'deferred');
});

test('a new-pattern proposal cannot pair a source-linked unrelated unresolved row with another component', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Logo ribbon', 'logo-ribbon');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'logo-ribbon.md', text);
  syncSourceParity(captures);
  const resolutionPath = path.resolve(captures, '..', 'resolution.json');
  const resolution = JSON.parse(fs.readFileSync(resolutionPath, 'utf8'));
  const sourceLinked = resolution.unresolved.find((entry) =>
    entry.locations?.some((location) => location.component === 'modal') && entry.normalized === 'logo-ribbon');
  sourceLinked.label = 'Unrelated panel';
  sourceLinked.normalized = 'unrelated-panel';
  const other = resolution.unresolved.find((entry) =>
    entry.locations?.some((location) => location.component === 'checkout-panel'));
  other.label = 'Logo ribbon';
  other.normalized = 'logo-ribbon';
  fs.writeFileSync(resolutionPath, `${JSON.stringify(resolution, null, 2)}\n`);

  const result = runPreparedPreflight(captures, fixture('fake-library'));
  assertBlocked(result, 'source-inventory');
  assert.ok(only(result).blockers.some((blocker) =>
    blocker.code === 'source-inventory' && blocker.message.includes('does not resolve')));
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

test('existing code with capability resumes at Figma as ready', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);
  const result = preflight(captures, fixture('fake-library'));
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}${result.stderr}`);
  const record = only(result);
  assert.equal(record.status, 'ready');
  assert.equal(record.resumeAt, 'figma');
  assert.ok(record.library.files.includes('parts/BadgeDialog.client.tsx'));
  assert.deepEqual(record.library.missingModules, []);
});

test('covered state capture requires an InteractionStates story before Figma promotion', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);
  const library = tempFixture('fake-library');
  writeFile(
    library,
    'components/badge/Badge.stories.tsx',
    readFile(library, 'components/badge/Badge.stories.tsx').replace('\nexport const InteractionStates = {};\n', '\n'),
  );
  assertBlocked(preflight(captures, library), 'interaction-states-story');
});

test('incomplete registry state node IDs keep an otherwise reviewed capture ready at Figma', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);
  const library = tempFixture('fake-library');
  registerReviewedFigma(library, 'Badge', 'components/badge');
  const registry = JSON.parse(readFile(library, 'figma/library.json'));
  delete registry.components[0].figma.stateCoverage.states[0].frameNodeId;
  writeFile(library, 'figma/library.json', `${JSON.stringify(registry, null, 2)}\n`);

  const result = preflight(captures, library);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const record = only(result);
  assert.equal(record.status, 'ready');
  assert.equal(record.resumeAt, 'figma');
  assert.equal(record.figma.interactionStateCoverageComplete, false);
  assert.ok(record.figma.interactionStateCoverageIssues.some((entry) => entry.includes('frame, instance, and component node IDs')));
});

test('reviewed Figma without structural presentation evidence resumes at Figma', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);
  const library = tempFixture('fake-library');
  registerReviewedFigma(library, 'Badge', 'components/badge');
  const registry = JSON.parse(readFile(library, 'figma/library.json'));
  delete registry.components[0].figma.presentationEvidence;
  writeFile(library, 'figma/library.json', `${JSON.stringify(registry, null, 2)}\n`);
  const result = preflight(captures, library);
  assert.equal(only(result).resumeAt, 'figma');
  assert.ok(only(result).figma.presentationEvidenceIssues.some((issue) => issue.includes('missing')));
});

test('reviewed Figma without a code-parity token binding audit resumes at Figma', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);
  const library = tempFixture('fake-library');
  registerReviewedFigma(library, 'Badge', 'components/badge');
  const registry = JSON.parse(readFile(library, 'figma/library.json'));
  delete registry.components[0].figma.tokenBindingAudit;
  writeFile(library, 'figma/library.json', `${JSON.stringify(registry, null, 2)}\n`);
  const result = preflight(captures, library);
  assert.equal(only(result).resumeAt, 'figma');
  assert.ok(only(result).figma.tokenBindingAuditIssues.some((issue) => issue.includes('missing')));
});

test('an explicit not-applicable state result needs no InteractionStates story or Figma matrix', () => {
  const captures = tempCaptures();
  const root = path.resolve(captures, '..');
  const artifact = JSON.parse(readFile(root, 'source-parity/modal.json'));
  artifact.interactionStates = {
    status: 'not-applicable',
    reason: 'The normalized component is static and exposes no interactive state.',
    states: [],
  };
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);
  const library = tempFixture('fake-library');
  writeFile(
    library,
    'components/badge/Badge.stories.tsx',
    readFile(library, 'components/badge/Badge.stories.tsx').replace('\nexport const InteractionStates = {};\n', '\n'),
  );
  registerReviewedFigma(library, 'Badge', 'components/badge');
  const registry = JSON.parse(readFile(library, 'figma/library.json'));
  registry.components[0].figma.stateCoverage = {
    status: 'not-applicable',
    reason: 'The normalized component is static and exposes no interactive state.',
    states: [],
  };
  registry.components[0].figma.tokenBindingAudit.stateRequirements = {};
  writeFile(library, 'figma/library.json', `${JSON.stringify(registry, null, 2)}\n`);

  const result = preflight(captures, library);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(only(result).status, 'evidence-pending');
});

test('reviewed Figma without an Applied marker resumes as evidence-pending', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);
  const library = tempFixture('fake-library');
  registerReviewedFigma(library, 'Badge', 'components/badge');

  const result = preflight(captures, library);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(only(result).status, 'evidence-pending');
});

test('reviewed Figma must resolve to ready-for-dev before evidence can land', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);
  const library = tempFixture('fake-library');
  registerReviewedFigma(library, 'Badge', 'components/badge');
  const registry = JSON.parse(readFile(library, 'figma/library.json'));
  registry.components.find((entry) => entry.canonical === 'Badge').figma.status = 'reviewed';
  writeFile(library, 'figma/library.json', `${JSON.stringify(registry, null, 2)}\n`);

  const result = preflight(captures, library);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(only(result).status, 'ready');
  assert.equal(only(result).resumeAt, 'figma');
  assert.equal(only(result).figma.status, 'reviewed');
});

test('code, reviewed Figma, and an Applied marker reconcile as skipped', () => {
  const captures = tempCaptures();
  const library = tempFixture('fake-library');
  registerReviewedFigma(library, 'Badge', 'components/badge');
  const text = `${retarget(readFile(captures, 'modal.md'), 'Badge', 'badge')}\n${appliedBlock(library, 'Badge', 'components/badge')}`;
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);

  const result = preflight(captures, library);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(only(result).status, 'skipped');
  const applied = only(result).applied;
  assert.notEqual(
    applied.figma.nodeId,
    applied.figma.stateCoverage.states[0].componentNodeId,
    'a component-set master may own child variant component nodes',
  );
});

test('modern Applied evidence must copy semantic state coverage from the registry', () => {
  const captures = tempCaptures();
  const library = tempFixture('fake-library');
  registerReviewedFigma(library, 'Badge', 'components/badge');
  const driftedApplied = appliedBlock(library, 'Badge', 'components/badge')
    .replace('"classification": "rendered"', '"classification": "already-represented"');
  const text = `${retarget(readFile(captures, 'modal.md'), 'Badge', 'badge')}\n${driftedApplied}`;
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);
  assertBlocked(preflight(captures, library), 'applied-figma-evidence');
});

test('legacy v1 source parity remains readable only for an already-landed capture', () => {
  const captures = tempCaptures();
  const root = path.resolve(captures, '..');
  const artifact = JSON.parse(readFile(root, 'source-parity/modal.json'));
  artifact.schemaVersion = 1;
  delete artifact.interactionStates;
  writeFile(root, 'source-parity/modal.json', `${JSON.stringify(artifact, null, 2)}\n`);
  const pending = preflight(captures, fixture('fake-library'));
  assertBlocked(pending, 'source-parity');

  const landedCaptures = tempCaptures();
  const landedRoot = path.resolve(landedCaptures, '..');
  const landedArtifact = JSON.parse(readFile(landedRoot, 'source-parity/modal.json'));
  landedArtifact.schemaVersion = 1;
  delete landedArtifact.interactionStates;
  writeFile(landedRoot, 'source-parity/modal.json', `${JSON.stringify(landedArtifact, null, 2)}\n`);
  const library = tempFixture('fake-library');
  registerReviewedFigma(library, 'Badge', 'components/badge');
  const landedText = `${retarget(readFile(landedCaptures, 'modal.md'), 'Badge', 'badge')}\n${appliedBlock(library, 'Badge', 'components/badge')}`;
  fs.rmSync(path.join(landedCaptures, 'modal.md'));
  writeFile(landedCaptures, 'badge.md', landedText);
  const landedResult = preflight(landedCaptures, library);
  assert.equal(landedResult.status, 0, landedResult.stderr || landedResult.stdout);
  assert.equal(only(landedResult).status, 'skipped');
});

test('code-complete Progress cannot get ahead of the library implementation', () => {
  const captures = tempCaptures();
  patchJsonSection(captures, 'Progress', () => ({
    status: 'code-complete',
    componentPath: 'components/modal',
  }));
  const result = preflight(captures, fixture('fake-library'));
  assertBlocked(result, 'progress-library-drift');
});

test('authored lifecycle headings cannot silently degrade when their JSON fence is missing', () => {
  for (const [heading, code] of [['Progress', 'progress-unparsable'], ['Applied', 'applied-unparsable']]) {
    const captures = tempCaptures();
    let source = readFile(captures, 'modal.md');
    if (heading === 'Progress') {
      const start = source.indexOf('## Progress');
      const fence = source.indexOf('```json', start);
      source = `${source.slice(0, fence)}not-json${source.slice(source.indexOf('\n```', fence) + 4)}`;
    } else {
      source += '\n## Applied\n\nlanded without governed metadata\n';
    }
    writeFile(captures, 'modal.md', source);
    assertBlocked(preflight(captures, fixture('fake-library')), code);
  }
});

test('Applied node identity must match the reviewed governed Figma registration', () => {
  const captures = tempCaptures();
  const library = tempFixture('fake-library');
  registerReviewedFigma(library, 'Badge', 'components/badge');
  const source = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  const applied = appliedBlock(library, 'Badge', 'components/badge')
    .replace('"nodeId": "100:200"', '"nodeId": "wrong:node"')
    .replace('"nodeKey": "stable-node-key"', '"nodeKey": "wrong-key"');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(
    captures,
    'badge.md',
    `${source}\n${applied}`,
  );
  const result = preflight(captures, library);
  assertBlocked(result, 'applied-figma-drift');
});

test('an alternate uses the compound key and reports the default companion migration', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge')
    .replace('"componentKey": "badge"', '"componentKey": "badge--compact"')
    .replace('"variant": null', '"variant": "compact"')
    .replace('"variantLabel": null', '"variantLabel": "Compact"')
    .replace('"default": true', '"default": false,\n  "companionDefault": { "variant": "standard", "variantLabel": "Standard" }')
    .replace('"slug": "badge",', '"slug": "badge",\n  "variant": "compact",');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge--compact.md', text);

  const result = preflight(captures, fixture('fake-library'));
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const record = only(result);
  assert.equal(record.status, 'ready');
  assert.equal(record.componentKey, 'badge--compact');
  assert.equal(record.componentPath, 'components/badge--compact');
  assert.deepEqual(record.componentJson.variant, 'compact');
  assert.equal(record.stories.title, 'Badge / Compact');
  assert.deepEqual(record.companionWrites, [{
    componentPath: 'components/badge',
    componentJson: { variant: 'standard', default: true },
    figmaRegistry: { variant: 'standard', variantLabel: 'Standard', default: true, familyPage: true },
  }]);
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
  assert.equal(only(result).status, 'ready');
  assert.equal(only(result).resumeAt, 'figma');
});

test('applied inspection resolves ESM .js specifiers to TypeScript source modules', () => {
  const captures = tempCaptures();
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);

  const library = tempFixture('fake-library');
  const component = path.join(library, 'components/badge');
  for (const file of ['index.ts', 'Badge.tsx', 'parts/BadgeDialog.client.tsx']) {
    const target = path.join(component, file);
    const source = fs.readFileSync(target, 'utf8').replace(/(from\s+['"][^'"]+)(?=['"])/g, '$1.js');
    fs.writeFileSync(target, source);
  }
  const result = preflight(captures, library);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(only(result).status, 'ready');
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

test('figma-pending reflects a current unexpected mid-run capability loss and restores to ready', () => {
  const captures = tempCaptures();
  patchJsonSection(captures, 'Progress', () => ({
    status: 'code-complete',
    componentPath: 'components/badge',
    blockedOn: { code: 'figma-capability-lost' },
  }));
  const text = retarget(readFile(captures, 'modal.md'), 'Badge', 'badge');
  fs.rmSync(path.join(captures, 'modal.md'));
  writeFile(captures, 'badge.md', text);
  const lost = preflight(captures, fixture('fake-library'), ['--brain', BRAIN], false);
  assert.equal(lost.status, 0, lost.stderr || lost.stdout);
  assert.equal(only(lost).status, 'figma-pending');
  assert.equal(only(lost).resumeExistingBranch, true);

  const restored = preflight(captures, fixture('fake-library'));
  assert.equal(restored.status, 0, restored.stderr || restored.stdout);
  assert.equal(only(restored).status, 'ready');
  assert.equal(only(restored).resumeAt, 'figma');
  assert.equal(only(restored).resumeExistingBranch, true);
});

test('a mixed set reports every status in one plan', () => {
  // The headline claim is "one plan covering all of them" — exercise ready,
  // blocked and deferred together, with both code and Figma resume boundaries.
  const captures = tempCaptures();
  const base = readFile(captures, 'modal.md');

  writeFile(captures, 'badge.md', retarget(base, 'Badge', 'badge')); //           code applied → ready at Figma
  writeFile(captures, 'link.md', retarget(base, 'Link', 'link')); //                   partial dir      → blocked
  writeFile(captures, 'logo-ribbon.md', retarget(base, 'Logo ribbon', 'logo-ribbon')); // in-run proposal → deferred
  // modal.md stays as-is                                                        //                → ready

  const result = preflight(captures, fixture('fake-library'), ['--brain', BRAIN]);
  assert.equal(result.status, 1, 'a set containing a blocked capture must exit 1 even with a deferred one present');
  const byFile = Object.fromEntries(result.json.components.map((c) => [c.file, c.status]));
  assert.deepEqual(byFile, {
    'badge.md': 'ready',
    'link.md': 'blocked',
    'logo-ribbon.md': 'deferred',
    'modal.md': 'ready',
  });
  assert.deepEqual(result.json.counts, {
    captures: 4,
    ready: 2,
    figmaPending: 0,
    evidencePending: 0,
    blocked: 1,
    skipped: 0,
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
