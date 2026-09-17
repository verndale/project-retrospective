---
date: 2026-09-17
topics: [retrospective-workflow]
plan: none
pr: pending
issue: https://github.com/verndale/project-retrospective/issues/96
issues: [https://github.com/verndale/project-retrospective/issues/96]
---
# Continue authorized retrospective publication

## Why

- A completed analyze run could validate artifacts, file tracking issues, and create its branch, then end without saying which exact action came next.
- Generic `## Next steps` prose pushed repository publication and dependency ordering back onto the operator even when commit, push, and pull-request authority was already explicit.
- Tracking authority and publication authority need to remain separate, but an authorization already present in the current request should be consumed instead of requested again.

## What changed

- Added one publication/handoff contract shared by analyze, retrospective ingestion, promote, and capture.
- Explicit publication authority now carries an action-owned issue branch through repository checks, commit, push, draft-PR creation, and read-back verification.
- Local-only runs ask one exact repository/branch/action question rather than returning a generic command list.
- Report next steps now name the current action, human decision, real paths/counts/issues, and dependency order.
- Merge, tag, release, issue closure, Figma publication, and writes to the analyzed project remain outside the skill.

## Files

- `skills/project-retrospective/SKILL.md`
- `skills/project-retrospective/README.md`
- `skills/project-retrospective/references/publication-handoff.md`
- `skills/project-retrospective/references/report-template.md`
- `skills/project-retrospective/references/tracking-issues.md`
- `scripts/tests/skill-conformance.test.cjs`

## Follow-ups

- Human review and merge remain the terminal repository-policy boundary after a draft PR is green.
