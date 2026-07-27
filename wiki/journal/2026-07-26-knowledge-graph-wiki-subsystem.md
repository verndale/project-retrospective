---
date: 2026-07-26
topics: [graph-wiki-subsystem, skill-authoring]
plan: plans/2026-07-26-port-the-knowledge-graph-context-wiki-subsystem-into-project.md
pr: pending
---
# Knowledge graph + context wiki subsystem

## Why

- This repo recorded *what* changed in `git log` but not *why*. The decisions that shaped it lived in one plan file on disk and a session transcript, so the next contributor would have re-litigated them.
- The catalog repo already solved this with a deterministic graph plus a context wiki, and had already stripped Slack from it. Porting from there rather than from the pipeline repo meant one less subsystem to remove.
- The skill also had no structural gate on its own contract. `SKILL.md` declares nine references and three scripts; only the conformance test checked they existed, and nothing rendered that contract as something an agent could navigate.

## What changed

- Ported the graph builder, the routing layer, the vendored Sigma.js viewer, the freshness eval, and the wiki collectors. Zero new npm dependencies — Node stdlib plus three vendored browser bundles.
- **The integrity edge is the skill contract.** The donor gates its build on a `catalogs` edge from the pattern manifest to every pattern file it lists; a missing file dangles and the build fails. This repo has no catalog, so the equivalent declaration is `SKILL.md` itself: `contracts` edges to every reference it links and every script it names, emitted whether or not the target exists.
- **The donor's extractors could not be reused for it.** `SKILL.md` names its scripts as `<skill>/scripts/inventory.cjs` inside fenced bash blocks, and the donor's extractors are fence-aware and reject angle brackets — a faithful port would have produced a gate that silently gated nothing. The two regexes already in `skill-conformance.test.cjs` are used instead, which also keeps the lint gate and the graph gate from drifting apart.
- One of those regexes turns out to solve a collision for a structural reason worth recording: `SKILL.md` also cites the *catalog's* `scripts/graph/build-graph.cjs`, and after this port a file exists at that path locally. `[a-z-]+` cannot cross the `/` in `graph/build-graph.cjs`, so it is correctly ignored. Widening that character class would produce an edge that dangles forever.
- Dropped the donor's `see-also` pass. It models a pattern cross-reference mesh that this repo's "references are one hop deep" rule actively forbids.
- **The gate composes into `pnpm test`** rather than arriving as a separate `graph.yml` workflow; `test.yml` already runs `pnpm test`. The consequence is that every test edit now dirties the committed graph, which is why the pre-commit hook restages it.
- Fixed a latent bug in the donor builder along the way: its `rel()` helper closed over the module-level repo root while `build()` accepted a `repoRoot` override, so a fixture-rooted build silently emitted `../`-prefixed node ids instead of failing.
- Slack ingestion stays excluded: no workflow, script, library, or environment variable.

## Files

- `scripts/graph/` — builder, routing, policy, server (port 4175), viewer + vendored bundles
- `scripts/wiki/` — collectors and libs; `scripts/evals/graph-check.cjs` — the freshness gate
- `wiki/` — index, mechanics, two archived plans, two journal entries, four topic pages
- `.husky/pre-commit`, `.github/workflows/wiki-sync.yml`, `.github/workflows/wiki-issue-sync.yml`

## Follow-ups

- The two wiki workflows need repository secret `PR_BOT_TOKEN` before they can open their bot PRs.
