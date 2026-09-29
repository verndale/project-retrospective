---
date: 2026-09-29
topics: [graph-wiki-subsystem]
plan: none
pr: pending
issue: https://github.com/verndale/project-retrospective/issues/123
issues: ["https://github.com/verndale/project-retrospective/issues/123"]
---
# Preserve pending main Quality runs

## Why

Disabling cancellation for main pushes kept running Quality checks alive, but GitHub's default concurrency behavior still allows a newer pending run to replace an older pending run in the same group. A quick series of substantive and wiki-only merges could therefore leave a substantive revision without its own Quality result for Release.

## What changed

Quality gives each non-PR run its own group using the run ID. Pull-request retries continue to share their issue's group and cancel obsolete attempts. The existing wiki-only fast path and Release's wiki-descendant guard remain in place. The retrospective skill's action-owned Evidence → Brain → Library merge flow is unchanged.

## Files

- `.github/workflows/quality.yml`, `scripts/tests/wiki-standard.test.cjs`
- `wiki/INDEX.md`, `wiki/topics/graph-wiki-subsystem.md`, this journal
