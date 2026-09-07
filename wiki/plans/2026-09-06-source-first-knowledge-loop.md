---
status: implemented
executed: 2026-09-06
date: 2026-09-06
evidence:
  - "verndale/project-retrospective issue #90"
  - "working tree tests"
source_tool: codex
source: "verndale/project-retrospective issue #90"
topics: [retrospective-workflow, library-capture]
audit_note: "Archived from the approved implementation contract; unrelated session/provider setup was intentionally omitted, and no downstream repository was written."
---
# Source-first retrospective knowledge loop

## Goal

Make one retrospective flow work for ordinary single-package and monorepo frontend repositories without requiring pipeline artifacts. Keep analyze lightweight; defer detailed library/Figma planning until a human selects a capture.

## Analyze

- Discover components from the root manifest and only nested manifests admitted by package-manager workspace declarations, then exact framework/platform dependency markers, conventional roots, source/imports, tests, stories, styles/tokens, consumers, and delivery configuration. Ignore unrelated nested package examples. Reject traversal roots and skip source, delivery, workspace, artifact, and memory symlinks whose target bytes the pinned repository cannot prove.
- Keep inventory schema version 1 and `code-scan` mode. Treat build configuration, component indexes, build packs, fingerprints, design facts, and project memory as optional corroboration.
- Infer platform only from exact markers or a canonical operator override. Leave ambiguous identity null with a warning.
- Select the latest eligible evidence for every other project automatically. Retain `PriorReports` as an explicit escape hatch for eligible run reports outside `Data`, including when `Data` is unavailable, but merge explicit and automatic inputs under the same latest-per-project rule so a stale manual path cannot win. Require a real calendar date, non-symlink owned run surfaces, valid run identity, exact canonical-or-null platform parity, and resolution/triage joins; exclude retrospective-only runs, include prior Watch and Promote, exclude Reject, and count one occurrence per project.
- Treat code plus colocated tests, stories, styles, and consumers as one implementation family. Promotion still requires another project or genuinely independent evidence, and hard exclusions remain unchanged.
- Emit only lightweight pending capture intents: canonical and structural identity, source entry, why, present/absent evidence, de-client headline, and pending progress. Make no target architecture, realization, Storybook, Figma, node, review, or accessibility-completeness claim.

## Capture

- Accept an optional exact component-key subset and source checkout override.
- Before branching, require a current write-capable Figma tool and the library's live registry validation for fresh and resumed work.
- Resolve sibling metadata/inventory/resolution, preserve its pinned revision, require exactly one safe capture Source entry, require parity project/run identity to join metadata, and require parity entry, inspected entry points, one unambiguous inventory owner, and a verified whole-file citation hash to name one exact file. Require resolution to join that owner to the capture canonical while preserving legitimate aliases and source-linked proposal aliases.
- Enrich selected intents to full component captures plus source-parity version 2, runtime architecture, intended realization, accessibility and interaction-state dispositions before downstream writes.
- Record absent source accessibility as an explicit remediation gap; never suppress the intent or mark remediation unnecessary.
- Validate the current downstream registry schema, checklist invariants, exact commands, supported `figma-use` capability, and live file without falsely rejecting the library's existing governed field names. Keep the more detailed capture grammar as execution/live-review guidance: Button for compact matrices, Section header/Alert for responsive specimens, Tabs for structural families, numbered Documentation/Main/alternates/Interaction-states order, and a separate unnumbered publish-source master. Keep publication manual and do not create Code Connect.
- Require modern Applied evidence to copy client-neutral registry identity, unpublished status, three review passes, and exact semantic state coverage. State variant component IDs may differ from a top-level component-set ID; live validation owns ancestry.
- Reserve `figma-pending` for current unexpected mid-run loss. Restored capability resumes the existing issue/branch rather than creating it again.

## Tracking and verification

- Use explicit `enrichment-pending` tracking to permit only the evidence run branch before capture enrichment writes; permit the issue-keyed library branch only after schema-v6 `ready` reports a non-empty capable write set.
- Preserve automatic governed issue/label reconciliation, with no commits, pushes, pull requests, merges, releases, or publication.
- Reject duplicate/unsafe capture and remediation identities plus unsafe project/date values before any value can enter an issue key or branch name.
- Update workflow, references, scripts, validators, fixtures, tests, READMEs, wiki history, and generated graph together.
- Run focused suites, then the full `pnpm test` gate.
