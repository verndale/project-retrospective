---
date: 2026-08-03
topics: [retrospective-workflow]
plan: none
pr: https://github.com/verndale/project-retrospective/pull/40
---
# Prior-art dedup for captures/proposals, and spec images

## Why

- A retrospective run drafted a capture for a component (Breadcrumbs) that a prior run had already captured and seeded into ui-design-library. The analyze draft step had no check against prior art — the duplicate guard only exists at `Action: capture` time (`capture-preflight.cjs` against a Library), which the analyze path does not have.
- Confluence functional specs that embed their Wireframes / Design Flats as **images** (rather than a Figma link) lost those images entirely: `adf-to-markdown.cjs` dropped every media node, so the archived spec carried the captions but not the figures.

## What changed

- **`validate-report.cjs --data <ui-design-evidence>`** flags a capture or proposal this run drafts that an earlier run already made — `capture-duplicate` (the library already holds it) and `proposal-duplicate` (promote the existing one instead of filing a second). Advisory warnings, deterministic, keyed on prior *artifacts* — so cross-run recurrence that was never captured/promoted stays legitimate evidence (e.g. Stat proposed by two clients) rather than a false positive.
- **`adf-to-markdown.cjs` renders media** as markdown image links: a Confluence file attachment becomes `![alt](<base>/wiki/download/attachments/<pageId>/<file>)` (page id from the `contentId-<id>` collection, filename from `alt`), external media use their url, and captions render beneath. A new `--base-url` makes the links absolute so they resolve in the archived spec.

## Ruled out

- Removing the historical duplicate proposals from past runs — two clients independently proposing Stat is the recurrence record that promoted it, not spurious duplication. The check surfaces future duplicates; it does not rewrite history.
- Downloading the attachment binaries into the archive — "proper markdown for images" is the image reference; a working link into the private Confluence keeps the archive light and is enough for a reference archive.

## Files

- `skills/project-retrospective/scripts/validate-report.cjs`, `scripts/tests/validate-report.test.cjs`
- `skills/project-retrospective/scripts/adf-to-markdown.cjs`, `scripts/tests/adf-to-markdown.test.cjs`
- `skills/project-retrospective/references/spec-capture.md`, `skills/project-retrospective/SKILL.md`
