# Capture: Modal

## Proposal type

component-capture

## Canonical

**Modal** (`modal`) — resolved via name.

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
- **Behavior to keep verbatim:** focus containment on open and restoration to the invoking element on close — that pair is the reason this implementation is worth keeping.

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
  "reuseFingerprint": {
    "slots": ["heading", "body", "action"],
    "affordance": "contain",
    "role": "container"
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

## Suggested commit

`feat(modal): Add Modal captured from fake-project`
