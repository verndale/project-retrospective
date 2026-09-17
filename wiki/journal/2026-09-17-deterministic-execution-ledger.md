---
date: 2026-09-17
topics: [retrospective-workflow, library-capture]
plan: none
pr: https://github.com/verndale/project-retrospective/pull/100
issue: https://github.com/verndale/project-retrospective/issues/99
issues: [https://github.com/verndale/project-retrospective/issues/99]
---
# Deterministic execution ledger and complete Figma capture

## Why

- A hands-off run still required terminal reconstruction to learn which branches, issues, pull requests, checks, merges, skips, or blockers occurred.
- Generic next-step prose could leave a validated downstream action waiting for a human decision that the merge contract had already authorized.
- Component capture governed state specimens but did not explicitly make the complete property/variant matrix and shared style-guide maintenance part of the same completion boundary.

## What changed

- Added an append-only JSON execution ledger with stable event IDs, deterministic sequence order, idempotent replay, conflict detection, and a generated plain-language Markdown view.
- Made `validate-report.cjs` require the ledger for every run scope, verify its run identity and schema, and reject Markdown drift. `## Next steps` now names the exact action, human decision, and audit path.
- Fixed cross-repository priority as initial Evidence, Brain, Library, then final Evidence reconciliation. Each non-empty target receives its own issue/branch, and its PR must carry the closing issue link before ready/merge.
- Extended Library capture to promote complete properties, variants, and states, run post-fix source-parity/adversarial/UI-design review, and audit/update missing reusable guidance in the shared style guide.
- Kept style-guide findings in the execution ledger and client-agnostic Library wiki rather than widening the governed capture registry payload.

## Files

- `skills/project-retrospective/scripts/execution-ledger.cjs`
- `skills/project-retrospective/scripts/validate-report.cjs`
- `skills/project-retrospective/references/execution-ledger.md`
- `skills/project-retrospective/references/publication-handoff.md`
- `skills/project-retrospective/references/library-integrity-checklist.md`
- `skills/project-retrospective/SKILL.md`
- `skills/project-retrospective/README.md`
- `scripts/tests/execution-ledger.test.cjs`
- `scripts/tests/validate-report.test.cjs`
