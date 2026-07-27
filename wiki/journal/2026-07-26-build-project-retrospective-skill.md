---
date: 2026-07-26
topics: [skill-authoring, retrospective-workflow, brain-promotion]
plan: plans/2026-07-26-project-retrospective-critique-build-plan.md
pr: https://github.com/verndale/project-retrospective/pull/1
---
# Building the project-retrospective skill

## Why

- A proposal for a "Frontend Platform Intelligence System" arrived with a sound vision — projects are temporary, knowledge is permanent — and machinery that contradicted how the three repos actually work.
- Most of the proposed machinery either already existed or fought the catalog's own philosophy, so the vision was kept and the machinery replaced.
- The decisions below are the ones `git log` cannot recover: they are all things that were *not* built, and why.

## What changed

Four pieces of the original proposal were rejected outright:

- **20 subagents.** Contradicts the house rule that policy and code decide structure while AI writes prose only. Discovery, resolution, and validation are deterministic scripts; judgment is needed only for triage and drafting. One skill, a phased workflow, three scripts.
- **A 27-field canonical artifact model.** The catalog's manifest is four fields by design — consumer-evidenced minimalism. A 27-field model is a catalog redesign, which the proposal itself forbade. Evidence lives in retrospective reports, not in catalog metadata.
- **Numeric promotion, architectural, and confidence scores.** Uncalibrated numbers are noise. The catalog's actual promotion precedent was to count high-frequency unresolved labels across consumer repos and require consumer-evidenced naming. Verdicts are Promote / Watch / Reject with cited evidence.
- **A Primitive / Component / Module / Layout taxonomy.** The catalog is deliberately flat. Bucket evidence comes free from the pipeline's own config and is recorded as evidence rather than imposed as a hierarchy.

Three further decisions worth keeping:

- **The knowledge graph is a derived rendering, never a source of truth.** The proposal had this inverted. Files are truth; the graph is a view over them, rebuilt deterministically with no LLM in the loop.
- **Promote edits the catalog manifest textually.** Parsing and re-serializing it with `JSON.stringify` reformats six hand-formatted context-alias entries and turns a six-line insert into a thirty-line diff. Found during a promote rehearsal against a disposable copy of the catalog checkout.
- **Captures are orthogonal to promotion.** The best component-library candidates are labels that already *resolve* — a mature Card or Modal — not novel ones. Novel labels are catalog-vocabulary candidates; resolved ones are implementation candidates. Different tracks, different outputs.

## Files

- `skills/project-retrospective/` — `SKILL.md`, `README.md`, nine `references/*.md`, three scripts plus `lib/util.cjs`
- `skills/_meta/_sections.md` — the authoring standard
- `scripts/tests/` — four suites over synthetic fixtures

## Follow-ups

- The deferred cross-project graph did not land here; it shipped in the private evidence repo instead, and the single planned data repo became two so one client's build can never contain another client's evidence.
