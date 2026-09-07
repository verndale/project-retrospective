---
name: project-retrospective
description: Analyzes a completed frontend project and mines it for promotable architecture, reusable components, pipeline rules, and durable team-retrospective knowledge. Inventories and resolves components against ui-design-brain, triages novel labels, drafts catalog/library/orchestration artifacts, captures Confluence retrospectives and accountable actions, and can append retrospective-only backfills to ui-design-evidence. With Action promote or capture, applies approved work to local downstream checkouts; captures include source-backed Storybook/Figma interaction states, an unpublished reviewed Figma master, and stop before committing or publishing. Use when a project wraps, the user wants a retrospective, pattern harvest, component inventory, catalog gap or alias audit, team-retrospective/post-mortem ingestion, historical evidence backfill, catalog promotion, or server-first multifile library capture.
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
   [`references/source-parity.md`](references/source-parity.md) — mandatory pinned behavior/layout/accessibility/state inventory created when capture enriches an intent.
5. [`references/orchestration-draft-template.md`](references/orchestration-draft-template.md) — drafts for pipeline-shaped findings.
6. [`references/brain-integrity-checklist.md`](references/brain-integrity-checklist.md) — the ordered promote procedure. Read only for `Action: promote`.
7. [`references/library-integrity-checklist.md`](references/library-integrity-checklist.md) — the ordered capture procedure. Read only for `Action: capture`.
8. [`references/code-scan-mode.md`](references/code-scan-mode.md) — degraded-mode procedure. Read only when the inventory reports `mode: code-scan`.
9. [`references/cms-taxonomy.md`](references/cms-taxonomy.md) — the seven canonical CMS key/label pairs and the boundary between identity recognition and discovery support.
10. [`references/wiki-feed.md`](references/wiki-feed.md) — the client wiki feed, the `meta.json` contract, client-identity resolution, and the project-memory archive. Read for `Action: analyze`.
11. [`references/wiki-client-template.md`](references/wiki-client-template.md) — the durable per-client page shape.
12. [`references/wiki-journal-template.md`](references/wiki-journal-template.md) — the per-run journal entry shape.
13. [`references/downstream-wiki.md`](references/downstream-wiki.md) — the client-agnostic context-wiki entry in the repo an action touches. Read for `Action: promote` (ui-design-brain) and `Action: capture` (ui-design-library).
14. [`references/spec-capture.md`](references/spec-capture.md) — the Confluence functional-spec capture recipe: label discovery, the approved-only gate, and the `specs-raw.json` schema. Read for `Action: analyze` when a `Specs` input is given.
15. [`references/tracking-issues.md`](references/tracking-issues.md) — deterministic GitHub issue, label, linking, and conditional local-branch routing. Read before the first repository write and at `Action: analyze` Step 7.
16. [`references/team-retrospectives.md`](references/team-retrospectives.md) — Confluence discovery, raw/findings schemas, normalized evidence, action lifecycle, private archive, and retrospectives-only runs. Read when `Retrospectives` is given or `Action: ingest-retrospectives` is used.

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
node <skill>/scripts/inventory.cjs --project <Project> [--platform <Platform>] --out <Output>/inventory.json --pretty
```

Report the `mode`, `sourceSnapshot`, `config.cmsKey`, `config.cmsLabel`, `discovery`, and `warnings` verbatim — warnings become the report's Gaps section. `sourceSnapshot` pins the exact Git HEAD; every later citation reads from that commit. Discovery starts with the root manifest and only nested manifests admitted by its workspace declaration or `pnpm-workspace.yaml`, then exact framework/platform dependency markers, conventional source roots, imports, colocated tests/stories/styles/tokens, consumers, and delivery configuration for ordinary single-package and monorepo projects. Repository walks reject traversal roots and skip every source symlink (including workspace/component roots, cycles, indexed entries, and direct delivery files), because its target bytes are not provable at the pinned revision. Unrelated nested package examples cannot change platform identity or component roots. Build config, component indexes, build packs, fingerprints, design facts, and project memory are optional corroboration. Platform identity uses exact markers or an explicit canonical `Platform` override; multiple exact matches stay `null` with an ambiguity warning. CMS identity follows [`references/cms-taxonomy.md`](references/cms-taxonomy.md) independently of discovery support. If `mode` is `code-scan`, read [`references/code-scan-mode.md`](references/code-scan-mode.md); code plus its tests/stories/styles/consumers is one project implementation family, not independent recurrence.

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

**3. Triage.** When `Data` or `PriorReports` is available, select prior recurrence deterministically before applying [`references/evidence-rubric.md`](references/evidence-rubric.md):

```bash
node <skill>/scripts/prior-evidence.cjs --project <project-slug> [--data <Data>] [--prior-reports <comma-separated report.md paths>] --pretty
```

The script chooses the latest eligible run for each other project, requires non-symlink run surfaces, valid run identity, exact inventory/meta/report CMS parity, and triage/resolution joins, includes prior Watch and Promote, excludes Reject and retrospective-only runs, and counts each project once. `PriorReports` is an explicit compatibility escape hatch, including when `Data` is unavailable: each path must name an eligible real `report.md` beside real metadata, inventory, triage, and resolution files. Explicit and automatic runs enter the same latest-per-project merge, so a stale path warns and cannot replace newer evidence. Use `latestRuns[].report` as this run's selected `meta.json.priorReports`; do not carry ignored paths forward. Code, colocated tests, stories, styles, and consumers in one project remain one implementation family. Apply Promote, Watch, or Reject to every unresolved label with path citations; recurrence can elevate Watch only after hard exclusions and catalog coverage still pass. An approved `spec` is independent of as-built code; a `specOnly` entry is Watch until built. Without `Brain`, still emit `## Candidates` with an explicit skipped-resolution note.

`Scope: candidates` writes `report.md` but no `proposals/` and no `orchestration-drafts.md`.

**4. Draft.** Write, in `<Output>`:

- `meta.json` — machine-readable run identity (client, project, exact canonical CMS key/label, date, scope, selected prior evidence) per [`references/wiki-feed.md`](references/wiki-feed.md). Repeat `inventory.json`'s `config.cmsKey`/`config.cmsLabel` exactly as `platform`/`platformDisplay`; set `priorReports` to `prior-evidence.cjs`'s selected `latestRuns[].report` paths, whether automatic or explicit.
- `report.md` — following [`references/report-template.md`](references/report-template.md).
- `triage.json` — the machine-readable twin of `report.md`'s `## Candidates`, written from your Step-3 verdicts plus `resolution.json`/`inventory.json` metadata (bucket, domain, entry, sources), one entry per triaged candidate split into `promote`/`watch`/`reject`. The evidence promotion radar reads each run's `watch[]` to rank candidates across runs, so every Watch entry's `note` MUST start `provisional canonical: <Name> — …`. Schema and the `provisional canonical:` rule: [`references/triage-schema.md`](references/triage-schema.md). Emitted at `full`/`candidates` scope, not `inventory`.
- `proposals/<kebab-label>.md` — one per Promote candidate, using the template for its type.
- `captures/<kebab-canonical>.md` for a default and `captures/<kebab-canonical>--<variant>.md` for a qualified structural alternate. Analyze emits only `component-capture-intent`: canonical/structural identity, one source entry, why, evidence present/absent, a de-client headline, and `Progress` pending. It makes no target Storybook/Figma/node/review, runtime-architecture, accessibility-ownership, or realization claim. Apply [`references/proposal-component-capture-template.md`](references/proposal-component-capture-template.md). Omit the directory when nothing qualifies.
- Do not emit `source-parity/` during analyze. `Action: capture` creates schema-v2 companions only for selected intents after reopening and hashing the pinned source per [`references/source-parity.md`](references/source-parity.md).
- `orchestration-drafts.md` — pipeline-shaped findings per [`references/orchestration-draft-template.md`](references/orchestration-draft-template.md), or its explicit "no pipeline learnings" note.
- `memory-archive.json` — run `scripts/archive-memory.cjs` to preserve the project's engineering memory (`<artifactsRoot>/memory/**`) before it is lost. It produces this manifest on **every** analyze run and, under a `Data` = ui-design-evidence checkout, byte-copies the memory (skipping empty placeholder shards and every symlink whose target is not proven by the pinned repository) into the evidence archive using `meta.json`'s `client-slug`. Flags, layout, and the fidelity carve-out: [`references/wiki-feed.md`](references/wiki-feed.md).
- When Step 1c ran: `retrospectives-raw.json`, `retrospective-findings.json`, `retrospectives.json`, and `retrospective-actions.json`; add the frozen `## Team retrospectives` section to `report.md`.

**5. Self-check.** Run the validator (see Validation loops) and fix what it reports.

**6. Wiki.** Feed the client/project knowledge wiki, per [`references/wiki-feed.md`](references/wiki-feed.md). Only when `Output` resolved under a `Data` checkout that is `ui-design-evidence` (`<Data>/wiki/` beside `<Data>/runs/`): resolve the client identity (a client-slug distinct from the project-slug — one client may own several), upsert `<Data>/wiki/clients/<client-slug>.md` — carrying durable engineering knowledge from the analyzed project's `artifacts/memory/` forward into its `## What we know`, and linking the project-memory archive Step 4 preserved at `<Data>/wiki/memory/<client-slug>/<project-slug>/` (author its `index.md`: a cleaned-up, fuller paraphrase of that memory) — and append `<Data>/wiki/journal/<YYYY-MM-DD>-<project-slug>.md` from their templates with outcomes grounded in this run, add one `<Data>/wiki/INDEX.md` line per new file, then **rebuild the evidence repo's generated, drift-gated artifacts from the `Data` root** — run each of `pnpm -C <Data> graph:build`, `pnpm -C <Data> wiki:build`, and `pnpm -C <Data> query:build` independently (not as one `&&` chain: skip any the checkout does not define, with a note, and still run the rest) — so the run hands back a CI-clean tree rather than depending on that repo's pre-commit hook, and hand back the wiki paths. When the run landed in the home fallback, skip this and say so. Append-only: never overwrite a journal entry; keep client-page sets additive.

**7. Tracking.** Apply [`references/tracking-issues.md`](references/tracking-issues.md). Run `tracking-targets.cjs` from a snapshot of exact artifact IDs and repository checks. Reconcile only the sanctioned labels, reuse an exact matching open issue or use `github-issue-creator` to file immediately, and return the URLs without a confirmation pause. The validated evidence run gets its private hub issue; pending proposals get a client-agnostic brain issue. Analyze never creates a brain or library branch, and a draft capture alone creates no library issue. Actionable library tracking begins only after schema-v6 capture preflight; the existing capture checkbox, issue, and branch include Storybook and Figma state coverage rather than spawning a second workflow. Skip `ai-orchestration` and every target whose resolver state is `skip`.

When `retrospective-actions.json` exists, include every non-`done`/non-`wont-do` action as a checklist item in the private evidence hub, naming its id, status, owner (or `needs-owner`), destination, and register link. Never publish client-derived actions directly to a shared repo.

### Action: ingest-retrospectives

Requires `Data`, `ProjectSlug`, and `Retrospectives`; accepts optional `Date` (today by default). Resolve client identity, canonical CMS key/label, and `priorReports` from the latest existing `<Data>/runs/<ProjectSlug>/` run. Stop if that source metadata uses a legacy or unknown CMS value; this producer does not provide runtime aliases. Stop if the target `<Data>/runs/<ProjectSlug>/<Date>/` already exists.

Apply [`references/tracking-issues.md`](references/tracking-issues.md) and resolve `ingest-retrospectives` as evidence-only. Create the emitted evidence run branch off clean aligned `main` before the first write. Follow [`references/team-retrospectives.md`](references/team-retrospectives.md): capture/discover pages, write the four retrospective artifacts, and write `meta.json` with `scope: retrospectives`. Its `report.md` contains exactly the applicable frozen spine: `Run`, `Summary`, `Team retrospectives`, `Gaps`, `Next steps`.

Archive reviewed bodies and an `index.md` digest under `<Data>/wiki/retrospectives/<client-slug>/<ProjectSlug>/`; merge the living register under `<Data>/wiki/actions/<client-slug>/<ProjectSlug>.md`; update the client page and append the run journal. Rebuild the evidence repo's graph/wiki/query outputs independently, validate with `--scope retrospectives`, automatically file or reuse the private evidence-hub issue with its action checklist, and stop without committing.

### Action: promote

**1. Verify preconditions** from [`references/brain-integrity-checklist.md`](references/brain-integrity-checklist.md): the `Proposal` file is readable and well-formed, `Brain` holds `skills/ui-design-brain/patterns-manifest.json`, the change is not already applied, and the exact brain write set is non-empty. Apply [`references/tracking-issues.md`](references/tracking-issues.md): reconcile/reuse/create the issue automatically, require clean aligned local `main`, rerun `tracking-targets.cjs`, and create `feat/<issue-number>-catalog-promotion` only when brain is `write-ready`. Stop before branching on an issue, label, authentication, dirty-main, or stale-main failure.

**2. Apply** the ordered edits for that proposal type — new-pattern, new-alias, or guidance-edit — to the brain working tree only.

**3. Verify** by running the brain's own graph build — `node scripts/graph/build-graph.cjs` from the `Brain` root, not this repo's copy of that path (exit 0 required).

**4. Wiki.** Author a client-agnostic context-wiki entry in the `Brain` checkout, per [`references/downstream-wiki.md`](references/downstream-wiki.md). Skip with a stated message when `<Brain>/wiki/` is absent. Otherwise read `<Brain>/wiki/MECHANICS.md` and follow it: write `wiki/journal/<date>-<change-slug>.md`, add one `wiki/INDEX.md` Journal line, and — per the proposal type — add a Decisions bullet to `wiki/topics/component-catalog.md`. Ground it in recurrence and the catalog delta (count `N → N+1`), never the client name, run slug, or copy. Then re-run `node scripts/graph/build-graph.cjs` from the `Brain` root so `wiki/connections*` folds in the new entry (exit 0). Never commit.

**5. Stop and hand back** in the shape the checklist specifies: edited files (catalog and the wiki paths touched), verification result, suggested commit. Do not commit. If this promotion establishes a canonical that a run's `captures/` deferred, name those deferred captures in the handback so the operator can re-run `Action: capture` and apply them now — that loopback is what the deferred state exists to close. When the run filed a brain tracking issue (analyze Step 7, [`references/tracking-issues.md`](references/tracking-issues.md)), reference it so the operator can check off the applied proposal.

### Action: capture

Requires `Captures`, `Library`, and `Brain`; optionally accepts `CaptureKeys` and a `Project` checkout override. Applies selected run intents/captures one at a time. Without `Brain`, canonical checking degrades and nothing downstream can compare the directory name against the catalog.

**1. Gate capability and source before branching.** Follow [`references/library-integrity-checklist.md`](references/library-integrity-checklist.md). Confirm the current write-capable Figma tool, run the library's exact `pnpm figma:live`, read sibling `inventory.json`, and resolve `Project` from it or the override. Prefer its recorded full Git revision. When inventory explicitly reports `sourceSnapshot.strategy: unavailable`, permit only `legacy-untracked` parity that re-hashes every citation and inspected path from the current checkout, rejects every symlink/non-regular file, and records that no Git identity pins those verified bytes. This gate covers fresh and resumed work. Missing writer/live/source validation stops before any evidence or library branch.

**2. Enrich the selected intents.** Apply tracking with the selected keys at `enrichment-pending`; after the Step-1 writer/live gate it may prepare only the run's evidence branch, while the library remains `capture-enrichment-required`. For each selected `CaptureKeys` entry, preserve exactly one safe repository-relative Source entry; verify that sibling `meta.json`, inventory, source-parity project/run/entry, inspected entry points, and a hashed citation all join the same run and file at the pinned revision or the explicitly unversioned verified current tree. Reject an entry with multiple inventory owners, and require sibling `resolution.json` to join its one owner to the capture canonical (including an explicit alias resolution or an unresolved component tied to its sibling new-pattern proposal). Then replace `component-capture-intent` with the full `component-capture` contract. Add its source-parity v2 companion, runtime architecture, interaction states, intended realization v1, a11y/state disposition, and de-client detail. Missing source accessibility is an explicit `remediation-gap` and remains actionable. Orchestration/build artifacts are optional corroboration. Then run:

```bash
node <skill>/scripts/capture-preflight.cjs --captures <Captures> --library <Library> --brain <Brain> [--capture-keys <CaptureKeys>] [--project <Project>] --figma-writer figma-use --figma-live-validated --pretty
```

Report `orphanedByRun` verbatim. Require schema v6, `source.verified: true`, exact identity, source-parity decisions, separate interaction states/architecture, realization v1, and `figmaPromotion.ready: true` with `writeCapabilityRequired: true`, `publicationStatus: "unpublished"`, exact source-parity/adversarial/design passes, current registry/checklist grammar, `pnpm test:code`, `pnpm figma:live`, `pnpm figma:coverage`, and `pnpm figma:validate`. A `blocked` result stops; exit `6` means promote a deferred sibling proposal first.

Apply [`references/tracking-issues.md`](references/tracking-issues.md) again to the validated work set. Only schema-v6 `ready` can create/reuse a library issue and create `feat/<issue-number>-library-capture` for a non-empty capable write set. `enrichment-pending` is evidence-branch-only; `figma-pending` means capability disappeared unexpectedly after work began and creates no new branch. Once capability is restored, preflight returns `ready` with `resumeExistingBranch`, and tracking resumes the same issue branch rather than creating it again. `evidence-pending` writes only evidence reconciliation; `skipped` means code, reviewed unpublished Figma coverage, post-remediation evidence, and `## Applied` already agree.

**3. Apply** one capture at a time, following its validated architecture and the checklist's order: facade/types → tree/parts/hooks → stories → `component.json` → `pnpm exports:sync`. Executing a capture is a rewrite, not a copy: map tokens, remove client coupling, keep server output deterministic, and place `'use client'` only on the planned client leaves (or the deliberate client-mode `index.ts` facade), each no more than 120 physical lines. Paste `componentJson` verbatim and fill `declienting`; keep architecture/parity/state inventory outside it. Covered states export `InteractionStates` with source-backed visual and executable runtime evidence; not-applicable retains its reason without an empty story. If implementation changes the planned API, DOM, keyboard model, accessibility ownership, or state inventory, revise and re-run preflight.

**4. Verify the complete code surface** before creating Figma. From `Library`, run `figmaPromotion.codeTestCommand`, then `pnpm build` (exit 0 required). It covers types, lint, architecture/contracts, SSR, Storybook behavior, browser accessibility, modes, and reduced motion. Use `codeContractsCommand` only as a faster diagnostic.

**5. Promote to Figma and review.** Read `figmaPromotion` and the target checklist. With the confirmed writer, create the unpublished canonical master and documentation from public types, Storybook `argTypes`, and semantic tokens. A REST token is read-only validation and does not satisfy this requirement. Follow the live-file grammar, choosing the matching reference rather than blending them: Button for compact component matrices; Section header and Alert for responsive specimens; Tabs for same-page structural alternates. Keep the 528px `01 • Documentation` rail at x=0, `02 • Main components` to its right, numbered structural alternates next, and `Interaction states` as the final numbered Ready for Dev section. Keep the master in a separate unnumbered `Publish source` section. Use 1440/1024/768/390 specimens when applicable; intrinsic components remain intrinsic.

Register the stable node identity in `figma/library.json` with `publicationStatus: "unpublished"`; do not create a Code Connect template or configuration. For covered components, add an `Interaction states` documentation frame after Main and every structural alternate, as the final numbered Ready for Dev section, using connected master instances, outside labels, semantic variables, property reuse for `already-represented`, and deterministic frame/instance/component IDs for visual states. Keep runtime-only behavior reasoned and executable rather than static. For not-applicable components, register the reason and `states: []`. Carry the source-parity decision IDs into the registry, then run a fresh post-remediation source-parity pass, an adversarial pass over identity, state differentiation, focus/disabled treatment, properties, aliases, spacing, containment, and breakpoint behavior, and a design pass over hierarchy, alignment, typography, wrapping, intrinsic sizing, and visual consistency. Review cannot pass until Storybook and unpublished Figma state coverage agree with source parity. Fix every actionable finding in place without deleting/recreating the master and repeat all passes until none remain. If review exposes a code/story/manifest defect, fix that source first, repeat Step 3, then resync Figma.

**6. Wiki and review evidence.** For each component actually written, author a client-agnostic context-wiki entry in `Library` per [`references/downstream-wiki.md`](references/downstream-wiki.md). Skip deferred/blocked/skipped and a checkout with no wiki. Otherwise follow its `wiki/MECHANICS.md`, ground the journal in decision IDs/de-clienting/canonical, record Figma review/fixes/result, point registry review evidence to it, update the index, and run `pnpm graph:build`. Never commit.

Run `pnpm figma:coverage`, `pnpm figma:validate`, `pnpm contracts`, `pnpm test`, and `pnpm build` from the Library root. Every command must exit 0 before the component or batch is complete.

Copy the registry proof into modern capture `## Applied`: stable top-level `nodeId`/`nodeKey`, unpublished status, exactly the three passed reviews, and exact semantic `stateCoverage`. Visual states require non-empty frame/instance/component IDs, but a child variant component ID need not equal the top-level component-set ID. Runtime-only states have reason and no visual IDs; not-applicable has reason plus empty states.

**7. Stop and hand back** in the checklist shape: components, stable Figma identity/state coverage, review evidence, wiki paths, verification, tracking issue, and suggested commits. Do not commit. If capability disappears mid-run, persist `Progress` as `code-complete` with `blockedOn: {"code":"figma-capability-lost"}`, report current `figma-pending`, and stop; never invent completion evidence or start another component.

## Inputs and outputs

Invoked with a parameter block:

```text
/project-retrospective
Project: /abs/path/to/completed-project
Brain: /abs/path/to/ui-design-brain
```

| Parameter | Required | Default | Meaning |
|---|---|---|---|
| `Project` | analyze: yes; capture: no | sibling inventory | Absolute path to the completed project repository. Always read-only; on capture it may override the checkout path, never the pinned revision. |
| `Brain` | for resolution, promote, and capture | — | Absolute path to a local ui-design-brain checkout. |
| `Data` | no | — | Absolute path to the private `ui-design-evidence` repo. When given, runs land under `<Data>/runs/`. |
| `Output` | no | see step 0 | Where run output is written. Never inside `Project`. |
| `Client` | no | derived | Human-readable client name; sets the wiki client-slug. One client may own several project-slugs. Resolution order in [`references/wiki-feed.md`](references/wiki-feed.md). |
| `Scope` | no | `full` | `full`, `inventory`, or `candidates`. |
| `Platform` | no | exact marker inference | One canonical CMS key override when repository markers are absent/ambiguous. |
| `PriorReports` | no | automatic from `Data` | Legacy escape hatch for comma-separated eligible `report.md` paths, usable without `Data`; explicit and automatic runs share latest-per-project selection. |
| `Specs` | no | — | Confluence source for the project's functional specs — a space key + label(s), or an approvals-page URL. Enables Step 1b. |
| `Retrospectives` | no | — | Comma/newline-separated Confluence page or space URLs. Enables Step 1c. |
| `ProjectSlug` | for ingest-retrospectives | — | Existing project slug in the evidence checkout. |
| `Date` | no | today | Run date for ingest-retrospectives; `YYYY-MM-DD`. |
| `Action` | no | `analyze` | `analyze`, `ingest-retrospectives`, `promote`, or `capture`. |
| `Proposal` | for promote | — | Path to the approved proposal file to apply. |
| `Captures` | for capture | — | Path to a run's `captures/` directory. Applied as a set. |
| `CaptureKeys` | no | all pending | Comma-separated exact component keys to enrich/apply. |
| `Library` | for capture | — | Absolute path to a local ui-design-library checkout. |

**Outputs (analyze)** — all inside `Output`: `meta.json`, schema-v1 `inventory.json`, `resolution.json`, `report.md`, `triage.json`, `memory-archive.json`, `proposals/<slug>.md` per Promote candidate, lightweight pending `captures/<slug>.md` intents, and `orchestration-drafts.md`. Analyze emits no `source-parity/`. Optional spec/retrospective inputs add their documented artifacts; `ingest-retrospectives` emits only meta/report plus retrospective artifacts.

**Side effects (analyze, wiki and tracking)** — when `Output` is under a `Data` = ui-design-evidence checkout, create `feat/<project>-<date>-run` from clean aligned `main` before the first write. The run preserves memory/specs, updates the authored wiki, and regenerates committed derived artifacts. Home fallback skips the evidence branch and issue. After validation, automatically reconcile sanctioned labels and file/reuse the private evidence hub plus a client-agnostic brain issue when proposals are pending. Analyze creates no shared-repository branch and no library issue from capture-file presence alone. Nothing is committed or pushed; see [`references/tracking-issues.md`](references/tracking-issues.md).

**Side effects (promote)** — edits the ui-design-brain working tree, and regenerates that repo's committed graph artifacts as a by-product of verification. When `<Brain>/wiki/` exists, also authors a client-agnostic wiki entry there — `wiki/journal/<date>-<change-slug>.md`, one `wiki/INDEX.md` line, and (per proposal type) a `wiki/topics/component-catalog.md` Decisions bullet — and rebuilds `wiki/connections*` via the brain's own `scripts/graph/build-graph.cjs`. Skipped when that checkout has no `wiki/`. Nothing is committed anywhere.

**Side effects (capture)** — on the evidence run branch, enriches selected intents and adds pinned source-parity v2. On the issue-keyed library branch, adds the server-first component/story/metadata surface and an unpublished governed Figma master/documentation/state coverage. It copies client-neutral Figma identity/review/coverage into `## Applied`. Code Connect is not created or configured. Nothing is committed or published.

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
- MUST NOT create a component directory the library cannot validate: every actionable capture needs pinned source verification and schema-v6 preflight with source-parity v2 interaction/accessibility dispositions, exact structural identity/lifecycle, runtime architecture and intended realization v1, `index.ts`, a types module, at least two tree/branch/leaf TSX modules, behavior/state-evidence stories, then `component.json` and `pnpm exports:sync`; never leave a partial component.
- MUST NOT widen a client boundary for convenience. Server mode has no client modules; hybrid keeps a server facade plus at least one server tree/branch/leaf implementation and hydrates only evidenced leaves; client mode requires a concrete hydration reason. Client implementation modules use `.client.ts`/`.client.tsx`, and every `'use client'` file stays within 120 physical lines and remains SSR-safe.
- MUST NOT copy a component out of the analyzed project. Executing a capture is a rewrite — client tokens map to semantic tokens, client copy and assets come out, and every removal is recorded in `declienting`.
- MUST NOT set a captured component's `maturity` to anything but `candidate`. Promotion to `supported` is a human decision made in that repo.
- MUST capability-gate fresh and resumed capture before branching, create and review the unpublished Figma master plus governed state frames (or matching not-applicable registration), and copy its client-neutral proof into `## Applied` before completion. `figma-pending` is only an unexpected current mid-run loss; restored capability resumes the existing branch. Never invent node/review/state evidence.
- MUST NOT create, configure, install, register, authenticate, or publish Code Connect. The library's canonical-slug npm imports are the only code-consumption path.
- MUST treat `Project` as read-only. Analyze output goes only inside `Output`, which MUST NOT be inside `Project`; promote edits go only inside the `Brain` working tree; capture edits go only inside the `Library` working tree and its governed Figma file — component code/tokens/exports, `figma/library.json`, and the downstream wiki/derived graph. A retrospective never leaves artifacts in the repository it analyzed.
- MUST report script warnings verbatim rather than silently proceeding. A missing `build.config.json` degrades to code-scan mode; it is not a reason to stop.
- MUST treat code plus colocated tests, stories, styles, imports, and consumers as one project implementation family for promotion evidence. Another project or genuinely independent evidence is still required; hard exclusions never relax.
- MUST NOT emit numeric scores, confidence percentages, or rankings. Evidence and a verdict.
- MUST write the client wiki only under `<Data>/wiki/` (the private ui-design-evidence checkout), never into this repository, and only when `Data` is that checkout — otherwise skip Step 6 and say so.
- MUST keep the wiki append-only: one `journal/` file per run, never overwritten; client-page `projects[]`/`platforms[]`/`aliases` additive. Supersede a stale fact with a new entry.
- MUST NOT invent wiki outcomes. Every journal Outcome traces to this run's `resolution.json` and its report verdicts; every "What we know" bullet traces to a run report or the analyzed project's `artifacts/memory/` (summarized durable engineering knowledge, never copied client prose).
- MUST run `archive-memory.cjs` on every analyze run so project memory is never silently dropped — record-only in the home fallback, a near-raw byte copy into `<Data>/wiki/memory/<client-slug>/<project-slug>/source/` (plus a fuller `index.md` digest) under a `Data` = evidence checkout. `validate-report.cjs` fails a run whose inventory shows memory but that produced no archive. The `source/` copy and `index.md` carry engineering knowledge only — never end-customer PII — and live only in the private evidence repo; the `## What we know` bullets stay a summary.
- MUST write `meta.json` for every analyze run, with `project.slug` and `date` equal to the run's own directory, so the wiki, the graph, and captures' `provenance.run` never disagree.
- MUST use the exact seven-entry CMS contract in [`references/cms-taxonomy.md`](references/cms-taxonomy.md): repeat inventory's canonical key/label in `meta.json` and the report, reject legacy values, and never infer discovery support from catalog recognition.
- MUST capture only **approved** functional specs (Document Status = APPROVED), and treat `specs-raw.json`/`specs.json` and the spec archive as client-derived output — written only under `Output`, or archived under `<Data>/wiki/specs/`, never into this repository. `validate-report.cjs` fails a spec pack carrying a non-approved spec.
- MUST author the downstream wiki (ui-design-brain on promote, ui-design-library on capture) client-agnostically, per [`references/downstream-wiki.md`](references/downstream-wiki.md): no client display name, no run slug or `provenance.source` path in prose, no client-naming `declienting` string. Ground each entry in recurrence and the catalog/de-client decision — these are shared repos, unlike the private evidence wiki that alone may name the client.
- MUST keep raw retrospective bodies, page ids/URLs, client identities, action owners, and issue links inside the private evidence checkout. Public fixtures and examples stay synthetic.
- MUST read the downstream repo's own `wiki/MECHANICS.md` and follow its per-capture protocol and templates — that repo owns the format; `references/downstream-wiki.md` adds only the data boundary, the skip rule, and the grounding.
- MUST skip the downstream wiki entry, with a stated message, when the checkout has no `wiki/`; and MUST author a library entry only for a capture actually written (skip `deferred`/`blocked`). Never create a `wiki/` tree the repo lacks.
- MUST rebuild the downstream repo's connections graph after the wiki entry by running its own graph build from its root — `pnpm graph:build` for the library, `node scripts/graph/build-graph.cjs` for the brain — and MUST NOT hand-edit the generated `wiki/connections*` pages.
- Client-derived output stays with the client: it belongs in the project or a private data repo, never in this skill's own repository.
- MUST apply [`references/tracking-issues.md`](references/tracking-issues.md) automatically: no approval pause for sanctioned labels, exact issue reuse/creation, issue linking, or required local branches. MUST create no shared branch from artifact presence alone, no library issue before actionable capture preflight, and no issue or branch for `ai-orchestration`. MUST NOT treat this authority as permission to commit, push, open a PR, close an issue, publish Figma, merge, or release.
