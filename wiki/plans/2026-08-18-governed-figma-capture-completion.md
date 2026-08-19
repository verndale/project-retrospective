---
status: implemented
executed: 2026-08-18
evidence:
  - "issue #69"
  - "capture-preflight tests"
  - "skill-conformance tests"
  - "PR #70 https://github.com/verndale/project-retrospective/pull/70 (merged 2026-08-19)"
source_tool: codex
source: approved implementation plan in the active Codex task
topics: [library-capture]
audit_note: The approved plan's optional Code Connect template was explicitly superseded by the maintainer. The implemented workflow forbids every Code Connect surface and uses canonical-slug npm imports exclusively. Code verification uses the target library's code-only contract command because aggregate contracts require completed Figma coverage.
---
# Governed Figma completion for Action capture

## Objective

Make a component capture incomplete until its React/Tailwind/Storybook implementation, unpublished Figma master, documentation, adversarial/design review, remediation, and final validation all pass.

## Implementation

1. File issue #69 with enhancement, documentation, skill, tooling, and wiki labels; branch from current `origin/main`.
2. Extend preflight with an additive library-owned Figma interface and fail before writes when it is unavailable.
3. Keep execution serial: component code and stories, code-only verification, Figma creation, review/fixes, evidence, then full downstream gates.
4. Use Button, Section header, and Alert as the presentation/naming references and preserve the 528px left documentation rail plus governed breakpoints.
5. Require unpublished candidate state and machine-readable review evidence linked to the component journal.
6. Stop with an explicit blocked handback when no write-capable Figma session exists.
7. Forbid Code Connect and retain canonical-slug npm imports as the sole code-consumption contract.

## Verification

- Synthetic preflight capability and prohibition fixtures.
- Skill conformance assertions for ordering, blocked handback, review passes, commands, and Code Connect prohibition.
- Full repository tests, skill validation, and graph/wiki drift checks.
