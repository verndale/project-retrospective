'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { run, tempOutput, readFile, writeFile, fixture } = require('./helpers.cjs');

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

test('a well-formed component capture passes', () => {
  const dir = tempOutput();
  writeFile(
    dir,
    'captures/card.md',
    [
      '# Capture: Card',
      '',
      '## Proposal type',
      '',
      'component-capture',
      '',
      '## Canonical',
      '',
      '**Card** (`card`) — resolved via name.',
      '',
      '## Source',
      '',
      '- Entry: `src/components/ui/card/Card.tsx`',
      '',
      '## Reuse evidence',
      '',
      '- Colocated unit tests cover every variant.',
      '',
      '## De-client work',
      '',
      '- Strip the CMS field types.',
      '',
      '## Proposed library entry',
      '',
      'Path: `components/card/`',
      '',
      '## Suggested commit',
      '',
      '`feat(library): Add Card from fake-project`',
      '',
    ].join('\n'),
  );
  const result = validate(dir);
  assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}`);
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
