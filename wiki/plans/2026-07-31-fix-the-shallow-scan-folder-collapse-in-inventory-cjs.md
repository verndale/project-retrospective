---
status: implemented
executed: 2026-07-31
date: 2026-07-31
evidence: []
source_tool: claude
source: "/Users/joe.fusco/.claude/plans/nifty-napping-hanrahan.md"
topics: [retrospective-workflow]
---
# Fix the shallow-scan folder collapse in `inventory.cjs`

*Written client-neutral so it archives to `wiki/plans/` verbatim under the data boundary.*

## Context

The stack-aware discovery change (issue #23) made `inventory.cjs` choose its extensions, roots
and granularity from `stackAdapter`. Measuring that change against two real checkouts — one
Handlebars/`toolkit` project, one React/`sitecore-ai` project — confirmed the headline fix
(that toolkit project went from 17 components to 94) but surfaced two defects in the `toolkit`
path, both from the same cause.

`scanBucketShallow` treats **every** immediate subdirectory holding a component file as exactly
one component named after the folder. That is right for `card/card.hbs`, wrong for a folder that
groups independent siblings:

1. **Leaves are silently dropped.** A `components/<group>/` folder holding several unrelated
   primitives collapses to one component named `<group>`; the primitives inside it are never
   discovered. Measured: two reusable primitives present on disk and absent from the inventory.
2. **Folder-named phantoms are emitted.** A `modules/<group>/` folder holding page-level partials
   yields a component literally named `<group>`, while the real component inside it survives only
   because Storybook happens to carry a story for it. A `toolkit` project without that story
   coverage would lose the component and gain a junk label.

The recursive scanner (`scanBucket`) already decides this correctly, and its rule is the one that
should apply: a directory is **one component** when it holds a single file, names a matching entry
file (`card/card.hbs`), or is a compound whose every part is namespaced under it
(`accordion/accordion-item.hbs`); otherwise its files are **independent siblings** and each is its
own component. Both scanners need that rule; today only one has it.

**Outcome:** the `toolkit` shallow scan stops collapsing sibling folders, so a stack whose reusable
primitives are grouped in subdirectories is inventoried completely and without phantoms — and the
React/recursive path is provably unchanged.

**Ruled out:** giving `toolkit` `granularity: 'recursive'` and deleting the shallow scanner. It
reaches the same result on the trees measured, but discards a deliberate boundary (the shallow
profile exists so template stacks do not descend into partial trees) and is a larger change than
the defect needs.

**Out of scope:** the icon-set follow-up recorded in
[`wiki/journal/2026-07-31-stack-aware-inventory-discovery.md`](wiki/journal/2026-07-31-stack-aware-inventory-discovery.md)
(flat layouts surfacing icon sets as many components). That is a triage-rubric change, not a
discovery one, and stays a separate pass.

## Setup

1. **File the issue** — `[Bug] toolkit shallow scan collapses sibling folders, dropping components
   and emitting phantoms`, labels `bug`, `area:skill`, `area:tooling`, into
   `verndale/project-retrospective`. Body drafted and confirmed separately; it references #23 as
   the parent and carries a fixture-only repro. Client-neutral — this repo is public.
2. **Branch off `main`** — `fix/<issue#>-shallow-scan-sibling-folders`, matching the
   `feat/23-stack-aware-inventory-discovery` convention. Branch only: no commit, push, or PR.

## Changes

### 1. `skills/project-retrospective/scripts/inventory.cjs`

**Extract the shared rule.** Lift the one-component-vs-siblings decision out of `scanBucket`'s
leaf branch (currently the `matchesFolder` / `compound` / `dirPerComponent` block, ~L343-356) into
a module-scope helper:

```js
function classifyComponentDir(folderName, compFiles, fileRe)
  // -> { oneComponent, entryFile, nonBarrel }
```

Move `isBarrelName` (currently a closure inside `scanBucket`) to module scope alongside it. The
helper carries no depth guard — callers apply their own.

**`scanBucket` — behavior must not change.** Call the helper only when `depth > 0`, preserving
today's semantics that component files at the bucket root take the flat path. The
`dirPerComponent` branch uses `entryFile`; the `else` branch keeps calling `pushFlat` unchanged.

**`scanBucketShallow` — the fix.** In the subdirectory branch (~L410-424), replace the
unconditional folder-named push with the helper's verdict:

- `oneComponent` → today's behavior, using `entryFile` for the `entry` field.
- otherwise → emit each non-barrel file as its own component, mirroring `pushFlat`'s field
  semantics: `folder: normalizeLabel(stem)`, `name: stem`, `path: <root>/<folder>`,
  `entry: <root>/<folder>/<file>`, and `domain: <folder>` (the container segment, matching what
  the recursive scanner records for the same shape).

The flat-file branch and the `empty-bucket` warning are untouched.

### 2. `scripts/tests/inventory.test.cjs` + `scripts/tests/fixtures/fake-project-toolkit/`

Fixture additions — **synthetic names, invented for the fixture**, per the data boundary:

- `frontend/src/html/components/chrome/{brand-mark,cart-button,locale-switch}.hbs` — independent
  siblings, no self-named file, no shared namespace.
- `frontend/src/html/components/panel/{panel-header,panel-body}.hbs` — a namespaced compound.

`components/generic-card/generic-card.hbs` already covers the self-named single-file case; keep it
as the control.

Tests to add:

- a sibling folder emits one component per file, each keyed to its own file
- the containing folder name is **not** emitted as a component
- a namespaced-compound folder still collapses to one component
- siblings carry the containing folder as `domain`

The existing `folders` deepEqual assertion (~L141) grows by `brand-mark`, `cart-button`,
`locale-switch`, `panel`.

### 3. `skills/project-retrospective/references/code-scan-mode.md`

One sentence (L20) states the old rule — "treats each flat file or immediate folder under a root as
a component (shallow)". Restate it as the real rule: one level deep, where an immediate folder is
one component when it holds a single file, a file matching the folder name, or parts all namespaced
under it, and otherwise contributes each of its files.

### 4. Wiki capture (`wiki/`)

Per [`wiki/MECHANICS.md`](wiki/MECHANICS.md) — a script change is a capture trigger:

- `wiki/journal/2026-07-31-shallow-scan-sibling-folders.md` — the Why/What/Files/Follow-ups
  template, `pr: pending`, `issue:` the new issue URL, `topics: [retrospective-workflow]`,
  `plan:` pointing at the archived plan.
- One Journal line in `wiki/INDEX.md`.
- A Decisions bullet on `wiki/topics/retrospective-workflow.md`.
- Archive this plan: `pnpm wiki:archive-plan <this file> --status implemented --topics retrospective-workflow`.
- `pnpm graph:build` so `data/graph.json` and `wiki/connections*` match (`pnpm evals:graph` fails on drift).

## Accepted consequences

- **Page-chrome partials become components.** A `<group>/` folder holding non-component partials
  (page head, script includes) will now yield labels for them. They are trivially Rejected in
  triage, and filtering them would need a denylist with no principled signal behind it.
- **More `duplicate-component` warnings.** Emitting siblings can surface genuine collisions — the
  same label reachable from a flat file, a grouped folder, and a partials folder. The guard already
  handles this correctly (keep first, warn, identify each by entry file); the extra warnings are the
  honest report of a real ambiguity, not noise introduced by the fix.

## Verification

1. `pnpm test` — the gate (171 tests + `evals:graph`). Must stay green, with the new cases added.
2. **Regression, React/recursive path:** re-run `inventory.cjs` against the React/`sitecore-ai`
   checkout and diff against the pre-fix baseline already captured in the session scratchpad. The
   component list must be **identical** — this path must not move at all.
3. **Fix confirmed, toolkit path:** re-run against the Handlebars/`toolkit` checkout and diff
   against its pre-fix baseline. Expected: the two dropped primitives reappear, the folder-named
   phantom is gone, and the grouped folder's remaining siblings appear under their own names.
4. Confirm no `empty-bucket` or `unknown-adapter` regression in either run's warnings.
5. Read-only review agent over the diff.

Delivered on the new branch as an uncommitted working tree plus a suggested Conventional Commits
message. No commit, push, merge, tag, or PR.
