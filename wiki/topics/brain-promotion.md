---
aliases: [promote action, catalog integrity checklist, manifest edit, alias proposal, pattern proposal, handback]
covers: [skills/project-retrospective/references/brain-integrity-checklist.md]
---
# Brain promotion — Design History

How an approved proposal is applied to a local ui-design-brain checkout, and why the skill stops before committing.

## Current state

- Promote edits a local `ui-design-brain` working tree and nothing else. It never commits, pushes, or opens a pull request there, and it never edits `ai-orchestration` — pipeline findings are paste-ready drafts the maintainer carries over.
- The catalog's integrity is five things moving together: the manifest entry, `index.md`, the pattern file, the README pattern count at every occurrence, and the context-alias table. `references/brain-integrity-checklist.md` holds the ordered procedure per proposal type.
- Verification runs the brain's own `scripts/graph/build-graph.cjs` from the brain root. That build fails on a dangling manifest-to-file edge, which makes it the catalog's sanctioned validator — the same idea this repo now applies to its own skill contract.
- The handback is a fixed shape: the edited-file list, the verification result, and a suggested commit in the brain's own history style. The maintainer runs `pnpm commit` inside the brain.
- Aliases require consumer evidence — a label an analyzed project actually used. Child-part names are never proposed as aliases or patterns, and context-scoped aliases never land without their counterpart.

## Decisions

- 2026-07-31 — feat(project-retrospective): Enhance proposal validation logic ([PR #21](https://github.com/verndale/project-retrospective/pull/21))
- 2026-07-30 — feat(project-retrospective): Update graph data and enhance documentation ([PR #19](https://github.com/verndale/project-retrospective/pull/19))
- 2026-07-30 — promote now authors a client-agnostic context-wiki entry in ui-design-brain (a `wiki/journal/` entry, one `wiki/INDEX.md` line, and a `component-catalog` Decisions bullet), following that repo's own `wiki/MECHANICS.md` and rebuilding `wiki/connections*` via its own `build-graph` — the same run the catalog verify already makes, re-run after the wiki edit. Client identity is barred by a positive allowlist, not a blocklist: the run slug can *be* the client (`runs/canadian-national/…`), so entries cite recurrence and the catalog delta, never the client ([journal](../journal/2026-07-30-downstream-wiki-feed.md)).
- 2026-07-27 — chore(ci): Add workflows for wiki issue synchronization ([PR #1](https://github.com/verndale/project-retrospective/pull/1))
- 2026-07-26 — The manifest is edited textually rather than parsed and re-serialized. `JSON.stringify` reformats six hand-formatted context-alias entries and turns a six-line insert into a thirty-line diff; found during a promote rehearsal on a disposable copy of the brain ([journal](../journal/2026-07-26-build-project-retrospective-skill.md), [plan](../plans/2026-07-26-project-retrospective-critique-build-plan.md)).
- 2026-07-26 — Promotion targets the brain's vocabulary only. The original proposal's shared component repository was dropped: the brain deliberately contains zero implementation, and creating one is a separate organizational decision the retrospective must not depend on ([plan](../plans/2026-07-26-project-retrospective-critique-build-plan.md)).
