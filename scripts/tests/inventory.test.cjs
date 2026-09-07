'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { CMS_CATALOG } = require('../../skills/project-retrospective/scripts/lib/cms-taxonomy.cjs');
const { run, runJson, fixture, tempFixture } = require('./helpers.cjs');

const PROJECT = fixture('fake-project');
const BARE = fixture('fake-project-bare');
const TOOLKIT = fixture('fake-project-toolkit');
const CODESCAN = fixture('fake-project-codescan');
const EMPTYINDEX = fixture('fake-project-emptyindex');
const PARTOF = fixture('fake-project-partof');
const MONOREPO = fixture('fake-project-monorepo');

const EXPECTED_CMS_CATALOG = [
  { key: 'contentful', label: 'Contentful' },
  { key: 'contentstack', label: 'Contentstack' },
  { key: 'optimizely-saas', label: 'Optimizely SaaS' },
  { key: 'optimizely-paas', label: 'Optimizely PaaS' },
  { key: 'sitecore-on-prem', label: 'Sitecore on-Prem' },
  { key: 'sitecore-ai', label: 'SitecoreAI' },
  { key: 'wordpress', label: 'Wordpress' },
];

const DISCOVERY_SUPPORTED_CMS = new Set(['contentstack', 'optimizely-saas', 'sitecore-ai']);

function inventory(project, args = []) {
  const result = runJson('inventory.cjs', ['--project', project, ...args]);
  assert.equal(result.status, 0, `expected exit 0, got ${result.status}: ${result.stderr}`);
  assert.ok(result.json, 'expected JSON on stdout');
  return result.json;
}

function inventoryWithAdapter(stackAdapter) {
  const project = tempFixture('fake-project');
  const configPath = path.join(project, 'build.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.stackAdapter = stackAdapter;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return inventory(project);
}

test('the CMS catalog exposes all seven exact canonical key and label pairs', () => {
  assert.deepEqual(CMS_CATALOG, EXPECTED_CMS_CATALOG);
});

test('CMS recognition stays separate from dedicated discovery support', () => {
  for (const cms of EXPECTED_CMS_CATALOG) {
    const inv = inventoryWithAdapter(cms.key);
    assert.equal(inv.config.cmsKey, cms.key, `${cms.key} emits its canonical key`);
    assert.equal(inv.config.cmsLabel, cms.label, `${cms.key} emits its exact canonical label`);
    const warningCodes = inv.warnings.map((warning) => warning.code);
    if (DISCOVERY_SUPPORTED_CMS.has(cms.key)) {
      assert.ok(!warningCodes.includes('unsupported-cms-discovery'), `${cms.key} has an active discovery profile`);
      assert.ok(!warningCodes.includes('unknown-adapter'), `${cms.key} is recognized`);
    } else {
      assert.ok(warningCodes.includes('unsupported-cms-discovery'), `${cms.key} is recognized without invented discovery behavior`);
      assert.ok(!warningCodes.includes('unknown-adapter'), `${cms.key} is recognized`);
    }
  }
});

test('legacy CMS identifiers are not runtime aliases', () => {
  for (const legacyKey of ['contentstack-sdk', 'optimizely', 'sitecore-xp', 'sitecore-xm-cloud']) {
    const inv = inventoryWithAdapter(legacyKey);
    assert.equal(inv.config.cmsKey, null, `${legacyKey} does not normalize to a canonical CMS key`);
    assert.equal(inv.config.cmsLabel, null, `${legacyKey} does not gain a canonical CMS label`);
    assert.ok(inv.warnings.some((warning) => warning.code === 'unknown-adapter'), `${legacyKey} is rejected as unknown`);
  }
});

test('artifacts mode is detected when pipeline evidence exists', () => {
  const inv = inventory(PROJECT);
  assert.equal(inv.schemaVersion, 1);
  assert.equal(inv.mode, 'artifacts');
  assert.equal(inv.sourceSnapshot.strategy, 'recorded');
  assert.match(inv.sourceSnapshot.commit, /^[a-f0-9]{40}$/);
  assert.equal(typeof inv.sourceSnapshot.dirty, 'boolean');
  assert.equal(inv.config.present, true);
  assert.equal(inv.config.artifactsRoot, 'artifacts');
  assert.equal(inv.config.cmsKey, 'optimizely-saas');
  assert.equal(inv.config.cmsLabel, 'Optimizely SaaS');
});

test('a Git project records the exact clean HEAD for future source parity', () => {
  const project = tempFixture('fake-project');
  assert.equal(spawnSync('git', ['init'], { cwd: project }).status, 0);
  assert.equal(spawnSync('git', ['add', '.'], { cwd: project }).status, 0);
  assert.equal(spawnSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-m', 'fixture'], { cwd: project }).status, 0);
  const inv = inventory(project);
  assert.equal(inv.sourceSnapshot.strategy, 'recorded');
  assert.match(inv.sourceSnapshot.commit, /^[a-f0-9]{40}$/);
  assert.equal(inv.sourceSnapshot.dirty, false);
});

test('component-index, code-scan, and build-pack-only components are all unioned', () => {
  const inv = inventory(PROJECT);
  // 8 from the component index + orphan-pack (build-pack only) + promo-strip and spacer
  // (on disk but absent from the index, recovered by the bucket scan).
  assert.equal(inv.counts.components, 11);
  assert.equal(inv.counts.components, inv.components.length);

  const folders = inv.components.map((c) => c.folder);
  assert.ok(folders.includes('orphan-pack'), 'a build pack without an index entry still counts as built');
  assert.deepEqual([...folders].sort(), folders, 'components are sorted by folder');
});

test('both dir-style and flat build packs are attributed', () => {
  const inv = inventory(PROJECT);
  assert.equal(inv.evidence.buildPacksDir, 2);
  assert.equal(inv.evidence.buildPacksFlat, 1);

  const modal = inv.components.find((c) => c.folder === 'modal');
  assert.equal(modal.buildPack.style, 'dir');
  assert.ok(modal.buildPack.files.includes('master.md'));

  const ribbon = inv.components.find((c) => c.folder === 'logo-ribbon');
  assert.equal(ribbon.buildPack.style, 'flat');
  assert.ok(ribbon.sources.includes('build-pack'));
});

test('a fingerprint on disk wins over a null in the component index', () => {
  const inv = inventory(PROJECT);
  const modal = inv.components.find((c) => c.folder === 'modal');
  assert.ok(modal.fingerprint, 'fingerprint.json exists on disk and must be read');
  assert.equal(modal.fingerprint.role, 'dialog');
  assert.ok(modal.sources.includes('fingerprint'));
  assert.equal(inv.evidence.fingerprints, 2, 'modal (V1 schema) + banner (V2 schema)');
});

test('fingerprint facets are lifted into a normalized surface (both schemas)', () => {
  const inv = inventory(PROJECT);

  // V1 semantic/ARIA schema: { slots[], affordance, role, variants[] }.
  const modal = inv.components.find((c) => c.folder === 'modal');
  assert.deepEqual(modal.facets, {
    role: 'dialog',
    affordance: 'overlay',
    slots: ['title', 'body', 'actions'],
    variants: ['default', 'wide'],
    notes: null,
  });

  // V2 authoring schema: { slot, primaryAffordance, contentRole, notes } → the same surface.
  const banner = inv.components.find((c) => c.folder === 'banner');
  assert.deepEqual(banner.facets, {
    role: 'marketing-banner', // from contentRole
    affordance: 'static', // from primaryAffordance
    slots: ['hero'], // singular slot promoted to an array
    variants: [],
    notes: 'Full-width promotional banner with an optional call-to-action.',
  });

  // No fingerprint → facets is null, not a phantom object.
  const ribbon = inv.components.find((c) => c.folder === 'logo-ribbon');
  assert.equal(ribbon.facets, null);
});

test('build-pack facet presence is distilled from the pack files (dir only)', () => {
  const inv = inventory(PROJECT);

  // A dir-style pack lists its leaf contracts sorted, minus the master.md index.
  const modal = inv.components.find((c) => c.folder === 'modal');
  assert.deepEqual(modal.buildPack.facets, ['dom-contract', 'state-machine']);

  // A dir pack with only master.md declares no facets.
  const orphan = inv.components.find((c) => c.folder === 'orphan-pack');
  assert.deepEqual(orphan.buildPack.facets, []);

  // A flat pack is a single file that IS the pack, so it declares no facets.
  const ribbon = inv.components.find((c) => c.folder === 'logo-ribbon');
  assert.equal(ribbon.buildPack.style, 'flat');
  assert.deepEqual(ribbon.buildPack.facets, []);
});

test('project memory naming a component counts as an evidence source', () => {
  const inv = inventory(PROJECT);
  const ribbon = inv.components.find((c) => c.folder === 'logo-ribbon');
  // Memory says "LogoRibbon"; the folder is "logo-ribbon". Normalization must bridge them.
  assert.ok(ribbon.sources.includes('memory'), 'memory prose naming the component should be detected');

  const chip = inv.components.find((c) => c.folder === 'chip');
  assert.ok(!chip.sources.includes('memory'), 'a component memory never mentions must not gain the source');
});

test('bucket and domain carry through from the component index', () => {
  const inv = inventory(PROJECT);
  const banner = inv.components.find((c) => c.folder === 'banner');
  assert.equal(banner.bucket, 'rendering');
  assert.equal(banner.domain, 'marketing');
});

test('the bucket scan runs in artifacts mode and corroborates the index', () => {
  const inv = inventory(PROJECT);
  const modal = inv.components.find((c) => c.folder === 'modal');
  assert.ok(modal.sources.includes('component-index'));
  assert.ok(
    modal.sources.includes('code-scan'),
    'an on-disk component named in the index gains a code-scan source in artifacts mode',
  );
});

test('the union recovers an on-disk component the index omitted', () => {
  const inv = inventory(PROJECT);
  const promo = inv.components.find((c) => c.folder === 'promo-strip');
  assert.ok(promo, 'promo-strip is on disk but not in the index — the scan must add it');
  assert.deepEqual(promo.sources, ['code-scan']);
  assert.equal(promo.domain, 'marketing');
});

test('an undeclared rendering domain is discovered and labeled from its path', () => {
  const inv = inventory(PROJECT);
  const spacer = inv.components.find((c) => c.folder === 'spacer');
  assert.ok(spacer, 'a component under an undeclared domain must still be found');
  assert.equal(spacer.bucket, 'rendering');
  assert.equal(spacer.domain, 'utility');
});

test('a non-registry story enriches its source component without creating a phantom', () => {
  const inv = inventory(PROJECT);
  // fake-project is `optimizely-saas` (storybook: false) and ships two story files. A matching
  // story is source evidence, while a standalone documentation story is not a component.
  const folders = inv.components.map((c) => c.folder);
  assert.ok(!folders.includes('tokens'), 'a story with no component must not become a phantom on a non-Storybook stack');
  const modal = inv.components.find((c) => c.folder === 'modal');
  assert.ok(!modal.sources.includes('storybook'), 'a colocated story must not become an independent promotion source');
  assert.ok(modal.sourceEvidence.stories.some((entry) => entry.endsWith('modal.stories.tsx')));
});

test('a project with no config or artifacts degrades to a code scan', () => {
  const inv = inventory(BARE);
  assert.equal(inv.mode, 'code-scan');

  const codes = inv.warnings.map((w) => w.code);
  assert.ok(codes.includes('no-build-config'));
  assert.ok(codes.includes('no-artifacts-root'));
  assert.ok(codes.includes('heuristic-buckets'));

  assert.equal(inv.counts.components, 1);
  const widget = inv.components[0];
  assert.equal(widget.folder, 'foo-widget');
  assert.equal(widget.name, 'FooWidget', 'the PascalCase entry file names the component');
  assert.deepEqual(widget.sources, ['code-scan']);
  assert.deepEqual(widget.sourceEvidence.entryPoints, ['src/components/foo-widget/FooWidget.tsx']);
});

test('a workspace discovers package roots and source evidence without pipeline artifacts', () => {
  const inv = inventory(MONOREPO);
  assert.equal(inv.schemaVersion, 1);
  assert.equal(inv.mode, 'code-scan');
  assert.deepEqual(inv.discovery.componentRoots, ['packages/ui/src/components']);
  assert.deepEqual(inv.discovery.frameworks, ['next', 'react']);
  assert.deepEqual(inv.discovery.deliveryConfig, ['.github/workflows/verify.yml', 'vercel.json']);

  const notice = inv.components.find((component) => component.folder === 'notice');
  assert.ok(notice, 'a conventional component root under a workspace package is discovered');
  assert.equal(notice.entry, 'packages/ui/src/components/notice/Notice.tsx');
  assert.deepEqual(notice.sourceEvidence.entryPoints, ['packages/ui/src/components/notice/Notice.tsx']);
  assert.deepEqual(notice.sourceEvidence.tests, ['packages/ui/src/components/notice/Notice.test.tsx']);
  assert.deepEqual(notice.sourceEvidence.stories, ['packages/ui/src/stories/Notice.stories.tsx']);
  assert.deepEqual(notice.sourceEvidence.styles, ['packages/ui/src/components/notice/Notice.module.css']);
  assert.deepEqual(notice.sourceEvidence.tokens, ['packages/ui/src/tokens/colors.css']);
  assert.deepEqual(notice.sourceEvidence.consumers, ['apps/site/src/View.tsx']);
  assert.deepEqual(notice.sourceEvidence.manifests, ['packages/ui/package.json']);
  assert.deepEqual(notice.sourceEvidence.frameworks, ['react']);
  assert.deepEqual(notice.sourceEvidence.deliveryConfig, ['.github/workflows/verify.yml', 'vercel.json']);
});

test('nested package manifests outside declared workspace membership cannot affect discovery or platform identity', () => {
  const project = tempFixture('fake-project-monorepo');
  const example = path.join(project, 'examples/demo');
  fs.mkdirSync(path.join(example, 'src/components/rogue'), { recursive: true });
  fs.writeFileSync(path.join(example, 'package.json'), JSON.stringify({
    name: 'unrelated-example',
    dependencies: { contentstack: '1.0.0' },
  }));
  fs.writeFileSync(
    path.join(example, 'src/components/rogue/Rogue.tsx'),
    'export function Rogue() { return <aside>not a workspace package</aside>; }\n',
  );

  const inv = inventory(project);
  assert.equal(inv.config.cmsKey, 'contentful');
  assert.equal(inv.config.platformSource, 'manifest');
  assert.ok(!inv.discovery.manifests.some((manifest) => manifest.path === 'examples/demo/package.json'));
  assert.ok(!inv.discovery.componentRoots.some((root) => root.startsWith('examples/demo/')));
  assert.ok(!inv.components.some((component) => component.folder === 'rogue'));
});

test('workspace, component, cycle, and delivery symlinks never escape pinned source discovery', () => {
  const project = tempFixture('fake-project-monorepo');
  const outside = fs.mkdtempSync(path.join(path.dirname(project), 'retro-external-'));
  fs.mkdirSync(path.join(outside, 'src/components/rogue'), { recursive: true });
  fs.writeFileSync(path.join(outside, 'package.json'), JSON.stringify({
    name: 'outside-workspace',
    dependencies: { contentstack: '1.0.0' },
  }));
  fs.writeFileSync(
    path.join(outside, 'src/components/rogue/Rogue.tsx'),
    'export function Rogue() { return <aside>outside</aside>; }\n',
  );
  fs.writeFileSync(path.join(outside, 'netlify.toml'), '[build]\ncommand = "outside"\n');

  fs.symlinkSync(outside, path.join(project, 'packages/outside-workspace'), 'dir');
  fs.symlinkSync(
    path.join(outside, 'src/components'),
    path.join(project, 'packages/ui/src/components/outside-components'),
    'dir',
  );
  fs.symlinkSync(
    path.join(project, 'packages/ui/src/components'),
    path.join(project, 'packages/ui/src/components/notice/cycle'),
    'dir',
  );
  fs.symlinkSync(path.join(outside, 'netlify.toml'), path.join(project, 'netlify.toml'));

  const inv = inventory(project);
  assert.equal(inv.config.cmsKey, 'contentful', 'an external workspace manifest cannot change CMS identity');
  assert.ok(!inv.discovery.manifests.some((manifest) => manifest.path.includes('outside-workspace')));
  assert.ok(!inv.components.some((component) => component.folder === 'rogue'));
  assert.ok(!inv.discovery.deliveryConfig.includes('netlify.toml'));
  const skipped = inv.warnings
    .filter((warning) => warning.code === 'source-symlink-skipped')
    .map((warning) => warning.message);
  for (const rel of [
    'packages/outside-workspace',
    'packages/ui/src/components/outside-components',
    'packages/ui/src/components/notice/cycle',
    'netlify.toml',
  ]) {
    assert.equal(skipped.filter((message) => message.includes(`"${rel}"`)).length, 1, `${rel} warns exactly once`);
  }
});

test('configured artifact and component roots cannot traverse outside the project', () => {
  const project = tempFixture('fake-project-bare');
  const outside = fs.mkdtempSync(path.join(path.dirname(project), 'retro-config-outside-'));
  fs.mkdirSync(path.join(outside, 'components/rogue'), { recursive: true });
  fs.writeFileSync(path.join(outside, 'components/rogue/Rogue.tsx'), 'export const Rogue = () => null;\n');
  fs.mkdirSync(path.join(outside, 'artifacts/build-packs/rogue'), { recursive: true });
  fs.writeFileSync(path.join(outside, 'artifacts/build-packs/rogue/master.md'), '# Rogue\n');
  fs.writeFileSync(path.join(project, 'build.config.json'), JSON.stringify({
    artifactsRoot: `../${path.basename(outside)}/artifacts`,
    componentBuckets: { ui: `../${path.basename(outside)}/components` },
  }));

  const inv = inventory(project);
  assert.equal(inv.config.artifactsRoot, 'artifacts');
  assert.ok(!inv.components.some((component) => component.folder === 'rogue'));
  assert.ok(inv.components.some((component) => component.folder === 'foo-widget'), 'safe in-project heuristics still run');
  assert.ok(inv.warnings.some((warning) =>
    warning.code === 'path-outside-project' && warning.message.includes('artifactsRoot')));
  assert.ok(inv.warnings.some((warning) =>
    warning.code === 'path-outside-project' && warning.message.includes('Component root')));
});

test('pnpm-workspace.yaml admits the same declared package roots without root workspaces metadata', () => {
  const project = tempFixture('fake-project-monorepo');
  const manifestPath = path.join(project, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  delete manifest.workspaces;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(project, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n  - 'packages/*'\n");

  const inv = inventory(project);
  assert.ok(inv.discovery.manifests.some((entry) => entry.path === 'packages/ui/package.json'));
  assert.ok(inv.discovery.componentRoots.includes('packages/ui/src/components'));
  assert.ok(inv.components.some((component) => component.folder === 'notice'));
});

test('exact manifest markers resolve platform identity and ambiguity remains null', () => {
  const inferred = inventory(MONOREPO);
  assert.equal(inferred.config.cmsKey, 'contentful');
  assert.equal(inferred.config.cmsLabel, 'Contentful');
  assert.equal(inferred.config.platformSource, 'manifest');
  assert.ok(inferred.config.platformMarkers.includes('package.json:dependency=@contentful/app-sdk'));

  const project = tempFixture('fake-project-monorepo');
  const manifestPath = path.join(project, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.dependencies.contentstack = '1.0.0';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const ambiguous = inventory(project);
  assert.equal(ambiguous.config.cmsKey, null);
  assert.equal(ambiguous.config.cmsLabel, null);
  assert.equal(ambiguous.config.platformSource, 'ambiguous');
  assert.ok(ambiguous.warnings.some((warning) => warning.code === 'ambiguous-platform'));

  const overridden = inventory(project, ['--platform', 'contentstack']);
  assert.equal(overridden.config.cmsKey, 'contentstack');
  assert.equal(overridden.config.cmsLabel, 'Contentstack');
  assert.equal(overridden.config.platformSource, 'override');
});

test('a toolkit (Handlebars + Storybook) project discovers markup and stories', () => {
  const inv = inventory(TOOLKIT);
  assert.equal(inv.mode, 'artifacts', 'build packs exist even though there is no component-index');
  const codes = inv.warnings.map((w) => w.code);
  assert.ok(!codes.includes('unknown-adapter'), 'toolkit is a known adapter');
  assert.ok(!codes.includes('empty-bucket'), 'the declared toolkit roots exist');

  const folders = inv.components.map((c) => c.folder).sort();
  assert.deepEqual(folders, [
    'badge', 'brand-mark', 'cart-button', 'cta-banner', 'generic-card',
    'homepage', 'locale-switch', 'panel', 'toast',
  ]);
});

test('a shallow-scanned folder of independent siblings yields one component per file', () => {
  const inv = inventory(TOOLKIT);
  const byFolder = Object.fromEntries(inv.components.map((c) => [c.folder, c]));

  for (const [slug, file] of [['brand-mark', 'brand-mark'], ['cart-button', 'cart_button'], ['locale-switch', 'locale-switch']]) {
    assert.ok(byFolder[slug], `components/chrome/${file}.hbs is its own component`);
    assert.equal(byFolder[slug].bucket, 'ui');
    assert.equal(
      byFolder[slug].entry,
      `frontend/src/html/components/chrome/${file}.hbs`,
      'each sibling is keyed to its own file, not the folder',
    );
  }
});

test('a shallow-scanned sibling keys on the normalized stem but keeps the raw file stem as its name', () => {
  const inv = inventory(TOOLKIT);
  const cartButton = inv.components.find((c) => c.folder === 'cart-button');
  assert.ok(cartButton, 'components/chrome/cart_button.hbs normalizes to the "cart-button" key');
  assert.equal(cartButton.name, 'cart_button', 'the raw file stem names the component');
});

test('the grouping folder itself is not emitted as a component', () => {
  const inv = inventory(TOOLKIT);
  const folders = inv.components.map((c) => c.folder);
  assert.ok(!folders.includes('chrome'), 'a folder of independent siblings is not a component');
});

test('a barrel among shallow-scanned siblings is not itself a component', () => {
  const inv = inventory(TOOLKIT);
  const folders = inv.components.map((c) => c.folder);
  assert.ok(!folders.includes('index'), 'components/chrome/index.hbs re-exports the siblings');
});

test('shallow-scanned siblings carry the grouping folder as their domain', () => {
  const inv = inventory(TOOLKIT);
  const brandMark = inv.components.find((c) => c.folder === 'brand-mark');
  assert.equal(brandMark.domain, 'chrome');
});

test('a namespaced-compound folder still collapses to one component', () => {
  const inv = inventory(TOOLKIT);
  const panel = inv.components.find((c) => c.folder === 'panel');
  assert.ok(panel, 'components/panel/{panel-header,panel-body}.hbs is one component');
  assert.equal(panel.bucket, 'ui');

  const folders = inv.components.map((c) => c.folder);
  assert.ok(!folders.includes('panel-header'), 'a namespaced part is not its own component');
  assert.ok(!folders.includes('panel-body'), 'a namespaced part is not its own component');
});

test('toolkit .hbs markup is discovered across components, modules, and templates', () => {
  const inv = inventory(TOOLKIT);
  const byFolder = Object.fromEntries(inv.components.map((c) => [c.folder, c]));
  assert.equal(byFolder['badge'].bucket, 'ui', 'flat components/badge.hbs');
  assert.equal(byFolder['generic-card'].bucket, 'ui', 'dir-per-component generic-card/generic-card.hbs');
  assert.equal(byFolder['cta-banner'].bucket, 'rendering', 'modules/cta-banner.hbs');
  assert.equal(byFolder['homepage'].bucket, 'template', 'templates/homepage.hbs');
  assert.ok(byFolder['badge'].sources.includes('code-scan'));
});

test('Storybook stories are accounted for as a component signal', () => {
  const inv = inventory(TOOLKIT);
  const badge = inv.components.find((c) => c.folder === 'badge');
  assert.ok(badge.sources.includes('storybook'), 'a story matching a component adds the storybook source');
  assert.ok(badge.sources.includes('build-pack'), 'and the build pack enriches the same component');

  const toast = inv.components.find((c) => c.folder === 'toast');
  assert.ok(toast, 'a story with no matching markup is still a component');
  assert.deepEqual(toast.sources, ['storybook']);
});

test('server-side .cshtml views are not treated as components', () => {
  const inv = inventory(TOOLKIT);
  const folders = inv.components.map((c) => c.folder);
  assert.ok(!folders.includes('index'), 'the .cshtml under Sample.Website/ must be excluded');
});

test('a project with buckets but no artifacts runs a config-driven code scan', () => {
  const inv = inventory(CODESCAN);
  assert.equal(inv.mode, 'code-scan');
  const codes = inv.warnings.map((w) => w.code);
  assert.ok(!codes.includes('heuristic-buckets'), 'declared componentBuckets are used — no heuristic probe');
});

test('a declared bucket that is missing warns empty-bucket; the speculative layouts root does not', () => {
  const inv = inventory(CODESCAN);
  const empty = inv.warnings.filter((w) => w.code === 'empty-bucket');
  assert.equal(empty.length, 1, 'only the declared, absent "legacy" bucket warns');
  assert.match(empty[0].message, /legacy/);
  assert.ok(!empty.some((w) => /layouts/.test(w.message)), 'the derived layouts root is speculative and stays silent');
});

test('a stale renderingDomains entry is flagged as missing on disk', () => {
  const inv = inventory(CODESCAN);
  const drift = inv.warnings.filter((w) => w.code === 'rendering-domain-missing');
  assert.equal(drift.length, 1);
  assert.match(drift[0].message, /ghost/);
});

test('the derived layouts root discovers layout components', () => {
  const inv = inventory(CODESCAN);
  const shell = inv.components.find((c) => c.folder === 'shell');
  assert.ok(shell, 'a component under src/components/layouts is discovered');
  assert.equal(shell.bucket, 'layout');
});

test('an unknown stackAdapter falls back to the default profile with a warning', () => {
  const inv = inventory(CODESCAN);
  const codes = inv.warnings.map((w) => w.code);
  assert.ok(codes.includes('unknown-adapter'), 'an unrecognized adapter is flagged');
  assert.ok(inv.counts.components > 0, 'the default profile still discovers components');
});

test('prototype-shaped adapter names remain unknown and degrade without crashing', () => {
  for (const stackAdapter of ['toString', 'constructor', '__proto__']) {
    const inv = inventoryWithAdapter(stackAdapter);
    assert.equal(inv.config.cmsKey, null);
    assert.equal(inv.config.cmsLabel, null);
    assert.ok(
      inv.warnings.some((warning) => warning.code === 'unknown-adapter'),
      `${stackAdapter} must use the ordinary unknown-adapter fallback`,
    );
    assert.ok(inv.counts.components > 0, `${stackAdapter} must still use the broad discovery profile`);
  }
});

test('code scan finds declared and undeclared rendering domains', () => {
  const inv = inventory(CODESCAN);
  const byFolder = Object.fromEntries(inv.components.map((c) => [c.folder, c]));
  assert.equal(byFolder['button'].bucket, 'ui');
  assert.equal(byFolder['hero'].domain, 'alpha', 'a declared domain');
  assert.equal(byFolder['card'].bucket, 'rendering');
  assert.equal(byFolder['card'].domain, 'beta', 'an undeclared domain, inferred from the path');
});

test('two components normalizing to the same key raise duplicate-component (Guard 1)', () => {
  const inv = inventory(CODESCAN);
  const codes = inv.warnings.map((w) => w.code);
  assert.ok(codes.includes('duplicate-component'), 'ui/widget and renderings/gamma/widget collide');
  const widgets = inv.components.filter((c) => c.folder === 'widget');
  assert.equal(widgets.length, 1, 'only one survives the collision');
});

test('a flat container of sibling files yields one component per file', () => {
  const inv = inventory(CODESCAN);
  const byFolder = Object.fromEntries(inv.components.map((c) => [c.folder, c]));
  // src/components/ui/icons/ has an index.ts barrel but un-namespaced siblings (FooIcon, BarIcon) —
  // a barrel alone does not collapse a flat set, so each file is a component, not one "icons".
  assert.ok(byFolder['foo-icon'], 'FooIcon.tsx is its own component');
  assert.ok(byFolder['bar-icon'], 'BarIcon.tsx is its own component');
  assert.ok(!byFolder['icons'], 'the flat container is not collapsed into one component');
  assert.equal(byFolder['foo-icon'].bucket, 'ui');
  assert.equal(byFolder['foo-icon'].domain, 'icons');
  // A dir-per-component sibling is still one component, not split by its files.
  assert.ok(byFolder['button'], 'button/Button.tsx stays a single component');
});

test('component files at a bucket root are each discovered', () => {
  const inv = inventory(CODESCAN);
  const byFolder = Object.fromEntries(inv.components.map((c) => [c.folder, c]));
  // src/components/widgets/{Sidebar,Topbar}.tsx sit directly at the bucket root (depth 0).
  assert.ok(byFolder['sidebar'], 'Sidebar.tsx at the bucket root is discovered');
  assert.ok(byFolder['topbar'], 'Topbar.tsx at the bucket root is discovered');
  assert.equal(byFolder['sidebar'].bucket, 'widgets');
});

test('an empty component-index falls through to a code scan (not zero components)', () => {
  const inv = inventory(EMPTYINDEX);
  assert.equal(inv.mode, 'code-scan', 'an empty [] index is not artifacts evidence');
  assert.equal(inv.evidence.componentIndex, false, 'an empty index did not contribute');
  const gizmo = inv.components.find((c) => c.folder === 'gizmo');
  assert.ok(gizmo, 'the heuristic scan still runs and finds the component');
  assert.deepEqual(gizmo.sources, ['code-scan']);
});

test('a compound directory (parts namespaced under the folder) stays one component', () => {
  const inv = inventory(CODESCAN);
  const folders = inv.components.map((c) => c.folder);
  // ui/tabs/ has TabsList.tsx + TabsPanel.tsx (both prefixed with the folder) → one component.
  assert.ok(folders.includes('tabs'), 'a compound is a single component');
  assert.ok(
    !folders.includes('tabs-list') && !folders.includes('tabs-panel'),
    'its namespaced parts are not split into phantom components',
  );
});

test('loose files at a mixed bucket root (with sibling subdirs) are still discovered', () => {
  const inv = inventory(CODESCAN);
  const providers = inv.components.find((c) => c.folder === 'providers');
  assert.ok(providers, 'ui/Providers.tsx is emitted even though ui/ also has component subdirs');
  assert.equal(providers.bucket, 'ui');
  assert.equal(providers.domain, null);
});

test('flat siblings that normalize to the same key warn and keep one', () => {
  const inv = inventory(CODESCAN);
  const topNavs = inv.components.filter((c) => c.folder === 'top-nav');
  assert.equal(topNavs.length, 1, 'ui/nav/{TopNav,top_nav}.tsx collapse to one');
  const dupMsgs = inv.warnings.filter((w) => w.code === 'duplicate-component').map((w) => w.message);
  assert.ok(dupMsgs.some((m) => /top_nav/.test(m)), 'the collision is surfaced, not dropped silently');
});

test('co-located test/spec files are not treated as components', () => {
  const inv = inventory(CODESCAN);
  const dialog = inv.components.find((c) => c.folder === 'dialog');
  assert.ok(dialog, 'the real Dialog.tsx is discovered');
  assert.equal(dialog.entry, 'src/components/ui/dialog/Dialog.tsx', 'entry points at the source, not a .test.tsx');
  assert.ok(!inv.components.some((c) => /(^|-)test(-|$)/.test(c.folder)), 'no phantom components from test files');
  // ui/dialog/hooks/ holds only test files, so it must neither spawn a component nor drop dialog.
  assert.ok(!inv.components.some((c) => c.folder === 'use-dialog-test'), 'a test-only subdir spawns no phantom');
});

test('a malformed fingerprint.json is warned and ignored, not counted as evidence', () => {
  const inv = inventory(CODESCAN);
  // ui/button/fingerprint.json is a JSON array; ui/dialog/fingerprint.json is unparseable.
  const bad = inv.warnings.filter((w) => w.code === 'unreadable-json');
  assert.equal(bad.length, 2, 'both a non-object and an unparseable fingerprint warn');
  assert.ok(bad.some((w) => /button/.test(w.message)), 'the non-object fingerprint is named');
  assert.ok(bad.some((w) => /dialog/.test(w.message)), 'the unparseable fingerprint is named');

  const button = inv.components.find((c) => c.folder === 'button');
  assert.ok(!button.sources.includes('fingerprint'), 'a malformed fingerprint adds no fingerprint source');
  assert.equal(button.facets, null, 'and yields no facets');
  assert.equal(inv.evidence.fingerprints, 0, 'malformed fingerprints are not counted');
});

test('composition partOf is lifted from a fingerprint declaration and validated', () => {
  const inv = inventory(PARTOF);

  // A declared partOf that resolves to a discovered component is recorded (normalized).
  const tab = inv.components.find((c) => c.folder === 'tab');
  assert.equal(tab.partOf, 'tabs', 'partOf "Tabs" normalizes and resolves to the tabs component');
  assert.equal(tab.facets.role, 'tab', 'facets and a partOf declaration coexist on one fingerprint');

  // No declaration → null.
  assert.equal(inv.components.find((c) => c.folder === 'tabs').partOf, null);

  // A partOf pointing at a non-existent component, or at itself, is dropped with a warning.
  assert.equal(inv.components.find((c) => c.folder === 'ghost').partOf, null);
  assert.equal(inv.components.find((c) => c.folder === 'loop').partOf, null);
  // An all-separator partOf normalizes to empty — treated as no declaration, not a broken edge.
  assert.equal(inv.components.find((c) => c.folder === 'dashy').partOf, null);
  const unresolved = inv.warnings.filter((w) => w.code === 'part-of-unresolved');
  assert.equal(unresolved.length, 2, 'only the dangling and self-referential partOf warn (not the empty one)');
});

test('a missing project directory exits 3, not 1', () => {
  const result = run('inventory.cjs', ['--project', fixture('does-not-exist')]);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /not a directory/);
});

test('a missing --project exits 2 with usage', () => {
  const result = run('inventory.cjs', []);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--project is required/);
  assert.match(result.stderr, /Usage:/);
});

test('an unknown option exits 2 rather than being ignored', () => {
  const result = run('inventory.cjs', ['--project', PROJECT, '--projekt', 'typo']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown option/);
});
