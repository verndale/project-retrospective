---
date: 2026-08-03
topics: [retrospective-workflow]
plan: none
pr: https://github.com/verndale/project-retrospective/pull/38
draft: ai
---
# feat(project-retrospective): Add specs input handling to project retrosp

## Why

- To add comprehensive specs input handling to the project retrospective skill.
- To support normalization, resolution, and validation processes for specs inputs.
- To improve test coverage and documentation for specs handling in the project retrospective.

## What changed

- Added new normalization script `skills/project-retrospective/scripts/normalize-specs.cjs` with tests in `scripts/tests/normalize-specs.test.cjs`.
- Added test fixtures `scripts/tests/fixtures/fake-output/specs.json` and `scripts/tests/fixtures/fake-specs/specs-raw.json`.
- Updated existing resolution and validation scripts `skills/project-retrospective/scripts/resolve.cjs` and `skills/project-retrospective/scripts/validate-report.cjs` and their tests.
- Modified multiple documentation files under `skills/project-retrospective/references/` to include spec-capture details (e.g., `spec-capture.md`) and updated README and SKILL files accordingly.

## Files

- scripts/tests/fixtures/fake-output/specs.json
- scripts/tests/fixtures/fake-specs/specs-raw.json
- scripts/tests/normalize-specs.test.cjs
- scripts/tests/resolve.test.cjs
- scripts/tests/validate-report.test.cjs
- skills/project-retrospective/README.md
- skills/project-retrospective/SKILL.md
- skills/project-retrospective/references/evidence-rubric.md
- skills/project-retrospective/references/spec-capture.md
- skills/project-retrospective/references/wiki-client-template.md
- skills/project-retrospective/references/wiki-feed.md
- skills/project-retrospective/references/wiki-journal-template.md
- skills/project-retrospective/scripts/normalize-specs.cjs
- skills/project-retrospective/scripts/resolve.cjs
- skills/project-retrospective/scripts/validate-report.cjs
