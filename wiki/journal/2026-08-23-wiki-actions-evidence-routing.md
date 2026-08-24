---
date: 2026-08-23
topics: [graph-wiki-subsystem]
plan: plans/2026-08-23-standardize-wiki-actions-and-evidence-routing.md
pr: pending
issue: https://github.com/verndale/project-retrospective/issues/83
issues: [https://github.com/verndale/project-retrospective/issues/83]
---
# Standardize wiki actions and evidence routing

## Why

- Wiki history could cite GitHub work, but the graph retained only ambiguous number-only metadata and the viewer/router could not use repo-qualified evidence.
- Merge automation depended on event payload fragments and shell-sized pagination results, so large PRs and missed merge runs were not safely replayable.
- Required checks, bot authentication, hook suppression, and Commitlint resolution needed one stable contract across repositories.
- Agent navigation needed an explicit lowest-cost lookup order and a measurable read budget to prevent broad wiki loading.

## What changed

Markdown citations now derive canonical offline `githubRefs` on existing curated graph nodes while legacy fields remain readable. The router understands repo-qualified PR and issue queries, prefers the strongest evidence page, and reports bytes for its compact itinerary; the viewer searches those same forms and renders safe external links. Merge reconciliation accepts a versioned, repo-qualified context with every closing issue, and writer workflows use manual replay, fully paginated file-backed JSON, bot recursion/race guards, explicit bot auth, and lease-safe review branches. Nightly issue refresh caches each repository-and-number lookup, checks every citation on a line, and annotates it only after all are confirmed closed; an individual lookup failure remains fail-soft. Stable Quality, Commit message lint, and Wiki integrity checks share the pinned runtime. The pre-commit graph lifecycle remains fail-open but refuses contaminated input, and `AGENTS.md` now directs agents to the cheapest grounded lookup.

## Files

- `.github/workflows/`, `.husky/pre-commit`, `package.json`, `pnpm-workspace.yaml`, `commitlint.config.cjs`
- `scripts/wiki/`, `scripts/graph/`, `scripts/tests/wiki-standard.test.cjs`
- `AGENTS.md`, `wiki/MECHANICS.md`, `wiki/INDEX.md`, `wiki/topics/graph-wiki-subsystem.md`
