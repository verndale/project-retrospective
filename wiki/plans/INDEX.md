# Plan Audit

Every agent plan executed for this repo, gathered from Claude plan stores and Codex sessions, with whether it actually shipped. Implemented and partial plans are archived here (linked); not-implemented, superseded, and out-of-scope plans are listed for the record and stay at their source on disk.

## Contents

- Status legend
- Plans

## Status legend

- **implemented** — substantially shipped (deltas noted in the archived file's `audit_note`).
- **partial** — a subset shipped; the rest never landed.
- **superseded** — replaced by a later plan before shipping as written.
- **not-implemented** — nothing shipped; may still be actionable.
- **out-of-scope** — targets another repo/product.
- **not-verified** — recovered by `pnpm wiki:find-plans --archive`; nobody has checked yet whether it shipped.

Totals: 7 implemented · 1 partial (8 plans).

## Plans

| Date | Plan | Status | Evidence | Topics |
| --- | --- | --- | --- | --- |
| 2026-08-18 | [Governed Figma completion for Action capture](2026-08-18-governed-figma-capture-completion.md) | implemented | [issue #69](https://github.com/verndale/project-retrospective/issues/69), preflight/conformance tests, [PR #70](https://github.com/verndale/project-retrospective/pull/70) | library-capture |
| 2026-07-26 | [project-retrospective — critique + build plan](2026-07-26-project-retrospective-critique-build-plan.md) | implemented | commit caebd12, commit 012a6f0, [PR #1](https://github.com/verndale/project-retrospective/pull/1) | skill-authoring, retrospective-workflow, brain-promotion |
| 2026-07-26 | [Port the knowledge-graph + context-wiki subsystem into project-retrospective](2026-07-26-port-the-knowledge-graph-context-wiki-subsystem-into-project.md) | implemented | [PR #1](https://github.com/verndale/project-retrospective/pull/1) | graph-wiki-subsystem |
| 2026-07-31 | [Make inventory discovery stack-aware and comprehensive](2026-07-31-stack-aware-inventory-discovery.md) | implemented | [PR #24](https://github.com/verndale/project-retrospective/pull/24) | retrospective-workflow |
| 2026-07-31 | [Fix the shallow-scan folder collapse in `inventory.cjs`](2026-07-31-fix-the-shallow-scan-folder-collapse-in-inventory-cjs.md) | implemented | [PR #27](https://github.com/verndale/project-retrospective/pull/27) | retrospective-workflow |
| 2026-08-09 | [Team Retrospective Knowledge and Accountability](2026-08-09-team-retrospective-knowledge-and-accountability.md) | partial | https://github.com/verndale/project-retrospective/issues/57, [PR #58](https://github.com/verndale/project-retrospective/pull/58) | retrospective-workflow |
| 2026-08-12 | [Server-first component architecture and full library migration](2026-08-12-server-first-component-architecture.md) | implemented | issue #60 https://github.com/verndale/project-retrospective/issues/60, working tree, [PR #61](https://github.com/verndale/project-retrospective/pull/61) | library-capture |
| 2026-08-13 | [Capture preflight schema v3 for accessible realizations](2026-08-13-capture-preflight-schema-v3-for-accessible-realizations.md) | implemented | [PR #64](https://github.com/verndale/project-retrospective/pull/64) | library-capture |
