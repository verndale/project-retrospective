---
aliases: [promote action, catalog integrity checklist, manifest edit, alias proposal, pattern proposal, handback]
covers: [skills/project-retrospective/references/brain-integrity-checklist.md]
---
# Brain promotion — Design History

How a validated proposal is applied to ui-design-brain and carried through its authorized publication boundary.

## Current state

- Promote edits the issue-keyed `ui-design-brain` branch and never edits `ai-orchestration` — pipeline findings are paste-ready drafts the maintainer carries over. Default `merge` lands the green PR and continues into captures; `pull-request` and `working-tree` are explicit stop-early overrides. A validator-passing Promote proposal needs no second human approval.
- The catalog's integrity is five things moving together: the manifest entry, `index.md`, the pattern file, the README pattern count at every occurrence, and the context-alias table. `references/brain-integrity-checklist.md` holds the ordered procedure per proposal type.
- Verification runs the brain's own `scripts/graph/build-graph.cjs` from the brain root. That build fails on a dangling manifest-to-file edge, which makes it the catalog's sanctioned validator — the same idea this repo now applies to its own skill contract.
- The handback is a fixed shape: exact next action, edited-file list, verification, issue, branch, publication state, and PR URL or one exact authorization question.
- Aliases require consumer evidence — a label an analyzed project actually used. Child-part names are never proposed as aliases or patterns, and context-scoped aliases never land without their counterpart.

## Decisions

- 2026-09-17 — Made Brain publication and dependent capture continuation automatic by default for retrospective-owned issue branches, while preserving explicit stop-early overrides ([issue #96](https://github.com/verndale/project-retrospective/issues/96), [journal](../journal/2026-09-17-default-merge-publication.md)).
- 2026-09-17 — Made validator-passing Promote proposals executable in full merge mode and continued through green Brain merge and unlocked captures without a second approval prompt ([issue #96](https://github.com/verndale/project-retrospective/issues/96), [journal](../journal/2026-09-17-hands-off-publication-handoff.md)).
- 2026-07-31 — feat(project-retrospective): Enhance proposal validation logic ([PR #21](https://github.com/verndale/project-retrospective/pull/21))
- 2026-07-30 — feat(project-retrospective): Update graph data and enhance documentation ([PR #19](https://github.com/verndale/project-retrospective/pull/19))
- 2026-07-30 — promote now authors a client-agnostic context-wiki entry in ui-design-brain (a `wiki/journal/` entry, one `wiki/INDEX.md` line, and a `component-catalog` Decisions bullet), following that repo's own `wiki/MECHANICS.md` and rebuilding `wiki/connections*` via its own `build-graph` — the same run the catalog verify already makes, re-run after the wiki edit. Client identity is barred by a positive allowlist, not a blocklist: the run slug can *be* the client (`runs/canadian-national/…`), so entries cite recurrence and the catalog delta, never the client ([journal](../journal/2026-07-30-downstream-wiki-feed.md)).
- 2026-07-27 — chore(ci): Add workflows for wiki issue synchronization ([PR #1](https://github.com/verndale/project-retrospective/pull/1))
- 2026-07-26 — The manifest is edited textually rather than parsed and re-serialized. `JSON.stringify` reformats six hand-formatted context-alias entries and turns a six-line insert into a thirty-line diff; found during a promote rehearsal on a disposable copy of the brain ([journal](../journal/2026-07-26-build-project-retrospective-skill.md), [plan](../plans/2026-07-26-project-retrospective-critique-build-plan.md)).
- 2026-07-26 — Promotion targets the brain's vocabulary only. The original proposal's shared component repository was dropped: the brain deliberately contains zero implementation, and creating one is a separate organizational decision the retrospective must not depend on ([plan](../plans/2026-07-26-project-retrospective-critique-build-plan.md)).
