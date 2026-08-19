---
status: implemented
executed: 2026-08-19
date: 2026-08-19
evidence:
  - working tree
  - deterministic resolver tests
  - capture lifecycle tests
  - downstream contract tests
  - "PR #72 https://github.com/verndale/project-retrospective/pull/72 (merged 2026-08-19)"
source_tool: codex
source: approved implementation plan in the active Codex task
topics: [retrospective-workflow, library-capture]
audit_note: Personal filesystem paths were redacted for the public wiki. The Figma portion implemented registry, family-page, lifecycle, and validation contracts only; live Figma node creation, rearrangement, rendering, and publication remain a separate plan.
---
# Automate retrospective GitHub tracking, branches, lifecycle, and Figma delivery

## Summary

- Automatically create required GitHub issues and local working branches when deterministic retrospective output requires them.
- Remove human approval from issue creation, sanctioned label reconciliation, issue linking, and local branch creation.
- Preserve explicit authorization for commits, pushes, PRs, issue closure, publishing, merging, and releases.
- Update the personal issue skill and project-retrospective agent contract; no new agent or subagent is needed.
- Preserve the governed Figma and structural-variant contract without performing live Figma file work.

## Authoritative policy surfaces

- Personal `github-issue-creator` skill and evals.
- Project-retrospective `AGENTS.md`, runtime skill, tracking reference, operator README, resolver, validators, and tests.
- UI-design-evidence lifecycle documentation and derived graph/explorer model.
- UI-design-library structural-family registry, validators, documentation, tests, and wiki.
- Brain and library commit/push authorization stays unchanged.

## Standard labels

- All three repositories: `Feature` (`0E8A16`, `New feature or request`).
- Evidence: `area: retrospectives` (`1D76DB`) and normalized `area: tooling` (`C5DEF5`).
- Brain: `area: catalog` (`1D76DB`) and normalized `area: tooling` (`C5DEF5`).
- Library: `area: components` (`1D76DB`).
- Preserve associations during renames, leave unrelated labels alone, and limit automatic repair to sanctioned definitions.

## Automatic issue skill

1. Resolve the repository.
2. Ask only for genuinely missing facts.
3. Produce the fixed `[Type] Summary` title and five-section body.
4. Validate or reconcile sanctioned labels.
5. Reuse an exact matching open issue or file immediately.
6. Return the issue URL.

Complete requests do not pause for approval. Authentication failures diagnose access and stop before a dependent branch.

## Conditional issue and branch matrix

- Evidence: a validated analyze run written to the evidence checkout gets an issue; its local run branch exists before the first write.
- Brain: pending catalog proposals get an issue; promote creates a local branch only for an approved non-empty brain write set.
- Library: capture preflight creates an issue only for actionable library work; a local branch requires a non-empty write set and required capabilities.
- AI orchestration gets neither issues nor branches.
- Analyze never creates brain or library branches. Empty, deferred, blocked, skipped, rejected, landed, home-fallback, and evidence-only targets create no downstream branch.

## Deterministic GitHub sequence

1. Compute the exact work set.
2. Reconcile sanctioned labels.
3. Reuse the exact matching open issue or create it automatically.
4. Require clean local `main` aligned with `origin/main`.
5. Create a local branch only when the write set remains non-empty.

Branch names are `feat/<project>-<date>-run`, `feat/<issue>-catalog-promotion`, and `feat/<issue>-library-capture`. Branch creation is local `git switch -c` and does not authorize a push. Failures stop before branch creation without asking for approval.

## Lifecycle and capture interfaces

- Capture preflight schema v4 uses exact `(canonical, variant)` identity.
- Default capture file: `captures/<slug>.md`; alternate: `captures/<slug>--<variant>.md`.
- Captures contain Structural implementation, Progress, and Applied sections.
- Runtime states are ready, figma-pending, evidence-pending, skipped, deferred, or blocked.
- Public evidence states are pending, code-complete, and landed.
- Existing code resumes at Figma; reviewed Figma resumes at evidence.
- npm imports remain `components/<slug>` and `components/<slug>--<variant>`.

## Figma and governed-AI contract

- One page per canonical family, with the default Ready for Dev section first and structural alternates in separately labeled sections.
- Preserve default master identity; name alternates `Canonical / Variant label`.
- Expose only Figma properties that mirror the public code contract.
- Separate structural imports use separate qualified masters; semantic role, affordance, or interaction changes require a new brain canonical.
- Registry fields may include variant, variantLabel, default, and familyPage.
- Button Light remains the legacy Button family page without moving published nodes.
- AI resolves canonical plus optional variant to componentPath, publicImport, and Figma node.
- Preserve Code Connect rejection checks.

## Verification

- Label operations are idempotent and preserve issue associations.
- Resolver tests cover run-only, proposal-only, actionable/deferred/terminal captures, unavailable Figma, evidence-only reconciliation, home fallback, issue reuse, dirty/stale main, and auth failure.
- Validators reject empty branches, duplicate targets, lifecycle drift, malformed structural identity, and mismatched Figma evidence.
- Run project-retrospective, library, evidence, and personal-skill quality gates.

## Authorization boundary

- Label normalization, automatic issue creation, issue linking, and required local branch creation are authorized.
- Commits, pushes, PRs, issue closure, publication, merging, and releases remain unauthorized.
