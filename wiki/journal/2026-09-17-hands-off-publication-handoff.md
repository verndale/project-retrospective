---
date: 2026-09-17
topics: [retrospective-workflow]
plan: none
pr: https://github.com/verndale/project-retrospective/pull/97
issue: https://github.com/verndale/project-retrospective/issues/96
issues: ["https://github.com/verndale/project-retrospective/issues/96"]
---
# Continue authorized retrospective publication

## Why

- A completed analyze run could validate artifacts, file tracking issues, and create its branch, then end without saying which exact action came next.
- Generic `## Next steps` prose pushed repository publication and dependency ordering back onto the operator even when commit, push, and pull-request authority was already explicit.
- Tracking authority and publication authority need to remain separate, but an authorization already present in the current request should be consumed instead of requested again.
- Validated Promote proposals and ready captures were still treated as human approval queues even in an explicitly hands-off run.

## What changed

- Added one publication/handoff contract shared by analyze, retrospective ingestion, promote, and capture.
- `Publication: pull-request` carries an action-owned issue branch through repository checks, commit, push, draft-PR creation, and read-back verification.
- `Publication: merge` additionally waits for checks, readies and merges the PR without bypassing protection, verifies default-branch and linked-issue state, then continues into dependent repositories.
- Validator-passing Promote proposals are executable decisions in merge mode; exact prior-proposal collisions are reused, Watch/Reject create no writes, and newly ready captures execute automatically after their canonical lands.
- Local-only runs ask one exact repository/branch/action question rather than returning a generic command list.
- Report next steps now name the current action, external blocker (or none), real paths/counts/issues, and dependency order.
- Manual tags/releases, Figma publication, protection bypass, unrelated issue closure, and writes to the analyzed project remain outside merge mode.

## Files

- `skills/project-retrospective/SKILL.md`
- `skills/project-retrospective/README.md`
- `skills/project-retrospective/references/publication-handoff.md`
- `skills/project-retrospective/references/report-template.md`
- `skills/project-retrospective/references/tracking-issues.md`
- `scripts/tests/skill-conformance.test.cjs`

## Follow-ups

- Repository-enforced review that automation cannot satisfy and missing external write capability remain explicit blockers; ordinary proposal approval and merge are not.
