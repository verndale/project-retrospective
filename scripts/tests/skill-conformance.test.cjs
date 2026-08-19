'use strict';

/**
 * Lints the skill against the authoring rules in skills/_meta/_sections.md and
 * Anthropic's agent-skill best practices. This repo has no separate skills-lint
 * runner — these assertions are it.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SKILL_DIR } = require('./helpers.cjs');
// Imported, not re-declared: the graph's integrity gate and this lint gate must agree on
// what SKILL.md declares, and two copies of a regex drift.
const { SKILL_REFERENCE_RE, SKILL_SCRIPT_RE } = require('../graph/build-graph.cjs');

const NAME_RE = /^[a-z0-9-]{1,64}$/;
const RESERVED = ['anthropic', 'claude'];
const XML_TAG_RE = /<\/?[A-Za-z][A-Za-z0-9-]*[\s/>]/;
const FIRST_PERSON_RE = /^(I |We |You )|\b(I can|I will|you can|you should|we will)\b/i;
const MAX_DESCRIPTION = 1024;
const MAX_BODY_LINES = 500;
const TOC_THRESHOLD = 100;

const SKILL_MD = path.join(SKILL_DIR, 'SKILL.md');
const raw = fs.readFileSync(SKILL_MD, 'utf8');

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(match, 'SKILL.md must open with YAML frontmatter');
  const fields = {};
  let key = null;
  for (const line of match[1].split('\n')) {
    const start = line.match(/^([a-zA-Z_-]+):\s?(.*)$/);
    if (start) {
      key = start[1];
      fields[key] = start[2];
    } else if (key) {
      fields[key] += ` ${line.trim()}`;
    }
  }
  return { fields, body: match[2] };
}

const { fields, body } = parseFrontmatter(raw);

function markdownFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...markdownFiles(full));
    } else if (entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

test('frontmatter carries only name and description', () => {
  assert.deepEqual(Object.keys(fields).sort(), ['description', 'name']);
});

test('name is a valid skill slug matching the directory', () => {
  assert.match(fields.name, NAME_RE);
  assert.equal(fields.name, path.basename(SKILL_DIR));
  for (const word of RESERVED) {
    assert.ok(!fields.name.includes(word), `name must not contain "${word}"`);
  }
});

test('description is third person, specific, and within the limit', () => {
  assert.ok(fields.description.length > 0, 'description must be non-empty');
  assert.ok(
    fields.description.length <= MAX_DESCRIPTION,
    `description is ${fields.description.length} chars, limit is ${MAX_DESCRIPTION}`,
  );
  assert.ok(!XML_TAG_RE.test(fields.description), 'description must not contain XML tags');
  assert.ok(!FIRST_PERSON_RE.test(fields.description), 'description must be written in third person');
  assert.match(fields.description, /Use when/i, 'description must say when to use the skill');
});

test('SKILL.md body stays under the line budget', () => {
  const lines = body.split('\n').length;
  assert.ok(lines < MAX_BODY_LINES, `SKILL.md body is ${lines} lines, limit is ${MAX_BODY_LINES}`);
});

test('SKILL.md follows the canonical section order', () => {
  const headings = body.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim());
  assert.deepEqual(headings, [
    'Contents',
    'Use when',
    'First-hop references',
    'Workflow',
    'Inputs and outputs',
    'Validation loops',
    'Guardrails',
  ]);
});

test('every file over the TOC threshold has a Contents heading', () => {
  for (const file of markdownFiles(SKILL_DIR)) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n').length;
    if (lines <= TOC_THRESHOLD) continue;
    assert.ok(
      /^## Contents$/m.test(text),
      `${path.relative(SKILL_DIR, file)} is ${lines} lines and needs a "## Contents" heading`,
    );
    assert.ok(
      !/table of contents/i.test(text),
      `${path.relative(SKILL_DIR, file)} must use "Contents", not "Table of contents"`,
    );
  }
});

test('no Windows-style paths in markdown links', () => {
  for (const file of markdownFiles(SKILL_DIR)) {
    const text = fs.readFileSync(file, 'utf8');
    const bad = text.match(/\]\([^)]*\\[^)]*\)/g);
    assert.equal(bad, null, `${path.relative(SKILL_DIR, file)} has a backslash path: ${bad}`);
  }
});

test('every first-hop reference link resolves to a real file', () => {
  SKILL_REFERENCE_RE.lastIndex = 0;
  const links = [...body.matchAll(SKILL_REFERENCE_RE)].map((m) => m[1].split('#')[0].split(/\s/)[0]);
  assert.ok(links.length >= 6, 'expected the reference list to be linked from SKILL.md');
  for (const link of new Set(links)) {
    assert.ok(fs.existsSync(path.join(SKILL_DIR, link)), `SKILL.md links to a missing file: ${link}`);
  }
});

test('references are one hop deep — no reference links to another reference', () => {
  const refsDir = path.join(SKILL_DIR, 'references');
  for (const file of markdownFiles(refsDir)) {
    const text = fs.readFileSync(file, 'utf8');
    const nested = [...text.matchAll(/\]\((\.\/)?references\/[^)]+\)/g)];
    assert.equal(nested.length, 0, `${path.basename(file)} links deeper into references/`);
  }
});

test('every script named in SKILL.md exists', () => {
  SKILL_SCRIPT_RE.lastIndex = 0;
  const scripts = [...raw.matchAll(SKILL_SCRIPT_RE)].map((m) => m[1]);
  assert.ok(scripts.length >= 3, 'SKILL.md should name its scripts');
  for (const script of new Set(scripts)) {
    assert.ok(
      fs.existsSync(path.join(SKILL_DIR, 'scripts', script)),
      `SKILL.md names a missing script: ${script}`,
    );
  }
});

test('guardrails state the git prohibition and the no-guessing rule', () => {
  const guardrails = body.split('## Guardrails')[1] || '';
  assert.match(guardrails, /MUST NOT run `git commit`/);
  assert.match(guardrails, /MUST NOT fuzzy-match/);
});

test('capture completion requires governed unpublished Figma review and forbids Code Connect', () => {
  const capture = body.split('### Action: capture')[1]?.split('## Inputs and outputs')[0] || '';
  assert.match(capture, /figmaPromotion/);
  assert.match(capture, /writeCapabilityRequired: true/);
  assert.match(capture, /codeTestCommand/);
  assert.match(capture, /pnpm test:code/);
  assert.match(capture, /publicationStatus: "unpublished"/);
  assert.match(capture, /adversarial pass/);
  assert.match(capture, /design pass/);
  assert.match(capture, /code complete, Figma promotion blocked/);
  assert.match(capture, /do not create a Code Connect template/);
  assert.match(capture, /pnpm figma:coverage/);
  assert.match(capture, /pnpm figma:validate/);
  assert.match(capture, /REST token is read-only validation and does not satisfy this requirement/);
});

test('validation loops state a numeric retry cap', () => {
  const loops = body.split('## Validation loops')[1]?.split('## Guardrails')[0] || '';
  assert.match(loops, /Cap: 3 attempts/, 'the retry cap must be stated inline, not deferred');
});

test('the skill ships no real home-directory paths', () => {
  // Documentation legitimately shows absolute paths; these stand-ins are the only
  // home-directory names allowed, so a real developer or client path is caught.
  const PLACEHOLDERS = new Set(['you', 'me', 'user', 'username', 'your-name']);
  for (const file of markdownFiles(SKILL_DIR)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const [, name] of text.matchAll(/\/(?:Users|home)\/([A-Za-z0-9._-]+)\//g)) {
      assert.ok(
        PLACEHOLDERS.has(name.toLowerCase()),
        `${path.relative(SKILL_DIR, file)} contains a real home-directory path: /Users/${name}/`,
      );
    }
  }
});
