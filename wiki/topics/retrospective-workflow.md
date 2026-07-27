---
aliases: [analyze path, retrospective run, component inventory, label resolution, evidence triage, promote watch reject]
covers: [skills/project-retrospective/SKILL.md, skills/project-retrospective/scripts/inventory.cjs, skills/project-retrospective/scripts/resolve.cjs, skills/project-retrospective/scripts/validate-report.cjs]
---
# Retrospective workflow — Design History

The analyze path: what a completed project is read for, how its labels are resolved, and what gates the output.

## Current state

- Three deterministic scripts do the mechanical work. `inventory.cjs` reads pipeline artifacts (build packs, component index, fingerprints, project memory) and degrades to a code scan when they are absent. `resolve.cjs` matches every component label against the ui-design-brain manifest. `validate-report.cjs` is the sanctioned validator for a run's output directory.
- Resolution is exact after normalization — lowercase, camelCase-boundary split, spaces and underscores collapsed to hyphens. No stemming, no plural folding, no nearest-match. A label resolves or it is novel.
- A label that maps to two canonicals through a context-scoped alias is reported `ambiguous` with its candidates; the script never picks. The model confirms from usage evidence or demotes the label to unresolved.
- The model's only job is judgment: triage into Promote / Watch / Reject with cited evidence, then draft prose. Verdicts carry evidence paths, never numeric scores.
- The validator runs under a stated cap of three attempts. On the third failure the run stops and reports the remaining failures verbatim rather than reshaping output to satisfy the validator.
- Captures are a separate track from proposals: the best component-library candidates are labels that already resolve cleanly, not novel ones.

## Decisions

- 2026-07-27 — feat(project-retrospective): Enhance graph builder to include module ([PR #7](https://github.com/verndale/project-retrospective/pull/7))
- 2026-07-27 — chore(ci): Add workflows for wiki issue synchronization ([PR #1](https://github.com/verndale/project-retrospective/pull/1))
- 2026-07-26 — Rejected the original proposal's 20-subagent fan-out and its numeric promotion, architectural, and confidence scores. Discovery, resolution, and validation are deterministic scripts; uncalibrated numbers are noise ([journal](../journal/2026-07-26-build-project-retrospective-skill.md), [plan](../plans/2026-07-26-project-retrospective-critique-build-plan.md)).
- 2026-07-26 — Reversed the plan's in-project `Output:` default. The analyzed project is strictly read-only; runs land in the private evidence repo instead ([plan](../plans/2026-07-26-project-retrospective-critique-build-plan.md)).
