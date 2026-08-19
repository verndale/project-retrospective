---
date: 2026-08-18
topics: [library-capture]
plan: plans/2026-08-18-governed-figma-capture-completion.md
pr: pending
issue: https://github.com/verndale/project-retrospective/issues/69
---
# Complete captures with reviewed Figma promotion

## Why

- Action capture stopped after code, stories, and package verification, leaving the governed Figma library as a separate manual follow-up.
- Captures land as candidates, so deferring Figma until supported maturity would not guarantee a complete design/developer handoff.
- A write-capable Figma session is an environmental requirement; absence must produce a visible incomplete state rather than a false success.

## What changed

- Preflight now emits an additive `figmaPromotion` contract and blocks when the target library lacks its registry, promotion checklist, code-only contract command, coverage command, or validation command.
- Preflight also blocks any target library that exposes Code Connect dependencies, scripts, configuration, or registry metadata.
- Action capture now verifies code, creates an unpublished canonical master and documentation, runs adversarial and design reviews, fixes findings in place, records journal evidence, then runs the complete Figma and library gates.
- The handback distinguishes a complete reviewed capture from `code complete, Figma promotion blocked` and never invents node or review evidence.

## Files

- `skills/project-retrospective/SKILL.md`
- `skills/project-retrospective/scripts/capture-preflight.cjs`
- `skills/project-retrospective/references/library-integrity-checklist.md`
- `scripts/tests/capture-preflight.test.cjs`

## Follow-ups

- The operator environment must expose a write-capable Figma agent or plugin session when executing a capture. The REST token remains read-only validation and does not satisfy creation.
