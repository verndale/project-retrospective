---
date: 2026-09-07
topics: [library-capture]
issue: https://github.com/verndale/project-retrospective/issues/93
issues: [https://github.com/verndale/project-retrospective/issues/93]
---
# Verify unversioned source without requiring pipeline artifacts

## Why

The capture contract already named `legacy-untracked` as a provenance strategy, but preflight still required sibling inventory to carry a recorded Git SHA. That made code-scan projects ineligible even when their source, tests, stories, styles, and accessibility behavior were available for exact inspection. It also risked conflating optional build packs and fingerprints with required source evidence.

## What changed

An inventory may now use `sourceSnapshot.strategy: unavailable` with `commit: null`. That state joins only a source-parity artifact using `legacy-untracked` with `commit: null`; recorded and reconstructed strategies still require a full pinned SHA.

Verification reads each citation and inspected path from the current checkout without following symlink segments. Every target must be a regular file below the project root, citation hashes and line ranges must match, and files larger than the bounded verification limit fail closed. A warning remains in the result because matching bytes do not manufacture revision identity.

Build packs, fingerprints, and orchestration artifacts remain useful corroboration but are not capture prerequisites. Source inspection, exact canonical linkage, accessibility disposition, runtime architecture, interaction-state coverage, and downstream Library validation remain mandatory.

## Files

- `skills/project-retrospective/SKILL.md`
- `skills/project-retrospective/README.md`
- `skills/project-retrospective/references/library-integrity-checklist.md`
- `skills/project-retrospective/references/source-parity.md`
- `skills/project-retrospective/scripts/source-parity.cjs`
- `skills/project-retrospective/scripts/capture-preflight.cjs`
- `scripts/tests/source-parity.test.cjs`
- `scripts/tests/capture-preflight.test.cjs`

## Follow-ups

- Use the verified unversioned path for source-backed captures whose inventory explicitly reports that no Git snapshot was available.
