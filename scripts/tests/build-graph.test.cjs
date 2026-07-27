'use strict';

// Tests for the knowledge-graph builder. Two modes:
//   - a synthetic fixture repo (fixtures/fake-graph-repo/) built via build({ repoRoot }),
//     which is how the negative cases are exercised without touching the real tree;
//   - the real repo, for the invariants that only mean something at full scale.
//
// The fixture is invisible to the real build: typeOf() returns null for anything under
// scripts/tests/fixtures/, which is what makes a graph test of a graph builder safe.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  build,
  render,
  renderConnections,
  danglingEdges,
  extractSkillReferences,
  extractSkillScripts,
  extractTestTargets,
  extractRequires,
} = require('../graph/build-graph.cjs');

const FIXTURE = path.join(__dirname, 'fixtures', 'fake-graph-repo');
const SKILL = 'skills/project-retrospective';

const byType = (graph, type) => graph.nodes.filter((n) => n.type === type).map((n) => n.id);
const edgesOf = (graph, type) => graph.edges.filter((e) => e.type === type);

/** Copy the fixture repo to a temp dir so a test can break it. */
function brokenCopy(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-graph-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  mutate(dir);
  return build({ repoRoot: dir });
}

test('every file kind in the fixture becomes a node of the expected type', () => {
  const graph = build({ repoRoot: FIXTURE });
  assert.deepEqual(byType(graph, 'skill'), [`${SKILL}/SKILL.md`]);
  assert.deepEqual(byType(graph, 'skill-readme'), [`${SKILL}/README.md`]);
  assert.deepEqual(byType(graph, 'skill-reference'), [`${SKILL}/references/alpha.md`]);
  assert.deepEqual(byType(graph, 'skill-script'), [`${SKILL}/scripts/alpha.cjs`]);
  assert.deepEqual(byType(graph, 'authoring-spec'), ['skills/_meta/_sections.md']);
  assert.deepEqual(byType(graph, 'repo-script'), ['scripts/graph/thing.cjs']);
  assert.deepEqual(byType(graph, 'test').sort(), ['scripts/tests/alpha.test.cjs', 'scripts/tests/helpers.cjs']);
  assert.deepEqual(byType(graph, 'root-doc').sort(), ['AGENTS.md', 'README.md']);
  assert.deepEqual(byType(graph, 'wiki-journal'), ['wiki/journal/2026-01-01-entry.md']);
  assert.deepEqual(byType(graph, 'wiki-topic'), ['wiki/topics/demo.md']);
  assert.deepEqual(byType(graph, 'wiki-plan'), ['wiki/plans/2026-01-01-plan.md']);
  assert.deepEqual(byType(graph, 'wiki-index'), ['wiki/INDEX.md']);
});

test('node ids are repo-relative when a repoRoot override is passed', () => {
  // Regression: rel() used to close over the module-level REPO_ROOT, so a fixture build
  // silently produced ../../../tmp/... ids instead of failing.
  const graph = build({ repoRoot: FIXTURE });
  const bad = graph.nodes.filter((n) => n.id.startsWith('..') || path.isAbsolute(n.id));
  assert.deepEqual(bad, [], 'no node id should escape the supplied repo root');
});

test('scripts and tests are labelled by filename, path-qualified for repo scripts', () => {
  const graph = build({ repoRoot: FIXTURE });
  const label = (id) => graph.nodes.find((n) => n.id === id).label;
  assert.equal(label(`${SKILL}/scripts/alpha.cjs`), 'alpha.cjs');
  assert.equal(label('scripts/tests/alpha.test.cjs'), 'alpha.test.cjs');
  assert.equal(label('scripts/graph/thing.cjs'), 'graph/thing.cjs');
});

test('SKILL.md declares a contracts edge to every reference and script it names', () => {
  const graph = build({ repoRoot: FIXTURE });
  const targets = edgesOf(graph, 'contracts').map((e) => e.target).sort();
  assert.deepEqual(targets, [`${SKILL}/references/alpha.md`, `${SKILL}/scripts/alpha.cjs`]);
  assert.ok(edgesOf(graph, 'contracts').every((e) => e.source === `${SKILL}/SKILL.md`));
});

test('a reference SKILL.md links but that is not on disk dangles the build', () => {
  const graph = brokenCopy((dir) => fs.rmSync(path.join(dir, SKILL, 'references/alpha.md')));
  const dangling = danglingEdges(graph);
  assert.equal(dangling.length, 1);
  assert.equal(dangling[0].type, 'contracts');
  assert.equal(dangling[0].target, `${SKILL}/references/alpha.md`);
});

test('a script SKILL.md names but that is not on disk dangles the build', () => {
  const graph = brokenCopy((dir) => fs.rmSync(path.join(dir, SKILL, 'scripts/alpha.cjs')));
  const types = danglingEdges(graph).map((e) => e.type).sort();
  // Caught independently by the skill contract and by the topic that declares it covered.
  assert.deepEqual(types, ['contracts', 'covers']);
});

test('a topic covering a surface that moved dangles the build', () => {
  const graph = brokenCopy((dir) => {
    const p = path.join(dir, 'wiki/topics/demo.md');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('alpha.cjs', 'gone.cjs'));
  });
  const dangling = danglingEdges(graph);
  assert.equal(dangling.length, 1);
  assert.equal(dangling[0].type, 'covers');
});

test('the catalog repo path named in SKILL.md never becomes a local contracts edge', () => {
  // SKILL.md cites the brain's scripts/graph/build-graph.cjs. `[a-z-]+` cannot cross the
  // slash in `graph/build-graph.cjs`, so it is ignored. Widening that class would emit an
  // edge into this repo's skill scripts that can never resolve.
  const skill = fs.readFileSync(path.join(FIXTURE, SKILL, 'SKILL.md'), 'utf8');
  assert.match(skill, /scripts\/graph\/build-graph\.cjs/, 'the fixture must contain the citation');
  assert.deepEqual(extractSkillScripts(skill), [`${SKILL}/scripts/alpha.cjs`]);
});

test('SKILL.md script names are found despite living in fenced code blocks', () => {
  // The donor's extractors are fence-aware and reject angle brackets, so a faithful port
  // would have produced a contract gate that silently gated nothing.
  const skill = fs.readFileSync(path.join(FIXTURE, SKILL, 'SKILL.md'), 'utf8');
  assert.ok(skill.includes('```bash'), 'the fixture must name its script inside a fence');
  assert.equal(extractSkillScripts(skill).length, 1);
  assert.equal(extractSkillReferences(skill).length, 1);
});

test('the authoring spec is a node but its inline-code placeholder makes no edge', () => {
  const graph = build({ repoRoot: FIXTURE });
  const spec = 'skills/_meta/_sections.md';
  assert.ok(graph.nodes.some((n) => n.id === spec));
  const outgoing = edgesOf(graph, 'links-to').filter((e) => e.source === spec);
  // The `[README.md](README.md)` example would resolve to skills/_meta/README.md, which is
  // not a node; the real ../../AGENTS.md link is kept.
  assert.deepEqual(outgoing.map((e) => e.target), ['AGENTS.md']);
});

test('a test file links to the script it spawns through the helper', () => {
  const graph = build({ repoRoot: FIXTURE });
  assert.deepEqual(
    edgesOf(graph, 'tests').map((e) => [e.source, e.target]),
    [['scripts/tests/alpha.test.cjs', `${SKILL}/scripts/alpha.cjs`]],
  );
});

test('the tests extractor reads helper calls, not every filename it can see', () => {
  const spawn = ['run(', "'beta.cjs')"].join('');
  assert.deepEqual(extractTestTargets(spawn), ['beta.cjs']);
  // A require specifier is a path, so it never registers as a spawned script.
  assert.deepEqual(extractTestTargets("require('../graph/build-graph.cjs')"), []);
  // A filename merely discussed in an assertion is not a surface under test. Getting this
  // wrong invented edges to files that never existed.
  assert.deepEqual(extractTestTargets("assert.equal(label, 'gamma.cjs')"), []);
});

test('only the suite that lints the real skill claims SKILL.md as a surface', () => {
  // Regression: a bare 'SKILL.md' literal also matched this file, which joins its own
  // fixture root with the same name — inventing an edge saying the graph builder's tests
  // cover the skill contract.
  const graph = build();
  const claimants = edgesOf(graph, 'tests').filter((e) => e.target === `${SKILL}/SKILL.md`).map((e) => e.source);
  assert.deepEqual(claimants, ['scripts/tests/skill-conformance.test.cjs']);
});

test('link titles and anchors are stripped from declared references', () => {
  assert.deepEqual(extractSkillReferences('[x](references/foo.md "Title")'), [`${SKILL}/references/foo.md`]);
  assert.deepEqual(extractSkillReferences('[x](references/foo.md#anchor)'), [`${SKILL}/references/foo.md`]);
});

test('the plan sentinels are not treated as paths', () => {
  // `pending` is what the merge automation writes; treating it as a path would dangle
  // the build forever, and it sits next to `pr: pending` in the same frontmatter block.
  for (const sentinel of ['none', 'pending']) {
    const graph = brokenCopy((dir) => {
      const p = path.join(dir, 'wiki/journal/2026-01-01-entry.md');
      fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('plans/2026-01-01-plan.md', sentinel));
    });
    assert.deepEqual(edgesOf(graph, 'plan'), [], `plan: ${sentinel} must emit no edge`);
    assert.deepEqual(danglingEdges(graph), [], `plan: ${sentinel} must not dangle`);
  }
});

test('topic and plan edges resolve from wiki frontmatter', () => {
  const graph = build({ repoRoot: FIXTURE });
  assert.deepEqual(
    edgesOf(graph, 'plan').map((e) => [e.source, e.target]),
    [['wiki/journal/2026-01-01-entry.md', 'wiki/plans/2026-01-01-plan.md']],
  );
  assert.ok(edgesOf(graph, 'topic').some((e) => e.target === 'wiki/topics/demo.md'));
});

test('a module links to the modules it requires, and bare specifiers are ignored', () => {
  const graph = build({ repoRoot: FIXTURE });
  assert.deepEqual(
    edgesOf(graph, 'requires').map((e) => [e.source, e.target]),
    [['scripts/tests/alpha.test.cjs', 'scripts/tests/helpers.cjs']],
  );
  // Assembled rather than written literally: this file is itself indexed, so a literal
  // require(...) in an assertion would be read as a real dependency and dangle the build.
  const req = (spec) => `require('${spec}')`;
  assert.deepEqual(extractRequires('scripts/a/b.cjs', `${req('node:fs')}; ${req('graphology')}`), []);
  assert.deepEqual(extractRequires('scripts/a/b.cjs', req('../c/d.cjs')), ['scripts/c/d.cjs']);
});

test('a require that does not resolve dangles the build', () => {
  const graph = brokenCopy((dir) => fs.rmSync(path.join(dir, 'scripts/tests/helpers.cjs')));
  const dangling = danglingEdges(graph);
  assert.equal(dangling.length, 1);
  assert.equal(dangling[0].type, 'requires');
});

test('no node is stranded except the known standalone ones', () => {
  // Before the requires pass, 18 of 55 nodes had degree 0 and `pnpm graph:navigate` returned
  // no-route for any script, which fails open into exactly the broad read it should prevent.
  // CLAUDE.md is a bare `@AGENTS.md` import shim with no markdown link to resolve. Anything
  // else appearing here is a real gap: wire it, or add it with a reason.
  const ALLOWED = ['CLAUDE.md'];
  const stranded = build().nodes.filter((n) => n.degree === 0).map((n) => n.id);
  assert.deepEqual(stranded, ALLOWED);
});

test('every node and edge type the builder emits is renderable by the viewer', () => {
  // The viewer's colour/label tables were the one declared surface with no automated
  // coupling: adding a node type silently produced a grey node with no legend row.
  const viewer = fs.readFileSync(path.join(__dirname, '..', 'graph', 'viewer', 'viewer.js'), 'utf8');
  const keysOf = (table) => {
    const body = viewer.split(`const ${table} = {`)[1].split('};')[0];
    return new Set([...body.matchAll(/^\s*"?([a-zA-Z-]+)"?\s*:/gm)].map((m) => m[1]));
  };
  const graph = build();
  const colors = keysOf('TYPE_COLORS');
  const labels = keysOf('TYPE_LABELS');
  const edgeColors = keysOf('EDGE_COLORS');
  for (const type of Object.keys(graph.counts.byType)) {
    assert.ok(colors.has(type), `viewer TYPE_COLORS is missing node type ${type}`);
    assert.ok(labels.has(type), `viewer TYPE_LABELS is missing node type ${type}`);
  }
  for (const type of Object.keys(graph.counts.byEdgeType)) {
    assert.ok(edgeColors.has(type), `viewer EDGE_COLORS is missing edge type ${type}`);
  }
});

test('the graph gate and the conformance lint share one definition of the contract', () => {
  const conformance = fs.readFileSync(path.join(__dirname, 'skill-conformance.test.cjs'), 'utf8');
  assert.match(conformance, /require\('\.\.\/graph\/build-graph\.cjs'\)/);
  assert.doesNotMatch(conformance, /\/scripts\\\/\(\[a-z/, 'the conformance test must import the regex, not re-declare it');
});

test('fixtures never leak into the real graph', () => {
  const graph = build();
  const leaked = graph.nodes.filter((n) => n.id.includes('scripts/tests/fixtures/'));
  assert.deepEqual(leaked, [], 'synthetic fixtures must not be indexed');
});

test('the real repo graph has no dangling edge', () => {
  assert.deepEqual(danglingEdges(build()).map((e) => `${e.type} ${e.source} -> ${e.target}`), []);
});

test('references stay one hop deep — no reference links to another reference', () => {
  // Progressive disclosure, proved structurally rather than asserted in prose.
  const graph = build();
  const type = new Map(graph.nodes.map((n) => [n.id, n.type]));
  const nested = edgesOf(graph, 'links-to').filter(
    (e) => type.get(e.source) === 'skill-reference' && type.get(e.target) === 'skill-reference',
  );
  assert.deepEqual(nested, []);
});

test('the build is deterministic and carries no timestamp', () => {
  assert.equal(render(build()), render(build()));
  assert.equal(JSON.stringify(renderConnections(build())), JSON.stringify(renderConnections(build())));
  assert.ok(!/generatedAt|timestamp/i.test(render(build())));
});

test('nodes and edges are sorted, so diffs stay reviewable', () => {
  const graph = build();
  const ids = graph.nodes.map((n) => n.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => a.localeCompare(b)));
  const sorted = [...graph.edges].sort(
    (a, b) => a.type.localeCompare(b.type) || a.source.localeCompare(b.source) || a.target.localeCompare(b.target),
  );
  assert.deepEqual(
    graph.edges.map((e) => `${e.type}|${e.source}|${e.target}`),
    sorted.map((e) => `${e.type}|${e.source}|${e.target}`),
  );
});

test('renderConnections produces exactly the index plus four section files', () => {
  assert.deepEqual(Object.keys(renderConnections(build())).sort(), [
    'wiki/connections.md',
    'wiki/connections/contract.md',
    'wiki/connections/coverage.md',
    'wiki/connections/links.md',
    'wiki/connections/wiki-wiring.md',
  ]);
});

test('an empty repo produces an empty graph rather than failing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-graph-empty-'));
  const graph = build({ repoRoot: dir });
  assert.deepEqual(graph.nodes, []);
  assert.deepEqual(graph.edges, []);
});
