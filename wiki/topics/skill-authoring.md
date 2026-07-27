---
aliases: [skill authoring, section spine, SKILL.md structure, four surfaces, conformance test, authoring standard]
covers: [skills/_meta/_sections.md, CONTRIBUTING.md]
---
# Skill authoring — Design History

How `SKILL.md` is allowed to be shaped in this repo, and what enforces it.

## Current state

- `skills/_meta/_sections.md` is authoritative for `SKILL.md`'s structure and is authoring-only: never loaded at runtime, never vendored with the skill.
- The H2 order is frozen: `## Contents`, `## Use when`, `## First-hop references`, `## Workflow`, `## Inputs and outputs`, `## Validation loops`, `## Guardrails`. A domain-specific section may be inserted only between `## Inputs and outputs` and `## Validation loops`.
- Frontmatter carries `name` and `description` and nothing else. The description is third person, under 1024 characters, and states both what the skill does and when to use it.
- Progressive disclosure is one level deep: every `references/*.md` links directly from `SKILL.md`, and no reference links to another reference. The references are leaf nodes by design; the knowledge graph asserts the same rule structurally, failing when a reference links to another reference.
- `scripts/tests/skill-conformance.test.cjs` lints all of the above: frontmatter keys, slug/dirname agreement, description shape, body line budget, section order, `## Contents` on any file over the threshold, no Windows paths, no real home-directory paths, and that every reference link and every named script resolves on disk.
- The four surfaces — a workflow step, the reference it names, the script it invokes, and the test that exercises it — move together. `wiki/connections/coverage.md` renders that rule as data.

## Decisions

- 2026-07-26 — Kept the catalog flat and the manifest at four fields rather than adopting the original proposal's 27-field artifact model and Primitive/Component/Module taxonomy; evidence lives in retrospective reports, not in skill metadata ([journal](../journal/2026-07-26-build-project-retrospective-skill.md), [plan](../plans/2026-07-26-project-retrospective-critique-build-plan.md)).
- 2026-07-26 — Made the conformance test's two extractors the single source of truth for what `SKILL.md` declares, so the lint gate and the graph gate cannot drift apart ([journal](../journal/2026-07-26-knowledge-graph-wiki-subsystem.md), [plan](../plans/2026-07-26-port-the-knowledge-graph-context-wiki-subsystem-into-project.md)).
