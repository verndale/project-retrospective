# Orchestration drafts — fake-project

Paste-ready drafts. Apply through ai-orchestration's own contribution flow; nothing here is applied automatically.

---

## Draft 1: Semantic tokens over arbitrary values

**Suggested destination:** `frontend-ai/skills/implement-build-pack/references/core/`

**Evidence:** `artifacts/memory/design-system.md` — the project recorded, as durable memory, that components use the brand spacing scale rather than arbitrary values.

**Why it is platform knowledge:** every project on this stack has a token layer, and arbitrary values are the recurring way generated output drifts from the design system.

### Draft content

````markdown
# Semantic tokens over arbitrary values

## Purpose

Generated components must express spacing, color, and typography through the project's semantic token
utilities, so output stays consistent with the design system when tokens change.

## Critical Rules

- MUST use the configured semantic token utility for any spacing, color, radius, or typography value.
- MUST NOT emit an arbitrary value when a token covers the case.

## Resolving a value

Resolve every value against the token layer before writing a class. When a design specifies something
the token layer does not cover, emit the arbitrary value and annotate it with the design source, so the
gap is visible rather than silently absorbed.

## Guardrails

- A stronger existing repo convention wins — inspect the token surface before introducing one.
- One-off values that genuinely have no token are permitted only with the annotation above.

## Examples

**Correct:**

```tsx
<div className="gap-padding-3xs bg-surface-base text-text-primary">
```

**Incorrect:**

```tsx
<div className="gap-[7px] bg-[#fff] text-[#2f2f2f]">
```
````

**Applying this draft:** it lands in a rule tree with machine-enforced conventions — a new `core/NN-*.md` rule must also be registered in the resolver (`frontend-ai/validators/resolve-implementation-context/check.cjs`) and given eval coverage. Follow that repo's `skills/_meta/_rule-sections.md`; do not paste and commit blind.
