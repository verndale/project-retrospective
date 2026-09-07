'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, runJson, fixture } = require('./helpers.cjs');

// fake-project carries artifacts/memory/design-system.md plus an artifacts/MEMORY.md index
// (the index is navigation, not memory content, so it is intentionally not archived).
const PROJECT = fixture('fake-project');

function archive(args) {
  return runJson('archive-memory.cjs', args);
}

/** Build a throwaway project tree and return its path; caller removes it. */
function tempProject(build) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-archive-'));
  build((rel, contents) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), contents, 'utf8');
  });
  return dir;
}

test('a record-only run (no --archive) lists memory but copies nothing', () => {
  const r = archive(['--project', PROJECT]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.json.status, 'skipped-no-data');
  assert.deepEqual(r.json.files, ['design-system.md']);
  assert.equal(r.json.destination, null);
});

test('--archive copies the memory near-raw and reports archived', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-dest-'));
  try {
    const source = path.join(dest, 'source');
    const r = archive(['--project', PROJECT, '--archive', source]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.status, 'archived');
    assert.ok(r.json.files.length >= 1, 'expected files to be archived');
    assert.ok(r.json.counts.bytes > 0, 'expected a non-zero byte count');
    // The bytes actually landed on disk.
    assert.ok(fs.existsSync(path.join(source, 'design-system.md')));
    // The MEMORY.md index is navigation, not memory content — it must not be archived.
    assert.ok(!fs.existsSync(path.join(source, 'MEMORY.md')), 'the MEMORY.md index must not be archived');
  } finally {
    fs.rmSync(dest, { recursive: true, force: true });
  }
});

test('a project with no memory reports no-memory, not a crash', () => {
  const proj = tempProject((w) => w('package.json', '{}\n'));
  try {
    const r = archive(['--project', proj]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.status, 'no-memory');
    assert.deepEqual(r.json.files, []);
    assert.ok(r.json.warnings.map((wn) => wn.code).includes('no-memory'));
  } finally {
    fs.rmSync(proj, { recursive: true, force: true });
  }
});

test('a missing --project exits 2 with usage', () => {
  const r = run('archive-memory.cjs', []);
  assert.equal(r.status, 2);
});

test('a --project that is not a directory exits 3', () => {
  const r = run('archive-memory.cjs', ['--project', fixture('fake-project', 'build.config.json')]);
  assert.equal(r.status, 3);
});

test('the artifacts root is read from build.config.json and nesting is preserved', () => {
  // The root folder is project-configurable; a non-"artifacts" root and a nested
  // component shard both have to survive the walk and the copy.
  const proj = tempProject((w) => {
    w('build.config.json', JSON.stringify({ artifactsRoot: 'dist/artifacts' }));
    w('dist/artifacts/memory/architecture.md', '# Architecture\n\n- App Router, RSC by default\n');
    w('dist/artifacts/memory/components/hero.md', '# Hero\n\n- full-bleed background image\n');
  });
  try {
    const source = path.join(proj, '__out__', 'source');
    const r = archive(['--project', proj, '--archive', source]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.artifactsRoot, 'dist/artifacts');
    assert.equal(r.json.status, 'archived');
    assert.deepEqual(r.json.files, ['architecture.md', 'components/hero.md']);
    assert.ok(fs.existsSync(path.join(source, 'components', 'hero.md')), 'nested shard must be preserved');
  } finally {
    fs.rmSync(proj, { recursive: true, force: true });
  }
});

test('empty/placeholder shards are skipped, not archived', () => {
  const proj = tempProject((w) => {
    w('build.config.json', JSON.stringify({ artifactsRoot: 'artifacts' }));
    // A migration skeleton: frontmatter + heading + comment, no real content.
    w('artifacts/memory/architecture.md', '---\ntopic: architecture\n---\n# Architecture\n<!-- placeholder -->\n');
    w('artifacts/memory/design-system.md', '# Design system\n\n- use the --color-* tokens\n');
  });
  try {
    const dest = path.join(proj, '__out__', 'source');
    const r = archive(['--project', proj, '--archive', dest]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.status, 'archived');
    assert.deepEqual(r.json.files, ['design-system.md']);
    assert.deepEqual(r.json.skippedEmpty, ['architecture.md']);
    assert.ok(!fs.existsSync(path.join(dest, 'architecture.md')), 'the empty shard must not be copied');
    assert.ok(fs.existsSync(path.join(dest, 'design-system.md')));
    assert.ok(r.json.warnings.map((wn) => wn.code).includes('empty-memory-skipped'));
  } finally {
    fs.rmSync(proj, { recursive: true, force: true });
  }
});

test('a project whose memory is all placeholders reports no-memory', () => {
  const proj = tempProject((w) => {
    w('artifacts/memory/architecture.md', '---\ntopic: architecture\n---\n# Architecture\n<!-- todo -->\n');
    w('artifacts/MEMORY.md', '# Project Memory\n<!-- index only -->\n');
  });
  try {
    const r = archive(['--project', proj]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.status, 'no-memory');
    assert.deepEqual(r.json.files, []);
    // MEMORY.md is ignored entirely (not memory content) — neither archived nor skipped;
    // only the placeholder shard is reported in skippedEmpty.
    assert.deepEqual(r.json.skippedEmpty, ['architecture.md']);
  } finally {
    fs.rmSync(proj, { recursive: true, force: true });
  }
});

test('memory archive never follows root or nested symlinks outside the pinned project', () => {
  for (const surface of ['artifacts', 'memory', 'nested-file', 'nested-directory']) {
    const proj = tempProject((w) => w('package.json', '{}\n'));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-archive-outside-'));
    fs.mkdirSync(path.join(outside, 'memory', 'nested'), { recursive: true });
    fs.writeFileSync(path.join(outside, 'memory', 'outside.md'), '# Outside\n\n- must not be archived\n');
    fs.writeFileSync(path.join(outside, 'memory', 'nested', 'outside.md'), '# Outside nested\n\n- must not be archived\n');
    fs.mkdirSync(path.join(proj, 'artifacts', 'memory'), { recursive: true });

    if (surface === 'artifacts') {
      fs.rmSync(path.join(proj, 'artifacts'), { recursive: true });
      fs.symlinkSync(outside, path.join(proj, 'artifacts'), 'dir');
    } else if (surface === 'memory') {
      fs.rmSync(path.join(proj, 'artifacts', 'memory'), { recursive: true });
      fs.symlinkSync(path.join(outside, 'memory'), path.join(proj, 'artifacts', 'memory'), 'dir');
    } else if (surface === 'nested-file') {
      fs.symlinkSync(
        path.join(outside, 'memory', 'outside.md'),
        path.join(proj, 'artifacts', 'memory', 'outside.md'),
      );
    } else {
      fs.symlinkSync(
        path.join(outside, 'memory', 'nested'),
        path.join(proj, 'artifacts', 'memory', 'nested'),
        'dir',
      );
    }

    try {
      const dest = path.join(proj, '__out__', 'source');
      const r = archive(['--project', proj, '--archive', dest]);
      assert.equal(r.status, 0, `${surface}: ${r.stderr}`);
      assert.equal(r.json.status, 'no-memory', surface);
      assert.deepEqual(r.json.files, [], surface);
      assert.ok(r.json.warnings.some((warning) => warning.code === 'source-symlink-skipped'), surface);
      assert.ok(!fs.existsSync(path.join(dest, 'outside.md')), surface);
      assert.ok(!fs.existsSync(path.join(dest, 'nested', 'outside.md')), surface);
    } finally {
      fs.rmSync(proj, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  }
});
