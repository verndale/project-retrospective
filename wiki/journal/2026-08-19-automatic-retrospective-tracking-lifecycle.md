---
date: 2026-08-19
topics: [retrospective-workflow, library-capture]
plan: plans/2026-08-19-automate-retrospective-github-tracking.md
pr: pending
---
# Automate conditional retrospective tracking and capture lifecycle

## Why

- Analyze could file shared-repository work and create branches from artifact presence even when no downstream write was actionable.
- Issue creation paused for confirmation despite a deterministic, already-authorized target, while label definitions differed across repositories.
- Capture evidence assumed a post-landing world and could not resume safely between code, governed Figma review, and evidence reconciliation.
- Structural implementations sharing one canonical lacked an exact cross-repository identity.

## What changed

- Added a deterministic resolver that emits skip, issue-pending, or write-ready for each repository and withholds executable branch instructions until all gates pass.
- Made governed issue filing automatic, exact-match/reuse aware, label constrained, and separate from commit, push, PR, closure, publication, merge, and release authority.
- Moved capture preflight to schema v4 with exact canonical-plus-variant identity and pending, code-complete, landed, Figma-pending, and evidence-pending resume states.
- Tightened adversarial checks so lifecycle claims cannot outrun library state or disagree with the reviewed Figma registry node.
- Kept live Figma file construction, rearrangement, rendering, and publication outside this implementation.

## Files

- `skills/project-retrospective/scripts/tracking-targets.cjs`
- `skills/project-retrospective/scripts/capture-preflight.cjs`
- `skills/project-retrospective/references/tracking-issues.md`
- `skills/project-retrospective/references/proposal-component-capture-template.md`
- `skills/project-retrospective/SKILL.md`
- `scripts/tests/tracking-targets.test.cjs`
- `scripts/tests/capture-preflight.test.cjs`

## Follow-ups

- Exercise the full governed path with the next real retrospective output; an implementation run alone has no eligible evidence, brain, or library issue target.
