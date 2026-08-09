---
date: 2026-08-09
topics: [retrospective-workflow]
plan: plans/2026-08-09-team-retrospective-knowledge-and-accountability.md
pr: https://github.com/verndale/project-retrospective/pull/58
issue: https://github.com/verndale/project-retrospective/issues/57
---
# Keep team-retrospective knowledge and actions alive

## Why

- Project retrospectives were useful at meeting time but had no durable ingestion or accountability path.
- Source pages vary in headings, tables, task lists, dates, and status language, so assuming one template or cadence would discard evidence.
- A retrospective action without a stable owner, next step, and disposition is indistinguishable from a note that was swept aside.

## What changed

- Added an optional `Retrospectives` input plus `Action: ingest-retrospectives` and the append-only `retrospectives` scope.
- Restricted automatic discovery to explicitly seeded spaces and required deterministic reconciliation of every discovered page as included or excluded.
- Split source capture, model-authored findings, normalized evidence, and action lifecycle into four artifacts that validate in parity with `## Team retrospectives`.
- Required every action to carry a stable ID, destination, owner, next step, and lifecycle state, with proof for `done` and rationale for `wont-do`.
- Kept raw Markdown, owners, and private issue links inside the evidence repo; shared destinations receive only client-neutral proposals, captures, or orchestration drafts.
- Ruled out retrospective evidence as a standalone promotion signal: it counts for component triage only when an inventoried component and strong non-code-scan as-built evidence corroborate it.

## Files

- `skills/project-retrospective/SKILL.md`
- `skills/project-retrospective/references/team-retrospectives.md`
- `skills/project-retrospective/scripts/normalize-retrospectives.cjs`
- `skills/project-retrospective/scripts/update-retrospective-register.cjs`
- `skills/project-retrospective/scripts/resolve.cjs`
- `skills/project-retrospective/scripts/validate-report.cjs`
- `scripts/tests/normalize-retrospectives.test.cjs`
- `scripts/tests/update-retrospective-register.test.cjs`

## Follow-ups

- Complete the private evidence-wiki surfaces and append-only historical backfills under the private repository's own branch and review process.
