---
date: 2026-08-03
topics: [retrospective-workflow]
plan: none
pr: https://github.com/verndale/project-retrospective/pull/36
draft: ai
---
# fix(project-retrospective): Update memory archive logic to exclude index

## Why

- To fix the memory archive logic to exclude the index file as intended.
- To align with the change introduced in commit d38352b.

## What changed

- Modified `skills/project-retrospective/scripts/archive-memory.cjs` to update the archive logic excluding the index file.
- Updated tests in `scripts/tests/archive-memory.test.cjs` and test fixtures in `scripts/tests/fixtures/fake-output/memory-archive.json` to cover the new exclusion logic.
- Made minor adjustments to `scripts/graph/data/graph.json` and `skills/project-retrospective/references/wiki-feed.md` related to the archive changes.
- Changes summarized in commit d38352b fixing the exclusion of the index file from the memory archive.

## Files

- scripts/tests/archive-memory.test.cjs
- scripts/tests/fixtures/fake-output/memory-archive.json
- skills/project-retrospective/references/wiki-feed.md
- skills/project-retrospective/scripts/archive-memory.cjs
