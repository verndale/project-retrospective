# Evidence rubric

The bar a candidate must clear to become a Promote, and the rules that keep a proposal compatible with the ui-design-brain catalog. Applied at the triage step, once resolution has produced the unresolved labels.

## Contents

- Terms
- Hard exclusions
- Evidence sources
- Verdicts
- Recurrence elevation
- Alias rules
- Variant rule
- Guidance-edit rule
- Writing evidence

## Terms

- **Label** — the name the project used for a component (`AccordionRow`, `PromoBanner`).
- **Canonical** — a catalog entry's `name`. **Novel** — a label that resolved to nothing.
- **Candidate** — a novel label under triage. **Verdict** — Promote, Watch, or Reject.
- **Proposal** — the file a Promote candidate produces, in one of three types.

## Hard exclusions

Never promote, whatever the evidence. These are project concerns, not platform vocabulary:

pages · business logic · authentication · checkout · search APIs · commerce flows · routing · client-specific workflows · client branding

A label naming one of these is Reject with the exclusion cited. Composite names get judged on what the component *is*: `CheckoutPanel` is checkout (Reject); `PricingTable` is a reusable presentation pattern that happens to appear in commerce (judge on the rest of the rubric).

Also never promote:

- **Child parts.** A `Tab`, `Slide`, `AccordionItem`, or `CarouselSlide` is a child of an existing canonical, not a catalog entry. The catalog deliberately leaves child modules unresolved so downstream specs can smart-link to them. Reject, and say which canonical owns the part. When a component's `fingerprint.json` declares `partOf`, the inventory records that parent link on the component (`partOf`) as a deterministic child-part signal — composition is never inferred from names.
- **Thin wrappers.** A label that is an existing canonical plus a project prefix, suffix, or styling word (`SiteHeader` → Header, `PrimaryButton` → Button, `HeroBannerLarge` → Hero) is not new vocabulary. Reject and name the canonical it should have resolved to — if the project genuinely used a different word for that canonical, that is an **alias** proposal, not a pattern.

## Evidence sources

An inventory component carries `sources[]`. These count as **independent** evidence:

| Source | What it evidences |
|---|---|
| `component-index` | The component exists in the project's own registry. |
| `build-pack` | It went through the pipeline with a normalized spec (DOM contract, tokens, accessibility, AC). |
| `spec` | An **approved** ba-spec-writer functional spec covers it — an authored, brain-canonicalized contract (CMS field surface, ARIA/keyboard model, composition, structured data). Comparable in strength to `build-pack`. |
| `fingerprint` | It has a declared reusable API surface (`slots`, `affordance`, `role`, `variants`). |
| `design-facts` | It has extracted design evidence behind it. |
| `memory` | Project memory discusses it by name — it generated durable knowledge. |
| `team-retrospective` | A captured team retrospective names it and the normalizer confirms model-recorded agreement against a matching component with a cited path and strong as-built evidence. Context-only retro prose never receives this source. |
| `code-scan` | It was found by directory heuristics only. **Weak** — see below. |

`code-scan` is a single weak source: it proves a directory exists, nothing about reuse or contract. A candidate evidenced only by `code-scan` caps at **Watch** unless a prior report supplies a second source. See `code-scan-mode.md`.

`team-retrospective` is independent authored reflection, but it is admitted only after corroboration: the finding must name the component, agree semantically with its implementation, cite a project path, and join to at least one of `component-index`, `build-pack`, `fingerprint`, `design-facts`, or `memory`. It can then satisfy one of the two sources; it never replaces the as-built source that made it eligible.

**Using `spec` evidence (from `resolution.json`'s `specs` block).** An approved spec is a strong, independent source, and it is unusual in also settling Promote **test 3** (describable client-neutrally): the spec's Overview and per-element contract are an authored, near-neutral definition already — the client copy comes out at drafting time. A `specOnly` entry (specced but not found as-built) is authored intent worth a Watch, not a Promote, until a build backs it. ba-spec-writer canonicalizes its element names against the brain when the spec is written, so the richest new-pattern candidates are the elements it flagged as novel (`novelLabels`) — a label it could not name is one the catalog cannot either.

## Verdicts

### Promote — all four must hold

1. **Reusable UI vocabulary.** A named interface pattern another project would plausibly build, not a page, flow, or one-off composition.
2. **Two independent evidence sources**, either within this project (two entries from the table above) or one here plus recurrence in a `PriorReports` report.
3. **Describable client-neutrally.** You can write the one-sentence definition and the Best practices bullets without naming the client, their brand, or their content model. If the definition needs the client to make sense, it is project knowledge.
4. **Not already covered.** It is not an existing canonical under another name (that is an alias), not a visual variant of one, and not a child part.

### Watch

Plausible platform vocabulary that has not earned a catalog entry yet: single-source evidence, `code-scan` only, one occurrence with no reuse signal, or genuine uncertainty about whether the name is the project's or the industry's. Watch is the useful default — it costs nothing and the next project's run will elevate it if the pattern is real.

### Reject

A hard exclusion, a child part, a thin wrapper, a one-off composition of existing canonicals, or something so client-specific it could not be described neutrally. Always say which rule applied and, where relevant, which canonical already covers it.

## Recurrence elevation

When `PriorReports` are supplied, compare normalized labels:

- A label that was **Watch** in a prior report and is a candidate again here is elevated to **Promote**, provided it still passes the exclusion and coverage tests. Cite both reports in the evidence.
- A label **Rejected** in a prior report stays Rejected unless this project supplies evidence that contradicts the original reason. Say what changed.
- Recurrence across two projects is the strongest signal available: it is the same evidence the catalog's own growth has used — count the projects that could not name a thing, then name it.

## Alias rules

An alias proposal says "the catalog already has this concept, the project called it something else."

- **Consumer-evidenced only.** Propose an alias only for a label some artifact in an analyzed project actually used for that canonical. Never invent plausible synonyms.
- **Never a child part.** Aliasing `Tab` or `Slide` would break downstream child-spec linking.
- **Context-scoped only when genuinely ambiguous.** Use the object form `{ name, context }` only when the same label demonstrably maps to two different canonicals across evidence (the catalog's existing cases: Banner, CTA, Label, Stepper). One meaning means a plain string alias.
- When a label becomes ambiguous, **both** canonicals must move to object form together — a context-scoped alias with a plain-string counterpart is a broken resolution. The exception is a label that is *itself* a canonical name (the catalog's `Label` and `Stepper` cases): a canonical cannot alias itself, so only the aliasing canonical goes object-form, and `index.md` gets a second row marked `(the canonical)` for the other meaning.

## Variant rule

A visual variant never changes the resolved canonical. Add a `**Visual variants (orthogonal to ARIA):**` block only when a **documented misresolution incident** justifies it — a case where the visual treatment actually caused the wrong component to be built or specced. The catalog's sole precedent is pill-tabs in `tabs.md`. No speculative variant blocks; a differently-styled Button is still Button.

**Capture-side: fold vs. split.** The same rule decides what becomes one library capture and what becomes two. Prop or visual variants of one component (size, density, tone) fold into that capture's `component.json.variants`; they never spawn a second capture, and a differently-styled, sized, or prefixed component is still the same canonical (a thin wrapper → Reject or an alias; a visual variant → the same canonical). A **structurally** distinct module — a different `fingerprint.json` slot / affordance / role / interaction contract, not a difference in styling, size, colour, copy, or a prefix/suffix word — was never that canonical: it misresolved. It earns its own canonical through a `new-pattern` proposal (which must still clear all four Promote tests), and its capture is `deferred` until that proposal is promoted. `ui-design-library` keys one directory per canonical, so this is the only way two implementations coexist — never resolve the collision by dropping the second module.

## Guidance-edit rule

Propose a guidance edit when the project produced a durable, client-neutral lesson about an **existing** canonical — an accessibility technique the guidance omits, a layout that keeps recurring, or a confusable neighbor with no cross-reference. The evidence is the incident: what went wrong or what was learned, with the file that shows it. Cross-references must be added in both directions.

## Writing evidence

Every verdict cites paths, not adjectives.

- **Good:** "Three build packs specify it (`artifacts/build-packs/promo-strip/master.md`, …); `fingerprint.json` declares `slots: [eyebrow, heading, actions]`; project memory covers its focus behavior in `artifacts/memory/accessibility.md`."
- **Bad:** "Widely used and well-built. High reuse potential. Confidence: 0.82."

No numeric scores anywhere — a score invented per run is not comparable across runs and hides the reasoning a reviewer needs.
