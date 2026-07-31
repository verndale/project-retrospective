---
date: 2026-07-31
topics: [retrospective-workflow]
plan: plans/2026-07-31-stack-aware-inventory-discovery.md
pr: pending
issue: https://github.com/verndale/project-retrospective/issues/23
---
# Make inventory discovery stack-aware

## Why

- `inventory.cjs` discovery was hard-wired to the React family, so a Handlebars + Storybook
  `toolkit` project inventoried a small fraction of its components and resolved none: `.hbs` was an
  invisible extension, its `frontend/src/html/*` roots were never probed, and Storybook — its
  actual component registry — was in the skip list.
- `stackAdapter` was read but never used to choose extensions or roots.
- `component-index.json` is not complete on real React projects (a ui-only index; rendering
  domains present on disk but declared in neither the index nor `renderingDomains`), yet artifacts
  mode trusted the index as the whole census.

## What changed

- `stackAdapter` now selects a discovery profile (extensions, roots, granularity, Storybook). The
  component-file regex is built from the profile; unknown adapters fall back to a broad default and
  warn `unknown-adapter` rather than returning zero.
- A recursive/shallow scan of the declared buckets, adapter roots, `reusableComponentsBase`, and a
  derived `layouts` root now runs in **both** modes and is unioned with the index — components the
  index omitted are recovered. The recursive bucket walk finds rendering domains from the directory
  structure whether or not they are declared.
- `renderingDomains` is demoted to a drift check (`rendering-domain-missing`). Ruled out: an overlay
  scanning only the declared domain subdirs — it would chase a stale mapping and miss undeclared
  domains.
- Storybook is a supplementary signal gated on the profile: the registry for `toolkit`, a no-op for
  the React majority (not even walked). Ruled out: making Storybook first-class for all stacks.
- Guards: `duplicate-component` for genuine same-key/different-path collisions; `empty-bucket` fires
  only for a declared-absent bucket in code-scan mode (speculative roots and artifacts mode stay
  quiet). The index stays authoritative on conflict; a scan fills only null fields.
- Folded in two discovery gaps: flat component layouts — independent sibling files (`ui/icons/*.tsx`)
  and files sitting directly at a bucket root — are each discovered rather than collapsed to the
  folder, while a compound whose parts are namespaced under the folder (`accordion/AccordionItem.tsx`)
  stays one component (a barrel alone does not decide it); and an empty `component-index.json` (`[]`)
  falls through to a code scan instead of forcing artifacts mode with zero components.
- Excluded co-located test/spec/story files (`*.test.tsx`, `*.stories.tsx`) from component
  discovery. They share the component extension, so they were becoming phantom components,
  displacing a real component's `entry`, or — when they sat in a sibling `hooks/`-style folder —
  making the scanner treat the real component's directory as a non-leaf and drop it.

## Files

- skills/project-retrospective/scripts/inventory.cjs
- skills/project-retrospective/references/code-scan-mode.md, SKILL.md, README.md
- scripts/tests/inventory.test.cjs, scripts/tests/fixtures/{fake-project,fake-project-toolkit,fake-project-codescan}

## Follow-ups

- Flat layouts now surface icon sets as many components (an `icons/` folder becomes one component
  per file); triage and resolution should treat icon-class labels as a set rather than as distinct
  promotable patterns.
