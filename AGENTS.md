# Project Retrospective — agent guide

Guidance for any AI coding agent (Claude Code, Codex, Cursor, Copilot, …) working in this repository.

## What this repo is

`@verndale/project-retrospective` is the single source of truth for **one** agent skill. The skill analyzes a completed frontend project and mines it for knowledge worth promoting into [`ui-design-brain`](https://github.com/verndale/ui-design-brain) (canonical UI vocabulary) or [`ai-orchestration`](https://github.com/verndale/front-end-build-orchestration) (pipeline rules). All skill content lives under `skills/project-retrospective/` and nowhere else:

- `SKILL.md` — skill entry point (frontmatter + phased workflow)
- `README.md` — operator docs (install, invocation, inputs/outputs)
- `references/*.md` — templates and rubrics, loaded one hop from `SKILL.md`
- `scripts/*.cjs` — deterministic discovery/resolution/validation, vendored with the skill

Skill-authoring templates live in `skills/_meta/` (sibling of the skill) — authoring-only: never loaded at runtime, never vendored. Everything outside `skills/` is repo tooling (tests, commits, release, CI).

## Division of labour (the load-bearing rule)

**Scripts decide structure; the model writes prose.** Discovery, label resolution, and output validation are deterministic `.cjs` — no LLM, no fuzzy matching, no network. The model's job is evidence triage (Promote / Watch / Reject) and drafting. When you are tempted to have the skill "figure out" something mechanical, put it in a script instead.

## Environment

Node 24+ and pnpm 10+ (via Corepack); `pnpm install`. Skill scripts are zero-dependency CommonJS and run on plain `node` — they must keep working when vendored into a repo with no `node_modules`. `pnpm test` (`node --test scripts/tests/`) is the quality gate. The commit/release tooling is the maintainer's job (see below).

## Editing this skill

**Whenever you edit, add, or change anything under `skills/project-retrospective/`, follow Anthropic's agent-skill best practices and run its checklist before considering the change done:**
<https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices>

`skills/_meta/_sections.md` is authoritative for this repo's `SKILL.md` structure — read it before adding or reordering a section. The practices that bite here:

- **Frontmatter (`SKILL.md`)** — `name` and `description` only. `name`: lowercase letters/numbers/hyphens, ≤64 chars, no `anthropic`/`claude`, no XML. `description`: third person, ≤1024 chars, states both *what it does* and *when to use it*.
- **Concise** — `SKILL.md` body under 500 lines; push detail into `references/*.md`.
- **Progressive disclosure, one level deep** — every `references/*.md` links directly from `SKILL.md`; no second-hop chains on the happy path.
- **TOC for long files** — any file over ~100 lines opens with `## Contents` (never "Table of contents").
- **Scripts solve, don't defer** — a missing or malformed input degrades with a recorded warning, never an unhandled crash. No unexplained constants.
- **Consistent terminology; no time-sensitive info; forward slashes in all paths.**

## Skill integrity (the four surfaces move together)

The skill's workflow, its references, its scripts, and its tests are one unit. A change to any one of them usually needs the others:

1. `SKILL.md` workflow step ↔ the `references/*.md` it names ↔ the script it invokes
2. A script's CLI flags, output schema, or exit codes ↔ `scripts/tests/*.test.cjs`
3. A change to an output's shape (report headings, proposal sections, JSON fields) ↔ `validate-report.cjs`

`skills/project-retrospective/scripts/validate-report.cjs` is the sanctioned validator for skill output — it is both the skill's own feedback loop and what the tests assert against. Don't add a second bespoke validator unless the maintainer asks.

## Data boundary (this repo is public)

Retrospective runs read client repositories and produce client-derived output. None of it belongs here.

- **Never commit** run outputs, component inventories, resolution results, reports, proposals, memory excerpts, client names, or client repo paths.
- Run output goes to the analyzed project (default `<Project>/<artifactsRoot>/retrospective/<date>/`) or wherever `Output:` points — never inside this repo.
- **Test fixtures are synthetic.** Invent component names; never copy a real project's inventory into `scripts/tests/fixtures/`.
- Examples in docs use placeholder paths, not real client checkouts.

## Downstream repos are read-mostly

The skill's `promote` action edits a **local `ui-design-brain` working tree** and stops. It never commits, pushes, or opens a PR there, and it never edits `ai-orchestration` — findings for the pipeline are emitted as paste-ready drafts the maintainer carries over. Brain edits must satisfy that repo's catalog-integrity checklist (manifest + `index.md` + pattern file + README count + context-alias table); `references/brain-integrity-checklist.md` holds the ordered procedure.

## Commits & release — the maintainer's job, not the agent's

**Permission boundary:** edit files under `skills/` and `scripts/tests/` freely without asking — that's the autonomous zone. Everything in this section is the maintainer's.

**Do not commit, push, merge, tag, or release** — in this repo or in any repo the skill touches. Make the requested edits, then stop and hand back for review. The maintainer commits with `pnpm commit` (Conventional Commits, required scope) and pushes; `semantic-release` then runs on `main`.
