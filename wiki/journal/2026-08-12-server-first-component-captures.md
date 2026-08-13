---
date: 2026-08-12
topics: [library-capture]
plan: plans/2026-08-12-server-first-component-architecture.md
pr: https://github.com/verndale/project-retrospective/pull/61
issue: https://github.com/verndale/project-retrospective/issues/60
---
# Make component captures server-first and structurally explicit

## Why

- A capture could describe a single broad client component without stating why hydration was necessary or which boundary should own it.
- Preflight recognized only top-level implementation and story files, so nested multifile components could be misclassified as partial or already applied.
- The application sequence did not establish a stable public facade before implementation, and the capture contract did not prevent one-TSX component monoliths.

## What changed

- Captures now require an exact Runtime architecture object covering mode, hydration reasons, server output, and every planned facade/types/tree/branch/leaf/hook/styles module.
- Schema-v2 preflight treats a missing or inconsistent runtime plan as a hard blocker, validates and emits the governed `reuseFingerprint`, returns architecture separately from `componentJson`, and never adds architecture to the library manifest.
- Server, hybrid, and client modes have explicit SSR and facade constraints. Hybrid mode requires an actual server implementation rather than counting its facade as server output. Client implementation paths use `.client.ts`/`.client.tsx`; directive-bearing files stay at or below 120 physical lines.
- Every capture plans one `index.ts` facade, one server types module, and at least two implementation TSX modules. Partial/applied detection now checks the planned graph recursively.
- “Already applied” now means more than matching filenames: the exact implementation set must be non-empty and reachable from the facade through the declared client boundary, the root story must agree, and stable manifest fields—including provenance—must match the capture. Empty, unplanned, disconnected, or drifted implementations block instead of being skipped.
- Application is serial and ordered facade/types → tree/parts/hooks → stories → `component.json` → `pnpm exports:sync`, followed by contracts, tests, and build.
- Keeping architecture in `component.json` was rejected because it is an execution plan, while the library derives runtime behavior from its checked module graph.

## Files

- `skills/project-retrospective/SKILL.md`
- `skills/project-retrospective/references/proposal-component-capture-template.md`
- `skills/project-retrospective/references/library-integrity-checklist.md`
- `skills/project-retrospective/scripts/capture-preflight.cjs`
- `scripts/tests/capture-preflight.test.cjs`
