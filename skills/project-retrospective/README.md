# project-retrospective — operator docs

What the skill does, how to run it, and what it produces. The skill's own instructions live in [SKILL.md](SKILL.md).

## Contents

- [What it does](#what-it-does)
- [Install](#install)
- [End-to-end walkthrough](#end-to-end-walkthrough)
- [Invocation](#invocation)
- [Parameters](#parameters)
- [Outputs](#outputs)
- [Scripts](#scripts)
- [Promoting a proposal](#promoting-a-proposal)
- [Executing captures](#executing-captures)
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

## End-to-end walkthrough

A finished project on one end, components in `ui-design-library` on the other. Six steps. **The skill never commits anywhere** — every commit below is yours.

Paths in these examples are placeholders. Substitute your own checkouts.

### Step 1 — Run the retrospective

```text
/project-retrospective
Project: /Users/you/Projects/some-client-site
Brain: /Users/you/Projects/ui-design-brain
Data: /Users/you/Projects/ui-design-evidence
```

`Data` is what puts the run in the evidence repo. Without it, output lands in `~/project-retrospective/runs/` and the skill tells you so.

Output goes to `<Data>/runs/<project-slug>/<YYYY-MM-DD>/`. **Done when:** that directory holds `report.md`, `inventory.json`, `resolution.json`, `orchestration-drafts.md`, plus `proposals/` and `captures/` if anything qualified — and the validator exits 0.

### Step 2 — Read the report

Open `report.md`. Three of its sections each pair with an artifact and a destination repo:

| Section | Artifact | Goes to |
|---|---|---|
| `## Candidates` (Promote verdicts) | `proposals/<slug>.md` | ui-design-brain |
| `## Captures` | `captures/<slug>.md` | ui-design-library |
| `## Learnings` | `orchestration-drafts.md` | ai-orchestration |

Check `## Gaps` first — it carries the script warnings verbatim, and a `mode: code-scan` run caps every verdict at Watch, which means no proposals by design.

**This is the only content-approval gate.** Everything downstream applies what you approve here, so throw out what you disagree with now. (Steps 3 and 4 each stop at a handback for review before you commit, but neither re-litigates the decision made here.) **Done when:** you know which proposals and which captures you want.

### Step 3 — Promote approved catalog changes

One invocation per proposal:

```text
/project-retrospective
Action: promote
Proposal: /Users/you/Projects/ui-design-evidence/runs/some-client-site/2026-06-14/proposals/stat.md
Brain: /Users/you/Projects/ui-design-brain
```

Edits the brain working tree, verifies with that repo's own graph build, stops. Then you commit:

```bash
cd /Users/you/Projects/ui-design-brain && pnpm commit
```

PR and merge. **Done when:** the new canonical is on `main` in ui-design-brain.

### Step 4 — Execute the captures

**Step 3 must come first for any capture whose canonical is new.** Preflight blocks a capture whose canonical is not in the manifest with no in-run proposal behind it (`canonical-unknown`); when a `new-pattern` proposal in the same run establishes that canonical, it reports the capture `deferred` (exit 6) instead — a "promote first, then re-run" state rather than a hard stop. Either way the enforcement is preflight's alone — the library's own contracts are self-referential, checking `component.json`'s `slug` against its directory name and `kebab(canonical)`, never against the catalog. A component keyed on a canonical the catalog does not have would pass `pnpm contracts` and be wrong anyway. Requires `Brain`; without it preflight cannot make this check at all and says so.

The whole directory in one invocation:

```text
/project-retrospective
Action: capture
Captures: /Users/you/Projects/ui-design-evidence/runs/some-client-site/2026-06-14/captures
Library: /Users/you/Projects/ui-design-library
Brain: /Users/you/Projects/ui-design-brain
```

Preflight checks every capture at once, then components are written **one at a time**, each verified with `pnpm contracts` and `pnpm test` before the next starts. Read the `orphanedByRun` list it reports before anything else: those are library components claiming this run with no capture behind them.

Then you commit, one per component:

```bash
cd /Users/you/Projects/ui-design-library && pnpm commit
```

**Done when:** `pnpm test` passes in the library and each new `components/<slug>/` holds three files.

### Step 5 — Carry the orchestration drafts over

`orchestration-drafts.md` is paste-ready. The skill never edits `ai-orchestration`, so this step is entirely manual — open the draft, open the destination it names, and carry it across through that repo's own contribution flow.

**Done when:** each draft is either filed there or consciously dropped.

### Step 6 — Keep the report

Keep `report.md` where it is. On the next project, pass it as `PriorReports` — a label two independent projects both had to invent is the strongest promotion evidence there is, and a Watch that recurs is elevated to Promote automatically.

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
| `Brain` | for resolution, promote, and capture | — | Absolute path to a local ui-design-brain checkout. Without it, resolution is skipped and the report records the gap. |
| `Data` | no | — | Absolute path to the private `ui-design-evidence` repo. When given, runs land under `<Data>/runs/<project-slug>/<date>/`. |
| `Output` | no | `<Data>/runs/…`, else `~/project-retrospective/runs/…` | Where run output is written. Never inside `Project`. |
| `Scope` | no | `full` | `inventory` (what was built), `candidates` (adds resolution and verdicts), `full` (adds proposals and drafts). |
| `PriorReports` | no | — | Comma-separated paths to earlier `report.md` files. A Watch candidate that recurs is elevated to Promote. |
| `Action` | no | `analyze` | `analyze`, `promote`, or `capture`. |
| `Proposal` | for promote | — | Path to the approved proposal file to apply. |
| `Captures` | for capture | — | Path to a run's `captures/` directory. Applied as a set — one invocation covers every capture in it. |
| `Library` | for capture | — | Absolute path to a local ui-design-library checkout. |

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
node scripts/capture-preflight.cjs --captures <output-dir>/captures --library <library-path> --brain <brain-path> --pretty
```

| Script | Exit codes |
|---|---|
| `inventory.cjs` | 0 success (including degraded) · 1 unexpected · 2 bad invocation · 3 `--project` is not a directory |
| `resolve.cjs` | 0 · 1 · 2 · 3 inventory missing/unreadable/wrong schema · 4 manifest missing/unreadable/invalid |
| `validate-report.cjs` | 0 pass · 1 failures · 2 bad invocation · 3 `--output` is not a directory |
| `capture-preflight.cjs` | 0 all ready or already applied · 1 one or more blocked, or unexpected · 2 bad invocation · 3 `--captures` is not a directory · 4 `--library` is not a library checkout · 5 manifest missing/unreadable/invalid · 6 none blocked, but one or more deferred (canonical only proposed this run — promote first, then re-run) |

Inputs *within* a run never crash the script: a missing artifact, an unreadable file, or an unexpected shape records a `{ code, message }` warning and the run continues with less evidence. Read the warnings — they are what the report's Gaps section is built from. A named input that was requested but cannot be used — an unreadable inventory, a structurally invalid manifest — exits on its own code instead, because every downstream answer would otherwise be meaningless.

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

## Executing captures

Review `captures/`, then apply the whole directory:

```text
/project-retrospective
Action: capture
Captures: /Users/you/Projects/ui-design-evidence/runs/site-b/2026-06-14/captures
Library: /Users/you/Projects/ui-design-library
Brain: /Users/you/Projects/ui-design-brain
```

**Batch input, serial execution.** `capture-preflight.cjs` checks every capture in the directory in one pass — canonical present in the catalog, slug equality across the canonical/parenthetical/filename, whether `components/<slug>/` is free, whether declared tokens exist in the library's semantic layer, whether provenance is complete. It writes **nothing** into the library. Components are then written one at a time, each verified with `pnpm contracts` and `pnpm test` before the next begins, so the library is never left holding half-written component directories.

**Executing a capture is a rewrite, not a copy.** Project imports are replaced with library primitives, client tokens are mapped onto semantic tokens (adding one when a value has no semantic home), client copy and assets come out, and every removal is recorded in `component.json`'s `declienting` array. That array is mandated by the library but not checked by its contract script, so it is the one thing only the author enforces.

**Read `orphanedByRun` first.** Preflight reports any library component whose `provenance.run` names a run this capture set covers but which has no capture file behind it — a component that reached the library with no evidence. It is a detector, not a fix: decide what to do about each one before applying anything.

Then you commit in the library repo (`pnpm commit`), one per component, and PR.

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
| Validator fails on `capture-parity` | A `### <Canonical>` entry under `## Captures` has no `captures/<kebab-canonical>.md`, or a capture file has no entry. Both directions fail — a capture the report does not list is how a component reaches the library with no evidence. |
| Validator fails on `capture-canonical` | The capture's bolded canonical, its backticked slug, and its filename disagree. Name the file after the canonical (`Badge` → `captures/badge.md`), never after the project's label. |
| Preflight blocks on `canonical-unknown` | The catalog has no such canonical and no `new-pattern` proposal in the run establishes it. Promote it into ui-design-brain first — the library keys on names the catalog resolves to. (If the run *does* propose it, preflight reports `deferred` — exit 6 — instead: promote that proposal, then re-run.) |
| Preflight blocks on `library-partial` | `components/<slug>/` already exists holding some but not all three files. Finish or remove it by hand; the skill will not write into a half-built directory. |
| Preflight blocks on `slug-mismatch` | The same disagreement `capture-canonical` catches, seen at capture time. Fix the capture file rather than the library directory. |
