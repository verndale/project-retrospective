# Project Retrospective

An **agent skill** that analyzes a completed frontend project and mines it for architectural knowledge worth promoting into the shared platform. Distributed via the [`skills` CLI](https://github.com/vercel-labs/skills).

---

## Purpose

Projects are temporary; knowledge is permanent. When a build wraps, the components it produced carry evidence about the platform: which design labels the team reached for, which ones the canonical catalog already covers, and which ones it doesn't yet name.

This skill turns that evidence into reviewable proposals. It inventories what was built, resolves every label against the [`ui-design-brain`](https://github.com/verndale/ui-design-brain) manifest, and triages what didn't resolve into **Promote / Watch / Reject** with cited evidence. Promoted candidates become brain-format pattern or alias proposals; pipeline-shaped learnings become paste-ready drafts for [`ai-orchestration`](https://github.com/verndale/front-end-build-orchestration).

It is an **architectural advisor, not an autonomous editor.** Every change to the platform is reviewed and committed by a human.

---

## Where it sits

```
completed project  (read-only — the retrospective never writes here)
        │  /project-retrospective  Action: analyze
        ▼
a run in the `ui-design-evidence` repo:
report.md · inventory.json · resolution.json · memory-archive.json · proposals/ · captures/ · orchestration-drafts.md
        │  human review
        ├── proposals/  → Action: promote → ui-design-brain working tree → verify → stop
        ├── captures/   → Action: capture → ui-design-library working tree → verify → stop
        └── orchestration-drafts.md → ai-orchestration, via its own contribution flow
                            │
                            ▼
        the existing daily catalog sync carries catalog changes into
        ai-orchestration → the next project
```

The skill plugs into the **front** of the existing delivery chain and replaces none of it.

### Three destinations, three repos

| Destination | What lands there | Who consumes it |
|---|---|---|
| [`ui-design-brain`](https://github.com/verndale/ui-design-brain) | Canonical vocabulary: patterns, aliases, guidance. | Every AI tool, via the `skills` CLI. |
| [`ui-design-library`](https://github.com/verndale/ui-design-library) (private) | Implementations keyed by canonical slug, with Storybook. | Client projects, so a Card is not rebuilt each time. |
| [`ui-design-evidence`](https://github.com/verndale/ui-design-evidence) (private) | Retrospective runs, evidence, cross-project history. | Nothing downstream — humans and this skill only. |

The library and the evidence store are **separate repos on purpose.** The library is pulled into client projects; the evidence store aggregates across clients. Keeping them apart means one client's build can never contain another client's retrospective data.

The library is keyed by the catalog's canonical slug, which is what makes it deterministically usable: `ui-design-brain` resolves a design label to `card`, and the library answers `components/card/`. The catalog defines the concept; the library implements it.

---

## What this repo contains

```
skills/project-retrospective/
├── SKILL.md        # skill entry point (frontmatter + phased workflow)
├── README.md       # operator docs — install, invocation, inputs/outputs
├── references/     # templates + rubrics, one hop from SKILL.md
└── scripts/        # zero-dependency inventory / resolve / validate / capture-preflight
```

Skill-authoring templates live alongside in `skills/_meta/` — authoring-only, never loaded at runtime or installed. Everything outside `skills/` is repo tooling (tests, commit/release automation, CI).

This layout (`skills/<name>/SKILL.md`) is what the `skills` CLI discovers. The repo is not published to npm; `package.json` is `"private": true` and exists to drive the Husky/commitlint/semantic-release tooling.

---

## Install

Install once at the user level, then run it against any project — nothing is added to the client repo:

```bash
npx skills add https://github.com/verndale/project-retrospective.git --skill project-retrospective -a claude-code --copy -g -y
```

`-g` installs into your user-level agent skills directory (`~/.claude/skills/` for Claude Code) instead of the current project; `--copy` writes real files rather than symlinks, so the skill keeps working with no cache present. Verify with `ls ~/.claude/skills/project-retrospective`. Re-running the command is the update — there is no version pin.

For other agents, swap `-a claude-code` for the agent you use (`-a codex`, `-a cursor`, …).

---

## Run it

```text
/project-retrospective
Project: /path/to/completed-project
Brain: /path/to/ui-design-brain
```

| Parameter | Required | Meaning |
|---|---|---|
| `Project:` | yes | Absolute path to the completed project repository. |
| `Brain:` | for resolution, promote, and capture | Absolute path to a local `ui-design-brain` checkout. Without it, resolution is skipped and the report says so. |
| `Data:` | no | Absolute path to the private `ui-design-evidence` repo. When given, runs land under `<Data>/runs/`. |
| `Output:` | no | Where run output is written. Never inside `Project`. |
| `Scope:` | no | `full` (default), `inventory`, or `candidates`. |
| `PriorReports:` | no | Comma-separated paths to earlier `report.md` files. A candidate that recurs across projects is elevated from Watch to Promote. |
| `Action:` | no | `analyze` (default), `promote`, or `capture`. |
| `Proposal:` | for promote | Path to the approved proposal file to apply. |
| `Captures:` | for capture | Path to a run's `captures/` directory. Applied as a set. |
| `Library:` | for capture | Absolute path to a local `ui-design-library` checkout. |

Output per run: `report.md` (human-readable), `inventory.json`, `resolution.json`, `memory-archive.json`, `proposals/<slug>.md` per Promote candidate, `captures/<slug>.md` per library candidate, and `orchestration-drafts.md`. Full parameter and output detail: [`skills/project-retrospective/README.md`](skills/project-retrospective/README.md).

**Client data stays with the client.** The analyzed project is read-only — a retrospective never leaves artifacts in the repository it analyzed. Run output goes to `Data:` or `Output:`, and is never committed to this public repo.

---

## Design principles

1. **Platform over project** — optimize the shared vocabulary, not the codebase being analyzed.
2. **Scripts decide structure; the model writes prose** — discovery, resolution, and validation are deterministic and zero-LLM. Judgment is the model's only job.
3. **No fuzzy matching** — a label resolves by exact canonical name, alias, or context-scoped alias, or it is novel. Guessing is what the catalog exists to prevent.
4. **Evidence before recommendations** — every verdict cites file paths, not scores.
5. **Advisor, not editor** — the skill never commits, pushes, or opens a PR anywhere.

---

## Repository automation

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| [`commitlint.yml`](.github/workflows/commitlint.yml) | PRs to `main`, pushes to non-`main` | Commitlint on the PR title + commit range via the `@verndale/ai-commit` preset. |
| [`pr.yml`](.github/workflows/pr.yml) | Pushes to non-`main`, `workflow_dispatch` | Creates/updates a draft PR by running `pnpm run pr:create` (`@verndale/ai-pr`). |
| [`test.yml`](.github/workflows/test.yml) | PRs to `main`, pushes to non-`main`, `workflow_dispatch` | Runs `pnpm test` — the suites under `scripts/tests/` plus the graph freshness gate. |
| [`release.yml`](.github/workflows/release.yml) | Pushes to `main` | Runs `semantic-release` to version, tag, write `CHANGELOG.md`, and cut a GitHub Release. |
| [`wiki-sync.yml`](.github/workflows/wiki-sync.yml) | PR merged | Fills a journal entry's pending PR link, drafts a stub for an uncaptured substantive PR, and opens a `bot/wiki-sync/<pr>` PR. Never pushes to `main`. |
| [`wiki-issue-sync.yml`](.github/workflows/wiki-issue-sync.yml) | Nightly, `workflow_dispatch` | Marks issues cited under a topic's Open threads as closed once they close. |

Locally, the same commit standard is enforced by Husky hooks (`commit-msg`, `prepare-commit-msg`) installed via the `prepare` script. A `pre-commit` hook warns when a substantive change stages no journal entry and rebuilds + stages the knowledge graph; it never blocks. Add repository secret `PR_BOT_TOKEN` (classic PAT with `repo`) for `pr.yml` and the two wiki workflows; `pr.yml` falls back to the built-in `GITHUB_TOKEN` when unset.

### Knowledge graph & context wiki

[`wiki/`](wiki/INDEX.md) records why the repo is the way it is — executed plans, decisions, and change history — and [`scripts/graph/`](scripts/graph/README.md) derives a typed graph over the skill, the tooling, the tests, the docs, and the wiki.

```bash
pnpm graph:build   # rebuild the committed graph + generated connections pages
pnpm graph:view    # interactive Sigma.js viewer at http://localhost:4175
pnpm evals:graph   # freshness, determinism, and the integrity gate
```

The gate is the skill's own contract: `SKILL.md` declares its references and scripts, and a build that cannot resolve one of them fails. It runs inside `pnpm test`, so there is no separate workflow for it.

Releases use Conventional Commit types (`feat` → minor, `fix` → patch, `BREAKING` → major) with structured notes from [`scripts/commit-pr/semantic-release-structured-notes.cjs`](scripts/commit-pr/semantic-release-structured-notes.cjs). `npmPublish` is `false`. Preview with `pnpm release:dry`.

---

## Environment

- **Node 24+** — pinned in `.nvmrc` (`24.14.0`) and `package.json` engines, enforced by `engine-strict=true` in `.npmrc`.
- **pnpm 10+** — pinned via `packageManager` (`10.33.0`), enabled through Corepack.

```bash
pnpm install
pnpm test        # the suites under scripts/tests/, then pnpm evals:graph — the quality gate
```

The skill's own scripts are zero-dependency CommonJS: they run under plain `node` with no `node_modules`, so an installed copy works standalone.

---

## Where to find things

- **Skill content:** [`skills/project-retrospective/`](skills/project-retrospective/) — `SKILL.md`, `references/`, `scripts/`
- **Authoring standard:** [`skills/_meta/_sections.md`](skills/_meta/_sections.md)
- **Tests & synthetic fixtures:** [`scripts/tests/`](scripts/tests/)
- **Why things are the way they are:** [`wiki/INDEX.md`](wiki/INDEX.md) — topics, journal, and the plan audit table
- **Knowledge graph:** [`scripts/graph/README.md`](scripts/graph/README.md)
- **Agent guidance:** [AGENTS.md](AGENTS.md) (`CLAUDE.md` is a thin import of it)
- **Contribution rules & commit standards:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Release config:** [`.releaserc.cjs`](.releaserc.cjs) + the notes plugin in [`scripts/commit-pr/`](scripts/commit-pr/)

---

## Contributing

Commit standards are enforced via `@verndale/ai-commit` (commitlint) and Husky hooks. Use `pnpm commit`. See [CONTRIBUTING.md](CONTRIBUTING.md).
