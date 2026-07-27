# orchestration-drafts.md template

Some findings are not catalog vocabulary — they are pipeline knowledge: a CMS adapter quirk, a token-architecture convention, a recurring implementation mistake, a validator that would have caught something. Those belong in `ai-orchestration`, not ui-design-brain.

This file collects them as **paste-ready drafts**. The skill never edits `ai-orchestration` — that repo has its own contribution flow (resolver registration, eval coverage, machine-enforced authoring rules), and a draft that skipped it would be rejected anyway.

Write the file at `<Output>/orchestration-drafts.md`.

## When a run has nothing to say

Most runs surface one or two of these; some surface none. Emit the file anyway with an explicit note — an empty file reads like a bug:

```markdown
# Orchestration drafts — <project name>

_No pipeline learnings from this run._
```

`validate-report.cjs` accepts that marker in place of the draft shape.

## Draft shape

Each draft follows the `ai-orchestration` rule-reference spine: `## Purpose` → `## Critical Rules` (optional) → domain body → `## Guardrails` → `## Examples` (optional). Rules there use RFC 2119 keywords (MUST, MUST NOT, SHOULD) and no frontmatter.

`````markdown
# Orchestration drafts — <project name>

Paste-ready drafts. Apply through ai-orchestration's own contribution flow; nothing here is applied automatically.

---

## Draft 1: <short title>

**Suggested destination:** `frontend-ai/skills/implement-build-pack/references/adapters/<adapter>/<file>.md`
<or `.../references/core/<NN>-<name>.md` for a core rule, or `frontend-ai/skills/<skill>/references/<file>.md`>

**Evidence:** <path in the analyzed project> — <what it shows>. <Occurrences, or the memory shard that recorded it.>

**Why it is platform knowledge:** <one line — why this recurs beyond this client>.

### Draft content

````markdown
# <Rule title>

## Purpose

<One to three sentences: what this rule governs and why it exists.>

## Critical Rules

- MUST <the non-negotiable>.
- MUST NOT <the failure mode this prevents>.

## <Domain section>

<The body. Concrete, with the mechanism — not just the prohibition.>

## Guardrails

- <Boundary or caution.>
- <When a different rule applies instead.>

## Examples

**Correct:**

```tsx
<example using Tailwind utilities as configured>
```

**Incorrect:**

```tsx
<the anti-pattern, with a one-line note on what breaks>
```
````

**Applying this draft:** it lands in a rule tree with machine-enforced conventions — a new `core/NN-*.md` rule must also be registered in the resolver (`frontend-ai/validators/resolve-implementation-context/check.cjs`) and given eval coverage. Follow that repo's `skills/_meta/_rule-sections.md`; do not paste and commit blind.

---

## Draft 2: <short title>

<same shape>
`````

## Rules

- **Never edit `ai-orchestration` from this skill.** Drafts only.
- **One draft per finding**, each with its own destination, evidence, and rationale. A draft with no path-backed evidence is an opinion — leave it out.
- **Client-neutral.** The draft is going into a shared pipeline: strip client names, brand tokens, and content-model specifics. If the lesson cannot survive that, it belongs in the project's own memory instead — say so in the report's Learnings section.
- **Example code uses Tailwind utilities as configured** — that repo forbids ad-hoc CSS and CSS modules in examples.
- **Suggest, don't insist, on the destination.** Name the most plausible path and say it is a suggestion; the maintainer knows that tree better than a retrospective does.
