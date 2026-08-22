---
status: implemented
executed: 2026-08-22
date: 2026-08-22
evidence:
  - "working tree implementation for issue #79"
source_tool: file
source: "/private/tmp/retro-issue-79-quality-graph-plan.md"
topics: [graph-wiki-subsystem]
---
# Standardize Retrospective quality and graph lifecycle

## Goal

Give project-retrospective the shared enforcement contract for ESLint, Conventional Commits, local Git hooks, pull-request quality, and curated knowledge-graph lifecycle behavior.

## Decisions

- ESLint is the only JavaScript linter. It covers first-party JavaScript and excludes fixtures, generated graph data, and vendored viewer assets.
- Pre-commit fixes staged JavaScript and blocks on remaining lint failures; the wiki reminder and graph rebuild/write path remain advisory.
- Pre-push runs the stable Node suite. CI additionally runs full lint and check-only graph validation under one stable quality job.
- Commitlint uses the public shared preset through a root config. The direct Commitlint CLI is authoritative locally and in the separate PR-title/range workflow.
- The curated graph remains lifecycle-driven, refuses to incorporate unstaged inputs, and is never rewritten by CI or pre-push.
- No typecheck gate is added because this repository has no first-party TypeScript implementation.

## Implementation

1. Add the lint dependencies, flat configuration, shared scripts, staged-file configuration, and lockfile updates.
2. Order the hooks as blocking staged lint, advisory wiki reminder, then fail-open graph lifecycle; add the blocking fast pre-push gate.
3. Replace the prior test workflow with `Quality / quality` and keep `Commit message lint / commitlint` separate and immutable to the PR head event.
4. Align contributor and graph/wiki documentation, add graph aliases, preserve loopback-only viewing, and keep bot graph generation on the shared builder.
5. Rebuild the curated graph and validate lint, fast/full verification, Commitlint boundaries, hooks, nonmutation, and absence requirements.
