---
status: implemented
executed: 2026-08-12
date: 2026-08-12
evidence:
  - "issue #60 https://github.com/verndale/project-retrospective/issues/60"
  - "working tree"
  - "PR #61 https://github.com/verndale/project-retrospective/pull/61 (merged 2026-08-13)"
source_tool: codex
source: current Codex task
topics: [library-capture]
audit_note: Implemented the project-retrospective capture-workflow scope in the working tree as planned; the companion library migration is recorded in ui-design-library. Commit, push, and pull request remain outside the agent permission boundary.
---
# Server-first component architecture and full library migration

## Summary

- Create two GitHub issues and issue-numbered `codex/` branches: one for `ui-design-library`, one for `project-retrospective`.
- Replace the one-TSX convention with a server-first tree/branch/leaf structure and migrate all 21 components.
- Treat incompatible public API cleanup as a breaking major release.
- Use Next.js only as a test consumer of the packed package; ship no App Router code or Next dependency.

## Implementation Changes

### Tracking and branches

- File `[Feature] Adopt a server-first component architecture and migrate the current library` in `verndale/ui-design-library` with `Feature` and `area: components`.
- File `[Enhancement] Generate server-first component captures for the UI design library` in `verndale/project-retrospective` with `enhancement`, `area:skill`, and `area:tooling`.
- Fetch fresh `origin/main` and create:
  - `codex/<issue>-server-first-components`
  - `codex/<issue>-server-first-captures`
- Do not commit, push, publish, or open PRs; hand both branches back locally.

### Component architecture

Every component uses:

```text
components/<slug>/
├── index.ts
├── <Component>.types.ts
├── <Component>.tsx | <Component>.client.tsx
├── parts/*.tsx
├── hooks/*.client.ts              # when needed
├── <Component>.stories.tsx
└── component.json
```

- `index.ts` is the sole public facade and package export target.
- Server and hybrid facades omit `'use client'`; inherently client facades carry it and re-export `<Component>.client.tsx`.
- Every component has at least two meaningful non-story TSX modules.
- Every `.client.ts`, `.client.tsx`, or directive-bearing file is at most 120 physical lines.
- Client requirements are named explicitly; hooks, effects, context, portals, observers, timers, and browser APIs cannot hide in neutral modules.
- Module-scope or render-time browser-global access is forbidden. Portal components continue returning `null` during SSR until mounted.
- Internal parts remain private package implementation details.
- No new runtime field is added to `component.json`; server/client/hybrid mode is derived from the checked module graph.

### Breaking public API changes

- Preserve every primary component subpath and primary named export.
- Split optional interaction:
  - `Alert` remains server-safe and keeps `open`, `variant`, `children`, and `className`.
  - Add client `DismissibleAlert` with required `onDismiss` plus `dismissLabel` and `dismissMs`.
  - `Badge` remains server-safe and drops removal callbacks.
  - Add client `DismissibleBadge` with required `onRemove` plus `removeLabel`.
- Make `Button` server-compatible:
  - Keep explicit `surface`, variant, size, icons, native button attributes, and children.
  - Remove `ButtonSurfaceProvider`, `useButtonSurface`, `as`, and `href`.
  - Navigation continues through `Link`.
- Replace Carousel’s `renderPrevious` and `renderNext` functions with serializable `previousIcon` and `nextIcon` `ReactNode` slots.
- Preserve all other props and named exports.
- Add a packaged `MIGRATION.md` describing the Button, Alert, Badge, and Carousel changes and the required consumer edits.

### Existing component migration

- Server-compatible:
  - Avatar → `AvatarFrame`
  - Breadcrumbs → desktop trail and mobile back-link branches
  - Button → `ButtonContent`
  - Card → separate `CardMedia`
  - Image → image element and picture-source branches
  - Link → `LinkContent`
  - Quote → `QuoteFrame`
  - RichText → recipe selection plus `RichTextContent`
  - SectionHeader → `SectionHeaderContent`
  - Stat → separate `StatGroup`
- Hybrid:
  - Accordion → server shell, client list/item controllers, declarative SSR `inert`
  - Alert → shared view plus `DismissibleAlert.client`
  - Badge → shared view plus `DismissibleBadge.client`
  - InPageNavigation → server landmark, scroll-spy controller, desktop links, mobile drawer, declarative `inert`
- Client:
  - Carousel → controller hook, viewport, controls, and status
  - Modal → dialog controller, panel, header, body, and footer
  - SearchInput → controller, field, controls, results, and icons
  - SearchOverlay → dialog controller, panel, header, and content
  - Slider → controller, track, scale, and selected-value branches
  - Tabs → controller, tab list/buttons, generated IDs, and ref-based focus
  - Toast → portal/timer controller, view, and icon
- Rename shared browser-dependent helpers to `.client.ts`; keep shared primitives in `src/lib` only when at least two components consume them.

### Tooling and future enforcement

- Export every package subpath through `dist/components/<directory>/index.js` and `index.d.ts`.
- Compile nested `.ts` and `.tsx` files and preserve directives in emitted ESM.
- Add a shared recursive component-file discovery helper for exports and contracts.
- Recursively scan all implementation modules for raw colours, semantic-token violations, and forbidden `next/*` imports.
- Add an AST-based architecture checker and self-tests covering:
  - 120 lines passing and 121 failing
  - `.client` naming and directive placement
  - minimum two implementation TSX files
  - browser globals and React client hooks in neutral modules
  - nested raw-colour violations
  - stable `index.ts` facades
- Add React Hooks linting and include it in the quality gate.
- Stories import only `./index`; update stories for the breaking APIs while preserving existing accessibility, keyboard, and motion assertions.

### Capture workflow

Add a required `## Runtime architecture` JSON block to captures:

```json
{
  "mode": "server | hybrid | client",
  "hydration": [
    "state | event-handler | effect | context | portal | timer | observer | browser-api | third-party-client"
  ],
  "serverOutput": "full | shell | none",
  "modules": [
    {
      "path": "relative module path",
      "role": "facade | types | tree | branch | leaf | hook | styles",
      "runtime": "server | client"
    }
  ]
}
```

- Server captures require empty hydration and no client implementation modules.
- Hybrid captures require server and client modules plus at least one hydration reason.
- Client captures require a client facade and at least one hydration reason.
- Every plan requires `index.ts`, a types module, and at least two planned TSX modules.
- Client implementation paths must use `.client.ts` or `.client.tsx`.
- Bump capture-preflight output to schema version 2 and include the validated architecture object without copying it into `component.json`.
- Make missing or inconsistent architecture a hard preflight blocker.
- Update partial/already-applied detection for recursive multifile components.
- Change Action: capture order to facade/types → tree/parts/hooks → stories → `component.json`, then `exports:sync`.
- Verify each component with contracts and tests; run the full package verification after the final capture.
- Update SKILL.md, checklist, proposal template, README, preflight tests, fake-library fixtures, wiki journal/topic, and generated graph.

## Test Plan

- `pnpm test` covers typecheck, lint, architecture checks/self-tests, contracts/self-tests, DOM-free SSR rendering of all 21 components, Storybook/axe behavior, and reduced motion.
- `pnpm build` verifies nested ESM/declarations, facade exports, dist parity, and preserved client directives.
- Add `pnpm test:next`:
  - Pin Next.js `16.2.12` as a dev-only test dependency.
  - Build and create a tarball with lifecycle scripts disabled.
  - Install the tarball into a temporary App Router fixture.
  - Import server/hybrid components directly from a Server Component.
  - Import interactive components from a Client Component.
  - Run `next build`.
  - Compile Tailwind through `@tailwindcss/postcss` with package `dist` registered through `@source`.
  - Assert CSS contains a utility found only in a nested package part.
  - Assert the tarball contains neither the fixture nor a Next runtime/peer dependency.
- Add `pnpm verify` as `test → build → packed Next consumer`; run it in PR and release CI.
- Project-retrospective tests cover valid server/hybrid/client plans, missing architecture, inconsistent mode/hydration, invalid client paths, one-TSX plans, schema-v2 output, and recursive library inspection.

## Assumptions and Delivery

- The Next fixture is only a compatibility compiler based on official [Server/Client Component](https://nextjs.org/docs/app/getting-started/server-and-client-components) guidance; no Next APIs ship in the library.
- Tailwind classes remain complete static strings and package scanning follows the official [`@source` guidance](https://tailwindcss.com/docs/detecting-classes-in-source-files).
- The library migration and enforcement land atomically on one branch so no temporary exemptions reach `main`.
- Semantic-release must receive a breaking-change commit from the maintainer; the agent stops before committing or publishing.
- Both repositories receive the required plan archive, journal/topic updates, index updates, and regenerated graph artifacts after implementation.
