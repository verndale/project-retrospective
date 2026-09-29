---
date: 2026-09-29
topics: []
plan: none
pr: https://github.com/verndale/project-retrospective/pull/111
issue: https://github.com/verndale/project-retrospective/issues/110
issues: ["https://github.com/verndale/project-retrospective/issues/110"]
---
# Use the existing fast test suite in Release

## Why
- The first hosted Release run after the Git delivery merge stopped before release analysis because `test:unit` does not exist in this repository.
- Main-branch Quality passed, but that did not validate the separate Release job's test command.

## What changed
- Release runs the existing `test:fast` suite before semantic-release.
- The correction is a tooling chore, so it does not request a package version change.

## Files
- `.github/workflows/release.yml`
- `package.json`
