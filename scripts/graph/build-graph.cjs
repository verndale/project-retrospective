#!/usr/bin/env node
"use strict";

// Knowledge-graph builder for @verndale/project-retrospective. Walks the repo and emits a
// typed node/edge graph to scripts/graph/data/graph.json for the interactive viewer
// (scripts/graph/viewer/).
//
// Nodes  = knowledge units, one per file: the skill entry point, its operator README,
//          each reference and script it ships, the authoring spec, the root docs, the
//          repo tooling, the tests, and the context-wiki pages.
// Edges  = relationships already latent in the content:
//   contracts  SKILL.md -> every references/*.md it links and every scripts/*.cjs it names
//   tests      a test file -> the script (or SKILL.md) it exercises
//   links-to   relative markdown link between two node files (count = weight)
//   topic      a wiki page -> topics/<slug>.md (from frontmatter `topics:`)
//   plan       a wiki journal entry -> its archived plan (from frontmatter `plan:`)
//   covers     a wiki topic -> the runtime surfaces declared in its `covers:` metadata
//
// `contracts` is this repo's integrity gate. The catalog repo validates its manifest
// against the pattern files it lists; this repo has no catalog, so the equivalent
// declaration is the skill's own contract. Those edges are emitted whether or not the
// target exists, so a renamed reference or a script named in SKILL.md that is not on disk
// becomes a dangling edge and fails the build. `tests`, `topic`, `plan`, and `covers`
// are emitted the same way, for the same reason.
//
// Everything is derived deterministically from the files — no guessing, no LLM.
// Output is timestamp-free so a rebuild only diffs when the content graph changes.
// Reuses the flat-frontmatter reader from scripts/wiki/lib/frontmatter.cjs.

const fs = require("fs");
const path = require("path");
const frontmatter = require("../wiki/lib/frontmatter.cjs");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUT_FILE = path.join(__dirname, "data", "graph.json");

// The skill this repo exists to publish, and the surfaces SKILL.md declares.
const SKILL_ROOT = "skills/project-retrospective";
const REFERENCES_PREFIX = `${SKILL_ROOT}/references/`;
const SKILL_SCRIPTS_PREFIX = `${SKILL_ROOT}/scripts/`;
const SKILL_ID = `${SKILL_ROOT}/SKILL.md`;

// Authoring-only spec. walk() skips _meta/ wholesale (it is never runtime content), so
// this one file is added explicitly — topics declare it in `covers:` and it is the
// authority for SKILL.md's structure, which makes it worth navigating to.
const AUTHORING_SPEC_ID = "skills/_meta/_sections.md";

// Repo tooling and its tests. Fixtures are synthetic inputs, not knowledge: indexing them
// would add a dozen nodes and turn their markdown into phantom links-to edges.
const TOOLING_DIRS = ["scripts/graph", "scripts/wiki", "scripts/evals", "scripts/commit-pr"];
const TESTS_DIR = "scripts/tests";
const FIXTURES_PREFIX = `${TESTS_DIR}/fixtures/`;

// The generated connections pages (a view of the graph, rendered into the wiki as a small
// index at wiki/connections.md plus per-section files under wiki/connections/). Excluded
// from the graph itself — otherwise their many links would become links-to edges, making
// them mega-nodes and coupling the graph to its own view.
const CONNECTIONS_INDEX_ID = "wiki/connections.md";
const CONNECTIONS_DIR_ID = "wiki/connections";
const isConnectionsView = (id) => id === CONNECTIONS_INDEX_ID || id.startsWith(`${CONNECTIONS_DIR_ID}/`);

// Root docs promoted to their own node type. CHANGELOG.md is intentionally excluded —
// semantic-release rewrites it every release, which would churn the graph for no signal.
const ROOT_DOCS = new Set(["AGENTS.md", "README.md", "CONTRIBUTING.md", "CLAUDE.md"]);

const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;
const FENCE_RE = /^```/;
const H1_RE = /^#\s+(.+?)\s*$/;
const PR_RE = /github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/g;
const ISSUE_RE = /github\.com\/[^/]+\/[^/]+\/issues\/(\d+)/g;

// The two extractors below deliberately mirror scripts/tests/skill-conformance.test.cjs
// character for character. That test already asserts these same two sets exist on disk;
// reusing its regexes keeps the graph gate and the lint gate from ever disagreeing about
// what SKILL.md declares. Two properties are load-bearing and easy to break by "improving"
// them:
//   - SKILL.md names its scripts as `<skill>/scripts/inventory.cjs` inside fenced bash
//     blocks, so any fence-aware or angle-bracket-rejecting extractor finds nothing.
//   - SKILL.md also cites the catalog repo's `scripts/graph/build-graph.cjs`. `[a-z-]+`
//     cannot cross the `/` in `graph/build-graph.cjs`, so that path is correctly ignored
//     instead of being mistaken for a local skill script that will never exist.
const SKILL_REFERENCE_RE = /\]\((references\/[^)]+)\)/g;
const SKILL_SCRIPT_RE = /scripts\/([a-z-]+\.cjs)/g;

// The scripts a suite actually spawns. Anchored on the helper call rather than on any
// quoted filename: scripts/tests/helpers.cjs resolves run()'s first argument against
// skills/project-retrospective/scripts/, so this reads a contract rather than guessing.
// A bare filename regex was tried first and was wrong — a test that merely *mentions* a
// filename in an assertion (as the graph builder's own tests do) invented edges to files
// that never existed.
const TEST_RUN_RE = /\b(?:run|runJson)\(\s*['"]([A-Za-z0-9._-]+\.cjs)['"]/g;
// The conformance suite lints SKILL.md itself rather than spawning a CLI, so the one
// markdown surface under test is recognised by its literal.
const TEST_SKILL_RE = /['"]SKILL\.md['"]/;

// NUL joins the (source, target) halves of an internal edge key so a node id that ever
// contained a space could never mis-split it (matches routing.cjs's edgeKey separator).
const EDGE_KEY_SEP = String.fromCharCode(0);

const toPosix = (p) => p.split(path.sep).join("/");
// Always take the root explicitly. build() accepts a repoRoot override so tests can build
// a synthetic fixture repo; a helper that closed over the module-level REPO_ROOT would
// silently emit `../../../tmp/...` ids for those builds instead of failing.
const relTo = (repoRoot, abs) => toPosix(path.relative(repoRoot, abs));
const rel = (abs) => relTo(REPO_ROOT, abs);

// Same skip rules as link resolution: external, anchors, template vars, placeholders.
function isSkippable(target) {
  return (
    target === "" ||
    target.startsWith("#") ||
    /^(https?:|mailto:)/.test(target) ||
    target.includes("${") ||
    target.includes("<") ||
    target.includes("...") ||
    target.startsWith("/")
  );
}

// Recursively collect files under `target` (a dir or file), excluding node_modules,
// dotfiles, and the authoring-only _meta/ templates (never runtime content).
function walk(target, exts) {
  let stat;
  try {
    stat = fs.statSync(target);
  } catch {
    return [];
  }
  if (stat.isFile()) return exts.some((e) => target.endsWith(e)) ? [target] : [];
  const out = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "_meta" || entry.name.startsWith(".")) continue;
    const p = path.join(target, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, exts));
    else if (entry.isFile() && exts.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}

// Map a repo-relative posix path to a node type, or null to skip it.
function typeOf(r) {
  if (ROOT_DOCS.has(r)) return "root-doc";
  if (r === AUTHORING_SPEC_ID) return "authoring-spec";

  if (r.startsWith(`${SKILL_ROOT}/`)) {
    if (r === SKILL_ID) return "skill";
    if (r === `${SKILL_ROOT}/README.md`) return "skill-readme";
    if (r.startsWith(REFERENCES_PREFIX) && r.endsWith(".md")) return "skill-reference";
    if (r.startsWith(SKILL_SCRIPTS_PREFIX) && r.endsWith(".cjs")) return "skill-script";
    return null;
  }

  if (r.startsWith(FIXTURES_PREFIX)) return null;
  if (r.startsWith(`${TESTS_DIR}/`) && r.endsWith(".cjs")) return "test";
  if (TOOLING_DIRS.some((d) => r.startsWith(`${d}/`)) && r.endsWith(".cjs")) return "repo-script";

  if (r.startsWith("wiki/")) {
    if (!r.endsWith(".md")) return null;
    const base = path.basename(r);
    if (base === "INDEX.md" || base === "MECHANICS.md") return "wiki-index";
    if (r.startsWith("wiki/journal/")) return "wiki-journal";
    if (r.startsWith("wiki/topics/")) return "wiki-topic";
    if (r.startsWith("wiki/plans/")) return "wiki-plan"; // plans/INDEX.md is caught by the base check above
    return "wiki-index";
  }
  return null;
}

// Scripts and tests carry no H1 and no frontmatter, so their label is their filename —
// path-qualified under scripts/ so `graph/build-graph.cjs` never reads as a skill script.
function extractLabel(id, type, text) {
  if (type === "skill") {
    const name = frontmatter.readField(text, "name");
    if (name) return name;
  }
  if (type === "repo-script") return toPosix(path.relative("scripts", id));
  if (type === "skill-script" || type === "test") return path.basename(id);
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(H1_RE);
    if (m) return m[1].replace(/`/g, "");
  }
  return path.basename(id);
}

// Extract resolvable relative markdown-link targets (repo-relative posix), skipping
// fenced code blocks and non-local targets.
function extractLinks(absFile, text, repoRoot = REPO_ROOT) {
  const targets = [];
  const lines = text.split(/\r?\n/);
  let fenced = false;
  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    LINK_RE.lastIndex = 0;
    let m;
    while ((m = LINK_RE.exec(line)) !== null) {
      const full = m[1].trim();
      const raw = full.split("#")[0].split(" ")[0];
      if (isSkippable(raw)) continue;
      const resolvedAbs = path.resolve(path.dirname(absFile), raw);
      targets.push({ target: relTo(repoRoot, resolvedAbs), anchor: full.includes("#") ? full.split("#")[1] : null });
    }
  }
  return targets;
}

// The references SKILL.md links, as repo-relative ids. Anchors are stripped; the raw text
// is scanned (not the fence-stripped body) because the reference list is prose, not code.
function extractSkillReferences(text) {
  const out = [];
  SKILL_REFERENCE_RE.lastIndex = 0;
  let m;
  while ((m = SKILL_REFERENCE_RE.exec(text)) !== null) {
    const id = `${SKILL_ROOT}/${m[1].split("#")[0].trim()}`;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

// The skill scripts SKILL.md names, as repo-relative ids.
function extractSkillScripts(text) {
  const out = [];
  SKILL_SCRIPT_RE.lastIndex = 0;
  let m;
  while ((m = SKILL_SCRIPT_RE.exec(text)) !== null) {
    const id = `${SKILL_SCRIPTS_PREFIX}${m[1]}`;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

// The surfaces a test exercises: each script it spawns through the helper, plus SKILL.md
// when it lints the skill contract directly.
function extractTestTargets(text) {
  const out = [];
  TEST_RUN_RE.lastIndex = 0;
  let m;
  while ((m = TEST_RUN_RE.exec(text)) !== null) if (!out.includes(m[1])) out.push(m[1]);
  if (TEST_SKILL_RE.test(text)) out.push("SKILL.md");
  return out;
}

function uniqueMatches(text, re) {
  const out = [];
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

function build({ repoRoot = REPO_ROOT } = {}) {
  const roots = [
    path.join(repoRoot, "skills"),
    path.join(repoRoot, "wiki"),
    ...TOOLING_DIRS.map((d) => path.join(repoRoot, d)),
    path.join(repoRoot, TESTS_DIR),
    ...[...ROOT_DOCS].map((d) => path.join(repoRoot, d)),
  ];
  const walked = roots.flatMap((rt) => walk(rt, [".md", ".cjs"]));
  const absFiles = [...new Set([...walked, path.join(repoRoot, AUTHORING_SPEC_ID)])];

  const nodes = new Map(); // id -> node
  const fileText = new Map(); // id -> raw text

  for (const abs of absFiles) {
    const id = relTo(repoRoot, abs);
    if (isConnectionsView(id)) continue; // the generated view is never a node in the graph
    const type = typeOf(id);
    if (!type) continue;
    let text;
    try {
      text = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    fileText.set(id, text);
    const isMd = id.endsWith(".md");
    nodes.set(id, {
      id,
      label: extractLabel(id, type, text),
      type,
      dir: toPosix(path.dirname(id)),
      topics: isMd ? frontmatter.readList(text, "topics") : [],
      aliases: isMd ? frontmatter.readList(text, "aliases") : [],
      prs: uniqueMatches(text, PR_RE),
      issues: uniqueMatches(text, ISSUE_RE),
      bytes: Buffer.byteLength(text, "utf8"),
      degree: 0,
    });
  }

  const edges = [];

  // 1. contracts — SKILL.md -> every reference it links and every script it names. Emitted
  //    whether or not the target resolves: that is the whole point. A reference renamed
  //    without updating SKILL.md, or a script SKILL.md instructs an agent to run that is
  //    not on disk, becomes a dangling edge and fails the build. This is the skill-contract
  //    validator, and it is this repo's analogue of the catalog repo's manifest gate.
  const skillText = fileText.get(SKILL_ID);
  if (skillText) {
    for (const target of [...extractSkillReferences(skillText), ...extractSkillScripts(skillText)]) {
      edges.push({ source: SKILL_ID, target, type: "contracts" });
    }
  }

  // 2. tests — a test file -> the script it spawns, or SKILL.md for the conformance suite.
  //    Resolve-only, unlike the passes around it. The gate value it would add is already
  //    carried by `contracts` (deleting a skill script fails there), while the false-
  //    positive risk is real: a suite that discusses a filename in an assertion would
  //    otherwise invent an edge to a file that never existed and fail the build forever.
  const testSeen = new Set();
  for (const [id, text] of fileText) {
    if (nodes.get(id)?.type !== "test") continue;
    for (const name of extractTestTargets(text)) {
      const target = name === "SKILL.md" ? SKILL_ID : `${SKILL_SCRIPTS_PREFIX}${name}`;
      if (target === id || !nodes.has(target)) continue;
      const key = `${id}${EDGE_KEY_SEP}${target}`;
      if (testSeen.has(key)) continue;
      testSeen.add(key);
      edges.push({ source: id, target, type: "tests" });
    }
  }

  // 3. links-to — relative markdown links between two known node files.
  const linkCounts = new Map(); // `${src} ${tgt}` -> {count, anchors:Set}
  for (const [id, text] of fileText) {
    if (!id.endsWith(".md")) continue;
    for (const { target, anchor } of extractLinks(path.join(repoRoot, id), text, repoRoot)) {
      if (target === id || !nodes.has(target)) continue;
      const key = `${id}${EDGE_KEY_SEP}${target}`;
      let entry = linkCounts.get(key);
      if (!entry) {
        entry = { count: 0, anchors: new Set() };
        linkCounts.set(key, entry);
      }
      entry.count += 1;
      if (anchor) entry.anchors.add(anchor);
    }
  }
  for (const [key, { count, anchors }] of linkCounts) {
    const [source, target] = key.split(EDGE_KEY_SEP);
    edges.push({ source, target, type: "links-to", count, anchors: [...anchors] });
  }

  // 4. topic / 5. plan / 6. covers — wiki frontmatter relations, all preserving unresolved
  //    targets so a stale topic slug, a moved plan, or a topic pointing at a surface that
  //    no longer exists fails loudly instead of being silently dropped. topics/covers are
  //    list-valued, so dedup identical (type, source, target) the way the passes above do.
  const wikiSeen = new Set();
  const pushWiki = (source, target, type) => {
    const key = `${type}${EDGE_KEY_SEP}${source}${EDGE_KEY_SEP}${target}`;
    if (wikiSeen.has(key)) return;
    wikiSeen.add(key);
    edges.push({ source, target, type });
  };
  for (const [id, text] of fileText) {
    if (!id.startsWith("wiki/")) continue;
    for (const slug of frontmatter.readList(text, "topics")) {
      const target = `wiki/topics/${slug}.md`;
      if (target !== id) pushWiki(id, target, "topic");
    }
    const planField = frontmatter.readField(text, "plan");
    if (planField && planField !== "none") {
      // Journal `plan:` is written wiki-relative (plans/...) or repo-relative (wiki/plans/...).
      const candidate = planField.startsWith("wiki/") ? planField : `wiki/${planField.replace(/^\.?\//, "")}`;
      if (candidate !== id) pushWiki(id, candidate, "plan");
    }
    if (nodes.get(id)?.type === "wiki-topic") {
      for (const target of frontmatter.readList(text, "covers")) pushWiki(id, target, "covers");
    }
  }

  // Degree.
  for (const e of edges) {
    if (nodes.has(e.source)) nodes.get(e.source).degree += 1;
    if (nodes.has(e.target)) nodes.get(e.target).degree += 1;
  }

  const nodeList = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  const edgeList = edges.sort(
    (a, b) => a.type.localeCompare(b.type) || a.source.localeCompare(b.source) || a.target.localeCompare(b.target),
  );

  const byType = {};
  for (const n of nodeList) byType[n.type] = (byType[n.type] || 0) + 1;
  const byEdge = {};
  for (const e of edgeList) byEdge[e.type] = (byEdge[e.type] || 0) + 1;

  return {
    counts: { nodes: nodeList.length, edges: edgeList.length, byType, byEdgeType: byEdge },
    nodes: nodeList,
    edges: edgeList,
  };
}

// Canonical serialization — the exact bytes graph:build writes. Shared with the
// graph-freshness eval so builder and checker never disagree on formatting.
function render(graph) {
  return JSON.stringify(graph, null, 2) + "\n";
}

// Coarse "area" for cross-subsystem filtering: the skill, the wiki, the repo tooling, and
// root docs. A links-to edge is a seam when its endpoints sit in different areas.
function areaOf(id) {
  if (id.startsWith("skills/")) return "skill";
  if (id.startsWith("wiki/")) return "wiki";
  if (id.startsWith("scripts/")) return "tooling";
  return "root";
}

// Render the graph as a set of human/agent-readable markdown pages: a small index at
// wiki/connections.md that routes to per-section files under wiki/connections/. Returns a
// { <repo-relative-posix-path>: <content> } map so a reader loads only the section its
// question needs. Node links from a section file resolve to the repo root via `../../<id>`
// (section files sit two levels down). Deterministic + timestamp-free, like render() above.
function renderConnections(graph) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const link = (id) => {
    const n = byId.get(id);
    const label = (n ? n.label : path.basename(id)).replace(/[[\]]/g, "");
    return `[${label}](../../${id})`;
  };
  const edgesOf = (t) => graph.edges.filter((e) => e.type === t);
  const finish = (lines) => lines.join("\n").replace(/\n*$/, "") + "\n";
  const bySource = (a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target);

  const head = (title, desc) => [
    `# Connections — ${title}`,
    "",
    desc,
    "",
    "Part of the [connections map](../connections.md), generated from the knowledge graph — **do not edit by hand**. Rebuilt on every `pnpm graph:build` and verified fresh by `pnpm evals:graph`.",
    "",
  ];

  // Skill contract — what SKILL.md declares, which is also what the build gate enforces.
  const contract = () => {
    const out = head(
      "Skill contract",
      "Every reference and script `SKILL.md` declares. These edges are the build's integrity gate: if one of these files goes missing, `pnpm graph:build` fails.",
    );
    const contracts = edgesOf("contracts").sort(bySource);
    const refs = contracts.filter((e) => e.target.startsWith(REFERENCES_PREFIX));
    const scripts = contracts.filter((e) => e.target.startsWith(SKILL_SCRIPTS_PREFIX));
    out.push(`## References (${refs.length})`, "");
    if (refs.length) for (const e of refs) out.push(`- ${link(e.target)}`);
    else out.push("_SKILL.md links no references._");
    out.push("", `## Scripts (${scripts.length})`, "");
    if (scripts.length) for (const e of scripts) out.push(`- ${link(e.target)}`);
    else out.push("_SKILL.md names no scripts._");
    return finish(out);
  };

  // Coverage — the four-surfaces view: what each test exercises, and what each topic covers.
  const coverage = () => {
    const out = head(
      "Coverage",
      "Which script each suite exercises, and which surfaces each wiki topic explains. Together these are the \"four surfaces move together\" rule, made visible.",
    );
    const testEdges = edgesOf("tests").sort(bySource);
    out.push("## Test → script", "");
    if (testEdges.length) {
      const sources = [...new Set(testEdges.map((e) => e.source))].sort();
      for (const s of sources) {
        const targets = testEdges.filter((e) => e.source === s).map((e) => e.target).sort();
        out.push(`- ${link(s)} → ${targets.map(link).join(", ")}`);
      }
    } else out.push("_No test coverage recorded yet._");
    const coversEdges = edgesOf("covers").sort(bySource);
    out.push("", "## Topic → covered surface", "");
    if (coversEdges.length) {
      const sources = [...new Set(coversEdges.map((e) => e.source))].sort();
      for (const s of sources) {
        const targets = coversEdges.filter((e) => e.source === s).map((e) => e.target).sort();
        out.push(`- ${link(s)} → ${targets.map(link).join(", ")}`);
      }
    } else out.push("_No topic declares a covered surface yet._");
    return finish(out);
  };

  // Document links — the prose mesh, and which of those links cross an area boundary.
  const links = () => {
    const out = head("Document links", "Relative markdown links between indexed documents, and which of them cross between the skill, the wiki, the tooling, and the root docs.");
    const linkEdges = edgesOf("links-to").sort(bySource);
    out.push("## All document links", "");
    if (linkEdges.length) {
      const sources = [...new Set(linkEdges.map((e) => e.source))].sort();
      for (const s of sources) {
        const targets = linkEdges.filter((e) => e.source === s).sort((a, b) => a.target.localeCompare(b.target));
        out.push(`- ${link(s)} → ${targets.map((e) => `${link(e.target)}${e.count > 1 ? ` (×${e.count})` : ""}`).join(", ")}`);
      }
    } else out.push("_No document links yet._");
    const seams = linkEdges.filter((e) => areaOf(e.source) !== areaOf(e.target));
    out.push("", "## Cross-area links (seams)", "");
    if (seams.length) for (const e of seams) out.push(`- ${link(e.source)} → ${link(e.target)}${e.count > 1 ? ` (×${e.count})` : ""}`);
    else out.push("_No cross-area links yet._");
    return finish(out);
  };

  // Wiki wiring — topics/plans/journal relations.
  const wikiWiring = () => {
    const out = head("Wiki wiring", "How the context wiki connects: journal → plan and page → topic.");
    const planEdges = edgesOf("plan").sort(bySource);
    out.push("## Journal → plan", "");
    if (planEdges.length) for (const e of planEdges) out.push(`- ${link(e.source)} → ${link(e.target)}`);
    else out.push("_No journal-to-plan links yet._");
    const topicEdges = edgesOf("topic").sort(bySource);
    out.push("", "## Page → topic", "");
    if (topicEdges.length) for (const e of topicEdges) out.push(`- ${link(e.source)} → ${link(e.target)}`);
    else out.push("_No topic links yet._");
    return finish(out);
  };

  const index = () =>
    finish([
      "# Connections — skill + wiki wiring",
      "",
      "Generated from the knowledge graph ([`scripts/graph/build-graph.cjs`](../scripts/graph/build-graph.cjs)) — **do not edit by hand**.",
      "Rebuilt on every `pnpm graph:build` and verified fresh by `pnpm evals:graph`. It maps how the skill, the repo",
      "tooling, and the context wiki wire together (open the graph viewer with `pnpm graph:view` for the full,",
      "interactive picture).",
      "",
      "This is a small index — open the section your question needs:",
      "",
      "- [Skill contract](connections/contract.md) — every reference and script `SKILL.md` declares, which is what the build gate enforces.",
      "- [Coverage](connections/coverage.md) — test → script, and topic → covered surface.",
      "- [Document links](connections/links.md) — the prose link mesh and its cross-area seams.",
      "- [Wiki wiring](connections/wiki-wiring.md) — journal → plan and page → topic.",
    ]);

  return {
    [CONNECTIONS_INDEX_ID]: index(),
    [`${CONNECTIONS_DIR_ID}/contract.md`]: contract(),
    [`${CONNECTIONS_DIR_ID}/coverage.md`]: coverage(),
    [`${CONNECTIONS_DIR_ID}/links.md`]: links(),
    [`${CONNECTIONS_DIR_ID}/wiki-wiring.md`]: wikiWiring(),
  };
}

// Integrity gate, as a function so the tests assert the real predicate rather than a
// reimplementation of it: every edge endpoint must resolve to a node.
function danglingEdges(graph) {
  const ids = new Set(graph.nodes.map((n) => n.id));
  return graph.edges.filter((e) => !ids.has(e.source) || !ids.has(e.target));
}

function run() {
  const graph = build();

  // Check before writing so a broken graph never overwrites the committed artifacts.
  const dangling = danglingEdges(graph);
  if (dangling.length) {
    console.error(`FAIL: ${dangling.length} edge(s) with unresolved endpoints.`);
    for (const d of dangling.slice(0, 10)) console.error(`  ${d.type} ${d.source} -> ${d.target}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, render(graph));

  const connFiles = renderConnections(graph);
  for (const [relPath, content] of Object.entries(connFiles)) {
    const abs = path.join(REPO_ROOT, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }

  console.log(`Knowledge graph → ${rel(OUT_FILE)}`);
  console.log(`Connections pages → ${Object.keys(connFiles).length} files (index + sections under ${CONNECTIONS_DIR_ID}/)`);
  console.log(`  nodes: ${graph.counts.nodes}   edges: ${graph.counts.edges}`);
  const fmt = (obj) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join("  ");
  console.log(`  node types: ${fmt(graph.counts.byType)}`);
  console.log(`  edge types: ${fmt(graph.counts.byEdgeType)}`);
}

if (require.main === module) run();

module.exports = {
  build,
  render,
  renderConnections,
  danglingEdges,
  typeOf,
  extractLinks,
  extractLabel,
  extractSkillReferences,
  extractSkillScripts,
  extractTestTargets,
  OUT_FILE,
  REPO_ROOT,
  CONNECTIONS_INDEX_ID,
  CONNECTIONS_DIR_ID,
};
