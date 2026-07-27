# Skill file structure — section reference

> **Authoring artifact. NOT loaded at runtime, NOT installed.** Documents the canonical structure
> the `project-retrospective` skill follows, so edits stay consistent. `skills/_meta/` is a non-skill
> directory (sibling of `skills/project-retrospective/`, underscore-prefixed) — skill discovery keys
> on `SKILL.md`, and the `skills` CLI installs only the named skill, so nothing here loads at runtime
> or ships to users.
>
> Pairs with the repo [`AGENTS.md`](../../AGENTS.md): this file owns **file structure**; `AGENTS.md`
> owns the **skill-integrity rule**, the **data boundary**, and the permission boundary.

## Contents

- Canonical section order
- Frontmatter and lead
- Sections
- Reference files
- Scripts
- Tests and fixtures
- Conventions (hard constraints)

## Canonical section order

`SKILL.md` uses these H2 sections in this order:

1. `## Contents` — the TOC (this skill's body exceeds 100 lines)
2. `## Use when` — always
3. `## First-hop references` — always
4. `## Workflow` — always
5. `## Inputs and outputs` — always
6. `## Validation loops` — always (this skill has retry logic)
7. `## Guardrails` — always

This matches the `ai-orchestration` skill spine, so anyone who authors in that repo reads this one
without retraining. A domain-specific section MAY be inserted between `## Inputs and outputs` and
`## Validation loops` when the skill gains its own artifact contract — name it by intent and keep it
minimal.

## Frontmatter and lead

- `name` — lowercase-hyphen slug matching the directory name. No `claude` / `anthropic`. No other
  frontmatter fields: invented keys (`version`, `lastReviewed`) drift and are never read.
- `description` — third person; says WHAT the skill does and WHEN to use it, with concrete trigger
  terms (retrospective, pattern harvest, catalog gap analysis, alias audit, promote). This is the one
  field used for skill selection — make it specific. Under 1024 chars.
- After the `# Skill: <name>` H1: a 1–2 sentence lead, then `Operator docs: [README.md](README.md).`

## Sections

### Use when (always)
Bullets naming the trigger conditions — when this skill applies, and when a sibling skill is the
better fit (e.g. use `ui-design-brain` directly to resolve one label during authoring; this skill is
for mining a whole repo).

### First-hop references (always)
The `references/*.md` files loaded on the happy path, as a short numbered list with a phrase on what
each is for. Keep paths one hop from `SKILL.md`.

### Workflow (always)
Numbered, imperative steps, split by `Action`. Each step names the script it runs or the reference it
applies. Steps that produce output say where it lands.

### Inputs and outputs (always)
Required inputs, optional inputs, outputs, and side effects — by name, in the parameter grammar the
operator types.

### Validation loops (always)
The validator → fix → re-check loop and its pass/fail shape, pointing at the script that defines it.
**Every loop states a numeric cap inline** (3 attempts, then report-and-stop). This repo has no
`_shared/retry-contract.md` to defer to, so the cap is written where the loop is. Never loop "until
coherent".

### Guardrails (always)
The normative rubric link, then MUST NOT items. The git-mutation prohibition, the no-fuzzy-matching
rule, the alias rules, the hard exclusion list, and the write-scope limits belong here — they are the
constraints that make the skill safe to run against a client repo.

### Examples and templates — NOT an inline section
Concrete artifacts (report shells, proposal skeletons, draft templates) live in `references/*.md`,
listed under `## First-hop references` and applied at a named workflow step. This keeps `SKILL.md`
thin and loads the example only when the step runs.

## Reference files (`references/*.md`)

- **Templates** (`*-template.md`), **rubrics** (`*-rubric.md`), and **checklists** (`*-checklist.md`)
  are fetched positionally by name from a known workflow step — they do NOT need a retrieval header.
- **Conditional docs** — anything read only when a condition holds (e.g. `code-scan-mode.md`, read
  only when inventory reports the degraded mode) — MUST open with `## Use when`, a short bullet list
  of the conditions, so the model self-selects.
- Name files descriptively by role. Any file over 100 lines opens with `## Contents`.
- Templates that emit content into another repo (brain pattern files, orchestration rule drafts) MUST
  reproduce that repo's structure exactly, and MUST say which repo owns the format.

## Scripts (`scripts/*.cjs`)

Scripts are installed with the skill and run under plain `node` in the operator's environment.

- **Zero dependencies, CommonJS, no network.** They must work with no `node_modules` present.
- **Solve, don't defer** — a missing config, an unreadable file, or an unexpected artifact shape
  produces a recorded warning and a degraded result, never an unhandled crash. The model surfaces
  warnings; it does not have to reverse-engineer a stack trace.
- **Documented exit codes** — `0` success (including degraded), `1` unexpected failure, `2` invalid
  invocation, and a distinct code per named input failure. Document them in the script header and in
  the skill README.
- **Deterministic** — same inputs, same output. No timestamps in compared content, no randomness, no
  model calls.
- **No voodoo constants** — every threshold or limit carries a comment explaining the value.
- Shared helpers live in `scripts/lib/`; each entry script stays independently runnable.

## Tests and fixtures (`scripts/tests/`)

- One `*.test.cjs` per script plus a conformance test that lints `SKILL.md` against the frontmatter
  and length rules above.
- Tests exercise the real CLI (spawn the script) so exit codes are covered, not just exports.
- **Fixtures are synthetic.** Invent component names and manifest entries. Never copy a real
  project's inventory, component index, or report into `fixtures/` — this repo is public.
- Broken-input variants are generated into a temp dir at run time from one golden fixture, so the
  committed fixture set stays small and readable.

## Conventions (hard constraints)

- **Keep `SKILL.md` thin** — under ~500 lines; push detail into `references/*.md`. Only `name` +
  `description` load at startup.
- **References one hop deep** — link `references/*.md` directly from `SKILL.md`; no second-hop chains
  on the happy path.
- **Prefer scripts for deterministic ops** — a committed script beats regenerated code.
- **Don't rename frozen output sections** — the report's H2 spine and the proposal section names are
  checked by `validate-report.cjs`; renaming one is a coordinated change across skill, reference,
  script, and test.
- **The four surfaces move together** — workflow step, reference, script, test. See
  [`AGENTS.md`](../../AGENTS.md).
- **TOC over 100 lines** — `## Contents` (never "Table of contents"), plain bullets in heading order
  for LLM-facing files, anchor links for human-facing READMEs.
- **Consistent terminology** — one term per concept: *candidate*, *verdict*, *proposal*, *canonical*,
  *label*, *novel*. Don't mix in "component match", "score", or "suggestion".
- **No time-sensitive phrasing**; **forward slashes in all paths**.
- **Follow Anthropic agent-skill best practices** (canonical link in [`AGENTS.md`](../../AGENTS.md)).
