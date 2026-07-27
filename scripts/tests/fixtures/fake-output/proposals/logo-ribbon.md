# Proposal: Logo ribbon

## Proposal type

new-pattern

## Pattern draft

```
## Logo ribbon

**Also known as:** Logo cloud  ·  Logo bar

A horizontal band of partner, client, or certification logos — presented as evidence of credibility rather than as navigation.

For a band of logos that link to individual partner pages, use a **Card** grid (see `card.md`).

**Best practices:**
- Use when the logos are collectively evidence, not individually actionable
- Keep logos optically balanced rather than uniformly sized — trademarks differ in visual weight
- Constrain to a single row per breakpoint; wrap rather than shrink below legibility
- Decide early whether the band scrolls, and make motion pausable if it does
- Give each logo an alt value naming the organization, and mark the band decorative only when a nearby heading already names the relationship
- Provide a monochrome treatment for busy backgrounds

**Common layouts:**
- Evenly spaced row beneath a hero, above the fold
- Centered band between content sections, introduced by a short heading
- Continuously scrolling marquee on marketing pages
- Two-row grid on narrow viewports

---
```

## Manifest entry

```json
{
  "name": "Logo ribbon",
  "slug": "logo-ribbon",
  "aliases": ["Logo bar", "Logo cloud"],
  "file": "patterns/logo-ribbon.md"
}
```

## Evidence

- `artifacts/build-packs/logo-ribbon.md` — a normalized build-pack spec exists for the component.
- `artifacts/memory/design-system.md` — project memory records its token behavior by name.
- Occurrences in this project: 1 (`logo-ribbon`).
- Prior reports: none.
- Rubric: reusable (a named marketing band, not a page), two independent sources, client-neutral, and not an existing canonical or child part.

## Integrity checklist delta

1. **Create** `skills/ui-design-brain/patterns/logo-ribbon.md` from the Pattern draft above.
2. **Manifest** — insert alphabetically by `name`, between `Link` and `Modal`.
3. **index.md** — insert `- Logo ribbon` into `## Canonical components`, between `- Link` and `- Modal`.
4. **index.md context table** — none; no context-scoped aliases.
5. **README.md** — pattern count 6 → 7 at every occurrence. Range endpoints unchanged.

## Suggested commit

`feat(ui-design-brain): Add Logo ribbon pattern`
