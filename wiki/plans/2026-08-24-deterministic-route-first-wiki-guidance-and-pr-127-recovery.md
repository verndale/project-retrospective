---
status: implemented
executed: 2026-08-24
date: 2026-08-24
evidence:
  - "canonical headless AGENTS.md block installed with zero-drift dry run"
  - "verndale/project-retrospective PR #84 https://github.com/verndale/project-retrospective/pull/84 (merged 2026-08-24)"
source_tool: file
source: "user-approved cross-repository plan"
topics: [graph-wiki-subsystem]
---
# Deterministic, Route-First Wiki Guidance and PR 127 Recovery

## Summary

- Keep all eight repositories on their current branches and preserve unrelated changes.
- Generate one deterministic route-first wiki contract in full and headless variants.
- Keep repository-specific graph, evidence, privacy, and authoring guidance outside the managed block.
- Recover cumulative-conductor PR 127 semantically on `codex/132-retire-jira-automation` without reverting the later Jira-retirement baseline wholesale.

## Navigation contract

- Send exact current-code questions to source, single-topic rationale to the index and one page, and cross-page why, wiring, ownership, or impact questions to the navigator.
- Use exact identifiers and repository-qualified GitHub references; use exact endpoint IDs when known.
- Trust the deterministic weighted shortest route, read sequentially, stop when grounded, and retry one exact ambiguity candidate.
- Do not use grep, find, or recursive rg for initial wiki discovery. After a miss, allow one root-scoped fixed-string search, then one known source path or one focused question.
- Never read generated graph JSON directly.

## Deterministic generation

- Add `--agents-only` so the installer updates or checks only the managed `AGENTS.md` block.
- Reuse one navigation core in full and headless modes.
- Replace generic hand-authored navigation prose with generated blocks while preserving repository-owned operations.
- Remove cumulative-conductor's duplicate Claude wiki block while preserving `@AGENTS.md`.

## Cumulative-conductor recovery

- Confirm PR 127 head and merge are already ancestors and avoid a no-op merge.
- Restore the PR's graph/wiki subsystem, tests, hooks, evidence routing, Commitlint setup, and canonical Actions.
- Preserve current Jira retirement, versions, eval coverage, start-pack behavior, and newer wiki records.
- Restore `Quality / quality` with current eval, Python, and start-pack checks plus JavaScript, wiki, and graph checks.
- Rebuild graph JSON and wiki connections from the merged authored tree.

## Acceptance

- Installer tests cover agents-only isolation, idempotence, variants, custom roots, malformed markers, and dry-run codes.
- All eight generated blocks have zero dry-run drift and expected byte equality.
- Changed repositories pass documented verification and wiki/graph freshness checks.
