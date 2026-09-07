---
date: 2026-09-07
topics: [library-capture]
issue: https://github.com/verndale/project-retrospective/issues/93
issues: [https://github.com/verndale/project-retrospective/issues/93]
---
# Make ready-for-development the capture terminal state

## Why

Completed intake and review previously proved that a Figma registration was reviewed and unpublished but did not make the handoff state part of the retrospective output contract. That allowed Applied evidence or downstream graph readers to lag behind the library registry even when the component was ready for implementation use.

## What changed

Capture preflight now requires the governed registration to be `ready-for-dev` in addition to stable identity, unpublished publication state, structural presentation evidence, semantic token-binding audit, exact state coverage, and passed source-parity/adversarial/design reviews.

The schema-v6 promotion envelope declares that terminal status, and modern Applied evidence must copy it exactly. Fixtures and regression tests prove a merely reviewed registration resumes at Figma rather than landing.

Native Figma Dev Mode readiness remains a manual maintainer action when the active writer API cannot set it. Registry readiness is automated; publication remains separate.

## Files

- `skills/project-retrospective/SKILL.md`
- `skills/project-retrospective/references/library-integrity-checklist.md`
- `skills/project-retrospective/references/proposal-component-capture-template.md`
- `skills/project-retrospective/references/source-parity.md`
- `skills/project-retrospective/scripts/capture-preflight.cjs`
- `scripts/tests/capture-preflight.test.cjs`

## Follow-ups

- Use the native Figma control manually until the writer API exposes a supported readiness setter.
