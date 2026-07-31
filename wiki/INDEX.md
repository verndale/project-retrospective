# Context Wiki

Why this repo is the way it is: executed plans, decisions, and change history. Read this index first; open only the pages it routes to.

## Contents

- How to navigate
- Topics
- Journal
- Plans
- Connections

## How to navigate

1. "Why is X like this / what's the design of X" → match X in Topics below; open that one page.
2. "What changed when / history of X" → scan the Journal lines below; open only matching entries.
3. "Was plan X implemented / what plans exist" → [plans/INDEX.md](plans/INDEX.md) is the audit table; archived plan files sit next to it.
4. Full plan detail behind a change → follow the plan link inside the journal entry or topic page.
5. "How does X wire to the rest of the skill/wiki" → [connections.md](connections.md), a small index over the generated map; open the section your question needs: [skill contract](connections/contract.md), [coverage](connections/coverage.md), [document links](connections/links.md), [wiki wiring](connections/wiki-wiring.md).
6. Cross-system "why", wiring, or impact question → agents silently use `pnpm graph:navigate` (`scripts/wiki/navigate.cjs`) before reading files; it returns a deterministic, minimal itinerary. Developers do not need to run or remember this utility.
7. No index hit or no route → grep `wiki/` for the term; then fall back to `git log` / `gh`. Never load the whole wiki.

## Topics

<!-- One line per topic page: [Title](topics/<slug>.md) — hook. Keep alphabetical by slug. -->

- [Brain promotion](topics/brain-promotion.md) — how an approved proposal is applied to a local ui-design-brain checkout, and why the skill stops before committing.
- [Knowledge graph & context wiki](topics/graph-wiki-subsystem.md) — the deterministic graph, its skill-contract integrity gate, the Sigma.js viewer, and the context wiki.
- [Library capture](topics/library-capture.md) — how a run's component captures reach a local ui-design-library checkout, and why the script that gates them writes nothing.
- [Retrospective workflow](topics/retrospective-workflow.md) — the analyze path: inventory, resolution, triage, and the validator that gates the output.
- [Skill authoring](topics/skill-authoring.md) — the frozen section spine for `SKILL.md`, the four-surfaces rule, and the conventions the conformance test enforces.

## Journal

<!-- Reverse-chronological, one line per entry: YYYY-MM-DD — [Title](journal/<file>.md) — hook. -->

- 2026-07-31 — [Read a grouping folder the same way at both scan granularities](journal/2026-07-31-shallow-scan-sibling-folders.md) — the shallow scan collapsed every subfolder to one folder-named component, dropping leaves and emitting phantoms; both scanners now share one rule.
- 2026-07-31 — [Make inventory discovery stack-aware](journal/2026-07-31-stack-aware-inventory-discovery.md) — `stackAdapter` now drives extensions/roots, a filesystem scan unions with the index in both modes, and Storybook counts only where the stack uses it.
- 2026-07-31 — [feat(project-retrospective): Enhance proposal validation logic](journal/2026-07-31-feat-project-retrospective-enhance-proposal-validation-logic.md) — AI-drafted, revise
- 2026-07-30 — [Feed the downstream context-wikis on promote and capture](journal/2026-07-30-downstream-wiki-feed.md) — promote now writes a client-agnostic brain wiki entry and capture a library one, mirroring the Step 6 evidence feed.
- 2026-07-30 — [Feed a client wiki from analyze (Step 6 + meta.json)](journal/2026-07-30-client-wiki-feed.md) — the skill now writes a per-client knowledge wiki in ui-design-evidence and a `meta.json` identity file per run.
- 2026-07-30 — [Defer captures for pending canonicals, and triage variant multiplicity](journal/2026-07-30-defer-captures-and-variant-triage.md) — a mature implementation of a just-promoted pattern can now reach the library via a `deferred` capture (exit 6, promote then re-run), and two modules sharing a canonical are triaged rather than silently dropped.
- 2026-07-27 — [Auditable captures, and a capture action for the library](journal/2026-07-27-auditable-captures-and-capture-action.md) — a component reached the library claiming a run that produced no capture for it; captures now hold two-way parity with the report, and `Action: capture` gives the library leg the shape the catalog leg has.
- 2026-07-27 — [Module edges, so navigation reaches the tooling](journal/2026-07-27-graph-module-edges.md) — added a `requires` edge and indexed all of `scripts/`; isolated nodes went from 18 to 1 and `pnpm graph:navigate` no longer dead-ends on tooling.
- 2026-07-27 — [chore(project-retrospective): merge main and rebuild graph](journal/2026-07-27-chore-project-retrospective-merge-main-and-rebuild-graph.md) — AI-drafted, revise
- 2026-07-26 — [Knowledge graph + context wiki subsystem](journal/2026-07-26-knowledge-graph-wiki-subsystem.md) — ported the deterministic graph and the context wiki from ui-design-brain, with the skill's own contract as the integrity gate in place of a catalog manifest.
- 2026-07-26 — [Building the project-retrospective skill](journal/2026-07-26-build-project-retrospective-skill.md) — what was rejected from the original proposal and why: no subagent fan-out, no 27-field artifact model, no numeric scores, no component taxonomy.

## Plans

- [Plan audit table](plans/INDEX.md) — every plan executed for this repo, with implementation status and evidence.

## Connections

- [Skill + wiki wiring](connections.md) — a small index that routes to the generated map of how the skill, the repo tooling, and the wiki wire together: [skill contract](connections/contract.md), [coverage](connections/coverage.md), [document links](connections/links.md), [wiki wiring](connections/wiki-wiring.md). Rendered from the knowledge graph; **do not hand-edit** — rebuilt by `pnpm graph:build` and verified by `pnpm evals:graph`.
