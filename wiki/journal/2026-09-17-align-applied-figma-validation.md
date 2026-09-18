---
date: 2026-09-17
topics: [library-capture]
plan: none
pr: pending
---
# Align Applied Figma validation

## Why

- The capture template, workflow, and preflight require modern `## Applied` evidence to copy `ready-for-dev` status, structural presentation evidence, token-binding proof, review passes, and state coverage.
- The final report validator accepted only a smaller legacy subset and therefore rejected the exact governed payload produced by capture.

## What changed

`validate-report.cjs` now accepts exactly the documented client-neutral Figma proof and validates the live precedent sections, known interaction-state token mappings, semantic token names, ready-for-dev status, review passes, and state coverage. Regression cases reject missing structural evidence, wrong status, unknown state IDs, ungoverned token names, and extra or missing top-level proof fields.

## Files

- `skills/project-retrospective/scripts/validate-report.cjs`
- `scripts/tests/validate-report.test.cjs`
