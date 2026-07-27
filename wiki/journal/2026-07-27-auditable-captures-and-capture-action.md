---
date: 2026-07-27
topics: [library-capture, retrospective-workflow]
plan: none
pr: pending
issue: https://github.com/verndale/project-retrospective/issues/9
---
# Auditable captures, and a capture action for the library

## Why

- A component reached `ui-design-library` claiming a retrospective run that never produced a capture for it. The provenance field is required, so it was back-filled with a plausible value; nothing could tell the difference.
- `report.md` had no `## Captures` section, so a run's capture set was never enumerated. `checkCaptures` only shape-checked files that happened to exist, while its sibling `checkProposals` enforced strict two-way parity. Nothing could notice a missing capture, or an extra one.
- There was no skill-side procedure for the library at all. A human free-handed the rewrite in the other repo, so nothing checked the canonical against the brain manifest before the work started.
- The drift was already live rather than hypothetical: one capture in a real run declared a canonical of **Badge** while being named and slugged `tag` after the project's label, and another was named after the label rather than `kebab("Link")`. Both were silently corrected during execution.

## What changed

Captures became as auditable as proposals, and the library leg got the same shape the catalog leg has.

`## Captures` is now a required report section at `full` scope, sitting between Candidates and Learnings so the report carries one section per downstream repo. `capture-parity` enforces both directions against `captures/`, mirroring `proposal-parity`'s four failure shapes. `capture-canonical` requires a capture's bolded canonical, its backticked slug, and its filename to agree.

`Action: capture` applies a run's whole `captures/` directory to a local `ui-design-library` checkout, gated by a new `capture-preflight.cjs`.

Ruled out along the way:

- **A script that writes `component.json`.** It manufactures directories failing that repo's contracts until each rewrite lands, and it forces a machine to author `declienting`, which is by definition a record of work only the rewrite knows about. Preflight writes nothing into the library.
- **Preflight shelling out to `pnpm contracts`.** It would need `node_modules` in the other repo and would duplicate a gate that repo already owns.
- **A `Verdict:` line on capture entries.** There is no triage axis, and it would mean widening `VERDICT_RE`.
- **A magic "nothing qualified" phrase.** Unlike the orchestration drafts file, the empty state here is already pinned by the required heading plus parity, so a required sentence would guard a failure that cannot occur.
- **Copying `sections()`/`fencedBlock()` into the new script.** Both moved into `lib/util.cjs` instead: two copies would diverge the first time someone fixed a fence edge case, and the capture template's nested json-inside-markdown block is the highest-risk case to re-derive.

`orphanedByRun` fell out of the preflight for free and is the detector for the original defect — library components claiming a run in the capture set with no capture behind them.

## Files

- `skills/project-retrospective/scripts/capture-preflight.cjs` (new)
- `skills/project-retrospective/references/library-integrity-checklist.md` (new)
- `skills/project-retrospective/scripts/validate-report.cjs`, `scripts/lib/util.cjs`
- `skills/project-retrospective/SKILL.md`, `README.md`, `references/report-template.md`, `references/proposal-component-capture-template.md`
- `scripts/tests/capture-preflight.test.cjs` (new), `scripts/tests/validate-report.test.cjs`, `scripts/tests/helpers.cjs`, `scripts/tests/fixtures/fake-library/` (new)

## Follow-ups

- `provenance.run` remains unenforced inside `ui-design-library`. The entry path is closed here, but a hand-added component can still claim any run; a check there is that repo's call.
- The brain checklist has no `## Use when` while the library checklist does. They should agree — adding one to the brain checklist is a small follow-up deliberately kept out of this change.
