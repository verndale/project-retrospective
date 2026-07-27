---
name: project-retrospective
description: Analyzes a completed frontend project repository and mines it for promotable architectural knowledge. Inventories the components that were built (from pipeline artifacts — build packs, component index, fingerprints, project memory — or a degraded code scan), resolves every component label against the ui-design-brain patterns manifest, triages unresolved labels into Promote, Watch, or Reject candidates with cited evidence, and drafts catalog-format pattern and alias proposals plus paste-ready ai-orchestration rule drafts. With Action promote, applies one approved proposal to a local ui-design-brain checkout following the catalog-integrity checklist and stops before committing. Use when a project wraps and the user wants a retrospective, pattern harvest, component inventory, catalog gap analysis, alias audit, or to promote a pattern or alias into ui-design-brain.
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
- Use the `ui-design-brain` skill instead when the task is resolving one label while authoring or building. This skill is for mining a whole repository.

## First-hop references

1. [`references/evidence-rubric.md`](references/evidence-rubric.md) — the Promote / Watch / Reject bar, hard exclusions, alias and variant rules. Normative for triage.
2. [`references/report-template.md`](references/report-template.md) — `report.md` structure; its `##` headings are frozen.
3. [`references/proposal-new-pattern-template.md`](references/proposal-new-pattern-template.md), [`references/proposal-new-alias-template.md`](references/proposal-new-alias-template.md), [`references/proposal-guidance-edit-template.md`](references/proposal-guidance-edit-template.md) — one per catalog proposal type.
4. [`references/proposal-component-capture-template.md`](references/proposal-component-capture-template.md) — capturing a mature implementation for `ui-design-library`.
5. [`references/orchestration-draft-template.md`](references/orchestration-draft-template.md) — drafts for pipeline-shaped findings.
6. [`references/brain-integrity-checklist.md`](references/brain-integrity-checklist.md) — the ordered promote procedure. Read only for `Action: promote`.
7. [`references/code-scan-mode.md`](references/code-scan-mode.md) — degraded-mode procedure. Read only when the inventory reports `mode: code-scan`.

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

Report the `mode` and the `warnings` array verbatim — they become the report's Gaps section. If `mode` is `code-scan`, read [`references/code-scan-mode.md`](references/code-scan-mode.md) before continuing; its evidence cap changes every verdict downstream.

`Scope: inventory` skips steps 2 and 3, and step 4 writes only the Run, Summary, Inventory, and Gaps sections of `report.md`.

**2. Resolution.** Requires `Brain`. Without it, skip to step 3, treat no label as novel (you cannot know), and record the missing catalog under Gaps. With it:

```bash
node <skill>/scripts/resolve.cjs --inventory <Output>/inventory.json --brain <Brain> --out <Output>/resolution.json --pretty
```

For any entry with `ambiguous: true`, the manifest scopes that label to more than one canonical and the script deliberately did not pick. Decide from usage evidence — the component's build pack, its `fingerprint.json` (`affordance`, `role`), its bucket and domain. If the evidence does not clearly match one candidate's `context`, treat the label as unresolved rather than guessing. Record which evidence decided it.

**3. Triage.** Apply [`references/evidence-rubric.md`](references/evidence-rubric.md) to every unresolved label: Promote, Watch, or Reject, each with evidence citing file paths. Check `PriorReports` first — a label that was Watch in an earlier report and recurs here is elevated to Promote. When step 2 was skipped for want of a `Brain`, still emit `## Candidates` with an explicit note that no resolution ran, so the section is present rather than missing.

`Scope: candidates` writes `report.md` but no `proposals/` and no `orchestration-drafts.md`.

**4. Draft.** Write, in `<Output>`:

- `report.md` — following [`references/report-template.md`](references/report-template.md).
- `proposals/<kebab-label>.md` — one per Promote candidate, using the template for its type.
- `captures/<kebab-canonical>.md` — for implementations mature enough that the next project should start from them rather than rebuild. Draw these from the **resolved** list as much as the unresolved one: a mature Card or Modal implementation is a better library candidate than a novel label, which is usually the least-settled code in the project. Apply [`references/proposal-component-capture-template.md`](references/proposal-component-capture-template.md). Omit the directory when nothing qualifies.
- `orchestration-drafts.md` — pipeline-shaped findings per [`references/orchestration-draft-template.md`](references/orchestration-draft-template.md), or its explicit "no pipeline learnings" note.

**5. Self-check.** Run the validator (see Validation loops) and fix what it reports.

### Action: promote

**1. Verify preconditions** from [`references/brain-integrity-checklist.md`](references/brain-integrity-checklist.md): the `Proposal` file is readable and well-formed, `Brain` holds `skills/ui-design-brain/patterns-manifest.json`, the change is not already applied, and the brain tree's existing state is reported before you touch it.

**2. Apply** the ordered edits for that proposal type — new-pattern, new-alias, or guidance-edit — to the brain working tree only.

**3. Verify** by running the brain's own graph build — `node scripts/graph/build-graph.cjs` from the `Brain` root, not this repo's copy of that path (exit 0 required).

**4. Stop and hand back** in the shape the checklist specifies: edited files, verification result, suggested commit. Do not commit.

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
| `Brain` | for resolution and promote | — | Absolute path to a local ui-design-brain checkout. |
| `Data` | no | — | Absolute path to the private `ui-design-evidence` repo. When given, runs land under `<Data>/runs/`. |
| `Output` | no | see step 0 | Where run output is written. Never inside `Project`. |
| `Scope` | no | `full` | `full`, `inventory`, or `candidates`. |
| `PriorReports` | no | — | Comma-separated paths to earlier `report.md` files. |
| `Action` | no | `analyze` | `analyze` or `promote`. |
| `Proposal` | for promote | — | Path to the approved proposal file to apply. |

**Outputs (analyze)** — all inside `Output`: `inventory.json`, `resolution.json`, `report.md`, `proposals/<slug>.md` per Promote candidate, `captures/<slug>.md` per library candidate, `orchestration-drafts.md`.

**Side effects (promote)** — edits the ui-design-brain working tree, and regenerates that repo's committed graph artifacts as a by-product of verification. Nothing is committed anywhere.

## Validation loops

```bash
node <skill>/scripts/validate-report.cjs --output <Output> --scope <Scope> [--no-brain] [--manifest <Brain>/skills/ui-design-brain/patterns-manifest.json]
```

Exit 0 is the pass; `FAIL [check] detail` lines name what to fix. Pass `--no-brain` when the run had no `Brain`. Warnings do not fail the run but must be read — an exclusion warning usually means a candidate should have been Rejected.

Fix and re-run. **Cap: 3 attempts.** After the third failure, stop and report the remaining failures verbatim rather than reshaping output to satisfy the validator.

Promote uses the brain's own `node scripts/graph/build-graph.cjs`, run from the `Brain` root, as its validator — this repo has a file at the same path, and it validates this repo, not the catalog. Same 3-attempt cap; on exhaustion, revert the brain edits and report.

## Guardrails

Normative rubric: [`references/evidence-rubric.md`](references/evidence-rubric.md). Promote procedure: [`references/brain-integrity-checklist.md`](references/brain-integrity-checklist.md).

- MUST NOT run `git commit`, `push`, `merge`, `tag`, or open a pull request — in the analyzed project, in the catalog, or anywhere else. Promote ends at the handback.
- MUST NOT fuzzy-match a label. Resolution is exact after normalization; anything else is novel. Never report a "closest match" or "probably X" — guessing is the failure the catalog exists to prevent.
- MUST NOT propose a child-part name (Tab, Slide, Accordion item) as an alias or a pattern.
- MUST NOT propose an alias without consumer evidence — a label an analyzed project actually used for that canonical.
- MUST NOT introduce a context-scoped alias without its counterpart. Plain string is the default; object form only for a demonstrated two-canonical collision, and then both canonicals and both index rows move together (see the rubric for the same-named-canonical exception).
- MUST NOT promote a hard exclusion: pages, business logic, authentication, checkout, search APIs, commerce flows, routing, client-specific workflows, or client branding.
- MUST NOT edit ai-orchestration. Pipeline findings are drafts the maintainer carries over.
- MUST treat `Project` as read-only. Analyze output goes only inside `Output`, which MUST NOT be inside `Project`; promote edits go only inside the `Brain` working tree. A retrospective never leaves artifacts in the repository it analyzed.
- MUST report script warnings verbatim rather than silently proceeding. A missing `build.config.json` degrades to code-scan mode; it is not a reason to stop.
- MUST NOT emit numeric scores, confidence percentages, or rankings. Evidence and a verdict.
- Client-derived output stays with the client: it belongs in the project or a private data repo, never in this skill's own repository.
