---
date: 2026-08-02
topics: [retrospective-workflow]
plan: none
pr: pending
---
# Spec capture: deterministic completeness + REST-API fetch

## Why

- Spec capture (Step 1b) fetched Confluence pages through the Atlassian MCP, which proved unreliable at scale. `searchConfluenceUsingCql` silently returned a *partial* node set — a batch with 16 pages came back with 1 — and `getConfluencePage` intermittently returned a *different* page than the id requested. Both under-capture specs with no signal.
- Completeness was left to the model comparing counts in prose. That is exactly the mechanical judgment the skill's design says belongs in a script, not the model.

## What changed

- **Completeness moved from prose to the script.** `normalize-specs.cjs` now dedupes the raw capture by `pageId` and reconciles it against a per-batch enumeration the capture records (`source.batches[].{totalCount, pageIds}`), emitting `batch-enumeration-incomplete`, `spec-uncaptured`, `spec-unexpected`, and `duplicate-page` warnings. The reconciliation is opt-in and backward compatible — omit `source.batches` and it is skipped.
- **Fetch moved to the Atlassian REST API.** It is id-addressed, so it never truncates a search or returns the wrong page — the two MCP failure modes. Pages are pulled as ADF and rendered to markdown by a new vendored, offline, zero-dep script, `adf-to-markdown.cjs`, which reproduces the exact structures `normalize-specs.cjs` parses (Page Properties table, `##`/`###` headings, Editable Fields / Dynamic Data tables, `**bold**` Style Options, numbered Component Elements promoted to `### N.`). The MCP path stays documented as a fallback.
- **Validated against ground truth.** The converter was checked against 19 MCP-markdown bodies: normalize's extraction (Document Status, baseType, field/a11y/variant counts) is identical; the only difference is Document Status casing, which every gate compares case-insensitively.

## Ruled out

- A storage/rendered-HTML → markdown converter: Confluence storage is macro-heavy XHTML and fragile to convert; ADF is structured JSON and deterministic to walk.
- Re-introducing a curated spec index for completeness — the enumeration lives inside the model's own capture (`source.batches`), not a separate hand-maintained file, and the component label still comes from the page title.

## Files

- `skills/project-retrospective/scripts/adf-to-markdown.cjs` (new), `scripts/tests/adf-to-markdown.test.cjs` (new)
- `skills/project-retrospective/scripts/normalize-specs.cjs`, `scripts/tests/normalize-specs.test.cjs`
- `skills/project-retrospective/references/spec-capture.md`, `skills/project-retrospective/SKILL.md`
