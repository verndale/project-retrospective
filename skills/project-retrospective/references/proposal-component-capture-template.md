# Proposal template — component capture

## Contents

- What a capture is for
- Choosing what to capture
- Template
- Rules

## What a capture is for

The catalog says what a **Card** is. A capture says "this project's Card implementation is good enough that the next project should start from it rather than rebuild it."

Captures target the private `ui-design-library` repo, not `ui-design-brain`, and they are **drafts executed by `Action: capture`**, or by a human following the same procedure. A component lifted straight out of a client project carries CMS types, client token names, and client copy; turning it into a library component is a rewrite, not a copy. The capture's job is to identify the candidate, prove it is worth the rewrite, and enumerate exactly what the rewrite has to strip.

Write one file per candidate at `captures/<kebab-canonical>.md` — a separate directory from `proposals/`, because a capture is a library change, not a catalog change. Each file pairs with a `### <Canonical Name>` entry under `## Captures` in `report.md`; `validate-report.cjs` fails when either half is missing.

## Choosing what to capture

**Capture is orthogonal to promotion.** The best capture candidates are usually components whose labels *already resolve* — a mature Card, Modal, or Breadcrumbs implementation is exactly what the next project should not rebuild. Novel labels are usually the least mature code in the project.

Capture when all of these hold:

1. **The label resolves to a canonical**, or a `new-pattern` proposal in this same run establishes one — in which case the capture is drafted now but comes back `deferred` from `capture-preflight.cjs` until that proposal is promoted (promote first, then capture). A library entry with no catalog name has nothing to key on.
2. **The implementation is evidenced as mature** — a build pack, colocated unit tests, a `fingerprint.json` declaring a real slot/variant surface, and accessibility work that is visible in the code rather than assumed.
3. **The client-specific surface is separable.** If the component only makes sense with the client's content model, it is project code.
4. **The token usage is disciplined** — semantic token utilities rather than arbitrary values, so the component can be re-themed instead of re-styled.

Do not capture: page-shaped regions, anything in the hard exclusion list, thin wrappers whose whole body is another component, or a component whose only evidence is `code-scan`.

## Template

````markdown
# Capture: <Canonical Name>

## Proposal type

component-capture

## Canonical

**<Canonical Name>** (`<slug>`) — resolved via <name | alias `X` | new-pattern proposal in this run>.

## Source

- Entry: `<path to the component file in the analyzed project>`
- Directory: `<component directory>`
- Fingerprint: `<path>` — <slots / affordance / role / variants it declares>
- Build pack: `<path>` — <which leaves exist>
- Tests: `<paths>` — <unit, e2e, what they cover>

## Reuse evidence

- <Why this implementation, not just the concept, is worth keeping — cite paths.>
- Accessibility: <the concrete techniques present in the code, with line references.>
- Tokens: <semantic utilities used; any arbitrary values and why.>
- Variants and slots: <the real API surface, from the fingerprint and the props.>
- Maturity: <tests, how long it has been in production, whether it was revised.>

## De-client work

What the library rewrite must strip or change. Be exhaustive and specific — this list is the estimate.

- **CMS coupling:** <e.g. Content SDK field types, `params.styles`, placeholder wiring — and what replaces them.>
- **Client tokens:** <token names that must map to library tokens.>
- **Client copy and assets:** <hardcoded strings, image paths.>
- **Project imports:** <helpers, path aliases, config it depends on.>
- **Behavior to keep verbatim:** <the parts that are the actual value and must survive the rewrite.>

## Proposed library entry

Path: `components/<slug>/`

```json
{
  "canonical": "<Canonical Name>",
  "slug": "<slug>",
  "framework": "react",
  "styling": "tailwind",
  "slots": ["<slot>", "<slot>"],
  "variants": ["<variant>"],
  "tokens": ["<semantic token group>"],
  "provenance": {
    "project": "<project slug>",
    "run": "runs/<project-slug>/<YYYY-MM-DD>/",
    "source": "<path in the analyzed project>"
  },
  "declienting": ["<one entry per removal — what came out, and what replaced it>"],
  "maturity": "candidate"
}
```

At capture time `declienting` mirrors `## De-client work`. At execution time it is rewritten to record what was **actually** removed. `ui-design-library` mandates the field but does not check it, so it is the one entry in this block nothing but the author enforces — "minor cleanup" is not an entry.

Story plan — one story per meaningful state, since the story file is the library's API contract:

- `Default` — <the baseline args>
- `<Variant>` — <what it demonstrates>
- `<Edge state>` — <empty, long content, missing optional slot>

The story meta carries `title: '<Canonical Name>'` and `tags: ['maturity:candidate']`. That repo's `pnpm contracts` fails when the tag and `component.json`'s `maturity` disagree — the sidebar badge renders from the tag, so two sources for one fact drift silently.

## Suggested commit

`feat(<slug>): Add <Canonical Name> captured from <project slug>`

The scope is the component slug, not `library` — `ui-design-library` owns that convention; see its `CONTRIBUTING.md`.
````

## Rules

- **Captures never write into the analyzed project, the catalog, or ai-orchestration.** A capture is executed into `ui-design-library` by `Action: capture`, and that action writes nowhere else.
- **Key on the canonical slug.** The library is only deterministically usable if its keys are the same vocabulary the catalog resolves to. A capture with no canonical is not ready.
- **Name the file after the canonical, not the project's label.** A capture of a project's `Tag` component whose canonical is **Badge** is `captures/badge.md`, and the parenthetical on its `## Canonical` line is `` `badge` ``. The report's `### Badge` entry, the filename, and that parenthetical must all agree — the library keys its component directories on the canonical slug, so a capture named after the label leads to a mis-slugged component.
- **`maturity: "candidate"`** on every capture. Promoting a candidate to a supported library component is a human decision made in that repo, after the rewrite and the story exist.
- **The de-client list is the deliverable.** A capture that says "minor cleanup needed" is useless; the value is in naming every coupling so the rewrite can be estimated and nothing client-specific leaks into shared code.
- **No client names, copy, or asset URLs in the capture body** beyond the provenance paths needed to find the source. The capture travels to a repo other projects read.
- **One capture *file* per canonical per run — but never silently drop a second module.** When two components resolve to the same canonical, decide which case you have and record it in the report's `## Captures` prose and this capture's `## Reuse evidence`:
  - **Prop or visual variants of one component** (a wide Modal, a compact Card, a tone) fold into that single capture's `component.json.variants` array — one file, multiple entries. The golden `captures/modal.md` shows the shape (`"variants": ["default", "wide"]`).
  - **A structurally distinct module** — a different `fingerprint.json` slot / affordance / role / interaction contract, *not* a difference in styling, size, colour, copy, or a prefix/suffix word — is not a variant even when it resolves to the same canonical: it misresolved, and was never really that canonical. Route it to its **own** canonical via a `new-pattern` proposal (it must still clear all four Promote tests), then draft its capture keyed to that proposed canonical; preflight reports it `deferred` until the proposal is promoted. The library keys one directory per canonical, so this is the only way two implementations coexist.
