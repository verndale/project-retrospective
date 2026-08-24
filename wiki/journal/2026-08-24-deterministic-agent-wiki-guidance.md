---
date: 2026-08-24
topics: [graph-wiki-subsystem]
plan: plans/2026-08-24-deterministic-route-first-wiki-guidance-and-pr-127-recovery.md
pr: https://github.com/verndale/project-retrospective/pull/84
---
# Make agent wiki guidance deterministic

## Why

The repository's navigation prose had drifted from the shared route-first contract and allowed a broader wiki fallback than intended.

## What changed

Installed the canonical headless managed block with exact source/history/cross-page routing, weighted shortest-route trust, sequential reading, exact-ID ambiguity retries, and one fixed-string fallback. Repository-specific graph lifecycle, GitHub evidence, authoring, and public-data boundaries remain outside the block.

## Files

- `AGENTS.md`
- `wiki/`
