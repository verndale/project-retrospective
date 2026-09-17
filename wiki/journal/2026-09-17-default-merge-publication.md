---
date: 2026-09-17
topics: [retrospective-workflow, brain-promotion, library-capture]
plan: none
pr: https://github.com/verndale/project-retrospective/pull/97
issue: https://github.com/verndale/project-retrospective/issues/96
issues: ["https://github.com/verndale/project-retrospective/issues/96"]
---
# Default retrospective publication to merge

## Why

- Requiring a publication phrase on every run recreated an operator handoff even after the workflow had learned how to verify, publish, merge, and continue safely.
- Hands-off operation is the durable project preference, not a one-run exception.
- Proposal verdicts and ready capture states already provide deterministic content decisions; routine repository publication should not introduce a second approval queue.

## What changed

- A retrospective invocation now resolves an omitted `Publication` parameter to `merge` for the action's deterministic evidence, Brain, and Library issue/run branches.
- `pull-request` and `working-tree` remain explicit stop-early overrides rather than defaults.
- Default merge still waits for required checks, respects repository protection, verifies linked issue closure and default-branch state, and stops on concrete authentication, capability, conflict, validation, or unsatisfied review blockers.
- Manual tags/releases, protection bypass, Figma publication, analyzed-project writes, unrelated repositories, and unrelated issue closure remain outside the standing authority.

## Files

- `AGENTS.md`
- `skills/project-retrospective/SKILL.md`
- `skills/project-retrospective/README.md`
- `skills/project-retrospective/references/publication-handoff.md`
- `skills/project-retrospective/references/tracking-issues.md`
- `scripts/tests/skill-conformance.test.cjs`
- `wiki/topics/retrospective-workflow.md`
- `wiki/topics/brain-promotion.md`
- `wiki/topics/library-capture.md`
