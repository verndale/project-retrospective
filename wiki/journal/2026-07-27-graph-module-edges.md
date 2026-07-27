---
date: 2026-07-27
topics: [graph-wiki-subsystem]
plan: none
pr: https://github.com/verndale/project-retrospective/pull/7
---
# Module edges, so navigation reaches the tooling

## Why

- A review of the freshly ported graph found 18 of 55 nodes with degree 0 — almost every script under `scripts/`, plus `lib/util.cjs` and `helpers.cjs`.
- `AGENTS.md` and `wiki/INDEX.md` both instruct agents to run `pnpm graph:navigate` before a broad context read. For any tooling file it returned `no-route` and exited 2, so the documented first step failed open into exactly the broad read it was meant to replace.
- `scripts/graph/README.md` — the file that defines the integrity gate — was not indexed by the graph it documents, so no topic could declare it covered and no link into it resolved.

## What changed

- Added a `requires` edge: an indexed `.cjs` to each `.cjs` it requires by relative path. Bare specifiers cannot match, so `node:` builtins and packages never enter. It is a gate, not resolve-only: every `.cjs` under `scripts/` and the skill is now a node, and the one unindexed region (test fixtures) is required by nothing, so a require that does not resolve is a broken require.
- Replaced the four-directory allow-list with a walk of all of `scripts/`, so a new `scripts/<dir>/` is indexed rather than silently invisible. Added a `tooling-doc` node type for `.md` under `scripts/`.
- Isolated nodes went from 18 to 1. The survivor is `CLAUDE.md`, a bare `@AGENTS.md` import shim with no markdown link to resolve; a test pins that list so a new island fails rather than accumulating.
- `scripts/tests/skill-conformance.test.cjs` now imports `SKILL_REFERENCE_RE` and `SKILL_SCRIPT_RE` from the builder instead of re-declaring them. The lint gate and the graph gate had two copies of the same contract, which is a drift waiting to happen.
- Widened the script regex to `[a-z0-9._-]+` so a script named `resolve2.cjs` stays gated, and allowed a `./references/` link form. The character class still cannot cross a `/`, which is what keeps the catalog repo's `scripts/graph/build-graph.cjs` citation from being mistaken for a local script.
- Added a test asserting every node and edge type the builder emits has a colour and a label in the viewer. That was the one surface of the declared four with no automated coupling — a new node type rendered grey with no legend row and no filter toggle, silently.

## Files

- `scripts/graph/build-graph.cjs`, `scripts/graph/routing-policy.json`, `scripts/graph/viewer/viewer.js`, `scripts/graph/README.md`
- `scripts/tests/build-graph.test.cjs`, `scripts/tests/skill-conformance.test.cjs`

## Follow-ups

- The routing policy check is one-directional: it fails when the policy names a node type the graph lacks, never when the graph gains a type no intent can reach.
