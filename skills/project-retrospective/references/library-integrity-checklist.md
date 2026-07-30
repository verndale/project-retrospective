# Library integrity checklist

The ordered procedure for `Action: capture`. Applies a run's component captures to a **local ui-design-library working tree**, one component at a time, verifies each with that repo's own checks, and stops.

Executing a capture is a rewrite, not a copy. A component lifted straight out of a client project carries CMS types, client token names, and client copy; none of that belongs in a repo other projects read. The capture tells you what to keep and what to strip — this checklist is the order that keeps the library valid at every step along the way.

## Contents

- Use when
- Preconditions
- Formatting invariants
- Write the implementation
- Write the stories
- Write component.json
- Verification
- Handback
- If verification fails

## Use when

- `Action: capture` — applying component captures to a `Library` checkout.
- Not for catalog changes. A new pattern or alias goes to ui-design-brain through `references/brain-integrity-checklist.md` instead, and it goes **first**: the library keys its component directories on canonical slugs the catalog already resolves.

## Preconditions

Stop and report if any of these fail — do not partially apply:

1. `Captures:` names a readable directory holding at least one `component-capture` file.
2. `Library:` contains `components/` and `src/tokens/semantic.css`.
3. `capture-preflight.cjs` exits 0 **and its plan carries a non-null `manifest`**. Exit 0 is the only green light: every capture is `ready` or `skipped`. A `blocked` one (exit 1) names its reason and is not yours to work around. A **`deferred`** one (exit 6) is valid but **not yet executable** — its canonical is established only by a sibling `new-pattern` proposal this run drafted, so it cannot be in the catalog yet. Promote that proposal first (`Action: promote`), then re-run the preflight and it becomes `ready`; do not write a deferred capture into the library now, and do not read a plan that has one as safe to start. Without `Brain` the script degrades — it warns `manifest-absent`, skips the catalog check, and still exits 0 with every capture `ready`. That is a run that verified nothing about the canonicals, and the library's own contracts will not catch it: they compare `component.json` against its own directory name, never against the catalog.
4. **Report `orphanedByRun` before touching anything.** A library component claiming one of this set's runs with no capture behind it is the exact defect this action exists to prevent — say which component, and let the maintainer decide.
5. `git -C <Library> status --short` is clean, or its existing changes are unrelated. Report what you found before adding to a dirty tree.
6. `pnpm contracts` passes in the library **before** you start, so any failure afterwards is unambiguously yours.

## Formatting invariants

Owned by `ui-design-library` — its `scripts/check-contracts.cjs` and `CONTRIBUTING.md` are authoritative, not this file. Read them if anything below looks stale.

- **Three flat files per component:** `components/<slug>/component.json`, `<PascalCase>.tsx`, `<PascalCase>.stories.tsx`. No barrel, no registry to append to, no per-component README — Storybook discovers by glob and the contract checker by directory listing. The checker requires those three and tolerates a fourth; every component in that repo has exactly three, so add nothing.
- **Slug equality:** `component.json`'s `slug`, the directory name, and `kebab(canonical)` must all agree. This is why a new canonical is promoted to the catalog first.
- **`slots` is non-empty.** A component declaring no slots fails.
- **Tokens are declared without the leading `--`** and every one must exist in `src/tokens/semantic.css`. If a value has no semantic home, **add the token** rather than inlining the value.
- **No raw colour in the implementation** — no hex literal, no `rgb()`/`rgba()` outside a comment.
- **`maturity: "candidate"`**, mirrored by a `'maturity:candidate'` tag on the story meta. `pnpm contracts` fails when the two disagree, because the sidebar badge renders from the tag and two sources for one fact drift silently.

**The one invariant no script enforces:** `declienting`. That repo mandates it and its contract checker does not read it, so nothing downstream will catch an empty or lazy array. It is yours to self-verify — one entry per removal, naming what came out and what replaced it. "Minor cleanup" is not an entry.

## Write the implementation

`components/<slug>/<PascalCase>.tsx`. In this order, because the next two steps depend on what this one settles:

1. **Replace project imports** with primitives from `src/lib/`, or write a new dependency-free one there.
2. **Map client tokens onto semantic tokens.** Where the capture's De-client work names a token with no semantic equivalent, add it to `src/tokens/semantic.css` — that is a sanctioned write, and the only one outside `components/`.
3. **Drop client copy, assets, and brand colours.** A hardcoded label becomes a required prop.
4. **Keep verbatim what the capture says to keep.** That behaviour is why the component was worth capturing; a rewrite that loses it produced a different component.

Record every removal as you go — you are writing the `declienting` array two steps from now, and reconstructing it afterwards is how "minor cleanup" happens.

## Write the stories

`components/<slug>/<PascalCase>.stories.tsx`.

- `import type { Meta, StoryObj } from '@storybook/react-vite'`; `title: '<Canonical Name>'`; `tags: ['maturity:candidate']`; `satisfies Meta<typeof X>`.
- One story per entry in the capture's story plan, plus the edge states that break layouts — empty, very long content, a missing optional slot.
- **Assert the effect, not the cause.** Computed style rather than class names; a real Tab rather than `element.focus()`; that an `aria-*` reference resolves rather than that the attribute is present.
- Tag an animating component's story `motion` so `pnpm test:motion` re-runs it under emulated `prefers-reduced-motion`, and branch the assertion on `matchMedia`.

## Write component.json

Last, deliberately. `components/<slug>/` holding only a `component.json` fails that repo's contracts on the missing implementation and stories — writing it first would leave the library red for the whole rewrite. **Do not run `pnpm contracts` between the previous two steps, and do not stop between them:** the directory is incomplete until this step lands.

1. Paste the preflight's `componentJson` for this capture verbatim. It already carries that repo's key order and the derived fields.
2. Fill `declienting` from what you actually removed — not from the capture's De-client work, which was the estimate.
3. Leave `maturity` at `candidate`. Promotion to `supported` is a human decision made in that repo, after the component has been used.

Then verify, then start the next capture. **One component start-to-verify before the next** — a batch of half-written directories is the state this order exists to prevent.

## Verification

From the library checkout root — `cd` into `Library` first:

```bash
pnpm contracts
```

The fast structural pass: slug equality, the three files, non-empty slots, declared tokens defined, the maturity tag agreeing. Exit 0 is the pass. Then the full gate:

```bash
pnpm test
```

Typecheck, contracts, every story rendered in a real Chromium with axe over the result, then the reduced-motion pass. An accessibility violation fails the run.

`pnpm test` needs a browser (`pnpm exec playwright install chromium`, once per machine). A missing browser is an environment failure, not a failing component — say so and do not spend an attempt on it.

## Handback

Stop here. Report:

```
Applied <N> capture(s) from <captures path> to <library path>.

Added:
<output of: git -C <library path> status --short>

Orphaned by run (library components claiming a run in this set with no capture):
<the preflight's orphanedByRun, or "none">

Verification: pnpm contracts → exit 0; pnpm test → exit 0 (run in <library path>)

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

Read the error, fix the cause, re-run. **Cap: 3 attempts.** After the third failure, revert the component directory you were writing (`git -C <Library> checkout -- components/<slug>`, or delete it if it is new, plus any token you added), report the failure with the error output and what you tried, and stop. Components already verified and handed back stay — they are complete and independently valid. Never leave a `components/<slug>/` partially written.
