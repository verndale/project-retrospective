---
name: project-retrospective
description: Analyzes a completed frontend project repository and mines it for promotable architectural knowledge. Inventories the components that were built (from pipeline artifacts — build packs, component index, fingerprints, project memory — or a degraded code scan), resolves every component label against the ui-design-brain patterns manifest, triages unresolved labels into Promote, Watch, or Reject candidates with cited evidence, and drafts catalog-format pattern and alias proposals plus paste-ready ai-orchestration rule drafts. With Action promote, applies one approved proposal to a local ui-design-brain checkout following the catalog-integrity checklist. With Action capture, applies a run's component captures to a local ui-design-library checkout. Both stop before committing. Use when a project wraps and the user wants a retrospective, pattern harvest, component inventory, catalog gap analysis, alias audit, to promote a pattern or alias into ui-design-brain, or to apply captures into ui-design-library.
---

# Skill: project-retrospective

Mines a completed frontend project for knowledge worth promoting into the shared platform. Deterministic scripts do discovery, resolution, and validation; you do evidence triage and drafting.

Operator docs: [README.md](README.md).

## Contents

- Use when
- First-hop references
- Workflow
- Inputs and outputs
- Validation loops
- Guardrails

## Use when

- A project has shipped and the user asks for a retrospective, pattern harvest, or catalog gap analysis.
- The user wants to know which components a project built that the catalog does not name.
- The user wants an alias audit — labels the project used for concepts the catalog already covers.
- The user has an approved proposal file and wants it applied to a local ui-design-brain checkout (`Action: promote`).
- The user has a run's `captures/` directory and wants those components applied to a local ui-design-library checkout (`Action: capture`).
- Use the `ui-design-brain` skill instead when the task is resolving one label while authoring or building. This skill is for mining a whole repository.

## First-hop references

1. [`references/evidence-rubric.md`](references/evidence-rubric.md) — the Promote / Watch / Reject bar, hard exclusions, alias and variant rules. Normative for triage.
2. [`references/report-template.md`](references/report-template.md) — `report.md` structure; its `##` headings are frozen.
3. [`references/proposal-new-pattern-template.md`](references/proposal-new-pattern-template.md), [`references/proposal-new-alias-template.md`](references/proposal-new-alias-template.md), [`references/proposal-guidance-edit-template.md`](references/proposal-guidance-edit-template.md) — one per catalog proposal type.
4. [`references/proposal-component-capture-template.md`](references/proposal-component-capture-template.md) — capturing a mature implementation for `ui-design-library`.
5. [`references/orchestration-draft-template.md`](references/orchestration-draft-template.md) — drafts for pipeline-shaped findings.
6. [`references/brain-integrity-checklist.md`](references/brain-integrity-checklist.md) — the ordered promote procedure. Read only for `Action: promote`.
7. [`references/library-integrity-checklist.md`](references/library-integrity-checklist.md) — the ordered capture procedure. Read only for `Action: capture`.
8. [`references/code-scan-mode.md`](references/code-scan-mode.md) — degraded-mode procedure. Read only when the inventory reports `mode: code-scan`.
9. [`references/wiki-feed.md`](references/wiki-feed.md) — the client wiki feed, the `meta.json` contract, client-identity resolution, and the project-memory archive. Read for `Action: analyze`.
10. [`references/wiki-client-template.md`](references/wiki-client-template.md) — the durable per-client page shape.
11. [`references/wiki-journal-template.md`](references/wiki-journal-template.md) — the per-run journal entry shape.
12. [`references/downstream-wiki.md`](references/downstream-wiki.md) — the client-agnostic context-wiki entry in the repo an action touches. Read for `Action: promote` (ui-design-brain) and `Action: capture` (ui-design-library).

## Workflow

### Action: analyze (default)

Copy this checklist into your response and tick each item as you complete it:

```
Retrospective progress:
- [ ] 1. Inventory
- [ ] 2. Resolution
- [ ] 3. Triage
- [ ] 4. Draft
- [ ] 5. Self-check
- [ ] 6. Wiki
```

**0. Resolve inputs.** Require `Project`. Resolve `Output` in this order — **never inside `Project`**, which is read-only for this skill:

1. `Output` if given.
2. `<Data>/runs/<project-slug>/<YYYY-MM-DD>/` when `Data` names the `ui-design-evidence` checkout.
3. `~/project-retrospective/runs/<project-slug>/<YYYY-MM-DD>/` otherwise — say so, and note that `Data` is where runs belong.

Create the directory and state the resolved paths before running anything. If any resolved path falls inside `Project`, stop and ask for an `Output` outside it.

**1. Inventory.** Run:

```bash
node <skill>/scripts/inventory.cjs --project <Project> --out <Output>/inventory.json --pretty
```

Report the `mode` and the `warnings` array verbatim — they become the report's Gaps section. Discovery is stack-aware: `stackAdapter` selects the component file extensions and roots, a filesystem scan of those roots is unioned with `component-index.json` in **both** modes (so components the index omitted are still found), and Storybook is counted where the stack uses it; an unrecognized adapter falls back to a broad default with an `unknown-adapter` warning. If `mode` is `code-scan`, read [`references/code-scan-mode.md`](references/code-scan-mode.md) before continuing — its evidence cap, and the discovery mechanics, change every verdict downstream.

`Scope: inventory` skips steps 2 and 3, and step 4 writes only the Run, Summary, Inventory, and Gaps sections of `report.md`.

**2. Resolution.** Requires `Brain`. Without it, skip to step 3, treat no label as novel (you cannot know), and record the missing catalog under Gaps. With it:

```bash
node <skill>/scripts/resolve.cjs --inventory <Output>/inventory.json --brain <Brain> --out <Output>/resolution.json --pretty
```

For any entry with `ambiguous: true`, the manifest scopes that label to more than one canonical and the script deliberately did not pick. Decide from usage evidence — the component's build pack, its `fingerprint.json` (`affordance`, `role`), its bucket and domain. If the evidence does not clearly match one candidate's `context`, treat the label as unresolved rather than guessing. Record which evidence decided it.

**3. Triage.** Apply [`references/evidence-rubric.md`](references/evidence-rubric.md) to every unresolved label: Promote, Watch, or Reject, each with evidence citing file paths. Check `PriorReports` first — a label that was Watch in an earlier report and recurs here is elevated to Promote. When step 2 was skipped for want of a `Brain`, still emit `## Candidates` with an explicit note that no resolution ran, so the section is present rather than missing.

`Scope: candidates` writes `report.md` but no `proposals/` and no `orchestration-drafts.md`.

**4. Draft.** Write, in `<Output>`:

- `meta.json` — machine-readable run identity (client, project, platform, date, scope, priorReports) per [`references/wiki-feed.md`](references/wiki-feed.md). The model writes it; `resolve.cjs`/`inventory.cjs` stay client-agnostic.
- `report.md` — following [`references/report-template.md`](references/report-template.md).
- `proposals/<kebab-label>.md` — one per Promote candidate, using the template for its type.
- `captures/<kebab-canonical>.md` — for implementations mature enough that the next project should start from them rather than rebuild. Draw these from the **resolved** list as much as the unresolved one: a mature Card or Modal implementation is a better library candidate than a novel label, which is usually the least-settled code in the project. A Promote candidate (new-pattern) whose *implementation* is itself mature also earns a capture, keyed to the canonical its proposal establishes — note it **deferred** in its `## Captures` entry and link the proposal; `capture-preflight.cjs` reports it `deferred` (exit 6) until that proposal is promoted, so promote first, then capture. When two components resolve to one canonical, fold prop/visual variants into one capture's `variants` or route a structurally distinct module to its own canonical — never drop the second (see the template). Apply [`references/proposal-component-capture-template.md`](references/proposal-component-capture-template.md). Omit the directory when nothing qualifies.
- `orchestration-drafts.md` — pipeline-shaped findings per [`references/orchestration-draft-template.md`](references/orchestration-draft-template.md), or its explicit "no pipeline learnings" note.
- `memory-archive.json` — run `scripts/archive-memory.cjs` to preserve the project's engineering memory (`<artifactsRoot>/memory/**`) before it is lost. It produces this manifest on **every** analyze run and, under a `Data` = ui-design-evidence checkout, byte-copies the memory (skipping empty placeholder shards) into the evidence archive using `meta.json`'s `client-slug`. Flags, layout, and the fidelity carve-out: [`references/wiki-feed.md`](references/wiki-feed.md).

**5. Self-check.** Run the validator (see Validation loops) and fix what it reports.

**6. Wiki.** Feed the client/project knowledge wiki, per [`references/wiki-feed.md`](references/wiki-feed.md). Only when `Output` resolved under a `Data` checkout that is `ui-design-evidence` (`<Data>/wiki/` beside `<Data>/runs/`): resolve the client identity (a client-slug distinct from the project-slug — one client may own several), upsert `<Data>/wiki/clients/<client-slug>.md` — carrying durable engineering knowledge from the analyzed project's `artifacts/memory/` forward into its `## What we know`, and linking the project-memory archive Step 4 preserved at `<Data>/wiki/memory/<client-slug>/<project-slug>/` (author its `index.md`: a cleaned-up, fuller paraphrase of that memory) — and append `<Data>/wiki/journal/<YYYY-MM-DD>-<project-slug>.md` from their templates with outcomes grounded in this run, add one `<Data>/wiki/INDEX.md` line per new file, and hand back the wiki paths. When the run landed in the home fallback, skip this and say so. Append-only: never overwrite a journal entry; keep client-page sets additive.

### Action: promote

**1. Verify preconditions** from [`references/brain-integrity-checklist.md`](references/brain-integrity-checklist.md): the `Proposal` file is readable and well-formed, `Brain` holds `skills/ui-design-brain/patterns-manifest.json`, the change is not already applied, and the brain tree's existing state is reported before you touch it.

**2. Apply** the ordered edits for that proposal type — new-pattern, new-alias, or guidance-edit — to the brain working tree only.

**3. Verify** by running the brain's own graph build — `node scripts/graph/build-graph.cjs` from the `Brain` root, not this repo's copy of that path (exit 0 required).

**4. Wiki.** Author a client-agnostic context-wiki entry in the `Brain` checkout, per [`references/downstream-wiki.md`](references/downstream-wiki.md). Skip with a stated message when `<Brain>/wiki/` is absent. Otherwise read `<Brain>/wiki/MECHANICS.md` and follow it: write `wiki/journal/<date>-<change-slug>.md`, add one `wiki/INDEX.md` Journal line, and — per the proposal type — add a Decisions bullet to `wiki/topics/component-catalog.md`. Ground it in recurrence and the catalog delta (count `N → N+1`), never the client name, run slug, or copy. Then re-run `node scripts/graph/build-graph.cjs` from the `Brain` root so `wiki/connections*` folds in the new entry (exit 0). Never commit.

**5. Stop and hand back** in the shape the checklist specifies: edited files (catalog and the wiki paths touched), verification result, suggested commit. Do not commit. If this promotion establishes a canonical that a run's `captures/` deferred, name those deferred captures in the handback so the operator can re-run `Action: capture` and apply them now — that loopback is what the deferred state exists to close.

### Action: capture

Requires `Captures`, `Library`, and `Brain`. Applies a run's component captures to a local ui-design-library working tree, one component at a time. Without `Brain` the preflight cannot check a canonical against the catalog and nothing downstream will — that repo's contracts compare a component against its own directory name, not against the manifest.

**1. Verify preconditions** from [`references/library-integrity-checklist.md`](references/library-integrity-checklist.md). Run:

```bash
node <skill>/scripts/capture-preflight.cjs --captures <Captures> --library <Library> --brain <Brain> --pretty
```

Report `orphanedByRun` verbatim — a library component claiming this run with no capture file is the defect this action exists to prevent. Do not start while any capture is `blocked`. A **`deferred`** capture (the preflight exits `6`) is likewise not yours to write yet — its canonical is only *proposed* this run; promote that proposal first, then re-run so it becomes `ready`. Exit `6` is not a green light.

**2. Apply** one capture at a time, in the checklist's order: implementation, then stories, then `component.json` — never the reverse, because a component directory holding only a `component.json` fails that repo's contracts. Executing a capture is a rewrite, not a copy: the `.tsx`, the token mapping, and the stories are yours to write. Paste the preflight's `componentJson` verbatim and fill `declienting` from what you actually removed.

**3. Verify** each component before starting the next, from the `Library` root: `pnpm contracts`, then `pnpm test` (exit 0 required).

**4. Wiki.** For each component actually written, author a client-agnostic context-wiki entry in the `Library` checkout, per [`references/downstream-wiki.md`](references/downstream-wiki.md). Skip a `deferred`, `blocked`, or `skipped` capture — nothing was written. Skip with a stated message when `<Library>/wiki/` is absent. Otherwise read `<Library>/wiki/MECHANICS.md` and follow it: write `wiki/journal/<date>-add-<slug>-component.md` (`topics: []`) and add one `wiki/INDEX.md` Journal line, grounded in the `declienting` removals and the canonical — never the client name, run slug, or copy. After the last entry, rebuild the graph with `pnpm graph:build` from the `Library` root (this is new here — Step 3 does not touch the graph; run the library's own copy, not this repo's identically-pathed one). Never commit.

**5. Stop and hand back** in the shape the checklist specifies: components added, the wiki paths touched, verification result, suggested commits. Do not commit.

## Inputs and outputs

Invoked with a parameter block:

```text
/project-retrospective
Project: /abs/path/to/completed-project
Brain: /abs/path/to/ui-design-brain
```

| Parameter | Required | Default | Meaning |
|---|---|---|---|
| `Project` | yes | — | Absolute path to the completed project repository. Read-only. |
| `Brain` | for resolution, promote, and capture | — | Absolute path to a local ui-design-brain checkout. |
| `Data` | no | — | Absolute path to the private `ui-design-evidence` repo. When given, runs land under `<Data>/runs/`. |
| `Output` | no | see step 0 | Where run output is written. Never inside `Project`. |
| `Client` | no | derived | Human-readable client name; sets the wiki client-slug. One client may own several project-slugs. Resolution order in [`references/wiki-feed.md`](references/wiki-feed.md). |
| `Scope` | no | `full` | `full`, `inventory`, or `candidates`. |
| `PriorReports` | no | — | Comma-separated paths to earlier `report.md` files. |
| `Action` | no | `analyze` | `analyze`, `promote`, or `capture`. |
| `Proposal` | for promote | — | Path to the approved proposal file to apply. |
| `Captures` | for capture | — | Path to a run's `captures/` directory. Applied as a set. |
| `Library` | for capture | — | Absolute path to a local ui-design-library checkout. |

**Outputs (analyze)** — all inside `Output`: `meta.json`, `inventory.json`, `resolution.json`, `report.md`, `memory-archive.json`, `proposals/<slug>.md` per Promote candidate, `captures/<slug>.md` per library candidate, `orchestration-drafts.md`.

**Side effects (analyze, wiki)** — when `Output` is under a `Data` = ui-design-evidence checkout, the run also preserves the project's memory at `<Data>/wiki/memory/<client-slug>/<project-slug>/` (near-raw `source/` plus an `index.md` digest), creates/updates `<Data>/wiki/clients/<client-slug>.md`, appends `<Data>/wiki/journal/<date>-<project-slug>.md`, and adds `<Data>/wiki/INDEX.md` lines. Skipped in the home fallback — though `memory-archive.json` is still written to `Output`. Nothing is committed.

**Side effects (promote)** — edits the ui-design-brain working tree, and regenerates that repo's committed graph artifacts as a by-product of verification. When `<Brain>/wiki/` exists, also authors a client-agnostic wiki entry there — `wiki/journal/<date>-<change-slug>.md`, one `wiki/INDEX.md` line, and (per proposal type) a `wiki/topics/component-catalog.md` Decisions bullet — and rebuilds `wiki/connections*` via the brain's own `scripts/graph/build-graph.cjs`. Skipped when that checkout has no `wiki/`. Nothing is committed anywhere.

**Side effects (capture)** — adds `components/<slug>/` directories to the ui-design-library working tree, three files each, and may add a semantic token to that repo's `src/tokens/semantic.css` when a client token has no semantic home. When `<Library>/wiki/` exists, also authors a client-agnostic wiki entry per written component — `wiki/journal/<date>-add-<slug>-component.md` plus one `wiki/INDEX.md` line — and rebuilds `wiki/connections*` via `pnpm graph:build`. Skipped when that checkout has no `wiki/`. Nothing is committed anywhere.

## Validation loops

```bash
node <skill>/scripts/validate-report.cjs --output <Output> --scope <Scope> [--no-brain] [--manifest <Brain>/skills/ui-design-brain/patterns-manifest.json]
```

Exit 0 is the pass; `FAIL [check] detail` lines name what to fix. Pass `--no-brain` when the run had no `Brain`. Warnings do not fail the run but must be read — an exclusion warning usually means a candidate should have been Rejected.

Fix and re-run. **Cap: 3 attempts.** After the third failure, stop and report the remaining failures verbatim rather than reshaping output to satisfy the validator.

Promote uses the brain's own `node scripts/graph/build-graph.cjs`, run from the `Brain` root, as its validator — this repo has a file at the same path, and it validates this repo, not the catalog. Same 3-attempt cap; on exhaustion, revert the brain edits and report.

Capture uses the library's own checks, run from the `Library` root: `pnpm contracts` for the fast structural pass, then `pnpm test` for typecheck, stories, and motion. Same 3-attempt cap; on exhaustion, revert the component directory you were writing and report. `pnpm test` renders every story in a real Chromium — a missing browser (`pnpm exec playwright install chromium`, once per machine) is an environment failure, not a failing component, and does not consume an attempt.

## Guardrails

Normative rubric: [`references/evidence-rubric.md`](references/evidence-rubric.md). Promote procedure: [`references/brain-integrity-checklist.md`](references/brain-integrity-checklist.md). Capture procedure: [`references/library-integrity-checklist.md`](references/library-integrity-checklist.md).

- MUST NOT run `git commit`, `push`, `merge`, `tag`, or open a pull request — in the analyzed project, in the catalog, in the component library, or anywhere else. Promote and capture end at the handback.
- MUST NOT fuzzy-match a label. Resolution is exact after normalization; anything else is novel. Never report a "closest match" or "probably X" — guessing is the failure the catalog exists to prevent.
- MUST NOT propose a child-part name (Tab, Slide, Accordion item) as an alias or a pattern.
- MUST NOT propose an alias without consumer evidence — a label an analyzed project actually used for that canonical.
- MUST NOT introduce a context-scoped alias without its counterpart. Plain string is the default; object form only for a demonstrated two-canonical collision, and then both canonicals and both index rows move together (see the rubric for the same-named-canonical exception).
- MUST NOT promote a hard exclusion: pages, business logic, authentication, checkout, search APIs, commerce flows, routing, client-specific workflows, or client branding.
- MUST NOT edit ai-orchestration. Pipeline findings are drafts the maintainer carries over.
- MUST NOT create a component directory the library cannot validate: implementation and stories before `component.json`, and never leave a `components/<slug>/` partially written.
- MUST NOT copy a component out of the analyzed project. Executing a capture is a rewrite — client tokens map to semantic tokens, client copy and assets come out, and every removal is recorded in `declienting`.
- MUST NOT set a captured component's `maturity` to anything but `candidate`. Promotion to `supported` is a human decision made in that repo.
- MUST treat `Project` as read-only. Analyze output goes only inside `Output`, which MUST NOT be inside `Project`; promote edits go only inside the `Brain` working tree; capture edits go only inside the `Library` working tree — under `components/<slug>/`, plus `src/tokens/semantic.css` when a mapping needs a token that does not exist. A retrospective never leaves artifacts in the repository it analyzed.
- MUST report script warnings verbatim rather than silently proceeding. A missing `build.config.json` degrades to code-scan mode; it is not a reason to stop.
- MUST NOT emit numeric scores, confidence percentages, or rankings. Evidence and a verdict.
- MUST write the client wiki only under `<Data>/wiki/` (the private ui-design-evidence checkout), never into this repository, and only when `Data` is that checkout — otherwise skip Step 6 and say so.
- MUST keep the wiki append-only: one `journal/` file per run, never overwritten; client-page `projects[]`/`platforms[]`/`aliases` additive. Supersede a stale fact with a new entry.
- MUST NOT invent wiki outcomes. Every journal Outcome traces to this run's `resolution.json` and its report verdicts; every "What we know" bullet traces to a run report or the analyzed project's `artifacts/memory/` (summarized durable engineering knowledge, never copied client prose).
- MUST run `archive-memory.cjs` on every analyze run so project memory is never silently dropped — record-only in the home fallback, a near-raw byte copy into `<Data>/wiki/memory/<client-slug>/<project-slug>/source/` (plus a fuller `index.md` digest) under a `Data` = evidence checkout. `validate-report.cjs` fails a run whose inventory shows memory but that produced no archive. The `source/` copy and `index.md` carry engineering knowledge only — never end-customer PII — and live only in the private evidence repo; the `## What we know` bullets stay a summary.
- MUST write `meta.json` for every analyze run, with `project.slug` and `date` equal to the run's own directory, so the wiki, the graph, and captures' `provenance.run` never disagree.
- MUST author the downstream wiki (ui-design-brain on promote, ui-design-library on capture) client-agnostically, per [`references/downstream-wiki.md`](references/downstream-wiki.md): no client display name, no run slug or `provenance.source` path in prose, no client-naming `declienting` string. Ground each entry in recurrence and the catalog/de-client decision — these are shared repos, unlike the private evidence wiki that alone may name the client.
- MUST read the downstream repo's own `wiki/MECHANICS.md` and follow its per-capture protocol and templates — that repo owns the format; `references/downstream-wiki.md` adds only the data boundary, the skip rule, and the grounding.
- MUST skip the downstream wiki entry, with a stated message, when the checkout has no `wiki/`; and MUST author a library entry only for a capture actually written (skip `deferred`/`blocked`). Never create a `wiki/` tree the repo lacks.
- MUST rebuild the downstream repo's connections graph after the wiki entry by running its own graph build from its root — `pnpm graph:build` for the library, `node scripts/graph/build-graph.cjs` for the brain — and MUST NOT hand-edit the generated `wiki/connections*` pages.
- Client-derived output stays with the client: it belongs in the project or a private data repo, never in this skill's own repository.
