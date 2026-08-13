# Library integrity checklist

The ordered procedure for `Action: capture`. Applies a run's component captures to a **local ui-design-library working tree**, one component at a time, verifies each with that repo's own checks, and stops.

Executing a capture is a rewrite, not a copy. A component lifted straight out of a client project carries CMS types, client token names, and client copy; none of that belongs in a repo other projects read. The capture tells you what to keep and what to strip — this checklist is the order that keeps the library valid at every step along the way.

## Contents

- Use when
- Preconditions
- Formatting invariants
- Write the facade and types
- Write the tree, parts, and hooks
- Write the stories
- Write component.json and sync exports
- Verification
- Wiki
- Handback
- If verification fails

## Use when

- `Action: capture` — applying component captures to a `Library` checkout.
- Not for catalog changes. A new pattern or alias goes to ui-design-brain through `references/brain-integrity-checklist.md` instead, and it goes **first**: the library keys its component directories on canonical slugs the catalog already resolves.

## Preconditions

Stop and report if any of these fail — do not partially apply:

1. `Captures:` names a readable directory holding at least one `component-capture` file.
2. `Library:` contains `components/` and `src/tokens/semantic.css`.
3. `capture-preflight.cjs` exits 0, emits `schemaVersion: 3`, and carries a non-null `manifest`, `architecture`, and realization v1 for every `ready`/`skipped` capture. Exit 0 is the only green light: every capture is `ready` or `skipped`. A `blocked` one (exit 1) names its reason and is not yours to work around. A **`deferred`** one (exit 6) is valid but **not yet executable** — its canonical is established only by a sibling `new-pattern` proposal this run drafted, so it cannot be in the catalog yet. Promote that proposal first (`Action: promote`), then re-run the preflight and it becomes `ready`; do not write a deferred capture into the library now, and do not read a plan that has one as safe to start. Without `Brain` the script degrades — it warns `manifest-absent`, skips the catalog check, and still exits 0 with every capture `ready`. That is a run that verified nothing about the canonicals, and the library's own contracts will not catch it: they compare `component.json` against its own directory name, never against the catalog.
4. **Report `orphanedByRun` before touching anything.** A library component claiming one of this set's runs with no capture behind it is the exact defect this action exists to prevent — say which component, and let the maintainer decide.
5. `git -C <Library> status --short` is clean, or its existing changes are unrelated. Report what you found before adding to a dirty tree.
6. `pnpm contracts` passes in the library **before** you start, so any failure afterwards is unambiguously yours.

## Formatting invariants

Owned by `ui-design-library` — its `scripts/check-contracts.cjs` and `CONTRIBUTING.md` are authoritative, not this file. Read them if anything below looks stale.

- **A public facade over a private module tree:** every component has `components/<slug>/index.ts`, one `.ts` types module, at least two `tree` / `branch` / `leaf` `.tsx` implementation modules, one `.stories.tsx`, and `component.json`. Component-specific parts stay below that directory; only a genuinely shared dependency-free primitive belongs in `src/lib/`. Do not create public subpaths for internal parts.
- **The preflight architecture is exact:** `mode` is `server`, `hybrid`, or `client`; hydration reasons come only from the governed list; `serverOutput` is respectively `full`, `shell`, or `none`; module paths are safe, normalized, relative, unique `.ts`/`.tsx` paths with governed roles and runtimes. For an existing directory, “already applied” additionally requires the exact implementation module set, non-empty and reachable files, a consistent client boundary, matching root story metadata, and matching stable manifest fields. The architecture remains in the capture/preflight plan and is never copied into `component.json`.
- **Server first:** `server` has no client modules or hydration. `hybrid` keeps a server `index.ts` facade, includes at least one server tree/branch/leaf implementation, and moves only evidenced interaction into client leaves. The facade alone is not server-rendered implementation. `client` is the exception: its `index.ts` is a client facade because the public component itself cannot render a server tree.
- **Client boundaries are visible and small:** every client module other than the deliberate client-mode `index.ts` facade ends in `.client.ts`/`.client.tsx`. Put `'use client'` on the facade or hybrid island where a server module first enters a client graph; descendants already beneath that boundary do not repeat it. A server module never uses the suffix or directive. Every `.client.ts(x)` and every directive-bearing file is at most 120 physical lines; split hooks/leaves again when either would exceed the cap.
- **SSR-safe initial render:** never read `window`, `document`, storage, media queries, or layout at module scope or during initial render. Gate browser work in effects/event handlers and keep the server and first client render deterministic. A client component is still server-rendered by React/Next; `'use client'` does not opt it out of SSR.
- **Slug equality:** `component.json`'s `slug`, the directory name, and `kebab(canonical)` must all agree. This is why a new canonical is promoted to the catalog first.
- **`slots` is non-empty.** A component declaring no slots fails.
- **`reuseFingerprint` is governed and non-empty.** Its structural slots, primary affordance, and content role use the library's governed vocabularies; preflight emits the validated object in `componentJson` so contracts do not fail after capture.
- **Primary realization metadata is complete.** `exportName` is a JavaScript identifier, `rendering` agrees with runtime architecture, and realization v1 describes the intended de-cliented public props, exact owned DOM, relationships, protected style slots, owned WCAG 2.2 AA/APG behaviors, evidence IDs, and governed consumer responsibilities.
- **Tokens are declared without the leading `--`** and every one must exist in `src/tokens/semantic.css`. If a value has no semantic home, **add the token** rather than inlining the value.
- **No raw colour in the implementation** — no hex literal, no `rgb()`/`rgba()` outside a comment.
- **`maturity: "candidate"`**, mirrored by a `'maturity:candidate'` tag on the story meta. `pnpm contracts` fails when the two disagree, because the sidebar badge renders from the tag and two sources for one fact drift silently.

**The one invariant no script enforces:** `declienting`. That repo mandates it and its contract checker does not read it, so nothing downstream will catch an empty or lazy array. It is yours to self-verify — one entry per removal, naming what came out and what replaced it. "Minor cleanup" is not an entry.

## Write the facade and types

Follow the preflight architecture exactly. Start the component as one uninterrupted write sequence — the facade may temporarily reference not-yet-written modules, so do not run a gate or hand back until the entire component reaches verification.

1. Write `components/<slug>/index.ts`, exporting only the supported public API. In `client` mode its first statement is `'use client'`; in `server` and `hybrid` mode it has no directive and must not pull the whole graph across the client boundary.
2. Write the planned `types` module. Keep shared serializable props here so server trees and client leaves depend on the same contract without importing runtime code.

## Write the tree, parts, and hooks

Write every planned `tree`, `branch`, `leaf`, `hook`, and `styles` module before the story:

1. **Replace project imports** with primitives from `src/lib/`, or write a new dependency-free one there.
2. **Map client tokens onto semantic tokens.** Where the capture's De-client work names a token with no semantic equivalent, add it to `src/tokens/semantic.css` — that is a sanctioned implementation write outside `components/`; the later deterministic export sync may also update `package.json`.
3. **Drop client copy, assets, and brand colours.** A hardcoded label becomes a required prop.
4. **Keep verbatim what the capture says to keep.** That behaviour is why the component was worth capturing; a rewrite that loses it produced a different component.
5. **Keep the runtime boundary honest.** Server modules render the full output or hybrid shell. Only modules whose declared hydration reason requires it may be client modules, and each client file stays within 120 physical lines. Prefer event handlers/effects over browser work during render.

Record every removal as you go — you are writing the `declienting` array after the story, and reconstructing it afterwards is how "minor cleanup" happens.

## Write the stories

`components/<slug>/<PascalCase>.stories.tsx`.

- `import type { Meta, StoryObj } from '@storybook/react-vite'`; `title: '<Canonical Name>'`; `tags: ['maturity:candidate']`; `satisfies Meta<typeof X>`.
- Import the component from `./index`, never a private tree/branch/leaf module, so every story exercises the public package facade.
- One story per entry in the capture's story plan, plus the edge states that break layouts — empty, very long content, a missing optional slot.
- **Assert the effect, not the cause.** Computed style rather than class names; a real Tab rather than `element.focus()`; that an `aria-*` reference resolves rather than that the attribute is present.
- Tag an animating component's story `motion` so `pnpm test:motion` re-runs it under emulated `prefers-reduced-motion`, and branch the assertion on `matchMedia`.
- Key each realization-owned behavior in the story metadata and assert it in a `play` function under the same evidence ID. Cover keyboard, focus, resolved IDREFs, live behavior, hidden/inert focusability, and decorative-tree exclusions where the realization claims them.

## Write component.json and sync exports

Last, deliberately. `components/<slug>/` holding only a `component.json` fails that repo's contracts on the missing implementation and stories — writing it first would leave the library red for the whole rewrite. **Do not run `pnpm contracts` between the previous two steps, and do not stop between them:** the directory is incomplete until this step lands.

1. Paste the preflight's `componentJson` for this capture verbatim. It already carries that repo's key order, primary export/rendering identity, and validated intended realization.
2. Fill `declienting` from what you actually removed — not from the capture's De-client work, which was the estimate.
3. Leave `maturity` at `candidate`. Promotion to `supported` is a human decision made in that repo, after the component has been used.
4. Do not add the preflight's `architecture` object. It governs this rewrite; it is not part of the library manifest contract.
5. If implementation changed the planned public API, owned DOM, keyboard model, or accessibility ownership, stop: revise the capture and re-run preflight. Do not silently reshape realization metadata after the gate.

Then run `pnpm exports:sync` from the library root. The public export points to `index.ts`/its compiled `index.js`; internal tree/branch/leaf modules remain private implementation details.

The complete action order is facade/types → tree/parts/hooks → stories → `component.json` → `pnpm exports:sync` → verification. Then start the next capture. **One component start-to-verify before the next** — a batch of half-written directories is the state this order exists to prevent.

## Verification

From the library checkout root — `cd` into `Library` first:

```bash
pnpm contracts
```

The fast structural pass: slug equality, recursive module architecture, client-boundary naming/line limits, non-empty slots, declared tokens defined, and the maturity tag agreeing. Exit 0 is the pass. Then the full gates:

```bash
pnpm test
pnpm build
```

`pnpm test` typechecks, checks contracts, renders every story in Chromium and WebKit with axe over the result, runs accessibility modes and reduced motion, and verifies behavior evidence. An accessibility violation fails the run. `pnpm build` proves the public `components/<slug>` export resolves to the facade and every nested module/declaration emits.

`pnpm test` needs browser binaries (`pnpm exec playwright install chromium webkit`, once per machine). A missing browser is an environment failure, not a failing component — say so and do not spend an attempt on it.

## Wiki

After `pnpm test` and `pnpm build` pass, author the client-agnostic context-wiki entry in the same delivery, per `references/downstream-wiki.md` — the library's own `wiki/MECHANICS.md` owns the format. Skip with a stated message when `<Library>/wiki/` is absent, and write **only for a component actually written**: a `deferred`, `blocked`, or `skipped` capture wrote nothing, so it gets no entry.

- **Journal** — one `wiki/journal/<date>-add-<slug>-component.md` per written component, `topics: []`, `plan: none`, `pr: pending`. Ground *What changed* in the `declienting` removals (citing only the semantic destination token, never the client source token) and what was kept verbatim; provenance stays "in `component.json`", never the run slug in prose. No topic page — MECHANICS creates one only once two related entries exist.
- **INDEX** — one `wiki/INDEX.md` Journal line per new journal file, newest-first.
- **Rebuild** — after the last entry, rebuild the graph from the `Library` root. Prefer `pnpm graph:build`; a bare `node scripts/graph/build-graph.cjs` from the wrong directory rebuilds *this* skill's graph instead — this repo has a file at the identical path. This step is new to capture: `pnpm contracts`/`pnpm test` do not touch the graph, so without it the handed-back `wiki/connections*` are stale.

Client-agnostic throughout — the canonical, the count, the de-client decision; never the client name, the run slug, or client copy. Append-only.

## Handback

Stop here. Report:

```
Applied <N> capture(s) from <captures path> to <library path>.

Added:
<output of: git -C <library path> status --short>

Orphaned by run (library components claiming a run in this set with no capture):
<the preflight's orphanedByRun, or "none">

Verification: pnpm contracts → exit 0; pnpm test → exit 0; pnpm build → exit 0 (run in <library path>)

Wiki: wiki/journal/<date>-add-<slug>-component.md (per written component), wiki/INDEX.md
(client-agnostic; skipped when <library path>/wiki/ is absent).
Regenerated wiki/connections* and scripts/graph/data/graph.json via pnpm graph:build.

Suggested commits — run inside <library path>, one per component:
  pnpm commit
Or directly:
  git commit -m "<suggested commit from the capture>"

This skill does not commit, push, or open a PR.
```

Commit subjects follow that repo's convention — the scope is the **component slug**, not `library`:

- `feat(<slug>): Add <Canonical Name> captured from <project slug>`
- `feat(tokens): Add <token> for <Canonical Name>` when the rewrite needed a new semantic token

## If verification fails

Read the error, fix the cause, re-run. **Cap: 3 attempts.** After the third failure, revert the component directory and export-map change you were writing (`git -C <Library> checkout -- components/<slug> package.json`, or delete the component if it is new), plus any token you added; report the failure with the error output and what you tried, and stop. Components already verified and handed back stay — they are complete and independently valid. Never leave a `components/<slug>/` partially written.
