# Connections — Coverage

Which script each suite exercises, and which surfaces each wiki topic explains. Together these are the "four surfaces move together" rule, made visible.

Part of the [connections map](../connections.md), generated from the knowledge graph — **do not edit by hand**. Rebuilt on every `pnpm graph:build` and verified fresh by `pnpm evals:graph`.

## Test → script

- [build-graph.test.cjs](../../scripts/tests/build-graph.test.cjs) → [project-retrospective](../../skills/project-retrospective/SKILL.md)
- [inventory.test.cjs](../../scripts/tests/inventory.test.cjs) → [inventory.cjs](../../skills/project-retrospective/scripts/inventory.cjs)
- [resolve.test.cjs](../../scripts/tests/resolve.test.cjs) → [inventory.cjs](../../skills/project-retrospective/scripts/inventory.cjs), [resolve.cjs](../../skills/project-retrospective/scripts/resolve.cjs)
- [skill-conformance.test.cjs](../../scripts/tests/skill-conformance.test.cjs) → [project-retrospective](../../skills/project-retrospective/SKILL.md)
- [validate-report.test.cjs](../../scripts/tests/validate-report.test.cjs) → [validate-report.cjs](../../skills/project-retrospective/scripts/validate-report.cjs)

## Topic → covered surface

- [Brain promotion — Design History](../../wiki/topics/brain-promotion.md) → [Brain integrity checklist](../../skills/project-retrospective/references/brain-integrity-checklist.md)
- [Knowledge graph & context wiki — Design History](../../wiki/topics/graph-wiki-subsystem.md) → [evals/graph-check.cjs](../../scripts/evals/graph-check.cjs), [graph/build-graph.cjs](../../scripts/graph/build-graph.cjs), [Wiki Mechanics](../../wiki/MECHANICS.md)
- [Retrospective workflow — Design History](../../wiki/topics/retrospective-workflow.md) → [project-retrospective](../../skills/project-retrospective/SKILL.md), [inventory.cjs](../../skills/project-retrospective/scripts/inventory.cjs), [resolve.cjs](../../skills/project-retrospective/scripts/resolve.cjs), [validate-report.cjs](../../skills/project-retrospective/scripts/validate-report.cjs)
- [Skill authoring — Design History](../../wiki/topics/skill-authoring.md) → [Contributing](../../CONTRIBUTING.md), [Skill file structure — section reference](../../skills/_meta/_sections.md)
