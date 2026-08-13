---
date: 2026-08-13
topics: [library-capture]
plan: plans/2026-08-13-capture-preflight-schema-v3-for-accessible-realizations.md
pr: https://github.com/verndale/project-retrospective/pull/64
issue: https://github.com/verndale/project-retrospective/issues/63
---
# Make accessible realization part of capture preflight

## Why

- Runtime architecture and a reuse fingerprint could be valid while the proposed component still omitted its real public props, package-owned DOM, keyboard model, or accessibility ownership.
- Discovering that mismatch during the capture action would let code and metadata diverge after the only deterministic preflight gate.
- WCAG/APG claims need stable behavior evidence and explicit consuming-page obligations rather than prose attached after implementation.

## What changed

- Capture preflight schema v3 requires `exportName`, `rendering`, and realization contract v1 in every proposed library entry.
- The zero-dependency checker validates typed props, DOM nodes and ancestry, cardinality, content and safe-attribute bindings, IDREF resolution, protected style slots, WCAG 2.2 AA/APG behaviors, evidence IDs, and governed consumer responsibilities.
- Applied-state comparison includes realization metadata. A changed public API, DOM, keyboard model, or accessibility owner requires revising the capture and rerunning preflight rather than silently editing the emitted manifest.
- The capture template, workflow, integrity checklist, synthetic fixtures, and tests now describe the intended de-cliented result.

## Files

- `skills/project-retrospective/scripts/capture-preflight.cjs`
- `skills/project-retrospective/references/proposal-component-capture-template.md`
- `skills/project-retrospective/references/library-integrity-checklist.md`
- `scripts/tests/capture-preflight.test.cjs`
