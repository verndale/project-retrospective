---
date: 2026-08-19
topics: [library-capture, retrospective-workflow]
plan: plans/2026-08-19-source-parity-capture-contract.md
pr: pending
issue: https://github.com/verndale/project-retrospective/issues/75
---
# Require source parity before component capture

## Why

- Existing gates could prove normalized code and Figma agreed while both omitted reusable source behavior.
- De-clienting prose was not a complete, deterministic inventory and carried no pinned source hashes.
- Future audits need mechanical completeness without asking the model to decide structure.

## What changed

- Inventory records the source Git snapshot and warns when the worktree is dirty or unavailable.
- A shared zero-dependency validator enforces one source-parity artifact per capture, safe citations, coverage, classifications, decisions, and review evidence.
- Report validation and schema-v5 capture preflight consume the same contract; Figma review now includes source parity.
- Tracking routing can create foundation work and actionable per-component work without empty downstream branches.

## Files

- `skills/project-retrospective/references/source-parity.md`
- `skills/project-retrospective/scripts/source-parity.cjs`
- `skills/project-retrospective/scripts/{inventory,validate-report,capture-preflight,tracking-targets}.cjs`
- `scripts/tests/`

## Review

- Adversarial review passed for the capture foundation: every required source-inspection category is explicit, verified paths and citations are read from the pinned Git object, line ranges are bounded, intentional de-clienting cannot carry remediation targets, decision JSON cannot self-certify its review, and completion requires a distinct post-remediation pass.
- Design review passed for the operator flow: one companion artifact follows each exact capture identity, structural alternates retain their audited family while targeting their exact compound library implementation, and source-parity/adversarial/design review remains sequenced after all changed public surfaces agree.

## Follow-ups

- Apply the private retrospective audit and public library governance contracts in their own issue branches.
