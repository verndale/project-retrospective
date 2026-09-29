---
date: 2026-09-29
topics: [graph-wiki-subsystem]
plan: none
pr: https://github.com/verndale/project-retrospective/pull/121
issue: https://github.com/verndale/project-retrospective/issues/120
issues: ["https://github.com/verndale/project-retrospective/issues/120"]
---
# Preserve tested main release handoff

## Why

A wiki-only main push could cancel the full Quality run for an earlier substantive merge. Release requires that successful push-event Quality result and cannot release from the later wiki-only revision alone.

## What changed

Quality now cancels superseded pull-request runs without canceling an in-progress main push. A later main push could still replace a pending one in the shared group; [issue #123](https://github.com/verndale/project-retrospective/issues/123) addresses that remaining gap. The retrospective skill's action-owned Evidence → Brain → Library publication sequence is unchanged.

## Files

- `.github/workflows/quality.yml`, `scripts/tests/wiki-standard.test.cjs`
- `wiki/INDEX.md`, `wiki/topics/graph-wiki-subsystem.md`, this journal
