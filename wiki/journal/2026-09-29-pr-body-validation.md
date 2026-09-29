---
date: 2026-09-29
topics: [graph-wiki-subsystem]
plan: none
pr: https://github.com/verndale/project-retrospective/pull/115
issue: https://github.com/verndale/project-retrospective/issues/114
issues: ["https://github.com/verndale/project-retrospective/issues/114"]
---
# Reject hidden PR descriptions

## Why
- The canonical PR gate accepted a body whose headings and content were entirely inside an HTML comment or code fence.
- Example headings inside comments or fences could also disrupt a valid description.

## What changed
- Section boundaries now come from visible, same-line headings outside comments and Markdown fences.
- Focused tests cover the template contract, malformed headings, hidden bodies, legacy tooling absence, and the pinned package manager.
- Fenced verification evidence remains permitted under a real section.

## Files
- `scripts/validate_pr_body.cjs`
- `scripts/tests/wiki-standard.test.cjs`
