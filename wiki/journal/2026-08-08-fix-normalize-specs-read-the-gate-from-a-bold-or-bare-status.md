---
date: 2026-08-08
topics: [retrospective-workflow]
plan: none
pr: https://github.com/verndale/project-retrospective/pull/49
draft: ai
---
# fix(normalize-specs): Read the gate from a bold or bare Status row

## Why

- The gate status reading logic needed to correctly handle both bold and bare Status rows for accurate parsing.
- Improve the robustness of the normalize-specs script's parsing behavior.

## What changed

- Updated normalize-specs.cjs to read gate status from either a bold or bare Status row (commit 1f51385).
- Added tests in normalize-specs.test.cjs to verify the updated parsing logic.
- Minor related changes in scripts/graph/data/graph.json.

## Files

- scripts/tests/normalize-specs.test.cjs
- skills/project-retrospective/scripts/normalize-specs.cjs
