---
date: 2026-08-08
topics: [retrospective-workflow]
plan: none
pr: https://github.com/verndale/project-retrospective/pull/52
draft: ai
---
# feat(project-retrospective): Update triage schema and related documentat

## Why

- To update the triage schema used in the project-retrospective skill.
- To improve validation scripts and their tests related to the triage schema.
- To enhance related documentation for clarity and accuracy.
- As shown by changes in skills/project-retrospective/references/triage-schema.md and commit dbb2515.

## What changed

- Added a new triage schema reference file at skills/project-retrospective/references/triage-schema.md.
- Modified validation scripts and tests: skills/project-retrospective/scripts/validate-report.cjs and scripts/tests/validate-report.test.cjs.
- Updated the triage.json test fixture (scripts/tests/fixtures/fake-output/triage.json).
- Edited documentation files including skills/project-retrospective/SKILL.md and wiki connection documents.

## Files

- scripts/tests/fixtures/fake-output/triage.json
- scripts/tests/validate-report.test.cjs
- skills/project-retrospective/SKILL.md
- skills/project-retrospective/references/triage-schema.md
- skills/project-retrospective/scripts/validate-report.cjs
