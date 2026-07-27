# Knowledge graph

A deterministic, zero-dependency map of this repo: the skill and everything it declares, the repo tooling, the tests, the root docs, and the context wiki as nodes; the relationships already latent in the content as edges. Built from the files (no LLM), rendered in the browser, and gated in CI.

## Contents

- Usage
- Node types
- Edge types
- The integrity gate
- How it works
- Internal agent navigation
- Adding a source

## Usage

```bash
pnpm graph:build      # rebuild scripts/graph/data/graph.json + wiki/connections*
pnpm graph:view       # serve the viewer at http://localhost:4175
pnpm evals:graph      # freshness, determinism, and integrity (also runs inside pnpm test)
```

The viewer serves on **4175**. `ui-design-brain` owns 4173 and `ui-design-evidence` owns 4174, so all three can run at once; override with `GRAPH_PORT`.

`data/graph.json` and the `wiki/connections*` pages are **committed artifacts**. `.husky/pre-commit` rebuilds and stages them on every commit; `pnpm evals:graph` byte-compares them against a fresh rebuild and fails on drift.

## Node types

| Type | What it is |
|---|---|
| `skill` | `skills/project-retrospective/SKILL.md` — labelled from its frontmatter `name` |
| `skill-readme` | the skill's operator docs |
| `skill-reference` | each `references/*.md` the skill ships |
| `skill-script` | each `scripts/**/*.cjs` the skill ships, including `lib/util.cjs` |
| `authoring-spec` | `skills/_meta/_sections.md`, the authority for `SKILL.md`'s structure |
| `repo-script` | every `.cjs` under `scripts/` that is not a test |
| `tooling-doc` | every `.md` under `scripts/`, including this file |
| `test` | each suite and helper under `scripts/tests/` |
| `root-doc` | `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `CLAUDE.md` |
| `wiki-index` | `wiki/INDEX.md`, `wiki/MECHANICS.md`, `wiki/plans/INDEX.md` |
| `wiki-journal` / `wiki-topic` / `wiki-plan` | the authored wiki pages |

`CHANGELOG.md` is excluded — semantic-release rewrites it every release, which would churn the graph for no signal. `skills/_meta/` is not walked (authoring-only), so `_sections.md` is added explicitly. `scripts/tests/fixtures/` is excluded: synthetic inputs are data, not knowledge, and that exclusion is what makes it safe to test the graph builder against a fixture repo.

All of `scripts/` is walked rather than an allow-list of subdirectories, so a new `scripts/<dir>/` is indexed instead of being silently invisible.

## Edge types

| Type | Relationship | Emission |
|---|---|---|
| `contracts` | `SKILL.md` → every reference it links and every script it names | **unconditional — the gate** |
| `requires` | a `.cjs` → a `.cjs` it requires by relative path (the module graph) | **unconditional — the gate** |
| `covers` | a wiki topic → the surfaces its `covers:` frontmatter claims | **unconditional — the gate** |
| `topic` | a wiki page → `topics/<slug>.md` from its `topics:` frontmatter | **unconditional — the gate** |
| `plan` | a journal entry → its archived plan, from `plan:` | **unconditional — the gate** |
| `tests` | a suite → the script it spawns, or `SKILL.md` when it lints the contract | resolve-only |
| `links-to` | a relative markdown link between two indexed documents | resolve-only, carries `count` + `anchors[]` |

## The integrity gate

Before writing anything, the builder checks that every edge endpoint resolves to a node. If one does not, it prints the offenders and exits 1 without touching the committed artifacts.

The catalog repo gates on its manifest: an entry naming a pattern file that is not on disk dangles, and the build fails. This repo has no catalog, so the equivalent declaration is **the skill's own contract** — what `SKILL.md` promises exists. Rename a reference, or a script the workflow tells an agent to run, and the build fails.

`covers`, `topic`, and `plan` are unconditional for the same reason: a topic claiming to document a surface that has moved, a stale topic slug, or a journal pointing at a plan that is gone are all silent rot otherwise.

`tests` is deliberately **not** a gate. Deleting a skill script already fails through `contracts`, so a gate here would add nothing — while a suite that merely discusses a filename in an assertion would invent an edge to a file that never existed and fail the build forever. That is not hypothetical; it is what the first version of this pass did.

Two extraction rules are load-bearing and easy to break by "improving" them:

- **`SKILL.md` names its scripts inside fenced bash blocks**, as `<skill>/scripts/inventory.cjs`. Fence-aware or angle-bracket-rejecting extractors — which is what the donor repo uses — find nothing here, producing a gate that silently gates nothing.
- **`SKILL.md` also cites the catalog repo's `scripts/graph/build-graph.cjs`**, and this repo has a file at that same path. `[a-z-]+` cannot cross the `/` in `graph/build-graph.cjs`, so the citation is correctly ignored. Widening that character class emits an edge that can never resolve.

Both rules are shared with `scripts/tests/skill-conformance.test.cjs`, so the lint gate and the graph gate cannot disagree about what `SKILL.md` declares.

## How it works

Everything is derived from the files — no guessing, no LLM, no network. Output is timestamp-free and sorted (nodes by id; edges by type, then source, then target) so a rebuild only diffs when the content graph actually changed, and two rebuilds are byte-identical.

`build({ repoRoot })` takes the root explicitly, which is how the tests build a synthetic fixture repo rather than the real tree.

## Internal agent navigation

```bash
pnpm graph:navigate --intent why --query "brain promotion"
```

Returns a deterministic, minimal itinerary — a Dijkstra route over [`routing-policy.json`](routing-policy.json), which assigns a cost per edge type and a preferred source/target type set per intent (`why`, `wiring`, `impact`). Agents use it before broad context reads. Developers do not need to run or remember it.

Every edge type in the graph must have a cost, and every node type named in the policy must exist, or `pnpm evals:graph` fails.

## Adding a source

Four things move together:

1. a `typeOf()` branch in [`build-graph.cjs`](build-graph.cjs), plus the walked roots if it lives somewhere new;
2. `TYPE_COLORS` / `TYPE_LABELS` (and `EDGE_COLORS` for a new edge type) in [`viewer/viewer.js`](viewer/viewer.js);
3. an edge cost and intent coverage in [`routing-policy.json`](routing-policy.json);
4. a case in [`../tests/build-graph.test.cjs`](../tests/build-graph.test.cjs), and the tables above.

Then run `pnpm graph:build` and commit the regenerated artifacts.
