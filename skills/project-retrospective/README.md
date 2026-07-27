# project-retrospective — operator docs

What the skill does, how to run it, and what it produces. The skill's own instructions live in [SKILL.md](SKILL.md).

## Contents

- [What it does](#what-it-does)
- [Install](#install)
- [Invocation](#invocation)
- [Parameters](#parameters)
- [Outputs](#outputs)
- [Scripts](#scripts)
- [Promoting a proposal](#promoting-a-proposal)
- [Across projects](#across-projects)
- [Troubleshooting](#troubleshooting)

## What it does

Reads a finished frontend project, works out what it built, checks those names against the [`ui-design-brain`](https://github.com/verndale/ui-design-brain) catalog, and turns what didn't resolve into reviewable proposals.

The division of labour matters: **scripts decide structure, the model exercises judgment.** Discovery, label resolution, and output validation are deterministic and zero-LLM. Deciding whether an unresolved label is real platform vocabulary is the part that needs a model — and it is advisory. Nothing reaches the catalog without a human commit.

## Install

```bash
npx skills add https://github.com/verndale/project-retrospective.git --skill project-retrospective -a claude-code --copy -g -y
```

`-g` installs to your user-level agent skills directory (`~/.claude/skills/` for Claude Code) rather than the current project, so no client repo gains a dependency on it. Verify with `ls ~/.claude/skills/project-retrospective`. Re-run the command to update.

The scripts are zero-dependency CommonJS and run on the `node` already on your PATH — nothing to install.

## Invocation

```text
/project-retrospective
Project: /Users/you/Projects/some-client-site
Brain: /Users/you/Projects/ui-design-brain
```

Inventory only, no catalog needed:

```text
/project-retrospective
Project: /Users/you/Projects/some-client-site
Scope: inventory
```

Writing into the evidence repo, with cross-project history:

```text
/project-retrospective
Project: /Users/you/Projects/site-b
Brain: /Users/you/Projects/ui-design-brain
Data: /Users/you/Projects/ui-design-evidence
PriorReports: /Users/you/Projects/ui-design-evidence/runs/site-a/2026-05-02/report.md
```

## Parameters

| Parameter | Required | Default | Meaning |
|---|---|---|---|
| `Project` | yes | — | Absolute path to the completed project repository. **Read-only** — the retrospective never writes here. |
| `Brain` | for resolution and promote | — | Absolute path to a local ui-design-brain checkout. Without it, resolution is skipped and the report records the gap. |
| `Data` | no | — | Absolute path to the private `ui-design-evidence` repo. When given, runs land under `<Data>/runs/<project-slug>/<date>/`. |
| `Output` | no | `<Data>/runs/…`, else `~/project-retrospective/runs/…` | Where run output is written. Never inside `Project`. |
| `Scope` | no | `full` | `inventory` (what was built), `candidates` (adds resolution and verdicts), `full` (adds proposals and drafts). |
| `PriorReports` | no | — | Comma-separated paths to earlier `report.md` files. A Watch candidate that recurs is elevated to Promote. |
| `Action` | no | `analyze` | `analyze` or `promote`. |
| `Proposal` | for promote | — | Path to the approved proposal file to apply. |

## Outputs

Written to `Output`, never into this skill's repository:

| File | Contents |
|---|---|
| `report.md` | The human-readable retrospective: summary, inventory, resolution, candidates with verdicts and evidence, learnings, gaps, next steps. |
| `inventory.json` | Every component found, with its evidence sources, build pack, and fingerprint. |
| `resolution.json` | Resolved labels with how they resolved; unresolved labels with occurrences and locations. |
| `proposals/<slug>.md` | One per Promote candidate — a ready-to-apply catalog change with its evidence. |
| `captures/<slug>.md` | Implementations mature enough to seed `ui-design-library`, with the de-clienting work each needs. Often drawn from components whose labels already resolve. |
| `orchestration-drafts.md` | Pipeline-shaped findings as paste-ready drafts for ai-orchestration. |

**The analyzed project is never written to.** Runs land in the private `ui-design-evidence` repo (`Data`) or, failing that, a user-level directory — never in the client repo. That keeps a retrospective from leaving artifacts a project team has to review, and keeps cross-project evidence out of any single client's tree.

**Two modes.** A project that went through the build pipeline has normalized evidence (build packs, component index, fingerprints, project memory) — that is `artifacts` mode. A project without it degrades to `code-scan`: directory walking only, which yields names but no contract, so verdicts cap at Watch. The report says which mode ran, in the Run and Gaps sections.

## Scripts

Runnable directly, which is useful for debugging a run:

```bash
node scripts/inventory.cjs --project <path> --out inventory.json --pretty
node scripts/resolve.cjs --inventory inventory.json --brain <brain-path> --out resolution.json --pretty
node scripts/validate-report.cjs --output <output-dir> --scope full
```

| Script | Exit codes |
|---|---|
| `inventory.cjs` | 0 success (including degraded) · 1 unexpected · 2 bad invocation · 3 `--project` is not a directory |
| `resolve.cjs` | 0 · 1 · 2 · 3 inventory missing/unreadable/wrong schema · 4 manifest missing/unreadable/invalid |
| `validate-report.cjs` | 0 pass · 1 failures · 2 bad invocation · 3 `--output` is not a directory |

Missing or malformed inputs never crash: each records a `{ code, message }` warning and the run continues with less evidence. Read the warnings — they are what the report's Gaps section is built from.

## Promoting a proposal

Review `proposals/`, then apply one:

```text
/project-retrospective
Action: promote
Proposal: /Users/you/Projects/ui-design-evidence/runs/site-b/2026-06-14/proposals/promo-strip.md
Brain: /Users/you/Projects/ui-design-brain
```

This edits the brain **working tree** — manifest entry, pattern file, `index.md`, README count, as the proposal type requires — runs that repo's own `node scripts/graph/build-graph.cjs` from the brain root to verify, and stops with the edited-file list and a suggested commit. (This repository has a file at the same path; it validates this repository, not the catalog.) You commit (`pnpm commit` in the brain repo), PR, and merge. From there the existing daily catalog sync carries it into ai-orchestration and out to projects.

Verification also regenerates the brain's committed graph and its `wiki/connections*` files — expected, and that repo's pre-commit hook rebuilds them anyway.

## Across projects

One project's retrospective is a snapshot; the signal gets much stronger with history. Keep each `report.md` and pass the relevant ones as `PriorReports` on the next run. A label two independent projects both had to invent is the strongest promotion evidence available — it is the same reasoning the catalog's own growth has used.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `mode: code-scan` on a pipeline project | The artifacts root was not found. Check `artifactsRoot` in the project's `build.config.json` and that you pointed `Project` at the repo root, not the app subdirectory. |
| `no-build-config` warning | No `build.config.json` at the project root. Expected for pre-pipeline projects; the scan falls back to conventional component roots. |
| Everything unresolved | Usually `--brain` pointed somewhere without `skills/ui-design-brain/patterns-manifest.json` (exit 4), or the project genuinely uses domain-specific names — which is the finding, not an error. |
| Validator fails on `proposal-parity` | A Promote candidate has no `proposals/<kebab-label>.md`, or a proposal file has no matching Promote candidate. The report and the proposals must agree. |
| Validator fails on `proposal-slug` | `slug` is not `kebab(name)`, or `file` is not `patterns/<slug>.md`. That equality is a hard catalog invariant. |
| Promote refuses to start | A precondition failed — unreadable proposal, no manifest at the `Brain` path, or the change is already applied. The message names which. |
