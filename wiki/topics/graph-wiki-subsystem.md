---
aliases: [knowledge graph, context wiki, skill contract gate, sigma.js viewer, plan capture, connections pages, graph freshness]
covers: [scripts/graph/build-graph.cjs, scripts/graph/serve.cjs, scripts/graph/README.md, scripts/evals/graph-check.cjs, scripts/wiki/refresh-issue-state.cjs, wiki/MECHANICS.md]
---
# Knowledge graph & context wiki — Design History

The deterministic graph, its skill-contract integrity gate, the vendored Sigma.js viewer, and the context wiki they render into.

## Current state

- `pnpm graph:build` derives `scripts/graph/data/graph.json` from the skill, the repo tooling, the tests, the root docs, and the wiki. `pnpm graph:view` renders it with a vendored Sigma.js stack on port 4175. `pnpm evals:graph` byte-compares a fresh rebuild against the committed artifacts and gates freshness.
- Node types: `skill`, `skill-readme`, `skill-reference`, `skill-script`, `authoring-spec`, `repo-script`, `tooling-doc`, `test`, `root-doc`, and the four `wiki-*` kinds. Edge types: `contracts`, `requires`, `tests`, `links-to`, `topic`, `plan`, `covers`.
- `contracts` is the integrity gate. The catalog repo validates its manifest against the pattern files it lists; this repo has no catalog, so the equivalent declaration is the skill's own contract — `SKILL.md` to every reference it links and every script it names. Those edges are emitted whether or not the target exists, so a renamed reference fails the build.
- `tests`, `topic`, `plan`, and `covers` are emitted the same way. A topic that claims to cover a surface which has moved fails the build as a dangling edge.
- The freshness gate composes into `pnpm test` rather than a separate workflow, so the existing `test.yml` covers it.
- The wiki captures executed plans, decisions, and change history. Slack ingestion is deliberately excluded.
- `wiki/connections.md` and the four section files under `wiki/connections/` are generated views, excluded from the graph's own nodes so they never become self-referential mega-nodes.

- `requires` is the module graph: an indexed `.cjs` to each `.cjs` it requires by relative path. It exists so navigation reaches the tooling — without it 18 of 55 nodes were isolated and `pnpm graph:navigate` returned no route for any script.

## Decisions

- 2026-07-27 — feat(project-retrospective): Enhance graph builder to include module ([PR #7](https://github.com/verndale/project-retrospective/pull/7))
- 2026-07-27 — Added the `requires` edge and indexed all of `scripts/` rather than an allow-list of subdirectories. `pnpm graph:navigate` dead-ended on every tooling file, which fails open into exactly the broad context read the instruction to use it is meant to prevent. Also indexed `.md` under `scripts/` so `scripts/graph/README.md`, which defines the integrity gate, is no longer outside the graph it documents.
- 2026-07-27 — chore(project-retrospective): merge main and rebuild graph ([PR #4](https://github.com/verndale/project-retrospective/pull/4))

- 2026-07-27 — chore(ci): Add workflows for wiki issue synchronization ([PR #1](https://github.com/verndale/project-retrospective/pull/1))
- 2026-07-26 — Made the skill contract the integrity edge instead of porting the donor's `catalogs` manifest edge, which has no analogue here. Dropped the donor's `see-also` pass entirely: it models a pattern cross-reference mesh that the "references are one hop deep" rule actively forbids ([journal](../journal/2026-07-26-knowledge-graph-wiki-subsystem.md), [plan](../plans/2026-07-26-port-the-knowledge-graph-context-wiki-subsystem-into-project.md)).
- 2026-07-26 — Reused the conformance test's two extraction regexes verbatim rather than the donor's backtick and markdown-link extractors, which find nothing here: `SKILL.md` names its scripts inside fenced bash blocks and the donor's extractors are fence-aware and reject angle brackets ([journal](../journal/2026-07-26-knowledge-graph-wiki-subsystem.md)).
- 2026-07-26 — Composed the freshness gate into `pnpm test` instead of adding a `graph.yml` workflow; `test.yml` already runs `pnpm test` ([plan](../plans/2026-07-26-port-the-knowledge-graph-context-wiki-subsystem-into-project.md)).
- 2026-07-26 — The graph is a derived rendering, never a source of truth. The original proposal had this inverted; if the graph and a file disagree, the file is right and the graph is stale ([journal](../journal/2026-07-26-build-project-retrospective-skill.md)).
