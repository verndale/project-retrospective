---
date: 2026-08-21
topics: [library-capture]
plan: plans/2026-08-21-governed-figma-interaction-states-and-retrospective-capture.md
pr: https://github.com/verndale/project-retrospective/pull/82
issue: https://github.com/verndale/project-retrospective/issues/78
---
# Govern interaction states through component capture

## Why

- A capture could prove normalized code, a canonical master, and responsive specimens while omitting hover, focus, disabled, or derived states that are part of the implementation.
- Temporal behaviors such as focus restoration and announcements needed an honest runtime-only path instead of pressure to create misleading static Figma frames.
- State evidence needed to remain inside the existing issue-first capture lifecycle rather than creating a parallel tracking workflow.

## What changed

- Source-parity v2 now requires a covered or explicitly not-applicable `interactionStates` model with source citations and closed Figma classifications.
- Capture preflight v6 returns that validated model separately from `componentJson`, requires covered Storybook exports and unpublished Figma state IDs before promotion can pass, and limits legacy v1 to already landed/skipped captures.
- Runtime-only states require behavior evidence and a reason; visual states receive node identity only in the governed Figma registry.
- Tracking remains one capture issue and `feat/<issue>-library-capture` branch, with each checkbox covering Storybook and Figma state evidence.
- The skill, capture template, references, fixtures, and validator/preflight/tracking regressions moved together. The skill remains under the authoring line budget and passes its conformance tests.
- The authenticated live Figma REST audit passed all 28 registered nodes, closing the cross-repository completion gate.

## Files

- `skills/project-retrospective/scripts/source-parity.cjs`
- `skills/project-retrospective/scripts/capture-preflight.cjs`
- `skills/project-retrospective/SKILL.md`
- `skills/project-retrospective/references/source-parity.md`
- `skills/project-retrospective/references/library-integrity-checklist.md`
- `scripts/tests/source-parity.test.cjs`
- `scripts/tests/capture-preflight.test.cjs`
