---
name: project-retrospective
description: Analyzes a completed frontend project and mines it for promotable architecture, reusable components, pipeline rules, and durable team-retrospective knowledge. Inventories and resolves components against ui-design-brain, triages novel labels, drafts catalog/library/orchestration artifacts, captures Confluence retrospectives and accountable actions, and can append retrospective-only backfills to ui-design-evidence. With Action promote or capture, applies approved work to local downstream checkouts; captures include an unpublished reviewed Figma master and stop before committing or publishing. Use when a project wraps, the user wants a retrospective, pattern harvest, component inventory, catalog gap or alias audit, team-retrospective/post-mortem ingestion, historical evidence backfill, catalog promotion, or server-first multifile library capture.
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
- The user wants team design/build/release retrospectives or post-mortems preserved, synthesized, and tracked, including an append-only historical backfill (`Action: ingest-retrospectives`).
- Use the `ui-design-brain` skill instead when the task is resolving one label while authoring or building. This skill is for mining a whole repository.

## First-hop references

1. [`references/evidence-rubric.md`](references/evidence-rubric.md) — the Promote / Watch / Reject bar, hard exclusions, alias and variant rules. Normative for triage.
2. [`references/report-template.md`](references/report-template.md) — `report.md` structure; its `##` headings are frozen.
   [`references/triage-schema.md`](references/triage-schema.md) — `triage.json`, the machine-readable twin of `## Candidates` the promotion radar reads.
3. [`references/proposal-new-pattern-template.md`](references/proposal-new-pattern-template.md), [`references/proposal-new-alias-template.md`](references/proposal-new-alias-template.md), [`references/proposal-guidance-edit-template.md`](references/proposal-guidance-edit-template.md) — one per catalog proposal type.
4. [`references/proposal-component-capture-template.md`](references/proposal-component-capture-template.md) — capturing a mature implementation for `ui-design-library`.
   [`references/source-parity.md`](references/source-parity.md) — mandatory source behavior/layout/invariant inventory and difference classifications for every capture.
5. [`references/orchestration-draft-template.md`](references/orchestration-draft-template.md) — drafts for pipeline-shaped findings.
6. [`references/brain-integrity-checklist.md`](references/brain-integrity-checklist.md) — the ordered promote procedure. Read only for `Action: promote`.
7. [`references/library-integrity-checklist.md`](references/library-integrity-checklist.md) — the ordered capture procedure. Read only for `Action: capture`.
8. [`references/code-scan-mode.md`](references/code-scan-mode.md) — degraded-mode procedure. Read only when the inventory reports `mode: code-scan`.
9. [`references/wiki-feed.md`](references/wiki-feed.md) — the client wiki feed, the `meta.json` contract, client-identity resolution, and the project-memory archive. Read for `Action: analyze`.
10. [`references/wiki-client-template.md`](references/wiki-client-template.md) — the durable per-client page shape.
11. [`references/wiki-journal-template.md`](references/wiki-journal-template.md) — the per-run journal entry shape.
12. [`references/downstream-wiki.md`](references/downstream-wiki.md) — the client-agnostic context-wiki entry in the repo an action touches. Read for `Action: promote` (ui-design-brain) and `Action: capture` (ui-design-library).
13. [`references/spec-capture.md`](references/spec-capture.md) — the Confluence functional-spec capture recipe: label discovery, the approved-only gate, and the `specs-raw.json` schema. Read for `Action: analyze` when a `Specs` input is given.
14. [`references/tracking-issues.md`](references/tracking-issues.md) — deterministic GitHub issue, label, linking, and conditional local-branch routing. Read before the first repository write and at `Action: analyze` Step 7.
15. [`references/team-retrospectives.md`](references/team-retrospectives.md) — Confluence discovery, raw/findings schemas, normalized evidence, action lifecycle, private archive, and retrospectives-only runs. Read when `Retrospectives` is given or `Action: ingest-retrospectives` is used.

## Workflow

### Action: analyze (default)

Copy this checklist into your response and tick each item as you complete it:

```
Retrospective progress:
- [ ] 1. Inventory
- [ ] 1c. Team retrospectives (when supplied)
- [ ] 2. Resolution
- [ ] 3. Triage
- [ ] 4. Draft
- [ ] 5. Self-check
- [ ] 6. Wiki
- [ ] 7. Issues
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

Report the `mode`, `sourceSnapshot`, and `warnings` verbatim — warnings become the report's Gaps section. `sourceSnapshot` pins the exact Git HEAD; when the worktree is dirty, every later citation reads from that commit rather than current files. Discovery is stack-aware: `stackAdapter` selects the component file extensions and roots, a filesystem scan of those roots is unioned with `component-index.json` in **both** modes (so components the index omitted are still found), and Storybook is counted where the stack uses it; an unrecognized adapter falls back to a broad default with an `unknown-adapter` warning. If `mode` is `code-scan`, read [`references/code-scan-mode.md`](references/code-scan-mode.md) before continuing — its evidence cap, and the discovery mechanics, change every verdict downstream.

`Scope: inventory` skips steps 2 and 3, and step 4 writes only the Run, Summary, Inventory, and Gaps sections of `report.md`.

**1b. Specs (optional).** When a `Specs` input is given (a Confluence space + labels, or an approvals-page URL), capture the project's **approved** functional specs per [`references/spec-capture.md`](references/spec-capture.md). Scripts stay offline, so the model does the network fetch — from the **Atlassian REST API** (id-addressed and reliable; MCP is a fallback), pulling each page as ADF and rendering it deterministically with `scripts/adf-to-markdown.cjs` — then assembles `<Output>/specs-raw.json` and structures it:

```bash
node <skill>/scripts/adf-to-markdown.cjs --adf-dir <adf-dir> --out-dir <bodies-dir> --base-url https://<site>.atlassian.net
node <skill>/scripts/normalize-specs.cjs --raw <Output>/specs-raw.json [--archive <Data>/wiki/specs/<client-slug>/<project-slug>/source] --out <Output>/specs.json --pretty
```

The component label comes from the spec title; step 2 resolves it against the brain. The spec pack is authored-intent evidence — CMS field surface, ARIA/keyboard contract, composition, and the elements ba-spec-writer could not canonicalize (the highest-value novel candidates). Report its `warnings` verbatim. Skip this step, with a note, when no `Specs` input is given.

**1c. Team retrospectives (optional).** When `Retrospectives` is supplied, capture explicit pages and discover likely pages only inside the seeded Confluence spaces per [`references/team-retrospectives.md`](references/team-retrospectives.md). Fetch as ADF, render with `scripts/adf-to-markdown.cjs`, write `retrospectives-raw.json`, synthesize `retrospective-findings.json`, then run `scripts/normalize-retrospectives.cjs` to produce `retrospectives.json` and `retrospective-actions.json`. Record every excluded automatic candidate with a reason; never assume a shared template or cadence. Under an evidence `Data` checkout, archive reviewed bodies under `<Data>/wiki/retrospectives/` and merge actions with `scripts/update-retrospective-register.cjs`. Report all warnings verbatim.

**2. Resolution.** Requires `Brain`. Without it, skip to step 3, treat no label as novel (you cannot know), and record the missing catalog under Gaps. With it:

```bash
node <skill>/scripts/resolve.cjs --inventory <Output>/inventory.json --brain <Brain> [--specs <Output>/specs.json] [--retrospectives <Output>/retrospectives.json] --out <Output>/resolution.json --pretty
```

Pass `--specs <Output>/specs.json` when Step 1b produced a spec pack: an approved spec adds a `spec` evidence source to a matched novel label and records the spec-vs-as-built join (`matched`, `specOnly`) under `specs` for triage. For any entry with `ambiguous: true`, the manifest scopes that label to more than one canonical and the script deliberately did not pick. Decide from usage evidence — the component's build pack, its `fingerprint.json` (`affordance`, `role`), its bucket and domain. If the evidence does not clearly match one candidate's `context`, treat the label as unresolved rather than guessing. Record which evidence decided it.

Pass `--retrospectives <Output>/retrospectives.json` when Step 1c ran. Only normalizer-eligible component signals append `team-retrospective`: the signal must name an inventoried component, semantically agree with the implementation, cite a project path, and have a strong non-`code-scan` as-built source. All other retrospective knowledge remains contextual.

**3. Triage.** Apply [`references/evidence-rubric.md`](references/evidence-rubric.md) to every unresolved label: Promote, Watch, or Reject, each with evidence citing file paths. Check `PriorReports` first — a label that was Watch in an earlier report and recurs here is elevated to Promote. A label backed by both an as-built source and an approved `spec` clears the two-source bar with a client-neutral definition already in hand; a `specOnly` entry in `resolution.json`'s `specs` block is authored intent not yet built (a Watch, not a Promote) — feed it into the verdict per the rubric's `spec` source. When step 2 was skipped for want of a `Brain`, still emit `## Candidates` with an explicit note that no resolution ran, so the section is present rather than missing.

`Scope: candidates` writes `report.md` but no `proposals/` and no `orchestration-drafts.md`.

**4. Draft.** Write, in `<Output>`:

- `meta.json` — machine-readable run identity (client, project, platform, date, scope, priorReports) per [`references/wiki-feed.md`](references/wiki-feed.md). The model writes it; `resolve.cjs`/`inventory.cjs` stay client-agnostic.
- `report.md` — following [`references/report-template.md`](references/report-template.md).
- `triage.json` — the machine-readable twin of `report.md`'s `## Candidates`, written from your Step-3 verdicts plus `resolution.json`/`inventory.json` metadata (bucket, domain, entry, sources), one entry per triaged candidate split into `promote`/`watch`/`reject`. The evidence promotion radar reads each run's `watch[]` to rank candidates across runs, so every Watch entry's `note` MUST start `provisional canonical: <Name> — …`. Schema and the `provisional canonical:` rule: [`references/triage-schema.md`](references/triage-schema.md). Emitted at `full`/`candidates` scope, not `inventory`.
- `proposals/<kebab-label>.md` — one per Promote candidate, using the template for its type.
- `captures/<kebab-canonical>.md` for a default and `captures/<kebab-canonical>--<variant>.md` for a qualified structural alternate. Draw mature implementations from resolved and unresolved lists. A new-pattern capture remains `deferred` until promotion. Fold prop/visual choices into `variants`; use a qualified structural import only when the role, affordance, and interaction semantics remain the same. A semantic difference requires its own brain canonical. Never drop the second implementation. Every capture includes exact `## Structural implementation`, `## Runtime architecture`, `## Progress`, realization v1, and later `## Applied` lifecycle evidence. Apply [`references/proposal-component-capture-template.md`](references/proposal-component-capture-template.md). Omit the directory when nothing qualifies.
- `source-parity/<component-key>.json` — exactly one per capture, following [`references/source-parity.md`](references/source-parity.md). Inventory source behavior, visual layout, and invariants; record the inspected entry points, tests, styles, build packs, importers, and composed consumers; compare code, Storybook, Figma, and AI resolution; classify every difference; record each decision's implementation state; pin and hash every citation; complete decision-phase source-parity review before capture execution. Omit the directory only when there are no captures.
- `orchestration-drafts.md` — pipeline-shaped findings per [`references/orchestration-draft-template.md`](references/orchestration-draft-template.md), or its explicit "no pipeline learnings" note.
- `memory-archive.json` — run `scripts/archive-memory.cjs` to preserve the project's engineering memory (`<artifactsRoot>/memory/**`) before it is lost. It produces this manifest on **every** analyze run and, under a `Data` = ui-design-evidence checkout, byte-copies the memory (skipping empty placeholder shards) into the evidence archive using `meta.json`'s `client-slug`. Flags, layout, and the fidelity carve-out: [`references/wiki-feed.md`](references/wiki-feed.md).
- When Step 1c ran: `retrospectives-raw.json`, `retrospective-findings.json`, `retrospectives.json`, and `retrospective-actions.json`; add the frozen `## Team retrospectives` section to `report.md`.

**5. Self-check.** Run the validator (see Validation loops) and fix what it reports.

**6. Wiki.** Feed the client/project knowledge wiki, per [`references/wiki-feed.md`](references/wiki-feed.md). Only when `Output` resolved under a `Data` checkout that is `ui-design-evidence` (`<Data>/wiki/` beside `<Data>/runs/`): resolve the client identity (a client-slug distinct from the project-slug — one client may own several), upsert `<Data>/wiki/clients/<client-slug>.md` — carrying durable engineering knowledge from the analyzed project's `artifacts/memory/` forward into its `## What we know`, and linking the project-memory archive Step 4 preserved at `<Data>/wiki/memory/<client-slug>/<project-slug>/` (author its `index.md`: a cleaned-up, fuller paraphrase of that memory) — and append `<Data>/wiki/journal/<YYYY-MM-DD>-<project-slug>.md` from their templates with outcomes grounded in this run, add one `<Data>/wiki/INDEX.md` line per new file, then **rebuild the evidence repo's generated, drift-gated artifacts from the `Data` root** — run each of `pnpm -C <Data> graph:build`, `pnpm -C <Data> wiki:build`, and `pnpm -C <Data> query:build` independently (not as one `&&` chain: skip any the checkout does not define, with a note, and still run the rest) — so the run hands back a CI-clean tree rather than depending on that repo's pre-commit hook, and hand back the wiki paths. When the run landed in the home fallback, skip this and say so. Append-only: never overwrite a journal entry; keep client-page sets additive.

**7. Tracking.** Apply [`references/tracking-issues.md`](references/tracking-issues.md). Run `tracking-targets.cjs` from a snapshot of exact artifact IDs and repository checks. Reconcile only the sanctioned labels, reuse an exact matching open issue or use `github-issue-creator` to file immediately, and return the URLs without a confirmation pause. The validated evidence run gets its private hub issue; pending proposals get a client-agnostic brain issue. Analyze never creates a brain or library branch, and a draft capture alone creates no library issue. Actionable library tracking begins only after schema-v5 capture preflight. Skip `ai-orchestration` and every target whose resolver state is `skip`.

When `retrospective-actions.json` exists, include every non-`done`/non-`wont-do` action as a checklist item in the private evidence hub, naming its id, status, owner (or `needs-owner`), destination, and register link. Never publish client-derived actions directly to a shared repo.

### Action: ingest-retrospectives

Requires `Data`, `ProjectSlug`, and `Retrospectives`; accepts optional `Date` (today by default). Resolve client identity, platform, and `priorReports` from the latest existing `<Data>/runs/<ProjectSlug>/` run. Stop if the target `<Data>/runs/<ProjectSlug>/<Date>/` already exists.

Apply [`references/tracking-issues.md`](references/tracking-issues.md) and resolve `ingest-retrospectives` as evidence-only. Create the emitted evidence run branch off clean aligned `main` before the first write. Follow [`references/team-retrospectives.md`](references/team-retrospectives.md): capture/discover pages, write the four retrospective artifacts, and write `meta.json` with `scope: retrospectives`. Its `report.md` contains exactly the applicable frozen spine: `Run`, `Summary`, `Team retrospectives`, `Gaps`, `Next steps`.

Archive reviewed bodies and an `index.md` digest under `<Data>/wiki/retrospectives/<client-slug>/<ProjectSlug>/`; merge the living register under `<Data>/wiki/actions/<client-slug>/<ProjectSlug>.md`; update the client page and append the run journal. Rebuild the evidence repo's graph/wiki/query outputs independently, validate with `--scope retrospectives`, automatically file or reuse the private evidence-hub issue with its action checklist, and stop without committing.

### Action: promote

**1. Verify preconditions** from [`references/brain-integrity-checklist.md`](references/brain-integrity-checklist.md): the `Proposal` file is readable and well-formed, `Brain` holds `skills/ui-design-brain/patterns-manifest.json`, the change is not already applied, and the exact brain write set is non-empty. Apply [`references/tracking-issues.md`](references/tracking-issues.md): reconcile/reuse/create the issue automatically, require clean aligned local `main`, rerun `tracking-targets.cjs`, and create `feat/<issue-number>-catalog-promotion` only when brain is `write-ready`. Stop before branching on an issue, label, authentication, dirty-main, or stale-main failure.

**2. Apply** the ordered edits for that proposal type — new-pattern, new-alias, or guidance-edit — to the brain working tree only.

**3. Verify** by running the brain's own graph build — `node scripts/graph/build-graph.cjs` from the `Brain` root, not this repo's copy of that path (exit 0 required).

**4. Wiki.** Author a client-agnostic context-wiki entry in the `Brain` checkout, per [`references/downstream-wiki.md`](references/downstream-wiki.md). Skip with a stated message when `<Brain>/wiki/` is absent. Otherwise read `<Brain>/wiki/MECHANICS.md` and follow it: write `wiki/journal/<date>-<change-slug>.md`, add one `wiki/INDEX.md` Journal line, and — per the proposal type — add a Decisions bullet to `wiki/topics/component-catalog.md`. Ground it in recurrence and the catalog delta (count `N → N+1`), never the client name, run slug, or copy. Then re-run `node scripts/graph/build-graph.cjs` from the `Brain` root so `wiki/connections*` folds in the new entry (exit 0). Never commit.

**5. Stop and hand back** in the shape the checklist specifies: edited files (catalog and the wiki paths touched), verification result, suggested commit. Do not commit. If this promotion establishes a canonical that a run's `captures/` deferred, name those deferred captures in the handback so the operator can re-run `Action: capture` and apply them now — that loopback is what the deferred state exists to close. When the run filed a brain tracking issue (analyze Step 7, [`references/tracking-issues.md`](references/tracking-issues.md)), reference it so the operator can check off the applied proposal.

### Action: capture

Requires `Captures`, `Library`, and `Brain`. Applies a run's component captures to a local ui-design-library working tree, one component at a time. Without `Brain` the preflight cannot check a canonical against the catalog and nothing downstream will — that repo's contracts compare a component against its own directory name, not against the manifest.

**1. Verify preconditions** from [`references/library-integrity-checklist.md`](references/library-integrity-checklist.md). Run:

```bash
node <skill>/scripts/capture-preflight.cjs --captures <Captures> --library <Library> --brain <Brain> --pretty
```

Report `orphanedByRun` verbatim — a library component claiming this run with no capture file is the defect this action exists to prevent. Do not start while any capture is `blocked`. A **`deferred`** capture (the preflight exits `6`) is likewise not yours to write yet — its canonical is only *proposed* this run; promote that proposal first, then re-run so it becomes `ready`. Exit `6` is not a green light.

Require the additive `figmaPromotion` result to have `required: true`, `ready: true`, `writeCapabilityRequired: true`, `publicationStatus: "unpublished"`, exactly the `source-parity`, `adversarial`, and `design` review passes, the library-owned registry/checklist paths, the complete `pnpm test:code` pre-Figma gate, and `pnpm figma:coverage` / `pnpm figma:validate` commands. Missing Figma promotion capability blocks the capture before any write. Code Connect is not part of this workflow; the target library's canonical-slug npm contract is the only code-consumption path.

Require `schemaVersion: 5`, exact `(canonical, variant)` identity, a validated `sourceParity` decision set, and a non-null `architecture` plus realization v1 on every executable component. `ready` starts code, `figma-pending` resumes at Figma, `evidence-pending` writes only evidence reconciliation, and `skipped` means code, reviewed unpublished Figma, and `## Applied` already agree. Missing or inconsistent source coverage/classification, runtime architecture, public API, owned DOM, accessibility behavior/evidence, or consumer responsibility is a hard blocker. The plan returns source parity and architecture separately from `componentJson`; never merge either into it.

Apply [`references/tracking-issues.md`](references/tracking-issues.md) to the preflight work set. Automatically create or reuse the library issue for actionable `ready`/`figma-pending` work. Require the issue, clean aligned local `main`, a non-empty library write set, and required Figma capability before creating `feat/<issue-number>-library-capture`. Figma-pending work without a writer and evidence-only reconciliation create no library branch.

**2. Apply** one capture at a time, following its validated architecture and the checklist's order: facade/types → tree/parts/hooks → stories → `component.json` → `pnpm exports:sync`. Executing a capture is a rewrite, not a copy: map tokens, remove client coupling, keep server output deterministic, and place `'use client'` only on the planned client leaves (or the deliberate client-mode `index.ts` facade), each no more than 120 physical lines. Paste `componentJson` verbatim and fill `declienting`; do not copy `architecture` into it. If Action changes the planned API, DOM, keyboard model, or accessibility ownership, revise the capture and re-run preflight before continuing.

**3. Verify the complete code surface** before creating Figma. From the `Library` root run `figmaPromotion.codeTestCommand`, then `pnpm build` (exit 0 required). That code-only suite includes types, lint, architecture and contract fixtures, SSR, Storybook behavior, Chromium/WebKit accessibility, modes, and reduced motion. It deliberately excludes Figma coverage, which must remain red until Step 4 registers the reviewed master. Use `figmaPromotion.codeContractsCommand` only as the faster diagnostic subset when fixing a structural failure; it does not replace the complete code test.

**4. Promote to Figma and review.** Read the paths from `figmaPromotion` and the target library's promotion checklist. With a write-capable Figma agent or plugin session, create the unpublished canonical master and its documentation from the public types, Storybook `argTypes`, and semantic tokens. A REST token is read-only validation and does not satisfy this requirement. Use the existing Button, Section header, and Alert pages as the structural/naming references: the 528px documentation rail stays left, and Main, responsive specimens, and publish sources stay to its right. Preserve 1440/1024/768/390 breakpoint specimens when applicable and preserve intrinsic sizing rather than stretching a component to its viewport.

Register the stable node identity in `figma/library.json` with `publicationStatus: "unpublished"`; do not create a Code Connect template or configuration. Carry the source-parity decision IDs into the registry, run an adversarial pass over identity, properties, aliases, spacing, containment, and breakpoint behavior, then a design pass over hierarchy, alignment, typography, wrapping, intrinsic sizing, and visual consistency. Fix every actionable finding in place without deleting/recreating the master and repeat both passes until none remain. If review exposes a code/story/manifest defect, fix that source first, repeat Step 3, then resync Figma.

**5. Wiki and review evidence.** For each component actually written, author a client-agnostic context-wiki entry in the `Library` checkout, per [`references/downstream-wiki.md`](references/downstream-wiki.md). Skip a `deferred`, `blocked`, or `skipped` capture. Skip with a stated message when `<Library>/wiki/` is absent. Otherwise read `<Library>/wiki/MECHANICS.md` and follow it: write `wiki/journal/<date>-add-<slug>-component.md` (`topics: []`) and add one `wiki/INDEX.md` Journal line. Ground it in the source-parity decision IDs, `declienting` removals, and canonical, then add the stable Figma node identity, adversarial/design findings, in-place fixes, and final result. Point the registry's `figma.review.evidence` to that journal and set its review standard/passes/status only after all three reviews pass. After the last entry, rebuild the graph with `pnpm graph:build` from the `Library` root. Never commit.

Run `pnpm figma:coverage`, `pnpm figma:validate`, `pnpm contracts`, `pnpm test`, and `pnpm build` from the Library root. Every command must exit 0 before the component or batch is complete.

**6. Stop and hand back** in the shape the checklist specifies: components added, stable Figma node identities, review evidence, wiki paths, verification result, and suggested commits. Do not commit. When the run filed a library tracking issue (analyze Step 7, [`references/tracking-issues.md`](references/tracking-issues.md)), reference it so the operator can check off the applied capture.

Without a write-capable Figma session, persist `## Progress` as `code-complete`, report `figma-pending`, the exact canonical/variant, any partial node ID, and the missing capability. Do not create an empty library branch, call the capture complete, write passing review metadata, or proceed to the next component. A later run resumes at Figma; reviewed Figma with no evidence marker resumes as `evidence-pending` without a library branch.

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
| `Specs` | no | — | Confluence source for the project's functional specs — a space key + label(s), or an approvals-page URL. Enables Step 1b. |
| `Retrospectives` | no | — | Comma/newline-separated Confluence page or space URLs. Enables Step 1c. |
| `ProjectSlug` | for ingest-retrospectives | — | Existing project slug in the evidence checkout. |
| `Date` | no | today | Run date for ingest-retrospectives; `YYYY-MM-DD`. |
| `Action` | no | `analyze` | `analyze`, `ingest-retrospectives`, `promote`, or `capture`. |
| `Proposal` | for promote | — | Path to the approved proposal file to apply. |
| `Captures` | for capture | — | Path to a run's `captures/` directory. Applied as a set. |
| `Library` | for capture | — | Absolute path to a local ui-design-library checkout. |

**Outputs (analyze)** — all inside `Output`: `meta.json`, `inventory.json`, `resolution.json`, `report.md`, `triage.json` (the machine-readable `## Candidates` twin the promotion radar reads; `full`/`candidates` scope), `memory-archive.json`, `proposals/<slug>.md` per Promote candidate, `captures/<slug>.md` plus `source-parity/<slug>.json` per library candidate, and `orchestration-drafts.md`. Plus `specs-raw.json`/`specs.json` when `Specs` was given, and the four retrospective artifacts when `Retrospectives` was given. `Action: ingest-retrospectives` emits only `meta.json`, `report.md`, and those four retrospective artifacts.

**Side effects (analyze, wiki and tracking)** — when `Output` is under a `Data` = ui-design-evidence checkout, create `feat/<project>-<date>-run` from clean aligned `main` before the first write. The run preserves memory/specs, updates the authored wiki, and regenerates committed derived artifacts. Home fallback skips the evidence branch and issue. After validation, automatically reconcile sanctioned labels and file/reuse the private evidence hub plus a client-agnostic brain issue when proposals are pending. Analyze creates no shared-repository branch and no library issue from capture-file presence alone. Nothing is committed or pushed; see [`references/tracking-issues.md`](references/tracking-issues.md).

**Side effects (promote)** — edits the ui-design-brain working tree, and regenerates that repo's committed graph artifacts as a by-product of verification. When `<Brain>/wiki/` exists, also authors a client-agnostic wiki entry there — `wiki/journal/<date>-<change-slug>.md`, one `wiki/INDEX.md` line, and (per proposal type) a `wiki/topics/component-catalog.md` Decisions bullet — and rebuilds `wiki/connections*` via the brain's own `scripts/graph/build-graph.cjs`. Skipped when that checkout has no `wiki/`. Nothing is committed anywhere.

**Side effects (capture)** — adds the server-first component tree, syncs exports, may add a semantic token, and creates an unpublished canonical master plus documentation in the governed Figma file. It records source-parity decision IDs, stable node identity, and passed source-parity/adversarial/design reviews in `figma/library.json`; the library journal records the findings and fixes. Code Connect is not created or configured. Nothing is committed or published.

## Validation loops

```bash
node <skill>/scripts/validate-report.cjs --output <Output> --scope <Scope> [--no-brain] [--manifest <Brain>/skills/ui-design-brain/patterns-manifest.json] [--data <Data>]
```

Exit 0 is the pass; `FAIL [check] detail` lines name what to fix. Pass `--no-brain` when the run had no `Brain`. Pass `--data <Data>` (the ui-design-evidence checkout) so the validator flags a capture or proposal this run drafts that an earlier run already made (`capture-duplicate`/`proposal-duplicate`) — a component already in the library needs no new capture, and a canonical proposed by a prior run should be promoted rather than proposed twice. Warnings do not fail the run but must be read — an exclusion or duplicate warning usually means a candidate should have been dropped.

Fix and re-run. **Cap: 3 attempts.** After the third failure, stop and report the remaining failures verbatim rather than reshaping output to satisfy the validator.

Promote uses the brain's own `node scripts/graph/build-graph.cjs`, run from the `Brain` root, as its validator — this repo has a file at the same path, and it validates this repo, not the catalog. Same 3-attempt cap; on exhaustion, revert the brain edits and report.

Capture first uses the library's code-only checks because aggregate contracts intentionally require the Figma registration. After Figma creation/review it runs `pnpm figma:coverage`, `pnpm figma:validate`, `pnpm contracts`, `pnpm test`, and `pnpm build`. Same 3-attempt cap applies to deterministic failures. A missing browser or write-capable Figma session is an environment blocker, not a pass and not a reason to invent review evidence.

## Guardrails

Normative rubric: [`references/evidence-rubric.md`](references/evidence-rubric.md). Promote procedure: [`references/brain-integrity-checklist.md`](references/brain-integrity-checklist.md). Capture procedure: [`references/library-integrity-checklist.md`](references/library-integrity-checklist.md).

- MUST NOT run `git commit`, `push`, `merge`, `tag`, or open a pull request — in the analyzed project, in the catalog, in the component library, or anywhere else. Promote and capture end at the handback.
- MUST NOT fuzzy-match a label. Resolution is exact after normalization; anything else is novel. Never report a "closest match" or "probably X" — guessing is the failure the catalog exists to prevent.
- MUST NOT propose a child-part name (Tab, Slide, Accordion item) as an alias or a pattern.
- MUST NOT propose an alias without consumer evidence — a label an analyzed project actually used for that canonical.
- MUST NOT introduce a context-scoped alias without its counterpart. Plain string is the default; object form only for a demonstrated two-canonical collision, and then both canonicals and both index rows move together (see the rubric for the same-named-canonical exception).
- MUST NOT promote a hard exclusion: pages, business logic, authentication, checkout, search APIs, commerce flows, routing, client-specific workflows, or client branding.
- MUST NOT edit ai-orchestration. Pipeline findings are drafts the maintainer carries over.
- MUST NOT create a component directory the library cannot validate: every capture needs schema-v5 preflight with source parity, exact structural identity and lifecycle, a runtime architecture and intended realization v1, `index.ts`, a types module, at least two tree/branch/leaf TSX modules, behavior-evidence stories, then `component.json` and `pnpm exports:sync`; never leave `components/<slug>/` or `components/<slug>--<variant>/` partially written.
- MUST NOT widen a client boundary for convenience. Server mode has no client modules; hybrid keeps a server facade plus at least one server tree/branch/leaf implementation and hydrates only evidenced leaves; client mode requires a concrete hydration reason. Client implementation modules use `.client.ts`/`.client.tsx`, and every `'use client'` file stays within 120 physical lines and remains SSR-safe.
- MUST NOT copy a component out of the analyzed project. Executing a capture is a rewrite — client tokens map to semantic tokens, client copy and assets come out, and every removal is recorded in `declienting`.
- MUST NOT set a captured component's `maturity` to anything but `candidate`. Promotion to `supported` is a human decision made in that repo.
- MUST create and review the candidate's unpublished Figma master before calling a capture complete. Without a write-capable session, report `code complete, Figma promotion blocked`; never invent node or review evidence.
- MUST NOT create, configure, install, register, authenticate, or publish Code Connect. The library's canonical-slug npm imports are the only code-consumption path.
- MUST treat `Project` as read-only. Analyze output goes only inside `Output`, which MUST NOT be inside `Project`; promote edits go only inside the `Brain` working tree; capture edits go only inside the `Library` working tree and its governed Figma file — component code/tokens/exports, `figma/library.json`, and the downstream wiki/derived graph. A retrospective never leaves artifacts in the repository it analyzed.
- MUST report script warnings verbatim rather than silently proceeding. A missing `build.config.json` degrades to code-scan mode; it is not a reason to stop.
- MUST NOT emit numeric scores, confidence percentages, or rankings. Evidence and a verdict.
- MUST write the client wiki only under `<Data>/wiki/` (the private ui-design-evidence checkout), never into this repository, and only when `Data` is that checkout — otherwise skip Step 6 and say so.
- MUST keep the wiki append-only: one `journal/` file per run, never overwritten; client-page `projects[]`/`platforms[]`/`aliases` additive. Supersede a stale fact with a new entry.
- MUST NOT invent wiki outcomes. Every journal Outcome traces to this run's `resolution.json` and its report verdicts; every "What we know" bullet traces to a run report or the analyzed project's `artifacts/memory/` (summarized durable engineering knowledge, never copied client prose).
- MUST run `archive-memory.cjs` on every analyze run so project memory is never silently dropped — record-only in the home fallback, a near-raw byte copy into `<Data>/wiki/memory/<client-slug>/<project-slug>/source/` (plus a fuller `index.md` digest) under a `Data` = evidence checkout. `validate-report.cjs` fails a run whose inventory shows memory but that produced no archive. The `source/` copy and `index.md` carry engineering knowledge only — never end-customer PII — and live only in the private evidence repo; the `## What we know` bullets stay a summary.
- MUST write `meta.json` for every analyze run, with `project.slug` and `date` equal to the run's own directory, so the wiki, the graph, and captures' `provenance.run` never disagree.
- MUST capture only **approved** functional specs (Document Status = APPROVED), and treat `specs-raw.json`/`specs.json` and the spec archive as client-derived output — written only under `Output`, or archived under `<Data>/wiki/specs/`, never into this repository. `validate-report.cjs` fails a spec pack carrying a non-approved spec.
- MUST author the downstream wiki (ui-design-brain on promote, ui-design-library on capture) client-agnostically, per [`references/downstream-wiki.md`](references/downstream-wiki.md): no client display name, no run slug or `provenance.source` path in prose, no client-naming `declienting` string. Ground each entry in recurrence and the catalog/de-client decision — these are shared repos, unlike the private evidence wiki that alone may name the client.
- MUST keep raw retrospective bodies, page ids/URLs, client identities, action owners, and issue links inside the private evidence checkout. Public fixtures and examples stay synthetic.
- MUST read the downstream repo's own `wiki/MECHANICS.md` and follow its per-capture protocol and templates — that repo owns the format; `references/downstream-wiki.md` adds only the data boundary, the skip rule, and the grounding.
- MUST skip the downstream wiki entry, with a stated message, when the checkout has no `wiki/`; and MUST author a library entry only for a capture actually written (skip `deferred`/`blocked`). Never create a `wiki/` tree the repo lacks.
- MUST rebuild the downstream repo's connections graph after the wiki entry by running its own graph build from its root — `pnpm graph:build` for the library, `node scripts/graph/build-graph.cjs` for the brain — and MUST NOT hand-edit the generated `wiki/connections*` pages.
- Client-derived output stays with the client: it belongs in the project or a private data repo, never in this skill's own repository.
- MUST apply [`references/tracking-issues.md`](references/tracking-issues.md) automatically: no approval pause for sanctioned labels, exact issue reuse/creation, issue linking, or required local branches. MUST create no shared branch from artifact presence alone, no library issue before actionable capture preflight, and no issue or branch for `ai-orchestration`. MUST NOT treat this authority as permission to commit, push, open a PR, close an issue, publish Figma, merge, or release.
