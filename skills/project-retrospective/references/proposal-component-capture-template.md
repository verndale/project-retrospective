# Proposal template — component capture

## Contents

- What a capture is for
- Choosing what to capture
- Template
- Rules

## What a capture is for

The catalog defines the **Card** canonical. A capture records a project implementation proposed as the library candidate for that canonical.

Captures target the private `ui-design-library` repo, not `ui-design-brain`, and they are **drafts executed by `Action: capture`**, or by a human following the same procedure. A component lifted from a client project carries CMS types, client token names, and client copy; turning it into a library component is a rewrite. The capture identifies the candidate, cites its selection evidence, and enumerates the de-client work.

Write one file per exact implementation identity: default `captures/<kebab-canonical>.md`; structural alternate `captures/<kebab-canonical>--<variant>.md`. Captures remain separate from `proposals/` because a capture is a library change, not a catalog change.

## Choosing what to capture

**Capture is orthogonal to promotion.** Prefer components whose labels already resolve and whose implementation evidence is complete. Novel labels usually have less implementation history.

Capture when all of these hold:

1. **The label resolves to a canonical**, or a `new-pattern` proposal in this same run establishes one — in which case the capture is drafted now but comes back `deferred` from `capture-preflight.cjs` until that proposal is promoted (promote first, then capture). A library entry with no catalog name has nothing to key on.
2. **The implementation has concrete evidence** — a build pack, colocated unit tests, a `fingerprint.json` declaring its slot/variant surface, and accessibility behavior identifiable in code.
3. **The client-specific surface is separable.** If the component only makes sense with the client's content model, it is project code.
4. **The token usage is disciplined** — semantic token utilities rather than arbitrary values, so the component can be re-themed instead of re-styled.
5. **Its runtime boundary can be stated precisely.** Audit every hook, handler, context, portal, timer, observer, browser API, and client-only dependency. Prefer a server tree with the smallest possible client leaves; retain `'use client'` only where a listed hydration reason requires it.

Do not capture: page-shaped regions, anything in the hard exclusion list, thin wrappers whose whole body is another component, or a component whose only evidence is `code-scan`.

## Template

````markdown
# Capture: <Canonical Name>

## Proposal type

component-capture

## Canonical

**<Canonical Name>** (`<slug>`) — resolved via <name | alias `X` | new-pattern proposal in this run>.

## Structural implementation

```json
{
  "componentKey": "<slug or slug--variant>",
  "canonical": "<Canonical Name>",
  "variant": null,
  "variantLabel": null,
  "default": true
}
```

For an alternate, set `variant` to its kebab identity, `variantLabel` to its human label, and `default` to `false`. When the existing bare default has no structural fields yet, add `"companionDefault": { "variant": "<default-variant>", "variantLabel": "<Default label>" }`; schema-v4 preflight emits the companion manifest/Figma-registry write rather than leaving the family half-migrated.

## Source

- Entry: `<path to the component file in the analyzed project>`
- Directory: `<component directory>`
- Fingerprint: `<path>` — <slots / affordance / role / variants it declares>
- Build pack: `<path>` — <which leaves exist>
- Tests: `<paths>` — <unit, e2e, what they cover>

## Reuse evidence

- <Selection evidence for this implementation — cite paths.>
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
- **Behavior to preserve:** <the behavior the rewrite must retain.>

## Runtime architecture

```json
{
  "mode": "server | hybrid | client",
  "hydration": ["state | event-handler | effect | context | portal | timer | observer | browser-api | third-party-client"],
  "serverOutput": "full | shell | none",
  "modules": [{"path": "relative module path", "role": "facade | types | tree | branch | leaf | hook | styles", "runtime": "server | client"}]
}
```

Replace each union string with one permitted value and list every module the rewrite will create, relative to `components/<slug>/`. The plan must contain exactly one `index.ts` facade, exactly one `.ts` types module, and at least two `tree` / `branch` / `leaf` `.tsx` implementation modules. Paths are unique, normalized, relative, and use forward slashes.

- `server` — `hydration: []`, `serverOutput: "full"`, a server facade, and no client modules.
- `hybrid` — at least one server tree/branch/leaf implementation and one client module, a server facade, one or more concrete hydration reasons, and `serverOutput: "shell"`. The facade alone does not count as server-rendered implementation.
- `client` — a client `index.ts` facade, one or more concrete hydration reasons, `serverOutput: "none"`, and at least one client tree/branch/leaf module. Neutral presentation leaves may remain `runtime: "server"` when they contain no client behavior, even though importing them beneath the client facade places them in its client graph.
- Every client module except the deliberate public `index.ts` exception ends in `.client.ts` or `.client.tsx`. The client facade itself must start with `'use client'`; server and hybrid facades must not. A hybrid client island imported directly by a server module also starts with the directive; descendants already beneath a client boundary do not repeat it.
- Keep every `'use client'` file at or below 120 physical lines. Split interaction into client hooks/leaves rather than moving the whole tree across the boundary.

## Proposed library entry

Path: `components/<componentKey>/`

```json
{
  "canonical": "<Canonical Name>",
  "slug": "<slug>",
  "variant": "<alternate variant, or named default variant when the family has alternates>",
  "default": true,
  "framework": "react",
  "styling": "tailwind",
  "slots": ["<slot>", "<slot>"],
  "variants": ["<variant>"],
  "exportName": "<PrimaryExport>",
  "rendering": "server | hybrid | client",
  "reuseFingerprint": {
    "slots": ["heading", "body", "action"],
    "affordance": "contain",
    "role": "container"
  },
  "realization": {
    "version": 1,
    "props": [
      { "path": "children", "type": "node", "required": true },
      { "path": "classNames", "type": "collection", "required": false },
      { "path": "classNames.root", "type": "string", "required": false }
    ],
    "contentBindings": [{ "prop": "children", "node": "root" }],
    "safeAttributes": [],
    "styleSlots": [
      { "path": "classNames.root", "node": "root", "protectedProperties": ["display", "visibility", "semantics", "reading-order"] }
    ],
    "dom": {
      "nodes": [{ "id": "root", "element": "div", "parent": null, "cardinality": "one" }]
    },
    "relationships": [],
    "behaviors": [
      {
        "id": "<slug>.semantics.root",
        "kind": "semantics",
        "description": "<package-owned guarantee>",
        "wcag": ["1.3.1"],
        "evidence": "<slug>.semantics.root",
        "evidenceType": "storybook-step"
      }
    ],
    "accessibility": {
      "standard": "WCAG-2.2-AA",
      "apgPattern": null,
      "consumerResponsibilities": ["accessible-copy", "token-contrast", "safe-class-overrides", "complete-page-assistive-technology-testing"]
    }
  },
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

This entry describes the intended **de-cliented** result, not the source component as found. Realization props, exact package-owned nodes and ancestry, cardinality and conditions, IDREF relationships, protected style slots, owned behaviors, WCAG/APG metadata, and governed consumer responsibilities must agree with the code the action will write. Every owned behavior uses one stable `id`, repeats it as `evidence`, and receives a story `play` assertion under that same evidence ID.

Omit `variant` and `default` for a single-implementation canonical. A named bare default carries both `variant` and `default: true`; a compound alternate carries `variant` and omits `default`.

`Runtime architecture` is an execution plan, not package metadata. `capture-preflight.cjs` validates and returns it separately in its schema-v4 plan; do not add it to `component.json`. `rendering` must equal the architecture mode.

Story plan — one story per meaningful state, since the story file is the library's API contract:

- `Default` — <the baseline args>
- `<Variant>` — <what it demonstrates>
- `<Edge state>` — <empty, long content, missing optional slot>

The default story meta carries `title: '<Canonical Name>'`; an alternate carries `title: '<Canonical Name> / <Variant label>'`. Both use `tags: ['maturity:candidate']`.

## Progress

```json
{
  "status": "pending"
}
```

After verified code exists, replace it with `status: "code-complete"`, exact `componentPath`, verified commands, and any `blockedOn` capability. Preflight then resumes at Figma.

## Applied

Add only after code, reviewed Figma, and private evidence reconcile:

```json
{
  "status": "landed",
  "componentPath": "components/<componentKey>",
  "figma": { "nodeId": "<stable node id>", "nodeKey": "<stable node key>" }
}
```

## Suggested commit

`feat(<slug>): Add <Canonical Name> captured from <project slug>`

The scope is the component slug, not `library` — `ui-design-library` owns that convention; see its `CONTRIBUTING.md`.
````

## Rules

- **Captures never write into the analyzed project, the catalog, or ai-orchestration.** A capture is executed into `ui-design-library` by `Action: capture`, and that action writes nowhere else.
- **Key on the canonical slug.** The library is only deterministically usable if its keys are the same vocabulary the catalog resolves to. A capture with no canonical is not ready.
- **Name the file after the exact structural key, never the project's label.** Default Badge is `captures/badge.md`; a qualified compact implementation is `captures/badge--compact.md`. The canonical line always declares base slug `badge`. Never re-kebab `badge--compact`; doing so destroys the delimiter.
- **`maturity: "candidate"`** on every capture. Promoting a candidate to a supported library component is a human decision made in that repo, after the rewrite and the story exist.
- **The de-client list is required.** Name each coupling so the rewrite can be estimated and client-specific dependencies do not enter shared code.
- **The runtime graph is also a deliverable.** Missing or inconsistent runtime architecture blocks capture. Do not use `client` merely because the source starts with `'use client'`; list the hydration reason and place the directive on the smallest leaves that need it.
- **The realization is the intended de-cliented result.** Missing or inconsistent public props, DOM ownership, keyboard/focus/state/announcement behavior, WCAG 2.2 AA metadata, APG pattern, evidence IDs, protected style slots, or consumer responsibilities block capture. If Action changes the public API, DOM, keyboard model, or accessibility ownership, revise the capture and re-run preflight before writing the manifest.
- **No client names, copy, or asset URLs in the capture body** beyond the provenance paths needed to find the source. The capture travels to a repo other projects read.
- **One capture file per `(canonical, variant)` identity — never silently drop a second module.** When two components resolve to the same canonical, decide which case you have:
  - **Prop or visual variants of one component** (a wide Modal, a compact Card, a tone) fold into that single capture's `component.json.variants` array — one file, multiple entries. The golden `captures/modal.md` shows the shape (`"variants": ["default", "wide"]`).
  - **A structural alternate with the same role, affordance, and interaction semantics** gets a qualified import `components/<slug>--<variant>` and a qualified Figma master on the canonical family page.
  - **Different role, affordance, or interaction semantics** means it is not that canonical. Route it through a `new-pattern` proposal instead of hiding a semantic split behind a structural variant.
