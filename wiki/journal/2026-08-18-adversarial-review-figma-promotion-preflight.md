---
date: 2026-08-18
topics: [library-capture]
plan: none
pr: pending
issue: https://github.com/verndale/project-retrospective/issues/69
---
# Harden Figma promotion preflight after adversarial review

## Why

- Preflight treated any parseable registry, any checklist file, and any non-empty named package scripts as a ready promotion interface.
- That allowed empty placeholders or `echo` commands to claim readiness without the established left-rail, responsive, unpublished, review, or read-only-live contracts.
- The output did not express the write-capability, publication-state, or review-pass requirements as machine-readable fields, and the skill could be read as accepting a REST API token for writes.
- Code Connect checks covered the known legacy paths but not disguised package commands, lockfile residue, nested registry metadata, or templates elsewhere in the target checkout.

## What changed

- Required the target registry to expose explicit-maintainer publication, read-only CI, direct canonical handoff, outside annotations, and the governed 1440/1024/768/390 widths.
- Required the checklist to name the 528px left rail, Button/Section header/Alert references, responsive widths, unpublished state, and both review passes.
- Required exact downstream script implementations and added machine-readable write-capability, unpublished publication, and adversarial/design fields.
- Required the complete code/story/browser/accessibility/motion suite before any Figma write, keeping only Figma-dependent coverage for the post-registration phase.
- Broadened Code Connect rejection across package metadata, commands, registry keys/values, lockfiles, legacy directories, and template/config filenames.
- Corrected the skill sequence so a read-only REST token never satisfies Figma writes and a component cannot advance until review evidence and final gates pass.

## Files

- `skills/project-retrospective/scripts/capture-preflight.cjs`
- `skills/project-retrospective/SKILL.md`
- `skills/project-retrospective/references/library-integrity-checklist.md`
- `scripts/tests/capture-preflight.test.cjs`
- `scripts/tests/skill-conformance.test.cjs`
