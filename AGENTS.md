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

Node 24+ and pnpm 10+ (via Corepack); `pnpm install`. Skill scripts are zero-dependency CommonJS and run on plain `node` — they must keep working when vendored into a repo with no `node_modules`. `pnpm test` is the quality gate: it runs the suites under `scripts/tests/` and then `pnpm evals:graph`. The commit/release tooling is the maintainer's job (see below).

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

## Knowledge graph & context wiki

`wiki/` records **why** this repo is the way it is — executed plans, decisions, and change history. Read [`wiki/INDEX.md`](wiki/INDEX.md) first and open only what it routes to; never load the whole wiki. The write-side protocol, including when to capture and the page templates, is [`wiki/MECHANICS.md`](wiki/MECHANICS.md). Before a broad context read, prefer `pnpm graph:navigate --intent why|wiring|impact --query <term>`, which returns a minimal deterministic itinerary.

`scripts/graph/` derives a typed node/edge graph from the repo and renders it (`pnpm graph:view`, port 4175). Details in [`scripts/graph/README.md`](scripts/graph/README.md).

- **The graph is derived, never authoritative.** If the graph and a file disagree, the file is right and the graph is stale. Run `pnpm graph:build`.
- **The gate is the skill's own contract.** `SKILL.md` → every reference it links and every script it names, emitted whether or not the target exists. Rename a reference without updating `SKILL.md` and the build fails. The same applies to a topic's `covers:`, a page's `topics:`, and a journal entry's `plan:`.
- **`data/graph.json` and `wiki/connections*` are generated and committed.** Never hand-edit them; `.husky/pre-commit` rebuilds and stages them, and `pnpm evals:graph` fails on drift.
- **The graph's four surfaces move together**: `build-graph.cjs`, the viewer's type tables, `routing-policy.json`, and `scripts/tests/build-graph.test.cjs`. Changing the node or edge model means changing all four and the README table.
- Slack ingestion is intentionally **not** part of this subsystem.

## Data boundary (this repo is public)

Retrospective runs read client repositories and produce client-derived output. None of it belongs here.

- **Never commit** run outputs, component inventories, resolution results, reports, proposals, memory excerpts, client names, or client repo paths.
- Run output goes wherever `Data:` or `Output:` points — never inside this repo, and never inside the analyzed project, which the skill treats as strictly read-only.
- **The client wiki the skill feeds (Step 6) lands only in the `ui-design-evidence` checkout**, under `<Data>/wiki/`. That private repo is the sanctioned home for richer client identity (client names, platforms); this rule forbids that content from ever landing here. It is distinct from this repo's own `wiki/` (which records why *this repo* is the way it is).
- **Test fixtures are synthetic.** Invent component names; never copy a real project's inventory into `scripts/tests/fixtures/`.
- Examples in docs use placeholder paths, not real client checkouts.
- **This repo's own `wiki/` is covered by this rule too.** A journal entry or archived plan may name what was learned, never who it was learned from; plans are redacted on archive.

## Downstream repos are read-mostly

The skill's `promote` action edits a **local `ui-design-brain` working tree** and stops. It never commits, pushes, or opens a PR there, and it never edits `ai-orchestration` — findings for the pipeline are emitted as paste-ready drafts the maintainer carries over. Brain edits must satisfy that repo's catalog-integrity checklist (manifest + `index.md` + pattern file + README count + context-alias table); `references/brain-integrity-checklist.md` holds the ordered procedure.

## Branch off main before applying repo edits

Every repository the skill *writes* is edited on a working branch off that repo's `main`, never on `main` itself, so `main` never carries uncommitted skill output. Create the branch (`git -C <repo> switch -c <branch>`) before the first write to that repo, and make every edit there:

- **ui-design-evidence** (`Data`) — `Action: analyze` writes the run (`runs/<project>/<date>/`) and the client wiki feed here, and `promote`/`capture` also write `## Applied` markers and regenerate its graph. Branch before the run's first write. This repo is private, so its branch name may name the run/client, matching the established run-branch pattern (e.g. `feat/<project>-<date>-run`).
- **ui-design-brain** (`Brain`) — `Action: promote` edits the catalog here.
- **ui-design-library** (`Library`) — `Action: capture` writes components here.

Branch names in the shared catalog/library repos stay **client-agnostic** — name the change, not the client (e.g. `feat/add-<slug>-pattern`). A repo the action only *reads* stays on `main`: the brain during a capture preflight, and the analyzed project (always read-only).

By default, still stop at handback with each working branch checked out and nothing committed. The explicit maintainer-authorization exception below applies only to the named repository and issue branch; it does not let a retrospective action commit or push other repositories it touches.

## File a tracking issue per repo at the end of a retro

At the end of an `Action: analyze` run, the skill files one **[Feature]** GitHub issue per repo the run gives pending work, using the `github-issue-creator` skill (which drafts, confirms with the maintainer, and only then files — never silently). The executable spec — which repos, when, titles, bodies, and labels — is the vendored [`skills/project-retrospective/references/tracking-issues.md`](skills/project-retrospective/references/tracking-issues.md), invoked at Workflow Step 7; keep the two in sync.

In short: the private **ui-design-evidence** repo gets a **client-named hub** issue recording the run; **ui-design-brain** gets a **client-agnostic** issue when the run drafted proposals; **ui-design-library** gets one — and its branch — only when the run flagged captures. `ai-orchestration` gets no issue (its rule drafts are carried over by hand). The shared repos' issues follow the same data boundary as the proposals and downstream wiki: describe the pattern, alias, or capture and its recurrence, never the client, the run slug, or client copy.

Filing an issue is the one step here that reaches outside the working tree; get the maintainer's go-ahead first.

## Commits & release

**Permission boundary:** edit files under `skills/`, `scripts/`, and `wiki/` freely without asking — that's the autonomous zone, and capturing a substantive change in `wiki/` is expected rather than optional. An agent may commit and push an issue branch only when the maintainer explicitly authorizes those actions.

Without explicit maintainer authorization, make the requested edits and stop at handback. When commit and push are authorized, use `pnpm commit` (Conventional Commits, required scope) and push only the issue branch so repository automation can create the draft PR. **Do not merge, tag, release, or publish** — in this repo or in any repo the skill touches. `semantic-release` runs only on `main`.
