---
status: implemented
executed: 2026-07-26
date: 2026-07-26
evidence: []
source_tool: claude
source: "/Users/joe.fusco/.claude/plans/users-joe-fusco-desktop-wiki-port-promp-modular-axolotl.md"
topics: [graph-wiki-subsystem]
audit_note: "Delivered as an uncommitted working tree on feat/knowledge-graph-wiki; evidence (PR) is backfilled on merge by wiki-sync. Deviations from the plan as written: build-graph.cjs's rel() helper was fixed to take the repo root explicitly (it closed over the module-level REPO_ROOT, so build({repoRoot}) silently emitted ../-prefixed ids and no fixture-based test could work), and scripts/graph/data/ was added to substantive.cjs's NEVER_RE because the pre-commit hook restages graph.json on every commit, which would otherwise flag every PR as needing a journal entry."
---
# Port the knowledge-graph + context-wiki subsystem into project-retrospective

## Context

`@verndale/project-retrospective` has two commits and no memory of why it looks the way it does. The decisions that shaped it — rejecting the original proposal's 20 subagents, its 27-field artifact model, its numeric promotion scores, its Primitive/Component/Module taxonomy — live only in a plan file on Joe's desktop and in a session transcript. `git log` cannot recover them, and the next agent to open this repo will re-litigate them.

The sibling repos already solved this. `ui-design-brain` runs a deterministic knowledge graph plus a context wiki (journal / topics / archived plans) recording the *why* behind each change; `ui-design-evidence` runs the graph half of the same subsystem. This is the third repo and the third adaptation, seeded with the plan this repo was actually built from.

The port also buys a gate this repo lacks. The brain's graph build fails when its pattern manifest names a file that does not exist. This repo has no catalog, so its analogue is the skill's own contract: `SKILL.md` declares nine `references/*.md` and three `scripts/*.cjs`, and a build that finds one missing must fail.

**Outcome:** `pnpm graph:build` / `graph:view` / `graph:navigate` / `evals:graph` / `wiki:*` all work here; `pnpm test` gains the freshness gate; `wiki/` ships already populated — two archived plans, two journal entries, four topic pages, both indexes, and the generated connections pages; nothing client-derived enters this public repo.

The port captures itself. `MECHANICS.md`'s capture trigger names "the graph/wiki tooling, workflows, or hooks" explicitly, so this plan is archived into the wiki it builds and gets its own journal entry and topic decision — the same thing the donor's port plan did one repo over. A wiki that shipped empty, or that shipped violating its own protocol on arrival, would be the wrong first commit.

**Donor:** `/Users/joe.fusco/Projects/@verndale/ui-design-brain` (already the Slack-free port). Its own port plan, `wiki/plans/2026-07-23-port-knowledge-graph-wiki-subsystem.md`, is this same job one repo over.

## Decisions already taken

- **Seed plan is redacted on archive.** The source names a client on 5 lines (incl. a real client repo path); `AGENTS.md` forbids that here. Archive, then redact: client name → neutral placeholder, client path → `<Project>`. Record it in `audit_note:`.
- **The `scripts/graph/build-graph.cjs` collision gets disambiguated** at all 8 sites (SKILL.md:99, :138; `brain-integrity-checklist.md` ×4; skill `README.md` ×2) — reworded to name the brain explicitly. Wording only; no frontmatter, section-order, workflow, or test-expectation change.
- **Slack stays fully excluded** — no workflow, script, lib, or env var.
- **No separate `graph.yml`.** The gate composes into `pnpm test`, which `test.yml` already runs.
- **Viewer port 4175** (brain 4173, evidence 4174), stated identically in code and docs. `ui-design-evidence` has a README/serve drift bug here — do not inherit it.
- **Branch:** `feat/knowledge-graph-wiki`, cut from `main`. No commits, pushes, tags, or PRs by the agent.

---

## 1. Graph ontology (the core adaptation)

### Node types — `typeOf()`

`walk()` keeps the donor's skips (`node_modules`, `_meta`, dotfiles) and adds `scripts/tests/fixtures` (synthetic data; its `.md` files would emit junk `links-to` edges). Extension filter widens to `[".md", ".cjs"]`. `skills/_meta/_sections.md` is added as an explicit node **outside** `walk()` — the same trick the donor uses for its manifest — so it is indexed but originates no link edges (its line 46 carries a backtick-quoted `[README.md](README.md)` example that would otherwise dangle forever).

| Type | Rule | Label source |
|---|---|---|
| `root-doc` | `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `CLAUDE.md` | first H1 |
| `skill` | `skills/project-retrospective/SKILL.md` | frontmatter `name` |
| `skill-readme` | `skills/project-retrospective/README.md` | first H1 |
| `skill-reference` | `skills/project-retrospective/references/*.md` | first H1 |
| `skill-script` | `skills/project-retrospective/scripts/**/*.cjs` (incl. `lib/util.cjs`) | basename |
| `authoring-spec` | `skills/_meta/_sections.md` | first H1 |
| `repo-script` | `scripts/{graph,wiki,evals,commit-pr}/**/*.cjs` | path-relative name |
| `test` | `scripts/tests/*.test.cjs`, `scripts/tests/helpers.cjs` | basename |
| `wiki-index` | `wiki/**/INDEX.md`, `wiki/MECHANICS.md` | first H1 |
| `wiki-journal` / `wiki-topic` / `wiki-plan` | by directory | first H1 |

`.cjs` files have no H1 and no frontmatter — label is the basename, exactly as the donor labels its manifest node with a literal string. `CHANGELOG.md` and the generated `wiki/connections*` pages are excluded (donor's `isConnectionsView`).

### Edge passes

| # | Type | Source → target | Emission |
|---|---|---|---|
| 1 | `contracts` | `SKILL.md` → each `references/*.md` it links, and → each `scripts/*.cjs` it names | **unconditional — this is the gate** |
| 2 | `tests` | each test file → the script (or `SKILL.md`) it exercises | **unconditional — gate** |
| 3 | `links-to` | relative markdown link between indexed `.md` nodes, fence-aware, `count` + `anchors[]` | resolve-only |
| 4 | `topic` | wiki page → `topics/<slug>.md` from frontmatter `topics:` | unconditional |
| 5 | `plan` | journal entry → its archived plan from frontmatter `plan:` | unconditional |
| 6 | `covers` | topic → the runtime surfaces in its `covers:` | unconditional |

Dropped from the donor: `catalogs` (no manifest here), `see-also` (the donor's backticked-filename convention is a pattern-catalog artifact; this repo's `references/*.md` contain zero links and a test forbids reference→reference links), and `references` (skill→manifest/pattern — superseded by `contracts`).

### The two extractors — reuse, do not reinvent

`skill-conformance.test.cjs` already derives exactly these two sets, and the graph builder must use the **same two regexes** rather than the donor's:

```js
/\]\((references\/[^)]+)\)/g          // → references, resolved against the skill dir
/scripts\/([a-z-]+\.cjs)/g            // → scripts, resolved against <skill>/scripts/
```

Two reasons, both load-bearing:

1. SKILL.md names its scripts as `<skill>/scripts/inventory.cjs` inside fenced bash blocks. The donor's `isSkippable()` rejects any target containing `<`, `BACKTICK_FILE_RE` excludes `<`, and both link passes are fence-aware — so **every donor extractor would find zero scripts** and the gate would be silently empty.
2. A looser regex would capture the brain's `scripts/graph/build-graph.cjs` (SKILL.md:99, :138) as a local skill script and emit an edge that dangles forever. `[a-z-]+` cannot cross the `/` in `graph/build-graph.cjs`, so the existing regex correctly ignores it — before *and* after the disambiguation reword.

For `tests` edges, derive from quoted filenames in each test's source: quoted `*.cjs` → `<skill>/scripts/<name>`, and the literal `'SKILL.md'` → the skill node. Restrict `.md` matching to exactly `SKILL.md` so fixture names (`master.md`, `report.md`, `orchestration-drafts.md`) don't dangle. Verified against the current tests — every test file gets ≥1 edge:

- `inventory.test.cjs` → `inventory.cjs`
- `resolve.test.cjs` → `inventory.cjs`, `resolve.cjs`
- `validate-report.test.cjs` → `validate-report.cjs`
- `skill-conformance.test.cjs` → `SKILL.md`

### Integrity gate

Unchanged from the donor (`build-graph.cjs:495-503`): before writing, every edge endpoint must resolve to a node, else print `FAIL: N edge(s) with unresolved endpoints` and `process.exit(1)`. What changes is *which* passes feed it — `contracts`, `tests`, `topic`, `plan`, `covers`.

### `routing-policy.json`

Every edge type needs a cost and every node type named must exist, or `evals:graph` fails.

```json
{
  "edgeCosts": { "contracts": 1, "covers": 1, "topic": 1, "plan": 1, "tests": 2, "links-to": 3 },
  "hubPenalty": 0.5,
  "excludedIntermediateTypes": ["root-doc", "wiki-index"],
  "intents": {
    "why":     { "preferredTargetTypes": ["wiki-topic", "wiki-journal", "wiki-plan"],
                 "preferredSourceTypes": ["wiki-topic", "wiki-journal", "wiki-plan", "skill", "skill-reference"],
                 "allowSourceAsTarget": true },
    "wiring":  { "preferredTargetTypes": ["skill", "skill-reference", "skill-script", "repo-script"],
                 "preferredSourceTypes": ["skill", "skill-reference", "skill-script", "repo-script"] },
    "impact":  { "preferredTargetTypes": ["skill", "skill-script", "test", "skill-reference"],
                 "preferredSourceTypes": ["skill", "skill-script", "test", "skill-reference"] }
  }
}
```

### `renderConnections()` sections

Four, replacing the donor's catalog-worded set: `wiki/connections/contract.md` (SKILL.md's declared references + scripts), `links.md` (doc cross-links), `coverage.md` (`tests` + `covers` — the four-surfaces view), `wiki-wiring.md` (topic/plan/journal wiring). Index at `wiki/connections.md`.

---

## 2. Files ported, and how

**Verbatim:** `scripts/graph/{routing.cjs,serve.cjs}` (serve: port → 4175), `scripts/graph/viewer/{viewer.css,routing.js}`, all three `viewer/vendor/*.min.js`, `scripts/wiki/{archive-plan.cjs,navigate.cjs,ci-journal-warn.cjs}`, `scripts/wiki/lib/{frontmatter,codex-plans,wiki-io,ai}.cjs` (`ai.cjs` stays dormant — opt-in via `WIKI_AI`, output discarded unless grounded).

**Adapt:**

| File | Change |
|---|---|
| `scripts/graph/build-graph.cjs` | Rewrite `typeOf()`, walked roots, and the edge passes per §1. Keep `walk`, `isSkippable`, fence handling, sort, `render()`, the integrity gate. |
| `scripts/graph/viewer/viewer.js` | Retune `TYPE_COLORS` / `TYPE_LABELS` / `EDGE_COLORS` to the new vocabulary. |
| `scripts/graph/viewer/index.html` | Retitle → `Knowledge Graph — Project Retrospective`. |
| `scripts/evals/graph-check.cjs` | Drop the donor's `coverageProblems`; add a `require.main === module` guard (the donor runs at module load, so a test that requires it executes the whole check). |
| `scripts/wiki/lib/substantive.cjs` | Rewrite all three tables: `SUBSTANTIVE_RE` → `^skills/`, `^scripts/(graph\|wiki\|evals)/`, `^\.github/workflows/`, `^\.husky/`; `NEVER_RE` → `^wiki/` (unchanged — stops bot-PR recursion); `TOPIC_RE` → graph/wiki/husky paths → `graph-wiki-subsystem`, `skills/project-retrospective/` → `retrospective-workflow`, `skills/_meta/` → `skill-authoring`. |
| `scripts/wiki/{find-unarchived-plans,pre-commit-journal}.cjs` | `REPO_MATCH` → `/project-retrospective/`; drop the donor's `~/Desktop/claude-plans-organized/ui-design-brain/*` scan dirs (keep `~/.claude/plans`). |
| `scripts/wiki/{on-merge-sync,refresh-issue-state}.cjs` | Repo slug → `verndale/project-retrospective`. `on-merge-sync`'s 5-column `plans/INDEX.md` assumption holds — keep the table shape. |

**New:** `.husky/pre-commit` (journal warn, non-blocking; then rebuild graph and `git add` the artifacts when `$CI` is unset), `.github/workflows/wiki-sync.yml`, `.github/workflows/wiki-issue-sync.yml`. Both workflows: Node `24.14.0`, pnpm `10.33.0`, secret `PR_BOT_TOKEN`, branches `bot/wiki-sync/<pr>` and `bot/wiki-issue-sync`, recursion guard `!startsWith(head.ref, 'bot/wiki-')`.

**`package.json`:** add `graph:build`, `graph:view`, `graph:navigate`, `evals:graph`, `wiki:archive-plan`, `wiki:find-plans`, `wiki:issue-sync`; change `test` to `node --test "scripts/tests/**/*.test.cjs" && pnpm evals:graph` (the `ui-design-evidence` composition). No new dependencies — the whole subsystem is Node stdlib plus the three vendored browser bundles.

`scripts/graph/data/graph.json` and `wiki/connections*` are **committed**, not gitignored — the freshness gate byte-compares them. They contain only this repo's own structure, so no data-boundary issue.

---

## 3. Wiki content — the full capture set

`wiki/INDEX.md` + `wiki/MECHANICS.md` adapted from the donor: prose retargeted, **read protocol ("Never load the whole wiki") and all four write templates kept exactly**. `wiki/plans/INDEX.md` keeps the 5-column `| Date | Plan | Status | Evidence | Topics |` shape (`on-merge-sync.cjs` indexes `cells[4]`) and its `Totals:` line, which `wiki-io.cjs::updatePlanTotals()` rewrites in place.

### Archived plans — two

**(a) The build plan** — `~/.claude/plans/users-joe-fusco-desktop-project-retrosp-fancy-lantern.md` (166 lines):

```bash
pnpm wiki:archive-plan <plan> --status implemented --date 2026-07-26 --source-tool claude --topics skill-authoring,retrospective-workflow,brain-promotion --evidence "commit caebd12" --evidence "commit 012a6f0"
```

No PR — both commits landed directly on `main`; no release was cut, both are `chore`. Then the redaction pass over the archived copy (5 client mentions incl. the client repo path).

`audit_note:` records the three deltas between plan and reality — Slice 4 shipped in the new private `ui-design-evidence` instead of here; the single "separate private data repo" became two (`ui-design-library` for implementations pulled into client projects, `ui-design-evidence` for runs and the graph, consumed by nothing) so one client's build can never contain another's evidence; and the in-project `Output:` default was reversed, the analyzed project now strictly read-only — plus the redaction note.

**(b) This plan** — archived the same way, `--status implemented --date 2026-07-26 --source-tool claude --topics graph-wiki-subsystem`. Evidence is left empty: there is no PR at handback time. That is the designed loop, not an omission — the port journal entry carries `plan:` pointing at this archived file and `pr: pending`, and `wiki-sync.yml` backfills both the `plans/INDEX.md` Evidence cell and the plan file's `evidence:` frontmatter when Joe's PR merges. The subsystem's own automation gets exercised by the very PR that introduces it.

`plans/INDEX.md` therefore ships with two rows and `Totals: 2 implemented (2 plans).`

### Journal entries — two

**(a) The build entry**, covering what `git log` cannot say:

- The original proposal's 20 subagents, 27-field artifact model, numeric promotion scores, and Primitive/Component/Module taxonomy were all rejected. The catalog is deliberately flat, its manifest is 4 fields, and the house rule is "determinism first: policy and code decide structure, AI writes prose only."
- The knowledge graph is a derived rendering, never a source of truth. The original plan had this inverted.
- Promote must edit the brain's manifest **textually** — re-serializing with `JSON.stringify` reformats six hand-formatted context-alias entries and turns a 6-line insert into a 30-line diff. Found during a promote rehearsal on a disposable copy.
- Captures are orthogonal to promotion: the best component-library candidates are labels that already *resolve* (a mature Card or Modal), not novel ones.

Frontmatter: `plan:` → the archived build plan, `pr: pending`, `topics: [skill-authoring, retrospective-workflow, brain-promotion]`.

**(b) The port entry** — this work. Why the wiki exists at all, why the integrity edge is the skill contract rather than a catalog, why the gate composes into `pnpm test` instead of a second workflow, and why Slack stays out. Frontmatter: `plan:` → the archived port plan, `pr: pending`, `topics: [graph-wiki-subsystem]`.

Both entries stay in the 20–50 line budget.

### Topic pages — four

Each with `aliases:` and `covers:`. Every `covers:` path must resolve to a graph node or `evals:graph` fails as a dangling edge; the `repo-script` / `skill-script` / `test` node types above exist precisely so these resolve.

| Topic | `covers:` |
|---|---|
| `skill-authoring` | `skills/_meta/_sections.md`, `CONTRIBUTING.md` |
| `retrospective-workflow` | `skills/project-retrospective/SKILL.md`, `.../scripts/{inventory,resolve,validate-report}.cjs` |
| `brain-promotion` | `skills/project-retrospective/references/brain-integrity-checklist.md` |
| `graph-wiki-subsystem` | `scripts/graph/build-graph.cjs`, `scripts/evals/graph-check.cjs`, `wiki/MECHANICS.md` |

The donor's rule that every first-class `SKILL.md` is covered by ≥1 topic is kept. Each topic opens with a `## Current state` section and a `## Decisions` section; `graph-wiki-subsystem` carries a dated decision bullet for this port, and the other three carry bullets for the build decisions above, each citing its journal entry and archived plan.

### Indexes and generated pages

- `wiki/INDEX.md` — four Topics lines (alphabetical by slug) and two Journal lines (reverse-chronological), one per new file, per the load-bearing format comments in the donor's index.
- `wiki/plans/INDEX.md` — two rows plus the regenerated `Totals:` line.
- `wiki/connections.md` + `wiki/connections/{contract,links,coverage,wiki-wiring}.md` — **generated by `pnpm graph:build`, never hand-written.** They ship in the same delivery because `evals:graph` byte-compares them, and they are excluded from the graph's own nodes so they never become self-referential mega-nodes.

Net: the wiki arrives populated and internally consistent, with `graph:build` and `evals:graph` green over it — not as an empty scaffold to be filled in later.

---

## 4. Docs and tests

- **`AGENTS.md`** — add a "Knowledge graph & context wiki" section; extend the permission boundary (the autonomous zone is currently `skills/` + `scripts/tests/`, which does not cover `scripts/{graph,wiki,evals}/`); state the move-together rule for builder ↔ viewer ↔ tests ↔ docs; state that the graph is derived and never authoritative.
- **`README.md`** — new subsection under "Repository automation", two new workflow rows, and update line 136 (`pnpm test` no longer just `node --test`).
- **`CONTRIBUTING.md`** — a wiki-capture obligation under "The four surfaces move together".
- **New test** `scripts/tests/build-graph.test.cjs`, modelled on `ui-design-evidence`'s (11 tests). Assert: every declared reference and script becomes a `contracts` edge; a SKILL.md reference link with no file on disk **fails the build** (the negative case); every test file gets a `tests` edge; `_meta`'s placeholder link produces no edge; fixtures produce no nodes; no edge dangles; two builds byte-identical; nodes and edges sorted; unknown option exits 2.

**Flagged, not silently done:** `AGENTS.md:53` still says run output defaults to `<Project>/<artifactsRoot>/retrospective/<date>/`, but `SKILL.md:117-118` documents the `Data:` param and "Never inside `Project`". The `audit_note` above records that exact reversal, so the wiki would ship contradicting `AGENTS.md`. It is a one-line fix, but it is a skill-contract statement rather than graph work — say the word and it is in, otherwise it stays as-is.

---

## 5. Verification

1. `pnpm graph:build` exits 0; report node/edge counts by type.
2. **Negative test — the gate must actually fail.** Rename a `references/*.md` that SKILL.md links; confirm `graph:build` exits 1 with a dangling `contracts` edge (and that `pnpm test` fails); revert. Repeat for a script named in SKILL.md. A gate that has never failed is not a gate.
3. `pnpm evals:graph` passes: deterministic rebuild, byte-compare, connections pages fresh, routing policy covers every node and edge type, no dangling endpoints. Then edit a wiki file without rebuilding → confirm FAIL stale → rebuild → PASS.
4. `pnpm graph:view` at `localhost:4175` — screenshot and confirm nodes actually draw and the console is clean, not merely that the server starts.
5. `pnpm test` green (68 existing + the new graph tests + `evals:graph`).
6. `pnpm graph:navigate --intent why --query promote` returns a sane itinerary.
7. Wiki content is complete and wired: `plans/INDEX.md` has **both** rows and `Totals: 2 implemented (2 plans).`; both plan files carry correct frontmatter; `INDEX.md` has 4 Topics lines and 2 Journal lines; each journal entry's `plan:` resolves (a `plan` edge, not a dangling one); every topic `covers:` path resolves; `wiki/connections*` are byte-fresh.
8. **Grep the whole `wiki/` tree for the client name and for `/Users/` to confirm the redaction held.** Maintainer home paths in `source:` frontmatter are donor precedent and stay; a client path is a defect.
9. Read-only review agents over the working tree; report findings.

## 6. Handback

Uncommitted working tree on `feat/knowledge-graph-wiki`, plus a suggested Conventional Commits sequence (`feat(graph): …`, `feat(wiki): …`, `docs(wiki): …`). No commit, push, merge, tag, or PR — here or in any repo the skill touches.

---

## GitHub issue to log manually

**Title:** `[Feature] Port the knowledge-graph + context-wiki subsystem from ui-design-brain`

**Labels:** `enhancement`, `area: graph`, `area:wiki`, `area: tooling` *(the brain uses this exact taxonomy — note `area:wiki` has no space, intentionally mirrored)*

**Body:**

> ### Problem
>
> This repo records *what* changed in `git log` but not *why*. The decisions that shaped it — a flat catalog, a 4-field manifest, no numeric scores, no subagent fan-out, the graph as a derived rendering rather than a source of truth — exist only in a local plan file and a session transcript. The next contributor cannot recover them and will re-litigate them.
>
> There is also no structural gate on the skill's own contract. `SKILL.md` declares nine `references/*.md` and three `scripts/*.cjs`; today only `skill-conformance.test.cjs` checks they exist, and nothing renders that contract as a navigable artifact.
>
> ### Proposal
>
> Port the knowledge-graph + context-wiki subsystem from [`ui-design-brain`](https://github.com/verndale/ui-design-brain), which is already the Slack-free version of it. Third repo, third adaptation (`ui-design-evidence` took the graph half).
>
> **Graph** — zero-dependency deterministic `build-graph.cjs` + vendored Sigma.js viewer, indexing the skill, its references and scripts, `skills/_meta/_sections.md`, the root docs, `scripts/tests/`, and the wiki. Committed `graph.json`, byte-compared by a freshness eval.
>
> **The integrity edge** — this repo has no pattern catalog, so the analogue of the brain's `catalogs` gate is the skill's own contract: `SKILL.md` → every reference it links and every script it names, emitted unconditionally so a missing file fails the build.
>
> **Wiki** — `journal/`, `topics/`, `plans/` with the donor's read protocol and write templates, seeded with the plan this repo was built from (client references redacted — this repo is public), two journal entries, and four topic pages.
>
> **Automation** — `wiki-sync.yml` (PR merge → `bot/wiki-sync/<pr>` PR), `wiki-issue-sync.yml` (nightly issue state), and a non-blocking `.husky/pre-commit` that warns on an uncaptured substantive change and restages the rebuilt graph.
>
> ### Scope notes
>
> - **Slack ingestion stays excluded** — no workflow, script, lib, or env var.
> - **No separate `graph.yml`.** The gate composes into `pnpm test` (`node --test … && pnpm evals:graph`), which `test.yml` already runs.
> - Viewer serves on **4175** so it can run alongside `ui-design-brain` (4173) and `ui-design-evidence` (4174).
> - No new npm dependencies: Node stdlib plus three vendored browser bundles.
>
> ### Acceptance
>
> - [ ] `pnpm graph:build` exits 0; `pnpm evals:graph` passes (deterministic rebuild, byte-compare, no dangling endpoints)
> - [ ] Renaming a `references/*.md` that `SKILL.md` links makes the build **fail** — the gate is demonstrated, not assumed
> - [ ] `pnpm graph:view` renders at `localhost:4175` with nodes drawn and a clean console
> - [ ] `pnpm test` green, and `pnpm graph:navigate --intent why --query promote` returns a sane itinerary
> - [ ] `wiki/plans/INDEX.md` carries the archived-plan row with correct frontmatter
> - [ ] No client name or real client path anywhere under `wiki/`
>
> ### Follow-up (needs repo settings)
>
> Secret `PR_BOT_TOKEN` (classic PAT, `repo` scope) must exist for the two wiki workflows to open their bot PRs.
