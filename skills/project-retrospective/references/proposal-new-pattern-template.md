# Proposal template — new pattern

For a Promote candidate that is genuinely new catalog vocabulary. Write one file per candidate at `proposals/<kebab-label>.md`.

The pattern draft must match the ui-design-brain pattern-file structure exactly — that repo owns the format, and the draft is copied into it verbatim at promote time. `##` headings below are checked by `validate-report.cjs`.

````markdown
# Proposal: <Canonical Name>

## Proposal type

new-pattern

## Pattern draft

```
## <Canonical Name>

**Also known as:** <Alias>  ·  <Alias>

<One-sentence definition — an em-dash elaboration is common.>

For <related case>, use a **<Other component>** (see `<other>.md`).

**Best practices:**
- <when to use>
- <key design / behavior choice>
- <key design / behavior choice>
- <state / interaction behavior>
- <accessibility / keyboard requirement — at least one, and make it concrete>
- <content or authoring consideration>

**Common layouts:**
- <concrete real-world placement>
- <concrete real-world placement>
- <concrete real-world placement>
- <concrete real-world placement>

---
```

## Manifest entry

```json
{
  "name": "<Canonical Name>",
  "slug": "<canonical-name>",
  "aliases": [
    "<Alias>",
    "<Alias>"
  ],
  "file": "patterns/<canonical-name>.md"
}
```

One alias per line — that is how the catalog file is hand-formatted, and the block is pasted in verbatim. An entry with no aliases uses `"aliases": [],` on one line.

## Evidence

- <Path + what it shows.>
- <Path + what it shows.>
- Occurrences in this project: <N> (`<component>`, `<component>`).
- Prior reports: <path and what it said, or none>.
- Rubric: passes reusable / two-source / client-neutral / not-already-covered because <one line each where it is not obvious>.

## Integrity checklist delta

What promote will change in the catalog:

1. **Create** `skills/ui-design-brain/patterns/<slug>.md` from the Pattern draft above.
2. **Manifest** — insert the entry alphabetically by `name`, between `<PrevName>` and `<NextName>`.
3. **index.md** — insert `- <Canonical Name>` into the `## Canonical components` list, between `- <Prev>` and `- <Next>`.
4. **index.md context table** — <rows to add, or "none — no context-scoped aliases">.
5. **README.md** — pattern count <N> → <N+1> at every occurrence (currently 3: the tree comment, the manifest row, and the patterns row). <Note if the new slug changes the `accordion.md … wizard.md` range endpoints.>

## Suggested commit

`feat(ui-design-brain): Add <Canonical Name> pattern`
````

## Rules

- **Slug equality is hard:** `slug == kebab(name) == filename`, and `file` is exactly `patterns/<slug>.md`. Validation fails otherwise.
- **The draft's H2 must equal the manifest `name`** character for character.
- **Alias separator is `  ·  `** — two spaces, a middle dot, two spaces — in the same order as the manifest `aliases`. Omit the whole line when there are no aliases.
- **At least one Best-practices bullet must be an accessibility or keyboard requirement.** Name the technique (focus management, `aria-*`, a WCAG success criterion), not "make it accessible".
- **The draft ends with `---`.**
- Keep the draft in the catalog's register: ~6 practices, ~4 layouts, no framework names, no client names, no time-sensitive phrasing.
- Every alias listed must be consumer-evidenced — a label an analyzed project actually used. Cite it under Evidence.
- **After this proposal is promoted, add an `## Applied` section** — a dated line is enough (`## Applied\n\n<YYYY-MM-DD> — promoted to ui-design-brain.`). The catalog then carries the canonical, so `validate-report` reads the match as expected rather than a `proposal-collision`; without the marker a match is a collision (a duplicate proposal), and with it a *missing* canonical is a `proposal-applied` failure (the promotion never landed). It is the proposal analog of the deferred-capture loopback; see `brain-integrity-checklist.md`.
