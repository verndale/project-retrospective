'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, tempOutput, readFile, writeFile, fixture } = require('./helpers.cjs');

/** A throwaway ui-design-evidence-shaped checkout with prior-run artifacts. */
function tempData(runs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-data-'));
  for (const [run, arts] of Object.entries(runs)) {
    for (const kind of ['proposals', 'captures']) {
      for (const [name, text] of Object.entries(arts[kind] || {})) {
        const p = path.join(dir, 'runs', run, kind, name);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, text);
      }
    }
  }
  return dir;
}

function warns(result, code) {
  return (result.json?.warnings || []).some((w) => w.check === code);
}

const MANIFEST = fixture('fake-brain/skills/ui-design-brain/patterns-manifest.json');

function validate(dir, args = []) {
  const result = run('validate-report.cjs', ['--output', dir, ...args]);
  let json = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    /* only --json runs produce parseable stdout */
  }
  return { ...result, json };
}

/** Assert the run failed and names the given check. */
function assertFails(dir, check, args = []) {
  const result = validate(dir, [...args, '--json']);
  assert.equal(result.status, 1, `expected a failure exit, got ${result.status}`);
  const checks = result.json.failures.map((f) => f.check);
  assert.ok(
    checks.includes(check),
    `expected a "${check}" failure, got: ${JSON.stringify(result.json.failures, null, 2)}`,
  );
}

test('the golden output passes', () => {
  const dir = tempOutput();
  const result = validate(dir);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}`);
  assert.match(result.stdout, /^PASS /m);
});

test('the golden output passes catalog collision checks against a manifest', () => {
  const dir = tempOutput();
  const result = validate(dir, ['--manifest', MANIFEST]);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}`);
});

test('optional ### Gotchas / ### Tips subheadings under ## Learnings still validate', () => {
  const dir = tempOutput();
  // Insert the optional gotcha/tip split under Learnings (H3s live between Learnings and Gaps).
  const inject = [
    '### Gotchas',
    '',
    '- **AppPlaceholder remap** — never re-wrap placeholder output. Suggested destination: `the sitecore adapter rules`.',
    '',
    '### Tips',
    '',
    '- **Section theming** — define `data-header-theme` from the start. Suggested destination: `frontend-ai/skills/implement-build-pack/references/core/`.',
    '',
    '',
  ].join('\n');
  writeFile(dir, 'report.md', readFile(dir, 'report.md').replace('## Gaps', inject + '## Gaps'));
  const result = validate(dir);
  assert.equal(result.status, 0, `expected pass with the optional H3 split, got:\n${result.stdout}`);
  assert.match(result.stdout, /^PASS /m);
});

test('a missing report section fails', () => {
  const dir = tempOutput();
  writeFile(dir, 'report.md', readFile(dir, 'report.md').replace('## Candidates', '## Findings'));
  assertFails(dir, 'report-sections');
});

test('an invalid verdict word fails', () => {
  const dir = tempOutput();
  writeFile(dir, 'report.md', readFile(dir, 'report.md').replace('Verdict: Watch', 'Verdict: Maybe'));
  assertFails(dir, 'candidate-verdict');
});

test('a candidate with two verdict lines fails', () => {
  const dir = tempOutput();
  writeFile(dir, 'report.md', readFile(dir, 'report.md').replace('Verdict: Reject', 'Verdict: Reject\n\nVerdict: Watch'));
  assertFails(dir, 'candidate-verdict');
});

test('a bold verdict line is accepted', () => {
  const dir = tempOutput();
  writeFile(dir, 'report.md', readFile(dir, 'report.md').replace('Verdict: Watch', '**Verdict:** Watch'));
  const result = validate(dir);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}`);
});

test('a Promote candidate with no proposal file fails parity', () => {
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'proposals/logo-ribbon.md'));
  assertFails(dir, 'proposal-parity');
});

test('a proposal with no matching Promote candidate fails parity', () => {
  const dir = tempOutput();
  writeFile(dir, 'proposals/orphan.md', readFile(dir, 'proposals/logo-ribbon.md'));
  assertFails(dir, 'proposal-parity');
});

test('an unrecognized proposal type fails', () => {
  const dir = tempOutput();
  writeFile(dir, 'proposals/logo-ribbon.md', readFile(dir, 'proposals/logo-ribbon.md').replace('new-pattern', 'renamed-thing'));
  assertFails(dir, 'proposal-type');
});

test('a missing type-required section fails', () => {
  const dir = tempOutput();
  writeFile(dir, 'proposals/logo-ribbon.md', readFile(dir, 'proposals/logo-ribbon.md').replace('## Evidence', '## Rationale'));
  assertFails(dir, 'proposal-sections');
});

test('a slug that is not kebab(name) fails', () => {
  const dir = tempOutput();
  writeFile(dir, 'proposals/logo-ribbon.md', readFile(dir, 'proposals/logo-ribbon.md').replace('"slug": "logo-ribbon"', '"slug": "logoRibbon"'));
  assertFails(dir, 'proposal-slug');
});

test('a manifest file path that does not match the slug fails', () => {
  const dir = tempOutput();
  writeFile(
    dir,
    'proposals/logo-ribbon.md',
    readFile(dir, 'proposals/logo-ribbon.md').replace('"file": "patterns/logo-ribbon.md"', '"file": "patterns/logoribbon.md"'),
  );
  assertFails(dir, 'proposal-file-path');
});

test('a pattern draft with no accessibility bullet fails', () => {
  const dir = tempOutput();
  const text = readFile(dir, 'proposals/logo-ribbon.md');
  const practices = text.slice(
    text.indexOf('**Best practices:**'),
    text.indexOf('**Common layouts:**'),
  );
  const stripped = text.replace(
    practices,
    '**Best practices:**\n- Keep the band visually tidy\n- Use it above the fold\n\n',
  );
  writeFile(dir, 'proposals/logo-ribbon.md', stripped);
  assertFails(dir, 'proposal-pattern-draft');
});

test('a pattern draft not ending in a rule fails', () => {
  const dir = tempOutput();
  const text = readFile(dir, 'proposals/logo-ribbon.md');
  // Drop the closing --- inside the draft block only.
  writeFile(dir, 'proposals/logo-ribbon.md', text.replace('\n---\n```\n\n## Manifest entry', '\n```\n\n## Manifest entry'));
  assertFails(dir, 'proposal-pattern-draft');
});

test('a draft H2 that disagrees with the manifest name fails', () => {
  const dir = tempOutput();
  writeFile(dir, 'proposals/logo-ribbon.md', readFile(dir, 'proposals/logo-ribbon.md').replace('## Logo ribbon', '## Logo Ribbon'));
  assertFails(dir, 'proposal-pattern-draft');
});

test('a proposal colliding with an existing canonical fails against the manifest', () => {
  const dir = tempOutput();
  const collided = readFile(dir, 'proposals/logo-ribbon.md')
    .replace(/"name": "Logo ribbon"/, '"name": "Modal"')
    .replace(/"slug": "logo-ribbon"/, '"slug": "modal"')
    .replace(/"file": "patterns\/logo-ribbon\.md"/, '"file": "patterns/modal.md"')
    .replace('## Logo ribbon', '## Modal');
  writeFile(dir, 'proposals/logo-ribbon.md', collided);
  assertFails(dir, 'proposal-collision', ['--manifest', MANIFEST]);
});

test('a new-pattern proposal marked "## Applied" tolerates a now-existing canonical', () => {
  const dir = tempOutput();
  // Same shape as the collision case, but recorded as promoted — the match is expected.
  const applied =
    readFile(dir, 'proposals/logo-ribbon.md')
      .replace(/"name": "Logo ribbon"/, '"name": "Modal"')
      .replace(/"slug": "logo-ribbon"/, '"slug": "modal"')
      .replace(/"file": "patterns\/logo-ribbon\.md"/, '"file": "patterns/modal.md"')
      .replace('## Logo ribbon', '## Modal') +
    '\n## Applied\n\n2026-07-30 — promoted to ui-design-brain.\n';
  writeFile(dir, 'proposals/logo-ribbon.md', applied);
  const result = validate(dir, ['--manifest', MANIFEST, '--json']);
  assert.equal(result.status, 0, `expected pass, got: ${JSON.stringify(result.json?.failures, null, 2)}`);
});

test('a proposal marked "## Applied" whose canonical is absent fails', () => {
  const dir = tempOutput();
  // Logo ribbon is not in the manifest, so the applied claim cannot be true.
  writeFile(
    dir,
    'proposals/logo-ribbon.md',
    readFile(dir, 'proposals/logo-ribbon.md') + '\n## Applied\n\n2026-07-30 — promoted.\n',
  );
  assertFails(dir, 'proposal-applied', ['--manifest', MANIFEST]);
});

test('an alias already claimed by another canonical warns without failing', () => {
  const dir = tempOutput();
  writeFile(
    dir,
    'proposals/logo-ribbon.md',
    readFile(dir, 'proposals/logo-ribbon.md').replace('"aliases": ["Logo bar", "Logo cloud"]', '"aliases": ["Dialog"]'),
  );
  const result = validate(dir, ['--manifest', MANIFEST, '--json']);
  assert.equal(result.status, 0, 'a duplicate alias is a warning, not a failure');
  assert.ok(result.json.warnings.some((w) => w.check === 'proposal-alias-duplicate'));
});

test('an applied proposal whose alias its own now-existing canonical claims does not warn', () => {
  const dir = tempOutput();
  // Rename to Modal (in the manifest) with an alias Modal itself claims, marked applied:
  // the "duplicate" is the proposal's own promoted canonical, not a collision with another.
  const applied =
    readFile(dir, 'proposals/logo-ribbon.md')
      .replace(/"name": "Logo ribbon"/, '"name": "Modal"')
      .replace(/"slug": "logo-ribbon"/, '"slug": "modal"')
      .replace(/"file": "patterns\/logo-ribbon\.md"/, '"file": "patterns/modal.md"')
      .replace('## Logo ribbon', '## Modal')
      .replace('"aliases": ["Logo bar", "Logo cloud"]', '"aliases": ["Dialog"]') +
    '\n## Applied\n\n2026-07-30 — promoted to ui-design-brain.\n';
  writeFile(dir, 'proposals/logo-ribbon.md', applied);
  const result = validate(dir, ['--manifest', MANIFEST, '--json']);
  assert.equal(result.status, 0, `expected pass, got: ${JSON.stringify(result.json?.failures, null, 2)}`);
  assert.ok(
    !result.json.warnings.some((w) => w.check === 'proposal-alias-duplicate'),
    'an applied proposal must not warn on an alias its own canonical claims',
  );
});

test('an applied proposal still warns on an alias a different canonical claims', () => {
  const dir = tempOutput();
  // Applied, but the alias "Chip" belongs to Badge, not to this proposal's own Modal:
  // the "## Applied" gate must not suppress a genuine cross-canonical collision.
  const applied =
    readFile(dir, 'proposals/logo-ribbon.md')
      .replace(/"name": "Logo ribbon"/, '"name": "Modal"')
      .replace(/"slug": "logo-ribbon"/, '"slug": "modal"')
      .replace(/"file": "patterns\/logo-ribbon\.md"/, '"file": "patterns/modal.md"')
      .replace('## Logo ribbon', '## Modal')
      .replace('"aliases": ["Logo bar", "Logo cloud"]', '"aliases": ["Chip"]') +
    '\n## Applied\n\n2026-07-30 — promoted to ui-design-brain.\n';
  writeFile(dir, 'proposals/logo-ribbon.md', applied);
  const result = validate(dir, ['--manifest', MANIFEST, '--json']);
  assert.equal(result.status, 0, 'a duplicate alias is a warning, not a failure');
  assert.ok(
    result.json.warnings.some((w) => w.check === 'proposal-alias-duplicate'),
    'a cross-canonical alias collision must warn even when the proposal is applied',
  );
});

test('an excluded-category proposal name warns without failing', () => {
  const dir = tempOutput();
  // Rename the Promote candidate and its proposal so both still agree.
  writeFile(dir, 'report.md', readFile(dir, 'report.md').replace('### LogoRibbon', '### CheckoutFlow'));
  writeFile(dir, 'proposals/checkout-flow.md', readFile(dir, 'proposals/logo-ribbon.md'));
  fs.rmSync(path.join(dir, 'proposals/logo-ribbon.md'));

  const result = validate(dir, ['--json']);
  assert.equal(result.status, 0, `expected pass with a warning, got: ${JSON.stringify(result.json?.failures)}`);
  assert.ok(result.json.warnings.some((w) => w.check === 'proposal-exclusion'));
});

test('scope inventory waives resolution, candidates, and proposals', () => {
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'resolution.json'));
  fs.rmSync(path.join(dir, 'proposals'), { recursive: true });
  fs.rmSync(path.join(dir, 'orchestration-drafts.md'));

  const result = validate(dir, ['--scope', 'inventory']);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}`);
});

test('--no-brain waives resolution.json at full scope', () => {
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'resolution.json'));
  writeFile(dir, 'report.md', readFile(dir, 'report.md').replace('## Resolution', '## Resolution skipped (no catalog)'));

  const result = validate(dir, ['--no-brain']);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}`);
});

test('a missing resolution.json without --no-brain fails', () => {
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'resolution.json'));
  assertFails(dir, 'resolution-present');
});

test('an inventory count mismatch fails', () => {
  const dir = tempOutput();
  const inv = JSON.parse(readFile(dir, 'inventory.json'));
  inv.counts.components = 99;
  writeFile(dir, 'inventory.json', JSON.stringify(inv, null, 2));
  assertFails(dir, 'inventory-counts');
});

test('malformed inventory JSON fails on parse, not a crash', () => {
  const dir = tempOutput();
  writeFile(dir, 'inventory.json', '{ not json');
  assertFails(dir, 'inventory-parses');
});

test('an orchestration drafts file with no shape and no empty-note fails', () => {
  const dir = tempOutput();
  writeFile(dir, 'orchestration-drafts.md', '# Orchestration drafts\n\nSome prose with no draft.\n');
  assertFails(dir, 'drafts-shape');
});

test('an explicit no-learnings note is accepted', () => {
  const dir = tempOutput();
  writeFile(dir, 'orchestration-drafts.md', '# Orchestration drafts — x\n\n_No pipeline learnings from this run._\n');
  const result = validate(dir);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}`);
});

test('a missing output directory exits 3', () => {
  const result = validate(fixture('no-such-output'));
  assert.equal(result.status, 3);
  assert.match(result.stderr, /not a directory/);
});

test('an invalid --scope exits 2', () => {
  const dir = tempOutput();
  const result = validate(dir, ['--scope', 'everything']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--scope must be one of/);
});

/** A minimal well-formed capture body, for tests that need a second one. */
function captureFile(canonical, slug) {
  return [
    `# Capture: ${canonical}`,
    '',
    '## Proposal type',
    '',
    'component-capture',
    '',
    '## Canonical',
    '',
    `**${canonical}** (\`${slug}\`) — resolved via name.`,
    '',
    '## Structural implementation',
    '',
    '```json',
    `{ "componentKey": "${slug}", "canonical": "${canonical}", "variant": null, "variantLabel": null, "default": true }`,
    '```',
    '',
    '## Source',
    '',
    `- Entry: \`src/components/ui/${slug}/${canonical}.tsx\``,
    '',
    '## Reuse evidence',
    '',
    '- Colocated unit tests cover every variant.',
    '',
    '## De-client work',
    '',
    '- Strip the CMS field types.',
    '',
    '## Runtime architecture',
    '',
    '```json',
    '{ "mode": "server", "hydration": [], "serverOutput": "full", "modules": [] }',
    '```',
    '',
    '## Proposed library entry',
    '',
    `Path: \`components/${slug}/\``,
    '',
    '## Progress',
    '',
    '```json',
    '{ "status": "pending" }',
    '```',
    '',
    '## Suggested commit',
    '',
    `\`feat(${slug}): Add ${canonical} captured from fake-project\``,
    '',
  ].join('\n');
}

/** Append a "### <Canonical>" entry to the report's Captures section. */
function addCaptureEntry(dir, canonical) {
  const report = readFile(dir, 'report.md').replace(
    '## Learnings',
    `### ${canonical}\n\n\`captures/${canonical.toLowerCase()}.md\` — from \`src/components/ui/${canonical.toLowerCase()}\`.\n\n- Synthetic fixture entry.\n\n## Learnings`,
  );
  writeFile(dir, 'report.md', report);
}

function addSourceParity(dir, canonical, componentKey) {
  const artifact = JSON.parse(readFile(dir, 'source-parity/modal.json'));
  artifact.componentKey = componentKey;
  artifact.canonical = canonical;
  artifact.capture = `captures/${componentKey}.md`;
  artifact.observations[0].id = `sp-${componentKey}-001`;
  writeFile(dir, `source-parity/${componentKey}.json`, `${JSON.stringify(artifact, null, 2)}\n`);
}

test('a well-formed component capture passes', () => {
  const dir = tempOutput();
  writeFile(dir, 'captures/link.md', captureFile('Link', 'link'));
  addSourceParity(dir, 'Link', 'link');
  addCaptureEntry(dir, 'Link');
  const result = validate(dir);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}`);
});

test('a "## Captures" entry with no capture file fails parity', () => {
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'captures/modal.md'));
  assertFails(dir, 'capture-parity');
});

test('a capture file with no "## Captures" entry fails parity', () => {
  const dir = tempOutput();
  writeFile(dir, 'captures/link.md', captureFile('Link', 'link'));
  assertFails(dir, 'capture-parity');
});

test('a report listing captures with no captures/ directory fails parity', () => {
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'captures'), { recursive: true });
  assertFails(dir, 'capture-parity');
});

test('"## Captures" is required at full scope', () => {
  const dir = tempOutput();
  writeFile(dir, 'report.md', readFile(dir, 'report.md').replace('## Captures', '## Captured work'));
  assertFails(dir, 'report-sections');
});

test('a missing "## Captures" heading reports one cause, not two', () => {
  // report-sections already names it. Stacking capture-parity on top would send the
  // reader to look at captures/, which is fine.
  const dir = tempOutput();
  writeFile(dir, 'report.md', readFile(dir, 'report.md').replace('## Captures', '## Captured work'));
  const result = validate(dir, ['--json']);
  const checks = result.json.failures.map((f) => f.check);
  assert.ok(checks.includes('report-sections'));
  assert.ok(!checks.includes('capture-parity'), `expected no capture-parity, got: ${JSON.stringify(result.json.failures, null, 2)}`);
});

test('two "## Captures" entries resolving to one file name the duplicate', () => {
  const dir = tempOutput();
  addCaptureEntry(dir, 'Modal');
  const result = validate(dir, ['--json']);
  assert.equal(result.status, 1);
  const details = result.json.failures.filter((f) => f.check === 'capture-parity').map((f) => f.detail);
  assert.equal(details.length, 1, `expected exactly one parity failure, got: ${JSON.stringify(details, null, 2)}`);
  assert.match(details[0], /more than one entry resolving to captures\/modal\.md/);
});

test('a capture whose "## Canonical" heading is wrong says so', () => {
  // The required-heading check is a substring test, so "## Canonical name" passes
  // it; the message must point at the heading, not at a missing bolded line.
  const dir = tempOutput();
  writeFile(dir, 'captures/modal.md', readFile(dir, 'captures/modal.md').replace('## Canonical\n', '## Canonical name\n'));
  const result = validate(dir, ['--json']);
  const failure = result.json.failures.find((f) => f.check === 'capture-canonical');
  assert.ok(failure, `expected capture-canonical, got: ${JSON.stringify(result.json.failures, null, 2)}`);
  assert.match(failure.detail, /has no "## Canonical" section/);
});

test('a bolded alias on the canonical line is not mistaken for the canonical', () => {
  const dir = tempOutput();
  writeFile(
    dir,
    'captures/modal.md',
    readFile(dir, 'captures/modal.md').replace(
      '**Modal** (`modal`) — resolved via name.',
      'Modal (`modal`) — resolved via alias **Dialog** (`dialog`).',
    ),
  );
  const result = validate(dir, ['--json']);
  const failure = result.json.failures.find((f) => f.check === 'capture-canonical');
  assert.ok(failure, `expected capture-canonical, got: ${JSON.stringify(result.json.failures, null, 2)}`);
  assert.doesNotMatch(failure.detail, /Dialog/, 'the alias must not be reported as the canonical');
});

test('a run that captured nothing passes with the section still present', () => {
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'captures'), { recursive: true });
  fs.rmSync(path.join(dir, 'source-parity'), { recursive: true });
  writeFile(
    dir,
    'report.md',
    readFile(dir, 'report.md').replace(
      /## Captures\n[\s\S]*?\n## Learnings/,
      '## Captures\n\nNo implementation in this project met the capture bar.\n\n## Learnings',
    ),
  );
  const result = validate(dir);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}`);
});

test('an empty captures/ directory warns but does not fail', () => {
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'captures/modal.md'));
  fs.rmSync(path.join(dir, 'source-parity/modal.json'));
  writeFile(
    dir,
    'report.md',
    readFile(dir, 'report.md').replace(
      /## Captures\n[\s\S]*?\n## Learnings/,
      '## Captures\n\nNo implementation in this project met the capture bar.\n\n## Learnings',
    ),
  );
  const result = validate(dir, ['--json']);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}`);
  assert.ok(result.json.warnings.some((w) => w.check === 'capture-empty'));
});

test('source parity cannot remain when a run has no captures', () => {
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'captures/modal.md'));
  writeFile(
    dir,
    'report.md',
    readFile(dir, 'report.md').replace(
      /## Captures\n[\s\S]*?\n## Learnings/,
      '## Captures\n\nNo implementation in this project met the capture bar.\n\n## Learnings',
    ),
  );
  const result = validate(dir, ['--json']);
  assert.equal(result.status, 1);
  assert.ok(result.json.failures.some((failure) => failure.check === 'source-parity'));
});

test('--scope candidates does not require the Captures section', () => {
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'captures'), { recursive: true });
  writeFile(dir, 'report.md', readFile(dir, 'report.md').replace('## Captures', '## Captured work'));
  const result = validate(dir, ['--scope', 'candidates']);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}`);
});

test('a capture whose canonical does not kebab to its filename fails', () => {
  // The real defect: a capture of a project's `Tag` component whose canonical is
  // Badge, but named and slugged after the project's label. The report entry and
  // the filename agree, so parity passes and only this check catches it.
  const dir = tempOutput();
  writeFile(dir, 'captures/tag.md', captureFile('Badge', 'tag'));
  addCaptureEntry(dir, 'Tag');
  assertFails(dir, 'capture-canonical');
});

test('a capture missing a required section fails', () => {
  const dir = tempOutput();
  writeFile(
    dir,
    'captures/card.md',
    '# Capture: Card\n\n## Proposal type\n\ncomponent-capture\n\n## Canonical\n\n**Card**\n',
  );
  assertFails(dir, 'proposal-sections');
});

test('a catalog proposal type is rejected inside captures/', () => {
  const dir = tempOutput();
  writeFile(dir, 'captures/logo-ribbon.md', readFile(dir, 'proposals/logo-ribbon.md'));
  assertFails(dir, 'proposal-type');
});

test('a capture type is rejected inside proposals/', () => {
  const dir = tempOutput();
  writeFile(
    dir,
    'proposals/logo-ribbon.md',
    readFile(dir, 'proposals/logo-ribbon.md').replace('new-pattern', 'component-capture'),
  );
  assertFails(dir, 'proposal-type');
});

// --- meta.json (the client-wiki identity contract) ---

test('a run missing meta.json fails at full scope', () => {
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'meta.json'));
  assertFails(dir, 'meta-present');
});

test('meta.json with the wrong schemaVersion fails', () => {
  const dir = tempOutput();
  const meta = JSON.parse(readFile(dir, 'meta.json'));
  meta.schemaVersion = 2;
  writeFile(dir, 'meta.json', JSON.stringify(meta, null, 2));
  assertFails(dir, 'meta-schema');
});

test('meta.json with a missing required field fails', () => {
  const dir = tempOutput();
  const meta = JSON.parse(readFile(dir, 'meta.json'));
  delete meta.client.name;
  writeFile(dir, 'meta.json', JSON.stringify(meta, null, 2));
  assertFails(dir, 'meta-fields');
});

test('meta.json with a non-kebab slug fails', () => {
  const dir = tempOutput();
  const meta = JSON.parse(readFile(dir, 'meta.json'));
  meta.client.slug = 'FakeProject';
  writeFile(dir, 'meta.json', JSON.stringify(meta, null, 2));
  assertFails(dir, 'meta-slug');
});

test('meta.json with a null platform is accepted', () => {
  const dir = tempOutput();
  const meta = JSON.parse(readFile(dir, 'meta.json'));
  meta.platform = null;
  writeFile(dir, 'meta.json', JSON.stringify(meta, null, 2));
  const result = validate(dir);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}`);
});

test('scope inventory does not require meta.json', () => {
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'meta.json'));
  fs.rmSync(path.join(dir, 'resolution.json'));
  fs.rmSync(path.join(dir, 'proposals'), { recursive: true });
  fs.rmSync(path.join(dir, 'orchestration-drafts.md'));
  const result = validate(dir, ['--scope', 'inventory']);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}`);
});

test('meta.json must agree with a real run directory', () => {
  const os = require('node:os');
  // A run laid out as runs/<slug>/<date>/ triggers the dir-agreement check.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-run-'));
  const runDir = path.join(base, 'runs', 'fake-project', '2026-01-01');
  fs.cpSync(tempOutput(), runDir, { recursive: true });
  // The fixture meta already declares slug fake-project / date 2026-01-01 → passes.
  const pass = validate(runDir);
  assert.equal(pass.status, 0, `expected pass, got:\n${pass.stdout}`);
  // Now break the date so it disagrees with the directory.
  const meta = JSON.parse(fs.readFileSync(path.join(runDir, 'meta.json'), 'utf8'));
  meta.date = '2026-02-02';
  fs.writeFileSync(path.join(runDir, 'meta.json'), JSON.stringify(meta, null, 2));
  assertFails(runDir, 'meta-dir');
});

// --- triage.json (the machine-readable "## Candidates" twin the promotion radar reads) ---

test('a run with a valid triage.json passes', () => {
  const dir = tempOutput(); // the golden fixture ships a well-formed triage.json
  const result = validate(dir, ['--json']);
  assert.equal(result.status, 0, `expected pass, got: ${JSON.stringify(result.json?.failures, null, 2)}`);
  assert.ok(
    !result.json.warnings.some((w) => w.check === 'triage-provisional'),
    'the golden watch entry carries a provisional-canonical note',
  );
});

test('a run missing triage.json fails at full scope', () => {
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'triage.json'));
  assertFails(dir, 'triage-present');
});

test('triage.json with the wrong schemaVersion fails', () => {
  const dir = tempOutput();
  const triage = JSON.parse(readFile(dir, 'triage.json'));
  triage.schemaVersion = 2;
  writeFile(dir, 'triage.json', JSON.stringify(triage, null, 2));
  assertFails(dir, 'triage-schema');
});

test('a triage entry with an invalid verdict fails', () => {
  const dir = tempOutput();
  const triage = JSON.parse(readFile(dir, 'triage.json'));
  triage.promote[0].verdict = 'Maybe';
  writeFile(dir, 'triage.json', JSON.stringify(triage, null, 2));
  assertFails(dir, 'triage-entry');
});

test('a triage entry with no label fails', () => {
  const dir = tempOutput();
  const triage = JSON.parse(readFile(dir, 'triage.json'));
  delete triage.watch[0].label;
  writeFile(dir, 'triage.json', JSON.stringify(triage, null, 2));
  assertFails(dir, 'triage-entry');
});

test('a triage array that is not an array fails shape', () => {
  const dir = tempOutput();
  const triage = JSON.parse(readFile(dir, 'triage.json'));
  triage.reject = null;
  writeFile(dir, 'triage.json', JSON.stringify(triage, null, 2));
  assertFails(dir, 'triage-shape');
});

test('a non-numeric count fails', () => {
  const dir = tempOutput();
  const triage = JSON.parse(readFile(dir, 'triage.json'));
  triage.counts.Watch = 'one';
  writeFile(dir, 'triage.json', JSON.stringify(triage, null, 2));
  assertFails(dir, 'triage-counts');
});

test('a watch note without "provisional canonical:" warns but does not fail', () => {
  const dir = tempOutput();
  const triage = JSON.parse(readFile(dir, 'triage.json'));
  triage.watch[0].note = 'a collection wrapper around Card';
  writeFile(dir, 'triage.json', JSON.stringify(triage, null, 2));
  const result = validate(dir, ['--json']);
  assert.equal(result.status, 0, `a missing provisional note warns, it does not fail:\n${result.stdout}`);
  assert.ok(warns(result, 'triage-provisional'), 'expected a triage-provisional warning');
});

test('a malformed triage.json fails to parse', () => {
  const dir = tempOutput();
  writeFile(dir, 'triage.json', '{ not json');
  assertFails(dir, 'triage-parses');
});

test('scope inventory does not require triage.json', () => {
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'triage.json'));
  fs.rmSync(path.join(dir, 'meta.json'));
  fs.rmSync(path.join(dir, 'memory-archive.json'));
  fs.rmSync(path.join(dir, 'resolution.json'));
  fs.rmSync(path.join(dir, 'proposals'), { recursive: true });
  fs.rmSync(path.join(dir, 'orchestration-drafts.md'));
  const result = validate(dir, ['--scope', 'inventory']);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}`);
});

test('triage.json must agree with a real run directory', () => {
  const os = require('node:os');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-triage-'));
  const runDir = path.join(base, 'runs', 'fake-project', '2026-01-01');
  fs.cpSync(tempOutput(), runDir, { recursive: true });
  // The fixture triage already declares run fake-project/2026-01-01 → passes.
  const pass = validate(runDir);
  assert.equal(pass.status, 0, `expected pass, got:\n${pass.stdout}`);
  // Break the run field so it disagrees with the directory.
  const triage = JSON.parse(fs.readFileSync(path.join(runDir, 'triage.json'), 'utf8'));
  triage.run = 'fake-project/2026-02-02';
  fs.writeFileSync(path.join(runDir, 'triage.json'), JSON.stringify(triage, null, 2));
  assertFails(runDir, 'triage-run');
});

// --- memory-archive.json (the "no run silently drops project memory" gate) ---

/** Assert the run passed (exit 0) and raised the given warning. */
function assertWarns(dir, check, args = []) {
  const result = validate(dir, [...args, '--json']);
  assert.equal(
    result.status,
    0,
    `expected pass with a warning, got status ${result.status}:\n${JSON.stringify(result.json, null, 2)}`,
  );
  const checks = result.json.warnings.map((w) => w.check);
  assert.ok(
    checks.includes(check),
    `expected a "${check}" warning, got: ${JSON.stringify(result.json.warnings, null, 2)}`,
  );
}

test('project memory with no memory-archive.json fails', () => {
  // The golden inventory reports memory shards, so a missing manifest means the
  // archive step never ran and that memory was dropped.
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'memory-archive.json'));
  assertFails(dir, 'memory-archive-missing');
});

test('a missing memory-archive.json fails even when no memory was detected', () => {
  // The archive step runs on every analyze run, so an absent manifest is always a
  // gap — and inventory's top-level memoryShards cannot see subdir-only memory, so
  // this must not be softened to a warning when memoryShards happens to be empty.
  const dir = tempOutput();
  const inv = JSON.parse(readFile(dir, 'inventory.json'));
  inv.evidence.memoryShards = [];
  inv.evidence.memoryIndex = false;
  writeFile(dir, 'inventory.json', JSON.stringify(inv, null, 2));
  fs.rmSync(path.join(dir, 'memory-archive.json'));
  assertFails(dir, 'memory-archive-missing');
});

test('a home-fallback archive (skipped-no-data) warns but passes', () => {
  const dir = tempOutput();
  const m = JSON.parse(readFile(dir, 'memory-archive.json'));
  m.status = 'skipped-no-data';
  m.destination = null;
  writeFile(dir, 'memory-archive.json', JSON.stringify(m, null, 2));
  assertWarns(dir, 'memory-not-preserved');
});

test('a "no-memory" archive that disagrees with inventory warns', () => {
  const dir = tempOutput(); // inventory still lists memory shards
  const m = JSON.parse(readFile(dir, 'memory-archive.json'));
  m.status = 'no-memory';
  m.files = [];
  writeFile(dir, 'memory-archive.json', JSON.stringify(m, null, 2));
  assertWarns(dir, 'memory-archive-mismatch');
});

test('a "no-memory" archive whose shards were all empty does not warn mismatch', () => {
  // inventory lists shards by filename, but the archive found them all empty — that
  // is expected, not a root disagreement, so no mismatch warning should fire.
  const dir = tempOutput();
  const m = JSON.parse(readFile(dir, 'memory-archive.json'));
  m.status = 'no-memory';
  m.files = [];
  m.skippedEmpty = ['architecture.md', 'design-system.md'];
  writeFile(dir, 'memory-archive.json', JSON.stringify(m, null, 2));
  const result = validate(dir, ['--json']);
  assert.equal(result.status, 0, `expected pass, got:\n${JSON.stringify(result.json, null, 2)}`);
  assert.ok(
    !result.json.warnings.map((w) => w.check).includes('memory-archive-mismatch'),
    'all-empty shards should not read as an artifacts-root mismatch',
  );
});

test('an "archived" manifest with no files fails', () => {
  const dir = tempOutput();
  const m = JSON.parse(readFile(dir, 'memory-archive.json'));
  m.files = [];
  writeFile(dir, 'memory-archive.json', JSON.stringify(m, null, 2));
  assertFails(dir, 'memory-archive-empty');
});

test('a memory-archive.json with the wrong schemaVersion fails', () => {
  const dir = tempOutput();
  const m = JSON.parse(readFile(dir, 'memory-archive.json'));
  m.schemaVersion = 2;
  writeFile(dir, 'memory-archive.json', JSON.stringify(m, null, 2));
  assertFails(dir, 'memory-archive-schema');
});

test('an archive that recorded unreadable files warns of incompleteness', () => {
  const dir = tempOutput();
  const m = JSON.parse(readFile(dir, 'memory-archive.json'));
  m.warnings = [{ code: 'memory-file-unreadable', message: 'could not copy components/hero.md' }];
  writeFile(dir, 'memory-archive.json', JSON.stringify(m, null, 2));
  assertWarns(dir, 'memory-archive-incomplete');
});

test('an unrecognized archive status fails', () => {
  const dir = tempOutput();
  const m = JSON.parse(readFile(dir, 'memory-archive.json'));
  m.status = 'copied';
  writeFile(dir, 'memory-archive.json', JSON.stringify(m, null, 2));
  assertFails(dir, 'memory-archive-status');
});

test('a malformed memory-archive.json fails', () => {
  const dir = tempOutput();
  writeFile(dir, 'memory-archive.json', '{ not json');
  assertFails(dir, 'memory-archive-parses');
});

test('scope inventory does not require memory-archive.json', () => {
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'memory-archive.json'));
  fs.rmSync(path.join(dir, 'meta.json'));
  fs.rmSync(path.join(dir, 'resolution.json'));
  fs.rmSync(path.join(dir, 'proposals'), { recursive: true });
  fs.rmSync(path.join(dir, 'orchestration-drafts.md'));
  const result = validate(dir, ['--scope', 'inventory']);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}`);
});

// specs.json — the optional Confluence functional-spec pack.
test('a run with no specs.json still passes (specs are an optional input)', () => {
  const dir = tempOutput();
  fs.rmSync(path.join(dir, 'specs.json'));
  const result = validate(dir);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}`);
});

test('a non-approved spec in specs.json fails the approved-only gate', () => {
  const dir = tempOutput();
  const pack = JSON.parse(readFile(dir, 'specs.json'));
  pack.specs[0].documentStatus = 'DRAFT';
  writeFile(dir, 'specs.json', JSON.stringify(pack, null, 2));
  assertFails(dir, 'specs-approved');
});

test('a specs.json whose counts do not reconcile fails', () => {
  const dir = tempOutput();
  const pack = JSON.parse(readFile(dir, 'specs.json'));
  pack.counts.specs = 99;
  writeFile(dir, 'specs.json', JSON.stringify(pack, null, 2));
  assertFails(dir, 'specs-counts');
});

test('a specs.json with no specs array fails the schema check', () => {
  const dir = tempOutput();
  writeFile(dir, 'specs.json', JSON.stringify({ schemaVersion: 1, counts: {}, warnings: [] }, null, 2));
  assertFails(dir, 'specs-schema');
});

test('a malformed specs.json fails to parse', () => {
  const dir = tempOutput();
  writeFile(dir, 'specs.json', '{ not json');
  assertFails(dir, 'specs-parses');
});

test('--data flags a proposal a prior run already made, without failing', () => {
  const dir = tempOutput(); // proposes logo-ribbon
  const data = tempData({
    'other-client/2020-01-01': { proposals: { 'logo-ribbon.md': readFile(dir, 'proposals/logo-ribbon.md') } },
  });
  try {
    const result = validate(dir, ['--manifest', MANIFEST, '--data', data, '--json']);
    assert.equal(result.status, 0, `a duplicate warns, it does not fail:\n${result.stdout}`);
    assert.ok(warns(result, 'proposal-duplicate'), 'expected a proposal-duplicate warning');
  } finally {
    fs.rmSync(data, { recursive: true, force: true });
  }
});

test('--data flags a capture a prior run already made', () => {
  const dir = tempOutput(); // captures modal
  const data = tempData({ 'other-client/2020-01-01': { captures: { 'modal.md': '# Capture: Modal\n' } } });
  try {
    const result = validate(dir, ['--manifest', MANIFEST, '--data', data, '--json']);
    assert.ok(warns(result, 'capture-duplicate'), 'expected a capture-duplicate warning');
  } finally {
    fs.rmSync(data, { recursive: true, force: true });
  }
});

test('--data with no overlapping prior art produces no duplicate warnings', () => {
  const dir = tempOutput();
  const data = tempData({
    'other-client/2020-01-01': { proposals: { 'unrelated.md': '# Proposal: Unrelated\n\n## Proposal type\n\nnew-pattern\n' } },
  });
  try {
    const result = validate(dir, ['--manifest', MANIFEST, '--data', data, '--json']);
    assert.equal(result.status, 0);
    assert.ok(!warns(result, 'proposal-duplicate') && !warns(result, 'capture-duplicate'));
  } finally {
    fs.rmSync(data, { recursive: true, force: true });
  }
});

test('without --data the prior-art check does not run (backward compatible)', () => {
  const dir = tempOutput();
  const result = validate(dir, ['--manifest', MANIFEST, '--json']);
  assert.ok(!warns(result, 'proposal-duplicate') && !warns(result, 'capture-duplicate'));
});

function tempRetrospectiveOutput() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-only-output-'));
  writeFile(
    dir,
    'meta.json',
    JSON.stringify({
      schemaVersion: 1,
      date: '2026-08-09',
      scope: 'retrospectives',
      client: { name: 'Sample', slug: 'sample' },
      project: { name: 'Sample project', slug: 'sample-project' },
      platform: null,
      priorReports: [],
    }),
  );
  writeFile(dir, 'retrospectives-raw.json', JSON.stringify({ schemaVersion: 1, pages: [{ pageId: '1' }] }));
  writeFile(dir, 'retrospective-findings.json', JSON.stringify({ schemaVersion: 1, pages: [{ pageId: '1' }], actions: [] }));
  writeFile(
    dir,
    'retrospectives.json',
    JSON.stringify({
      schemaVersion: 1,
      pages: [{ pageId: '1', title: 'Build Retrospective', componentSignals: [] }],
      excluded: [],
      warnings: [],
      counts: { pages: 1, excluded: 0, actions: 1 },
    }),
  );
  writeFile(
    dir,
    'retrospective-actions.json',
    JSON.stringify({
      schemaVersion: 1,
      actions: [
        {
          id: 'retro-action-123456789abc',
          title: 'Assign release ownership',
          status: 'needs-owner',
          owner: null,
          destination: 'project',
          evidence: null,
          rationale: null,
        },
      ],
      counts: { total: 1, needsOwner: 1 },
    }),
  );
  writeFile(
    dir,
    'report.md',
    '# Project retrospective — Sample\n\n## Run\n\nRetrospectives-only backfill.\n\n## Summary\n\nOne page captured.\n\n## Team retrospectives\n\n- Build Retrospective\n\n## Gaps\n\n- None.\n\n## Next steps\n\n1. Assign the open action.\n',
  );
  return dir;
}

test('retrospectives scope validates without inventory, resolution, triage, or memory artifacts', () => {
  const dir = tempRetrospectiveOutput();
  try {
    const result = validate(dir, ['--scope', 'retrospectives']);
    assert.equal(result.status, 0, result.stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('retrospectives scope requires the dedicated report section', () => {
  const dir = tempRetrospectiveOutput();
  try {
    writeFile(dir, 'report.md', readFile(dir, 'report.md').replace('## Team retrospectives', '## Notes'));
    assertFails(dir, 'report-sections', ['--scope', 'retrospectives']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('retrospective actions enforce owner and completion proof', () => {
  const dir = tempRetrospectiveOutput();
  try {
    const pack = JSON.parse(readFile(dir, 'retrospective-actions.json'));
    pack.actions[0].status = 'done';
    writeFile(dir, 'retrospective-actions.json', JSON.stringify(pack));
    assertFails(dir, 'retrospective-action-owner', ['--scope', 'retrospectives']);
    assertFails(dir, 'retrospective-action-proof', ['--scope', 'retrospectives']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a normal full run with one retrospective artifact missing fails parity', () => {
  const dir = tempOutput();
  writeFile(dir, 'retrospectives.json', JSON.stringify({ schemaVersion: 1, pages: [], excluded: [], warnings: [], counts: { pages: 0, excluded: 0, actions: 0 } }));
  assertFails(dir, 'retrospectives-present');
  assertFails(dir, 'report-sections');
});
