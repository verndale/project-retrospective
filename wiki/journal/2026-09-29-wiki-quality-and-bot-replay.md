---
date: 2026-09-29
topics: [graph-wiki-subsystem]
plan: none
pr: https://github.com/verndale/project-retrospective/pull/118
issue: https://github.com/verndale/project-retrospective/issues/117
issues: ["https://github.com/verndale/project-retrospective/issues/117"]
---
# Focus wiki Quality and restore bot replay

## Why

- Wiki-only bot PRs ran the complete skill suite even though Wiki integrity already checked wiki and graph freshness.
- Existing bot PR replay used GraphQL lookup/edit calls. The same BOT_TOKEN pattern failed during a verified UI Design Library replay when a query requested organization-read scope.

## What changed

- Quality keeps its stable check name and uses wiki and graph checks for changes limited to wiki pages and generated graph data. Code, workflow, manual, empty, and unavailable ranges use the complete suite.
- Both wiki bots use repository REST endpoints to find, reopen, and edit existing review PRs. The action-owned retrospective publication modes remain unchanged.
- The wiki standard test guards the REST update path.

## Files

- `.github/workflows/quality.yml`, `.github/workflows/wiki-sync.yml`, `.github/workflows/wiki-issue-sync.yml`
- `scripts/tests/wiki-standard.test.cjs`
- `wiki/INDEX.md`, `wiki/MECHANICS.md`, `wiki/topics/graph-wiki-subsystem.md`, this journal

## Follow-ups

- Replay an existing bot PR and verify the action and focused Quality check on GitHub.
