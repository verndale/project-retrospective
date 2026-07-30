---
aliases: [capture action, component capture, library integrity checklist, capture preflight, orphaned by run, de-clienting]
covers: [skills/project-retrospective/references/library-integrity-checklist.md, skills/project-retrospective/references/proposal-component-capture-template.md, skills/project-retrospective/scripts/capture-preflight.cjs]
---
# Library capture — Design History

How a run's component captures reach a local ui-design-library checkout, and why the script that gates them writes nothing.

## Current state

- Capture edits a local `ui-design-library` working tree and nothing else. It never commits, pushes, or opens a pull request there. Its one write outside `components/<slug>/` is a semantic token added to `src/tokens/semantic.css` when a client token has no semantic home.
- `scripts/capture-preflight.cjs` takes a run's whole `captures/` directory in one invocation and validates every capture against the brain manifest and the library's current state. It writes nothing into the library and spawns no subprocess. Exit 0 means every capture is `ready` or already applied.
- Execution is serial per component, and the write order is load-bearing: implementation, then stories, then `component.json`. That repo's contract checker requires all three files, so writing `component.json` first would leave the library failing its own gate for the length of the rewrite.
- `orphanedByRun` is the detector for a component that reached the library with no evidence: it reports every `components/<slug>/` whose `provenance.run` names a run in the capture set but which has no capture file behind it.
- The report's `## Captures` section and `captures/` are held in two-way parity by `validate-report.cjs` (`capture-parity`), and a capture's canonical, its backticked slug, and its filename must all agree (`capture-canonical`).
- `declienting` is mandated by ui-design-library and read by nothing there. The checklist names it as the one invariant the author alone enforces rather than implying the downstream checker covers it.
- Verification is that repo's own `pnpm contracts` then `pnpm test`, run from the library root — the same "the downstream repo owns its gate" arrangement [brain promotion](brain-promotion.md) uses.

## Decisions

- 2026-07-30 — Added a `deferred` capture status: a capture whose canonical is only established by a `new-pattern` proposal in the run is `deferred` (exit 6), not `canonical-unknown`-blocked, so a mature implementation of a just-promoted pattern reaches the library after a promote→re-run loop instead of falling through. Exit 6 is non-zero on purpose — the library's contracts never check the catalog, so a deferred capture at exit 0 would land a component keyed to an unpromoted canonical. Deferral is a flag resolved at the terminal gate, so a real blocker still wins ([journal](../journal/2026-07-30-defer-captures-and-variant-triage.md)).
- 2026-07-30 — Variant multiplicity is triaged, not dropped: prop/visual variants fold into one capture's `variants`; a structurally-distinct module (different `fingerprint.json` slot/affordance/role contract, never styling/size/prefix) earns its own canonical → a deferred capture. The library's 1:1 canonical→directory keying is left unchanged ([journal](../journal/2026-07-30-defer-captures-and-variant-triage.md)).
- 2026-07-27 — Preflight writes nothing into the library. Batch-writing `component.json` was rejected on two grounds: it manufactures directories that fail `pnpm contracts` until each rewrite lands, so a dead session strands phantom components; and `declienting` is a record of what the rewrite actually removed, so a script can only emit `[]` — a falsehood in a field nothing downstream checks ([journal](../journal/2026-07-27-auditable-captures-and-capture-action.md)).
- 2026-07-27 — "Accepts the whole `captures/` directory" is an input contract, not a write contract. One invocation, one plan covering all N; execution stays serial with a verify between components ([journal](../journal/2026-07-27-auditable-captures-and-capture-action.md)).
- 2026-07-27 — Capture entries in `report.md` carry no `Verdict:` line. A capture is binary — the entry's presence is the assertion — and inventing a fourth verdict word would mean widening `VERDICT_RE`, which is load-bearing for Candidates ([journal](../journal/2026-07-27-auditable-captures-and-capture-action.md)).
- 2026-07-27 — Captures are named after the canonical, never the project's label. A real run produced `captures/tag.md` declaring `**Badge**`, which a human silently corrected during execution; `capture-canonical` and the preflight's `slug-mismatch` now catch it at both ends ([journal](../journal/2026-07-27-auditable-captures-and-capture-action.md)).

## Open threads

- `provenance.run` is still unenforced downstream. The entry path is closed — no component reaches the library through `Action: capture` without a capture file — but a hand-added component can claim any run, and `orphanedByRun` only fires when someone runs a capture. The real fix is a check in `ui-design-library`, which is that repo's call.
- `ui-design-library`'s own `kebab` lacks this repo's acronym split and accent fold, so `CTAButton` kebabs differently in the two repos. No current canonical triggers it; preflight carries a `kebab-divergence` blocker rather than assuming it stays latent.
- Two structurally-distinct modules that resolve to one canonical still cannot coexist in the library: the fix routes the extra to its own canonical, but a native variant axis (multiple implementations per canonical — variant subdirectories or compound slugs) would let genuine variants coexist without minting a canonical. That is a `ui-design-library` keying / `check-contracts.cjs` redesign, which is that repo's call.
