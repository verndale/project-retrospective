---
date: 2026-07-30
topics: [brain-promotion, library-capture]
plan: none
pr: https://github.com/verndale/project-retrospective/pull/19
issue: https://github.com/verndale/project-retrospective/issues/18
---
# Feed the downstream context-wikis on promote and capture

## Why

- `promote` and `capture` edited the ui-design-brain and ui-design-library working trees but never authored the context-wiki journal entry each repo's own `wiki/MECHANICS.md` calls for. The maintainer wrote it by hand afterward; the downstream pre-commit hook only *warns* when a substantive change stages no entry.
- `analyze` Step 6 already feeds the evidence *client* wiki (#15). The promote and capture legs were the remaining gap — the skill touched all three repos but authored a wiki entry in only one.

## What changed

- Added a **Wiki** step to `Action: promote` (ui-design-brain) and `Action: capture` (ui-design-library): after the existing verify, author a client-agnostic `wiki/journal/<date>-<change-slug>.md` + one `wiki/INDEX.md` line, plus a `component-catalog` Decisions bullet (promote only), then rebuild `wiki/connections*` via the downstream repo's own `build-graph`. Skipped when the checkout has no `wiki/`; a `deferred`/`blocked` capture writes no entry.
- New shared reference `references/downstream-wiki.md` holds the common contract; the two integrity checklists each gained a `## Wiki` section pointing at it. The downstream `wiki/MECHANICS.md` stays authoritative for format — the reference adds only the data boundary, the skip rule, and the grounding.
- The data boundary is a **positive allowlist**, not a blocklist: the run slug is not automatically safe — a real one is `runs/canadian-national/2026-07-26/`, where the slug *is* the client. Safe to cite: canonical, count delta, platform adapter key, recurrence count, de-client prose. Forbidden: client name, run-slug/source path in prose, client-naming `declienting` strings; provenance stays in `component.json`.
- Ruled out: a new writer script (kept model-authored, matching the Step 6 precedent and "scripts decide structure; the model writes prose"); two per-repo mirror references (the two MECHANICS are ~90% identical, so one shared file avoids duplicated templates that drift); any change to `validate-report.cjs` (it validates analyze output only, not the downstream trees).

## Files

- skills/project-retrospective/SKILL.md
- skills/project-retrospective/references/downstream-wiki.md (new)
- skills/project-retrospective/references/brain-integrity-checklist.md
- skills/project-retrospective/references/library-integrity-checklist.md
- skills/project-retrospective/README.md

## Follow-ups

- Each downstream repo's own wiki-sync bot fills `pr: pending` on merge; the entries the skill writes are the richer authored version those bots would otherwise stub.
