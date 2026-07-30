---
date: 2026-07-30
topics: [library-capture]
plan: none
pr: pending
---
# Defer captures for pending canonicals, and triage variant multiplicity

## Why

- The retrospective's best output — a Promote candidate (new-pattern) with a mature implementation — could never reach the library in one pass. A capture keys on a canonical that must already be in the brain, so `capture-preflight.cjs` hard-blocked it (`canonical-unknown`), and nothing looped back after promotion. Surfaced live when **Stat** was promoted but the run had drafted no capture for it, so there was nothing to apply.
- A second hole: two structurally-distinct modules can resolve to one canonical (a nav bar and a mega menu, both → Navigation), but the library keys one directory per canonical, so the skill silently dropped the weaker one ("capture the stronger one").

## What changed

- `capture-preflight.cjs` gained a first-class **`deferred`** status. When a capture's canonical is absent from the manifest but a sibling `new-pattern` proposal in the run establishes it, the capture is `deferred` (reason `pending-promotion`) rather than `canonical-unknown`-blocked. A new `--proposals` flag (default: the `captures/` sibling) points at the run's proposals; it degrades silently to blocked when absent. Deferral is a flag set at the manifest check and resolved only at the terminal gate, so a real blocker still wins (blocked > deferred > ready/skipped).
- **Exit code 6** for a deferred-only run — deliberately non-zero. `deferred` at exit 0 would remove the promote-first safety interlock: the library's contracts check the directory name, never the catalog, so a deferred capture would pass `pnpm contracts`/`pnpm test` and land a component keyed to an unpromoted canonical. Blocked still dominates (exit 1); deferred self-resolves to `ready` once its proposal is promoted and the preflight is re-run.
- Variant multiplicity is triaged in prose, not dropped: prop/visual variants fold into one capture's existing `component.json.variants`; a structurally-distinct module (a different `fingerprint.json` slot/affordance/role/interaction contract — never styling, size, or a prefix word) earns its own canonical via a new-pattern proposal → a deferred capture. The library's 1:1 keying is left unchanged; a native variant axis is an out-of-scope `ui-design-library` redesign.
- Docs moved with the code (four surfaces): the promote handback names the deferred captures it unblocks (the loopback); the capture precondition, the rubric's Variant rule, the capture template's fold-vs-split rule, the report template, and the README exit-code table all gained the deferred/exit-6 semantics.

## Files

- skills/project-retrospective/scripts/capture-preflight.cjs — `deferred` status, `loadProposals`, `--proposals`, exit 6
- scripts/tests/capture-preflight.test.cjs — blocked-vs-deferred split, blocked-outranks-deferred, four-status mix, counts
- skills/project-retrospective/references/library-integrity-checklist.md, proposal-component-capture-template.md, evidence-rubric.md, report-template.md
- skills/project-retrospective/SKILL.md, README.md

## Follow-ups

- Dogfood: bank **Stat** into ui-design-library via the deferred→ready loop (it is already promoted to the brain).
- A native ui-design-library variant axis (multiple implementations per canonical) is the real fix for genuinely-variant treatments — a separate `ui-design-library` `check-contracts.cjs`/keying redesign, tracked as an Open thread on the library-capture topic.
