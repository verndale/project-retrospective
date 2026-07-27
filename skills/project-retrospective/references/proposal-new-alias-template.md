# Proposal template — new alias

For a label the catalog already covers under a different name. This is the most common useful outcome: the vocabulary exists, the project reached for another word, and the catalog should recognize it.

Write one file per candidate at `proposals/<kebab-label>.md`. `##` headings are checked by `validate-report.cjs`.

````markdown
# Proposal: alias "<Label>" → <Canonical Name>

## Proposal type

new-alias

## Target

Canonical: **<Canonical Name>** (`<slug>`, `patterns/<slug>.md`)

## Alias

Plain alias: `<Label>`

<Or, when the label maps to two canonicals depending on usage:>

Context-scoped alias:

```json
{ "name": "<Label>", "context": "<short human-readable disambiguation>" }
```

Also-known-as parenthetical: `<Label> (<short context>)`
Counterpart: **<Other Canonical>** must carry the same label with context `<its context>`.

## Consumer evidence

- <Path> — the project used `<Label>` to mean <canonical>, shown by <what in the file>.
- <Path> — <second instance, if any>.
- Occurrences: <N>. Prior reports: <path, or none>.
- Not a child part of <canonical>: <why — it is the whole component, not a constituent>.

## Edits

1. **Manifest** — add to `<Canonical Name>`'s `aliases`, alphabetically: after `<PrevAlias>`, before `<NextAlias>`.
2. **Pattern file** — rewrite the `**Also known as:**` line in `patterns/<slug>.md` to mirror the new manifest order:
   `**Also known as:** <Alias>  ·  <Alias>  ·  <Alias>`
   <If the file has no such line today, add it directly after the H2 and a blank line.>
3. **index.md context table** — <rows to add for both canonicals, or "none — plain alias">.
4. **README.md** — unchanged (the pattern count does not move).

## Suggested commit

`feat(ui-design-brain): Add <Label> alias to <Canonical Name>`
````

## Rules

- **Consumer-evidenced only.** An alias exists because a project used the word, not because it sounds plausible. Two independent uses are better than one; a single clear use is acceptable if it is unambiguous.
- **Never alias a child part** (`Tab`, `Slide`, `Accordion item`). Downstream specs rely on child modules resolving to novel.
- **Plain string by default.** Use the object form only when the same label demonstrably means two different canonicals — the catalog's existing cases are Banner, CTA, Label, and Stepper.
- **Ambiguity is symmetric, with one exception.** When a label becomes context-scoped, both canonicals move to object form, both pattern files get the parenthetical, and both rows go in the index table. The exception is a label that is itself a canonical name — the catalog's `Label` and `Stepper` cases. A canonical cannot alias itself, so only the aliasing canonical goes object-form, and the index table carries a second row marked `(the canonical)`. A one-sided context alias in any other situation is a broken resolution.
- **Aliases stay alphabetical** in the manifest; the `**Also known as:**` line follows manifest order with the `  ·  ` separator.
- Use `fix(ui-design-brain): …` instead of `feat` when the change corrects a label that currently resolves to the wrong canonical.
