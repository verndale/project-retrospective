---
status: implemented
executed: 2026-08-23
date: 2026-08-23
evidence:
  - "verndale/project-retrospective issue #83 https://github.com/verndale/project-retrospective/issues/83"
  - "working tree implementation and full repository verification"
source_tool: codex
source: "codex task /root/schema_design"
topics: [graph-wiki-subsystem]
---
# Standardize wiki actions and offline GitHub evidence routing

## Goal

Bring the repository's curated graph, wiki automation, hooks, and required checks to the shared cross-repository contract without replacing its project-retrospective-specific graph model or workflows.

## Decisions

- Treat merged PR title/body/files/commits as reconciliation input only. Persist canonical repo-qualified citations on the Markdown nodes that use them; do not add PR/issue nodes, snapshots, or a live viewer API.
- Preserve legacy number-only `prs` and `issues` fields while adding `githubRefs` for search, routing, and safe viewer links.
- Make evidence queries repository-qualified and return a byte-costed minimal itinerary, with journal pages preferred over topics, plans, and indexes.
- Keep the curated graph lifecycle advisory at commit time, but detect unstaged and untracked inputs before rebuilding so generated artifacts cannot contaminate a commit.
- Use five stable workflow identities, review-only wiki bot branches, manual replay for merged PRs, fully paginated API reads, and the shared pinned Node/Corepack runtime.
- Keep `@verndale/ai-commit@2.7.0` as the sole direct Commitlint provider and narrowly expose its bundled CLI through pnpm's public hoist setting.

## Implementation

1. Add the shared GitHub evidence parser, enrich graph nodes, and extend deterministic routing and viewer search/panels.
2. Normalize merge context and closing-issue reconciliation while retaining backward-compatible frontmatter fields.
3. Standardize Quality, Commit message lint, Wiki integrity, merge sync, issue sync, and generic PR bot safeguards.
4. Extract the contamination-safe graph hook lifecycle into a testable fail-open helper.
5. Add compact agent navigation instructions, same-delivery wiki history, and acceptance coverage for pagination, workflow identities, evidence routing, viewer safety, and dependency wiring.
6. Rebuild generated graph artifacts and run focused plus full verification.
