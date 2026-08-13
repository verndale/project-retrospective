---
status: implemented
executed: 2026-08-13
date: 2026-08-13
evidence: []
source_tool: file
source: "/tmp/retrospective-realization-plan.md"
topics: [library-capture]
---
# Capture preflight schema v3 for accessible realizations

## Goal

Require a proposed library capture to describe the intended de-cliented public API, package-owned DOM, accessibility behavior, and consuming-page obligations before the capture action writes component code.

## Implementation

1. Upgrade `capture-preflight.cjs` output from schema v2 to schema v3.
2. Require each proposed library entry to name its primary `exportName`, derived `rendering`, and realization contract v1.
3. Validate typed props, exact owned nodes and ancestry, cardinality, conditional references, content bindings, safe attributes, IDREF relationships, protected style slots, owned WCAG 2.2 AA/APG behaviors, stable evidence IDs, and governed consumer responsibilities.
4. Treat missing or inconsistent accessibility evidence as a hard blocker.
5. Compare realization metadata when deciding that a capture is already applied.
6. Update the capture template, workflow, integrity checklist, synthetic fixture, tests, operator documentation, and context wiki.
7. Require the capture to be revised and preflight rerun if execution changes the public API, owned DOM, keyboard model, or accessibility ownership.

## Verification

- `pnpm graph:build`
- `pnpm test`
- Skill structural validation

## Boundary

The preflight remains deterministic, zero-dependency, offline, and read-only against the library. Runtime architecture remains an execution plan outside `component.json`; realization metadata is package metadata.
