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

Node 24+ and pnpm 10+ (via Corepack); `pnpm install`. Skill scripts are zero-dependency CommonJS and run on plain `node` — they must keep working when vendored into a repo with no `node_modules`. `pnpm test` is the quality gate: it runs the suites under `scripts/tests/` and then `pnpm graph:check`. The commit/release tooling is the maintainer's job (see below).

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

## Knowledge graph and repository wiki operations

`wiki/` records **why** this repo is the way it is — executed plans, decisions, and change history. The write-side protocol, including when to capture and the page templates, is [`wiki/MECHANICS.md`](wiki/MECHANICS.md).

- **Query GitHub evidence unambiguously:** use a full URL, `owner/repo PR #123`, `owner/repo issue #123`, or `owner/repo#123`. Never query a bare `#123`; PR and issue numbers collide across repositories. Evidence resolves to the existing wiki page that cites it, not a live GitHub node.
- **Generated wiring map:** [`wiki/connections.md`](wiki/connections.md) is a routed index for skill contracts, tests, module dependencies, topic coverage, and wiki relations. Open only the section named by the itinerary. Do not hand-edit it; `pnpm graph:build` rebuilds it and `pnpm run wiki:check` verifies it.
- **Write in the same delivery:** when a substantive change lands, add the journal entry, archive the executed plan, update the affected topic and indexes, and rebuild the graph per [`wiki/MECHANICS.md`](wiki/MECHANICS.md).
- **Automation is a safety net:** merge and issue workflows reconcile repo-qualified citations into Markdown and graph nodes derive offline `githubRefs` from them. Agents still author the richer wiki record directly when they do the work.

`scripts/graph/` derives a typed node/edge graph from the repo and renders it (`pnpm graph:view`, port 4175). Details in [`scripts/graph/README.md`](scripts/graph/README.md).

- **The graph is derived, never authoritative.** If the graph and a file disagree, the file is right and the graph is stale. Run `pnpm graph:build`.
- **The gate is the skill's own contract.** `SKILL.md` → every reference it links and every script it names, emitted whether or not the target exists. Rename a reference without updating `SKILL.md` and the build fails. The same applies to a topic's `covers:`, a page's `topics:`, and a journal entry's `plan:`.
- **`data/graph.json` and `wiki/connections*` are generated and committed.** Never hand-edit them; `.husky/pre-commit` rebuilds and stages them, and `pnpm graph:check` fails on drift.
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

- **ui-design-evidence** (`Data`) — `Action: analyze` and `ingest-retrospectives` write runs and wiki feeds here, and `promote`/`capture` also write lifecycle markers and regenerate its graph. Branch before the run's first write. This repo is private, so its branch name may name the run/client, matching the established run-branch pattern (e.g. `feat/<project>-<date>-run`).
- **ui-design-brain** (`Brain`) — `Action: promote` edits the catalog here.
- **ui-design-library** (`Library`) — `Action: capture` writes components here.

Branch names in the shared catalog/library repos stay **client-agnostic** and issue-keyed: `feat/<issue-number>-catalog-promotion` and `feat/<issue-number>-library-capture`. A repo the action only *reads* stays on `main`: the brain during a capture preflight, and the analyzed project (always read-only).

By default, still stop at handback with each working branch checked out and nothing committed. The explicit maintainer-authorization exception below applies only to the named repository and issue branch; it does not let a retrospective action commit or push other repositories it touches.

## File a tracking issue per repo at the end of a retro

The skill automatically reconciles sanctioned labels, reuses or files one **[Feature]** GitHub issue per repo with deterministic pending work, links downstream tracking, and creates only the required local working branch. An explicit retrospective target is authorization for these operations; do not pause for issue approval. The executable spec is [`skills/project-retrospective/references/tracking-issues.md`](skills/project-retrospective/references/tracking-issues.md), backed by `tracking-targets.cjs`; keep the contract, script, and tests in sync.

In short: the private **ui-design-evidence** repo gets a client-named hub issue for a validated evidence run; **ui-design-brain** gets a client-agnostic issue for pending proposals and a branch only for an approved non-empty promote write set; **ui-design-library** gets a client-agnostic issue only when capture preflight finds actionable work and a branch only for a non-empty capable write set. Deferred/blocked/skipped/landed items and evidence-only reconciliation create no library issue or branch. `ai-orchestration` gets neither.

Automatic issue/label/link/local-branch authority does not authorize commits, pushes, PRs, issue closure, Figma publication, merges, or releases. Authentication, label, issue, clean-main, alignment, or capability failures stop before branch creation without an approval prompt.

## Commits & release

**Permission boundary:** edit files under `skills/`, `scripts/`, and `wiki/` freely without asking — that's the autonomous zone, and capturing a substantive change in `wiki/` is expected rather than optional. An agent may commit and push an issue branch only when the maintainer explicitly authorizes those actions.

Without explicit maintainer authorization, make the requested edits and stop at handback. When commit and push are authorized, use `pnpm commit` (Conventional Commits, required scope) and push only the issue branch so repository automation can create the draft PR. **Do not merge, tag, release, or publish** — in this repo or in any repo the skill touches. `semantic-release` runs only on `main`.

<!-- wiki-skill:start -->
## Context wiki navigation

Use `wiki/` as this repository's existing context source. Never bulk-load that directory.

- For an exact current-code, file, symbol, or command question, inspect the named source or use targeted source `rg`; do not load history.
- For a direct single-topic history or rationale question, start at `wiki/INDEX.md` when it exists and open only the page it routes to.
- Only for a cross-page why, wiring, ownership, or impact question, run `node scripts/wiki/navigate.cjs --wiki-root "wiki" --intent why --query "<terms>"` before opening wiki pages. Use `wiring` for ownership/dependencies and `impact` for change scope.
- Query with exact slugs, identifiers, symbols, or repository-qualified GitHub references. Never use a bare issue or PR number such as `#123`.
- When both endpoints are known, use exact `--from` and `--to` node IDs.
- Trust the router's deterministic weighted shortest route, which accounts for relationship cost, hubs, and page bytes. Open only its itinerary; never add candidates, neighbors, or adjacent pages.
- Read itinerary pages sequentially, never speculatively in parallel, and stop as soon as the answer is grounded.
- If resolution is ambiguous, rerun with one returned exact ID; never open every candidate.
- Never use `grep`, `find`, or recursive `rg` as initial wiki discovery. After a router miss, run at most one root-scoped exact search: `rg -n --fixed-strings "<exact term>" wiki/`. If it fails, inspect one known source path or ask one focused question; never widen the search.
- Never read generated graph JSON directly.
- This installation owns navigation only. Preserve this repository's existing wiki authoring, validation, hooks, workflows, and generated-data conventions.

This managed block is shared by Codex, Cursor, and Claude (via `@AGENTS.md` in `CLAUDE.md`).
<!-- wiki-skill:end -->
