# Contributing

This repository is the single source of truth for the `project-retrospective` agent skill, distributed via the [`skills` CLI](https://github.com/vercel-labs/skills). It enforces strict commit standards so the skill can be installed and updated from a known-good `main`.

## Quick Start (TL;DR)

    pnpm install
    git checkout -b feat/my-skill-change
    # edit files under skills/project-retrospective/
    pnpm test
    git add -A
    pnpm commit
    git push

## What lives here

A single agent skill, under `skills/project-retrospective/`:

- `SKILL.md` — skill entry point (frontmatter + phased workflow)
- `README.md` — operator docs (install, invocation, inputs/outputs)
- `references/*.md` — templates and rubrics, one hop from `SKILL.md`
- `scripts/*.cjs` — zero-dependency discovery, resolution, and validation

Plus repo tooling: `scripts/tests/` (node:test suites + synthetic fixtures), `scripts/commit-pr/` (release-notes plugin), CI workflows, and `skills/_meta/` (authoring-only; no `SKILL.md`, so it is never loaded at runtime and never vendored).

**Authoring:** `skills/_meta/_sections.md` is the canonical structure for this repo's `SKILL.md` and its reference files. Follow it, and follow [Anthropic's agent-skill best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).

## The four surfaces move together

A change to the skill usually touches four things at once: the `SKILL.md` workflow step, the `references/*.md` it names, the script it invokes, and the test that covers it. `scripts/tests/` is the gate — run `pnpm test` before you push. `validate-report.cjs` is the sanctioned output validator; don't add a second one.

Two of those four are now enforced structurally: the knowledge graph emits an edge from `SKILL.md` to every reference it links and every script it names, and fails the build when one does not resolve. `pnpm test` ends in `pnpm evals:graph`, so a stale committed graph fails the suite.

**Run `pnpm graph:build` and commit the result** whenever you change anything the graph indexes — which includes the tests themselves. The `pre-commit` hook does this for you and stages `scripts/graph/data/graph.json` and `wiki/connections*`; if you commit with `--no-verify`, rebuild by hand. Never hand-edit those files.

## Capture the why

A substantive change — an executed plan, or a change to the skill, its tests, or the graph/wiki tooling — gets a `wiki/journal/` entry in the same delivery. [`wiki/MECHANICS.md`](wiki/MECHANICS.md) has the trigger, the four steps, and the templates. Record what was ruled out and why; `git log` already covers what changed.

The data boundary below applies to the wiki as much as to anything else: name what was learned, never who it was learned from.

## Data boundary — this repo is public

Retrospective runs read client repositories. Their output never lands here.

- No run outputs, inventories, reports, proposals, memory excerpts, client names, or client repo paths in commits.
- Fixtures under `scripts/tests/fixtures/` are **synthetic** — invented component names only.
- Docs use placeholder paths, not real client checkouts.

## Maintaining `AGENTS.md`

`AGENTS.md` is the canonical, tool-agnostic agent guide (`CLAUDE.md` is a thin `@AGENTS.md` import). When editing it, keep it lean (≤~150 lines), use progressive disclosure (link to `skills/_meta/`, `README.md`) instead of inlining, pair every "don't" with a "do", and never include secrets.

- Official spec: <https://agents.md>
- Empirical patterns: <https://www.augmentcode.com/blog/how-to-write-good-agents-dot-md-files>

## Commit Messages (Required)

We enforce **Conventional Commits** through **`@verndale/ai-commit`** (commitlint preset). Types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`.

Format (scope is **required**):

    type(scope): Short subject

Examples:

    feat(project-retrospective): Add promote action for brain proposals
    fix(scripts): Correct context-alias ambiguity handling in resolve
    docs(readme): Clarify user-level install flow

The first line is validated by **commitlint** via the `commit-msg` hook and in CI. Use `pnpm commit` (runs `ai-commit run`) for an AI-assisted, pre-validated message; `OPENAI_API_KEY` in `.env` enables AI generation and is optional (safe fallback otherwise). See `.env-example`.

## How changes reach users

1. Land your change here and merge to `main`.
2. Users re-run the `skills add` install command (see [README.md](README.md)) to pick up the new version. There is no version pin and no drift check — re-running the install IS the update.

## Repository automation

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| [`.github/workflows/commitlint.yml`](.github/workflows/commitlint.yml) | PRs to `main`, pushes to non-`main` | Commitlint on PR title + commit range |
| [`.github/workflows/pr.yml`](.github/workflows/pr.yml) | Pushes to non-`main`, `workflow_dispatch` | Dogfood: install deps, run **`pnpm run pr:create`** |
| [`.github/workflows/release.yml`](.github/workflows/release.yml) | Pushes to `main` | `semantic-release`: version bump, `CHANGELOG.md`, Git tag + GitHub Release |

Add repository secret **`PR_BOT_TOKEN`** (classic PAT with **`repo`**) for **`pr.yml`**; it falls back to the built-in `GITHUB_TOKEN` when unset.

Releases are driven by [`semantic-release`](.releaserc.cjs) on every push to `main` — Conventional Commit types decide the bump (`feat` → minor, `fix` → patch, `BREAKING` → major). Release notes are deterministic and structured via the local plugin [`scripts/commit-pr/semantic-release-structured-notes.cjs`](scripts/commit-pr/semantic-release-structured-notes.cjs); an optional bounded AI summary runs only when `RELEASE_NOTES_AI=true` and an endpoint/model/API key are configured. Preview locally with `pnpm release:dry`.

This repo is **not published to npm** — it is distributed as an agent skill via the `skills` CLI. `package.json` is `"private": true` and `npmPublish` is `false`, so `semantic-release` versions and tags the repo (and updates `CHANGELOG.md`) without ever publishing a package.

## Installation

Requirements:

- Node 24+ (see `.nvmrc` and `package.json` engines)
- pnpm 10+ (see `packageManager`)

Install:

    pnpm install

## What Not To Do

- Do not commit secrets or `.env`
- Do not commit client-derived data or retrospective outputs
- Do not bypass commitlint or disable hooks
- Do not add network calls or runtime dependencies to the skill's `scripts/` — they must run standalone when vendored
