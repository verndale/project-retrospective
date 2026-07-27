# Connections — Coverage

Which script each suite exercises, how the modules depend on one another, and which surfaces each wiki topic explains. Together these are the "four surfaces move together" rule, made visible.

Part of the [connections map](../connections.md), generated from the knowledge graph — **do not edit by hand**. Rebuilt on every `pnpm graph:build` and verified fresh by `pnpm evals:graph`.

## Test → script

- [inventory.test.cjs](../../scripts/tests/inventory.test.cjs) → [inventory.cjs](../../skills/project-retrospective/scripts/inventory.cjs)
- [resolve.test.cjs](../../scripts/tests/resolve.test.cjs) → [inventory.cjs](../../skills/project-retrospective/scripts/inventory.cjs), [resolve.cjs](../../skills/project-retrospective/scripts/resolve.cjs)
- [skill-conformance.test.cjs](../../scripts/tests/skill-conformance.test.cjs) → [project-retrospective](../../skills/project-retrospective/SKILL.md)
- [validate-report.test.cjs](../../scripts/tests/validate-report.test.cjs) → [validate-report.cjs](../../skills/project-retrospective/scripts/validate-report.cjs)

## Module → module

- [evals/graph-check.cjs](../../scripts/evals/graph-check.cjs) → [graph/build-graph.cjs](../../scripts/graph/build-graph.cjs), [graph/routing.cjs](../../scripts/graph/routing.cjs)
- [graph/build-graph.cjs](../../scripts/graph/build-graph.cjs) → [wiki/lib/frontmatter.cjs](../../scripts/wiki/lib/frontmatter.cjs)
- [build-graph.test.cjs](../../scripts/tests/build-graph.test.cjs) → [graph/build-graph.cjs](../../scripts/graph/build-graph.cjs)
- [inventory.test.cjs](../../scripts/tests/inventory.test.cjs) → [helpers.cjs](../../scripts/tests/helpers.cjs)
- [resolve.test.cjs](../../scripts/tests/resolve.test.cjs) → [helpers.cjs](../../scripts/tests/helpers.cjs)
- [skill-conformance.test.cjs](../../scripts/tests/skill-conformance.test.cjs) → [graph/build-graph.cjs](../../scripts/graph/build-graph.cjs), [helpers.cjs](../../scripts/tests/helpers.cjs)
- [validate-report.test.cjs](../../scripts/tests/validate-report.test.cjs) → [helpers.cjs](../../scripts/tests/helpers.cjs)
- [wiki/archive-plan.cjs](../../scripts/wiki/archive-plan.cjs) → [wiki/lib/codex-plans.cjs](../../scripts/wiki/lib/codex-plans.cjs), [wiki/lib/wiki-io.cjs](../../scripts/wiki/lib/wiki-io.cjs)
- [wiki/ci-journal-warn.cjs](../../scripts/wiki/ci-journal-warn.cjs) → [wiki/lib/substantive.cjs](../../scripts/wiki/lib/substantive.cjs)
- [wiki/find-unarchived-plans.cjs](../../scripts/wiki/find-unarchived-plans.cjs) → [wiki/archive-plan.cjs](../../scripts/wiki/archive-plan.cjs), [wiki/lib/codex-plans.cjs](../../scripts/wiki/lib/codex-plans.cjs)
- [wiki/navigate.cjs](../../scripts/wiki/navigate.cjs) → [graph/build-graph.cjs](../../scripts/graph/build-graph.cjs), [graph/routing.cjs](../../scripts/graph/routing.cjs)
- [wiki/on-merge-sync.cjs](../../scripts/wiki/on-merge-sync.cjs) → [wiki/lib/ai.cjs](../../scripts/wiki/lib/ai.cjs), [wiki/lib/frontmatter.cjs](../../scripts/wiki/lib/frontmatter.cjs), [wiki/lib/substantive.cjs](../../scripts/wiki/lib/substantive.cjs), [wiki/lib/wiki-io.cjs](../../scripts/wiki/lib/wiki-io.cjs)
- [wiki/pre-commit-journal.cjs](../../scripts/wiki/pre-commit-journal.cjs) → [wiki/lib/substantive.cjs](../../scripts/wiki/lib/substantive.cjs)
- [inventory.cjs](../../skills/project-retrospective/scripts/inventory.cjs) → [util.cjs](../../skills/project-retrospective/scripts/lib/util.cjs)
- [resolve.cjs](../../skills/project-retrospective/scripts/resolve.cjs) → [util.cjs](../../skills/project-retrospective/scripts/lib/util.cjs)
- [validate-report.cjs](../../skills/project-retrospective/scripts/validate-report.cjs) → [util.cjs](../../skills/project-retrospective/scripts/lib/util.cjs)

## Topic → covered surface

- [Brain promotion — Design History](../../wiki/topics/brain-promotion.md) → [Brain integrity checklist](../../skills/project-retrospective/references/brain-integrity-checklist.md)
- [Knowledge graph & context wiki — Design History](../../wiki/topics/graph-wiki-subsystem.md) → [evals/graph-check.cjs](../../scripts/evals/graph-check.cjs), [Knowledge graph](../../scripts/graph/README.md), [graph/build-graph.cjs](../../scripts/graph/build-graph.cjs), [graph/serve.cjs](../../scripts/graph/serve.cjs), [wiki/refresh-issue-state.cjs](../../scripts/wiki/refresh-issue-state.cjs), [Wiki Mechanics](../../wiki/MECHANICS.md)
- [Retrospective workflow — Design History](../../wiki/topics/retrospective-workflow.md) → [project-retrospective](../../skills/project-retrospective/SKILL.md), [inventory.cjs](../../skills/project-retrospective/scripts/inventory.cjs), [resolve.cjs](../../skills/project-retrospective/scripts/resolve.cjs), [validate-report.cjs](../../skills/project-retrospective/scripts/validate-report.cjs)
- [Skill authoring — Design History](../../wiki/topics/skill-authoring.md) → [Contributing](../../CONTRIBUTING.md), [Skill file structure — section reference](../../skills/_meta/_sections.md)
