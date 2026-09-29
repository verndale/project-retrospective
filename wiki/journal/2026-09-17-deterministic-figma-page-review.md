---
date: 2026-09-17
topics: [library-capture]
plan: none
pr: https://github.com/verndale/project-retrospective/pull/103
issue: https://github.com/verndale/project-retrospective/issues/102
issues: ["https://github.com/verndale/project-retrospective/issues/102"]
---
# Make Figma page review executable

## Why

- A governed capture produced component pages after Archive instead of under Components.
- The pages used custom dark section styling and interaction matrices that extended beyond their presentation frames even though the skill described the intended standard.
- Prose review and a few structural assertions were insufficient because a plausible render could pass without matching the actual live precedent.

## What changed

Capture preflight now requires the exact downstream `components-group-button-template-v1` registry object and emits it as `figmaPromotion.componentPageContract`. A missing boundary, live reference node, documentation child, coordinate, gap, inset, or publish-grid value blocks capture before branching. The downstream `figma:live:selftest` command is also a required exact package surface.

The capture workflow must clone the emitted contract instead of reconstructing page chrome from prose, screenshots, or memory. After every Figma write it runs the fixture suite and authenticated live audit, then inspects fresh renders for source parity, adversarial findings, and UI design quality. Placement, live-reference fills/strokes, exact section structure, direct-master layout, and recursive presentation containment are machine failures that visual prose cannot waive.

## Files

- `skills/project-retrospective/SKILL.md`
- `skills/project-retrospective/README.md`
- `skills/project-retrospective/references/library-integrity-checklist.md`
- `skills/project-retrospective/scripts/capture-preflight.cjs`
- `scripts/tests/capture-preflight.test.cjs`
- `scripts/tests/skill-conformance.test.cjs`
- `scripts/tests/fixtures/fake-library/`
