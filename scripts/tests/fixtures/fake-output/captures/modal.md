# Capture: Modal

## Proposal type

component-capture

## Canonical

**Modal** (`modal`) — resolved via name.

## Structural implementation

```json
{
  "componentKey": "modal",
  "canonical": "Modal",
  "variant": null,
  "variantLabel": null,
  "default": true
}
```

## Source

- Entry: `src/components/ui/modal/Modal.tsx`
- Directory: `src/components/ui/modal`
- Fingerprint: `src/components/ui/modal/fingerprint.json` — slots `title`, `body`, `actions`; affordance `overlay`; role `dialog`; variants `default`, `wide`.
- Build pack: `artifacts/build-packs/modal/` — `master.md` and `dom-contract.md`.
- Tests: none in this project.

## Reuse evidence

- The dialog semantics are already in the DOM contract rather than assumed: `artifacts/build-packs/modal/dom-contract.md` fixes `role="dialog"` and the labelling relationship.
- Accessibility: the dom contract names focus containment on open and restoration on close, and both are exercised by the build pack's own checks.
- Tokens: surface and motion come from semantic utilities; the overlay scrim is the one project-specific value.
- Variants and slots: three named slots and two variants, declared in `fingerprint.json` rather than inferred from props.
- Maturity: shipped with a build pack and a fingerprint, and revised once after the dom contract was written.

## De-client work

- **CMS coupling:** none — the component takes children, not field types.
- **Client tokens:** the scrim reads `--fake-overlay-scrim`, which has no semantic equivalent; map it onto a semantic overlay token or add one.
- **Client copy and assets:** the default close-button label is hardcoded; make it a required prop.
- **Project imports:** none outside the component directory.
- **Behavior to preserve:** focus containment on open and restoration to the invoking element on close.

## Runtime architecture

```json
{
  "mode": "hybrid",
  "hydration": ["state", "event-handler", "portal"],
  "serverOutput": "shell",
  "modules": [
    { "path": "index.ts", "role": "facade", "runtime": "server" },
    { "path": "Modal.types.ts", "role": "types", "runtime": "server" },
    { "path": "Modal.tsx", "role": "tree", "runtime": "server" },
    { "path": "parts/ModalDialog.client.tsx", "role": "branch", "runtime": "client" },
    { "path": "parts/ModalHeader.tsx", "role": "leaf", "runtime": "server" },
    { "path": "hooks/useModal.client.ts", "role": "hook", "runtime": "client" }
  ]
}
```

## Proposed library entry

Path: `components/modal/`

```json
{
  "canonical": "Modal",
  "slug": "modal",
  "framework": "react",
  "styling": "tailwind",
  "slots": ["title", "body", "actions"],
  "variants": ["default", "wide"],
  "exportName": "Modal",
  "rendering": "hybrid",
  "reuseFingerprint": {
    "slots": ["heading", "body", "action"],
    "affordance": "contain",
    "role": "container"
  },
  "realization": {
    "version": 1,
    "props": [
      { "path": "title", "type": "string", "required": true },
      { "path": "children", "type": "node", "required": true },
      { "path": "classNames", "type": "collection", "required": false },
      { "path": "classNames.dialog", "type": "string", "required": false },
      { "path": "classNames.title", "type": "string", "required": false }
    ],
    "contentBindings": [
      { "prop": "title", "node": "title" },
      { "prop": "children", "node": "body" }
    ],
    "safeAttributes": [],
    "styleSlots": [
      { "path": "classNames.dialog", "node": "dialog", "protectedProperties": ["display", "visibility", "semantics"] },
      { "path": "classNames.title", "node": "title", "protectedProperties": ["visibility", "semantics", "reading-order"] }
    ],
    "dom": {
      "nodes": [
        { "id": "dialog", "element": "div", "parent": null, "cardinality": "one" },
        { "id": "title", "element": "h2", "parent": "dialog", "cardinality": "one" },
        { "id": "body", "element": "div", "parent": "dialog", "cardinality": "one" }
      ]
    },
    "relationships": [
      { "from": "dialog", "attribute": "aria-labelledby", "to": "title" }
    ],
    "behaviors": [
      {
        "id": "component.dialog.semantics",
        "kind": "semantics",
        "description": "The dialog has a resolved accessible name.",
        "wcag": ["1.3.1", "4.1.2"],
        "evidence": "component.dialog.semantics",
        "evidenceType": "storybook-step"
      },
      {
        "id": "component.dialog.focus",
        "kind": "focus",
        "description": "Focus is contained and restored.",
        "wcag": ["2.1.2", "2.4.3"],
        "evidence": "component.dialog.focus",
        "evidenceType": "storybook-step"
      }
    ],
    "accessibility": {
      "standard": "WCAG-2.2-AA",
      "apgPattern": "modal-dialog",
      "consumerResponsibilities": ["accessible-copy", "heading-context", "token-contrast", "safe-class-overrides", "complete-page-assistive-technology-testing"]
    }
  },
  "tokens": ["color-surface-raised", "ease-standard"],
  "provenance": {
    "project": "fake-project",
    "run": "runs/fake-project/2026-01-01/",
    "source": "src/components/ui/modal/Modal.tsx"
  },
  "declienting": ["<one entry per removal — what came out, and what replaced it>"],
  "maturity": "candidate"
}
```

Story plan — one story per meaningful state, since the story file is the library's API contract:

- `Default` — title, body, and one action.
- `Wide` — the `wide` variant at the breakpoint where the layout changes.
- `NoActions` — the optional `actions` slot omitted.

## Progress

```json
{
  "status": "pending"
}
```

## Suggested commit

`feat(modal): Add Modal captured from fake-project`
