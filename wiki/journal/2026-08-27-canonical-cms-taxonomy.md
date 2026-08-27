---
date: 2026-08-27
topics: [retrospective-workflow]
plan: none
pr: https://github.com/verndale/project-retrospective/pull/88
issue: https://github.com/verndale/project-retrospective/issues/87
issues: [https://github.com/verndale/project-retrospective/issues/87]
---
# Canonicalize CMS identity in retrospective runs

## Why

- Run metadata used adapter-era CMS keys and model-written display labels, so evidence producers could disagree about the same platform.
- Treating CMS recognition as discovery support would invent component-scanning behavior for platforms this skill has not profiled.
- The coordinated migration intentionally removes runtime aliases; new evidence must expose drift rather than prolong it.

## What changed

Added a deterministic seven-entry CMS catalog that emits exact key/label metadata from inventory. Kept Contentstack, Optimizely SaaS, and SitecoreAI discovery profiles separate from the catalog; recognized CMS identities without a profile now use the broad scan with a specific capability warning.

The discovery-profile registry now uses an own-key lookup so prototype-shaped unknown adapter values cannot masquerade as profiles and crash inventory. They follow the same warning-backed broad fallback as every other unknown adapter.

The report validator now requires canonical `meta.platform`/`meta.platformDisplay`, parity with inventory metadata, and the same exact pair in the report Run table. Legacy keys remain documented only as rejected inputs; historical normalization stays at the evidence repository's read boundary.

## Files

- `skills/project-retrospective/scripts/lib/cms-taxonomy.cjs`
- `skills/project-retrospective/scripts/inventory.cjs`
- `skills/project-retrospective/scripts/validate-report.cjs`
- `skills/project-retrospective/references/cms-taxonomy.md`
- `scripts/tests/inventory.test.cjs`
- `scripts/tests/validate-report.test.cjs`

## Follow-ups

- Land the coordinated evidence-repository historical read normalization before relying on legacy runs as consumers. Tracking: [verndale/project-retrospective issue #87](https://github.com/verndale/project-retrospective/issues/87).
