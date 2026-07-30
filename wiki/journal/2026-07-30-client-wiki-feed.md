---
date: 2026-07-30
topics: [retrospective-workflow]
plan: none
pr: pending
---
# Feed a client wiki from analyze (Step 6 + meta.json)

## Why

- The skill promoted runs to ui-design-evidence but never recorded, per client, what projects were run and what happened in each. Client identity lived only in the report H1 prose, invisible to any downstream tool.

## What changed

- Added Step 6 to `analyze`: after a run, upsert `<Data>/wiki/clients/<client-slug>.md` and append `<Data>/wiki/journal/<date>-<project-slug>.md` in the ui-design-evidence checkout; skips in the home fallback.
- Added a `Client` input and a client-identity resolution order — the client-slug is distinct from the project-slug (one client may own several).
- New run artifact `meta.json` (schemaVersion 1: client, project, platform, date, scope, priorReports), model-written in Step 4 and validated by `validate-report.cjs` (`checkMeta`) at full/candidates scope: kebab slugs, and slug/date must match the run directory.
- New references `wiki-feed.md`, `wiki-client-template.md`, `wiki-journal-template.md`; the report Run table gains Client + Platform rows.
- Ruled out: emitting `meta.json` from `inventory.cjs`/`resolve.cjs` — those stay deterministic and client-agnostic, so the one judgment field (client identity) is model-written. Ruled out a meta.scope agreement check — it conflicts with running the validator at a different `--scope` than a run recorded.

## Files

- skills/project-retrospective/SKILL.md
- skills/project-retrospective/references/{wiki-feed,wiki-client-template,wiki-journal-template,report-template}.md
- skills/project-retrospective/scripts/validate-report.cjs
- scripts/tests/validate-report.test.cjs, scripts/tests/fixtures/fake-output/meta.json

## Follow-ups

- The wiki consumer — builder, coverage gate, backfill — lives in ui-design-evidence (tracked in verndale/ui-design-evidence#1).
