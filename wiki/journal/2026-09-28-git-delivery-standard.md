---
date: 2026-09-28
topics: [graph-wiki-subsystem]
plan: plans/2026-09-29-standardize-git-delivery-in-project-retrospective--d184da65fe7f.md
pr: https://github.com/verndale/project-retrospective/pull/109
issue: https://github.com/verndale/project-retrospective/issues/108
issues: ["https://github.com/verndale/project-retrospective/issues/108"]
---
# Standard Git delivery for repository maintenance

## Why
- The generic branch-push PR Action and AI commit helper added work and obscured the issue-to-PR review boundary.
- Wiki bots still referred to the renamed token secret.

## What changed
- Maintenance work now uses a labeled issue, updated-main branch, standalone Commitlint, deterministic PR body, and an open PR for review.
- Wiki bot writers retain direct GitHub CLI PR handling with `BOT_TOKEN`.
- Release waits for successful Quality on a main push and skips wiki-only revisions.
- The retrospective skill's domain-specific publication modes remain separate from this maintenance delivery.
- Wiki issue-state reconciliation now runs Mondays at 11:30 UTC, matching agent-review-workflows.

## Files
- `AGENTS.md`, `.github/workflows/`, `commitlint.config.cjs`, `package.json`, `CONTRIBUTING.md`, `README.md`, `skills/project-retrospective/references/publication-handoff.md`
