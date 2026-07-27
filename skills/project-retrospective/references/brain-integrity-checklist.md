# Brain integrity checklist

The ordered procedure for `Action: promote`. Applies one approved proposal to a **local ui-design-brain working tree**, verifies it, and stops.

That repo's catalog integrity is maintained by hand across five surfaces that drift easily. This checklist is what keeps a promoted change from breaking resolution for every downstream consumer.

## Contents

- Preconditions
- Formatting invariants
- Type: new-pattern
- Type: new-alias
- Type: guidance-edit
- Verification
- Handback
- If verification fails

## Preconditions

Stop and report if any of these fail — do not partially apply:

1. `Proposal:` names a readable file with a `## Proposal type` of `new-pattern`, `new-alias`, or `guidance-edit`, and the sections that type requires.
2. `Brain:` contains `skills/ui-design-brain/patterns-manifest.json` and it parses as a JSON array.
3. The manifest does not already contain the proposed canonical (new-pattern) or alias (new-alias).
4. `git -C <Brain> status --short` is clean, or its existing changes are unrelated. Report what you found before adding to a dirty tree.

## Formatting invariants

These hold for every type. A promote that breaks one is worse than no promote — it corrupts resolution silently.

- **Manifest order:** the array is alphabetical by `name`. Entries carry exactly `name`, `slug`, `aliases`, `file` — no extra keys. Two-space indentation, matching the existing file.
- **Edit the manifest as text, never by re-serializing it.** The file is hand-formatted: context-scoped aliases sit on one line as `{ "name": "…", "context": "…" }`, which `JSON.stringify(data, null, 2)` expands to three lines. Reading, mutating, and rewriting the whole array silently reformats every entry that has an object alias — six of them today — turning a six-line insertion into a thirty-line diff across unrelated patterns. Insert or amend the exact lines instead, then confirm with `git -C <Brain> diff --stat` that only the intended lines moved. Parsing the file to *check* something is fine; writing it back is not.
- **Alias order:** each `aliases` array is alphabetical (object-form aliases sort by their `name`). `Link`'s array is currently out of order upstream — leave it as you found it; a promote is not the place to fix unrelated drift.
- **Slug equality:** `slug == kebab(name) == filename`, and `file` is exactly `patterns/<slug>.md`.
- **Pattern H2:** `## <Name>` matches the manifest `name` character for character. H2, never H1.
- **Also-known-as line:** aliases in **manifest order**, separated by `  ·  ` (two spaces, middle dot, two spaces). Context-scoped aliases carry a short parenthetical, e.g. `CTA (in-page action)`. Omit the whole line when there are no aliases.
- **File ends with `---`.**
- **index.md:** the `## Canonical components` list is alphabetical; the `### Context-scoped aliases` table is alphabetical by Label and mirrors the object-form aliases in the manifest, **plus** a row marked `(the canonical)` for any label that is also a canonical name (today: `Label`, `Stepper`).
- **Cross-references are bidirectional** — that is the catalog's authoring rule. Some existing pairs are one-way; a missing reverse pointer elsewhere is not licence to skip yours.
- **README count:** the pattern count appears in **three** places (the directory-tree comment, the manifest table row, and the patterns table row). Update every occurrence, and update the `accordion.md … wizard.md` range endpoints if the new slug sorts outside them.

## Type: new-pattern

In this order:

1. **Create** `skills/ui-design-brain/patterns/<slug>.md` from the proposal's Pattern draft block, verbatim. That repo's `skills/_meta/_sections.md` owns the pattern-file structure — check the draft against it before copying if anything looks off.
2. **Manifest** — insert the entry at its alphabetical position by `name`.
3. **index.md** — insert `- <Canonical Name>` into `## Canonical components` at its alphabetical position.
4. **index.md context table** — add a row per object-form alias, and add the counterpart row for any canonical that now shares that label. Skip when there are none.
5. **README.md** — bump the count at all three occurrences; adjust the range endpoints if needed.

## Type: new-alias

1. **Manifest** — insert the alias into the target entry's `aliases` at its alphabetical position, as a plain string or `{ name, context }`.
2. **Pattern file** — rewrite the `**Also known as:**` line in `patterns/<slug>.md` to mirror the new manifest order. If the file has no such line, add it after the H2 and a blank line.
3. **index.md context table** — for a context-scoped alias only: add the row, and ensure the counterpart canonical is also object-form, also carries the parenthetical in its pattern file, and also has a row. A one-sided context alias is a broken resolution.
4. **README.md** — unchanged.

## Type: guidance-edit

1. **Pattern file** — apply the edit to `patterns/<slug>.md`. A variants block uses the verbatim heading `**Visual variants (orthogonal to ARIA):**` and sits after the definition/cross-reference lines, before Best practices.
2. **Reverse cross-reference** — when the edit adds a `see \`<other>.md\`` pointer, add the reciprocal pointer in that file. Cross-references are bidirectional in this catalog.
3. No manifest, index, or README changes. If you need one, the proposal was the wrong type — stop and say so.

## Verification

From the brain checkout root:

```bash
node scripts/graph/build-graph.cjs
```

This is that repo's sanctioned catalog validator: it emits a `catalogs` edge from each manifest entry to its pattern file and **fails on a dangling edge** — a manifest entry pointing at a missing or misnamed file. Exit 0 is the pass.

It also regenerates `scripts/graph/data/graph.json` and the `wiki/connections*` pages. **Leave those regenerated files in place** — they are committed artifacts there, and that repo's own pre-commit hook rebuilds and stages them anyway. Mention them in the handback so the maintainer is not surprised by the diff.

Then confirm the manifest still parses and the diff is the shape you intended:

```bash
node -e "JSON.parse(require('fs').readFileSync('skills/ui-design-brain/patterns-manifest.json','utf8'))"
git diff --stat skills/ui-design-brain/patterns-manifest.json
```

A new-pattern insertion adds six lines plus one line per alias, and removes nothing. Any removed line
means the file was re-serialized — revert it and redo the edit textually.

## Handback

Stop here. Report:

```
Applied <type> proposal <proposal path> to <brain path>.

Edited:
<output of: git -C <brain path> status --short>

Verification: node scripts/graph/build-graph.cjs → exit 0
(Regenerated scripts/graph/data/graph.json and wiki/connections* as a side effect.)

Suggested commit — run inside <brain path>:
  pnpm commit
Or directly:
  git commit -m "<suggested commit from the proposal>"

This skill does not commit, push, or open a PR.
```

Commit subjects follow that repo's convention — `type(ui-design-brain): Sentence-case imperative subject`:

- `feat(ui-design-brain): Add <Name> pattern`
- `feat(ui-design-brain): Add <alias> alias to <Name>`
- `docs(ui-design-brain): <Subject>` for clarity edits
- `fix(ui-design-brain): <Subject>` when correcting a wrong resolution

## If verification fails

Read the error, fix the cause, re-run. **Cap: 3 attempts.** After the third failure, revert your edits in the brain tree (`git -C <Brain> checkout -- <files you touched>`, or delete files you created), report the failure with the error output and what you tried, and stop. Never leave the catalog half-applied.
