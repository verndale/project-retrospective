---
status: implemented
executed: 2026-07-31
date: 2026-07-31
evidence: []
source_tool: file
source: "/private/tmp/claude-505/-Users-joe-fusco-Projects--verndale-project-retrospective/d57715d5-2a87-447f-8b6f-cd6bd97ca201/scratchpad/2026-07-31-stack-aware-inventory-discovery.md"
topics: [retrospective-workflow]
---
# Make inventory discovery stack-aware and comprehensive

## Context

`inventory.cjs` under-inventoried real projects because component discovery was hard-wired to the
React family and its completeness assumptions were wrong. Verified against three projects on
different stacks (referred to here by `stackAdapter` only; client identity is redacted):

- A **toolkit** project (Handlebars + Storybook, no `componentBuckets`, no `component-index.json`):
  a fresh analyze inventoried ~17 of ~90 components and resolved 0. Three mutually-reinforcing
  blind spots, all in `inventory.cjs`:
  1. Extension blindness — `COMPONENT_FILE_RE` matched only `.tsx/.jsx/.vue/.svelte`; `.hbs` (and
     every template stack) was invisible.
  2. Root blindness — `HEURISTIC_ROOTS` never included the toolkit's `frontend/src/html/*` roots;
     `reusableComponentsBase` was never read.
  3. Storybook actively skipped — `SKIP_DIRS` listed `stories`/`.storybook` and `*.stories.*` was
     not a `sources[]` signal, though for that stack Storybook is the component registry.
  `stackAdapter` was read but never used to pick extensions or roots.
- An **optimizely** (React) project: `component-index.json` was ui-only and missed the entire
  rendering bucket; a declared rendering domain did not exist on disk (a stale mapping).
- A **sitecore-ai** (React) project: the index missed several rendering components in domains
  declared in neither the index nor `renderingDomains`.

Goal: find every module and every UI primitive in any project.

## Decisions

1. **Union in both modes.** Discovery runs in artifacts mode too and unions with the index; the
   index is corroborated and supplemented, never trusted as complete.
2. **`renderingDomains` demoted to a label/drift aid.** A recursive bucket walk discovers every
   rendering domain — declared or not — from the directory structure; a declared domain absent on
   disk is flagged `rendering-domain-missing`. (Rejected: an overlay that scanned only the
   declared `renderingDomains` subdirs — it would have chased a stale/fictional domain and missed
   the undeclared ones.)
3. **`stackAdapter` drives a profile** — extensions, roots, granularity, and whether Storybook is
   the registry. Adapter names are not stable across projects, so an unknown adapter falls back to
   a broad default and warns (`unknown-adapter`) rather than returning zero.
4. **Storybook is a supplementary signal, not a first-class one.** Most projects (React) have none
   and the pass is a no-op — gated on the profile so a React project that merely ships stories is
   not polluted. For the toolkit stack, where Storybook is the registry, stories contribute to the
   census, unioned with the markup. (Rejected: treating Storybook as a first-class signal for all
   stacks.)
5. **Census boundary:** UI primitives + modules/renderings + layouts + page templates + colocated
   page layouts, each labeled by provenance. Route/app pages and server/CMS views (`.cshtml`) are
   excluded — the roots stay scoped and the extension set excludes them.

## Adapter profile table (hardcoded, self-contained)

| stackAdapter | extensions | roots | granularity | storybook |
|---|---|---|---|---|
| `toolkit` | `.hbs`, `.handlebars` | `frontend/src/html/{components,modules,templates}` + `reusableComponentsBase` | shallow | yes |
| `optimizely` / `sitecore-ai` / `contentstack` / `contentstack-sdk` | `.tsx`, `.jsx` | `componentBuckets` → heuristics | recursive | no |
| default / unknown | broad union (`.tsx`,`.jsx`,`.vue`,`.svelte`,`.astro`,`.hbs`,`.twig`,`.liquid`) | `componentBuckets` → heuristics | recursive | yes |

## What was implemented

- **Adapter profiles + dynamic extensions.** `profileFor(stackAdapter)` with alias/default and an
  `unknown-adapter` warning; the component-file regex is built from `profile.exts` (`makeFileRe`).
- **Root resolution** (`resolveRoots`): declared `componentBuckets` (recursive walk, so domains are
  found from the tree) ∪ adapter-profile roots ∪ `reusableComponentsBase` ∪ a derived `layouts`
  root, de-duplicated; heuristic roots only when nothing is declared. Roots are marked
  `speculative` (adapter/reusable/derived) vs declared.
- **Granularity**: recursive (React, dir-per-component) vs shallow (toolkit — each flat file or
  immediate folder is a component; fine-grained leaves come from Storybook).
- **Storybook** (`discoverStories`): bounded walk for `*.stories.*`, keyed by slug, bucketed by
  the story path; gated on `profile.storybook`; adds a `storybook` source.
- **Merge**: index first (authoritative; non-null fields never overwritten), then scan + story
  signals folded in (corroborate or supplement). Guard 1: `duplicate-component` for genuine
  same-key/different-path collisions. Guard 2: `empty-bucket` fires only for a declared-absent
  bucket in code-scan mode; speculative roots and artifacts mode stay silent.

## Files

- `skills/project-retrospective/scripts/inventory.cjs` (discovery + merge rewrite)
- `skills/project-retrospective/references/code-scan-mode.md`, `SKILL.md`, `README.md`
- `scripts/tests/inventory.test.cjs` + synthetic fixtures (`fake-project` extended,
  `fake-project-toolkit`, `fake-project-codescan`)

## Verification

- `pnpm test` — 164 tests pass; graph freshness 17/17.
- Read-only review over the diff; findings addressed (Storybook gate, warning-code test coverage,
  redundant-test cleanup, lowercase-entry fallback).
- Sample outcomes by stack: toolkit ~17 → ~94, optimizely ~20 → ~95, sitecore-ai 155 → 191.

## Follow-ups (pre-existing, out of scope)

- A flat-file React layout (component files directly under a bucket, no per-component folder) is
  still under-counted by the recursive scanner; the toolkit shallow path handles flat files.
- An empty `component-index.json` (`[]`) is truthy and forces artifacts mode, suppressing the
  heuristic fallback.
