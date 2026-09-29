---
status: implemented
executed: 2026-09-29
date: 2026-09-29
evidence:
  - "issue #108"
source_tool: codex
source: "/private/tmp/project-retrospective-git-delivery-plan.md"
topics: [graph-wiki-subsystem]
---
# Standardize Git delivery in project-retrospective

Create a labeled issue and branch from updated main. Remove the AI commit and PR helpers, the generic PR Action, and its scripts without compatibility code. Use standalone Commitlint, the deterministic PR body validator, and BOT_TOKEN in wiki writers. Run Quality on main pushes and Release only after successful Quality. Update AGENTS and active docs, preserve the skill's domain-specific retrospective publication contract, and verify repository gates before opening a PR without merging it.
