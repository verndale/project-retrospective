# Proposal template — guidance edit

For a durable, client-neutral lesson about a canonical the catalog **already** has: an accessibility technique its guidance omits, a layout that keeps recurring, a confusable neighbor with no cross-reference, or a visual variant that caused a real misresolution.

Write one file per candidate at `proposals/<kebab-label>.md`. `##` headings are checked by `validate-report.cjs`.

````markdown
# Proposal: guidance edit — <Canonical Name>

## Proposal type

guidance-edit

## Target file(s)

- `skills/ui-design-brain/patterns/<slug>.md`
- <`patterns/<other>.md` when adding a cross-reference — it must be edited too>

## Edit

**Add** to `**Best practices:**`, after `<existing bullet>`:

```
- <new bullet — concrete technique, not an exhortation>
```

<Or, for a replacement:>

**Replace:**

```
- <existing line, verbatim>
```

**With:**

```
- <new line>
```

<Or, for a variants block — the heading is verbatim and goes after the definition/cross-reference lines, before Best practices:>

```
**Visual variants (orthogonal to ARIA):**
- <variant name> — <what changes visually; the ARIA/semantics do not>
```

## Incident evidence

- <What actually happened: the misresolution, the accessibility defect, the repeated layout — with the path that shows it.>
- <Why this is platform knowledge and not a project preference.>
- <For a variants block: the documented misresolution this prevents. Speculative variants are not accepted.>

## Cross-reference reciprocity

<Required when the edit adds a "see `<other>.md`" pointer. Cross-references are bidirectional in this catalog.>

Add to `patterns/<other>.md`: `For <case>, use a **<Canonical Name>** (see `<slug>.md`).`

<Or: "N/A — this edit adds no cross-reference.">

## Suggested commit

`docs(ui-design-brain): <Sentence-case subject>`

<Use `fix(ui-design-brain): …` when the edit corrects guidance that causes a wrong resolution or a wrong build.>
````

## Rules

- **Guidance edits do not touch the manifest, `index.md`, or the README count.** If your change needs any of those, it is a new-pattern or new-alias proposal instead.
- **The variants heading is verbatim:** `**Visual variants (orthogonal to ARIA):**`. A visual variant never changes which canonical a label resolves to — consumers express it as `Name (variant: pill)`.
- **Add variant blocks only on a documented incident.** The catalog's sole precedent is pill-tabs; speculative blocks are rejected.
- **Cross-references are bidirectional** — a one-way pointer is an incomplete edit.
- Keep the catalog's register: concrete, client-neutral, no framework names, no time-sensitive phrasing, and the file still ends with `---`.
- Preserve the surrounding structure: ~6 Best-practices bullets and ~4 Common-layouts bullets. If your edit pushes a section well past that, cut something or reconsider the edit.
