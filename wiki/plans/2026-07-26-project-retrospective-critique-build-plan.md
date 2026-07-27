---
status: implemented
executed: 2026-07-26
date: 2026-07-26
evidence:
  - "commit caebd12"
  - "commit 012a6f0"
source_tool: claude
source: "/Users/joe.fusco/.claude/plans/users-joe-fusco-desktop-project-retrosp-fancy-lantern.md"
topics: [skill-authoring, retrospective-workflow, brain-promotion]
audit_note: "Slices 1-3 shipped and are covered by the test suite. Deltas: the deferred Slice 4 cross-project graph did not land here - it shipped in the private ui-design-evidence repo instead, and the plan's single 'separate private data repo' became two (ui-design-library for implementations pulled into client projects, ui-design-evidence for runs and the graph, consumed by nothing) so one client's build can never contain another client's evidence. The plan's in-project Output: default was also reversed: the analyzed project is now strictly read-only. Archived body redacted for the public-repo data boundary - client name and client repo path replaced with placeholders."
---
# project-retrospective — critique + build plan

## Context

The plan doc (`~/Desktop/project-retrospective-plan.md`) proposes a "Frontend Platform Intelligence System": a `project-retrospective` skill that mines completed frontend projects for knowledge to promote into ui-design-brain. The vision is sound and is **kept**: projects are temporary, knowledge is permanent; the brain stays the canonical vocabulary layer; evidence before recommendations; human approves everything.

But the proposal was written without knowledge of how the three repos actually work. After full inspection of ui-design-brain, ai-orchestration, and a completed pipeline project, most of the proposed machinery either already exists or contradicts the brain's own philosophy. This plan replaces the machinery while preserving the vision.

Target: the empty public repo `verndale/project-retrospective` (local: `/Users/joe.fusco/Projects/@verndale/project-retrospective`, currently empty, not yet a git repo).

## Critique — incorrect assumptions in the original proposal

1. **"Knowledge graph becomes the source of truth for relationships."** Inverted. Both repos already have knowledge graphs (brain: 94 nodes; ai-orchestration: 500 nodes) built by the same house pattern: zero-dep `build-graph.cjs`, deterministic, zero-LLM, byte-compare-validated in CI, vendored Sigma.js viewer. In this ecosystem the graph is a *derived rendering* of files — never a source of truth. Files (manifest, patterns, reports) are truth.
2. **"Shared Component Repository."** Doesn't exist. The brain deliberately contains zero implementation; implementations live in projects. Creating a shared component repo is a separate org decision the retrospective must not depend on. Reusable API surface is already captured without code extraction (per-component `fingerprint.json` + build packs).
3. **20 subagents.** Contradicts the house philosophy ("Determinism first — policy and code decide structure; AI writes prose only") and Anthropic skill best practices. Discovery/resolution/validation are deterministic scripts; LLM judgment is needed only for triage + prose drafting. One skill, phased workflow, 3 scripts.
4. **27-field Canonical Artifact Model.** The brain's manifest is 4 fields (`name, slug, aliases, file`) by design — consumer-evidenced minimalism. A 27-field model is a brain redesign, which the proposal itself forbids. Evidence lives in retro reports, not brain metadata.
5. **Primitives/Components/Modules/Layouts taxonomy.** The brain catalog is deliberately **flat** (70 patterns, no tiers; Hero and FAQ-class things are already just patterns). Bucket evidence (ui vs rendering) comes free from `build.config.json` `componentBuckets` and is recorded as evidence — no taxonomy imposed on the brain.
6. **Numeric promotion/architectural/confidence scores.** Uncalibrated numbers = noise. The brain's actual promotion precedent (catalog 65→70) was: count high-frequency **unresolved labels** across consumer repos, require consumer-evidenced naming, PR with evidence. Verdicts here are Promote / Watch / Reject with cited evidence.
7. **"Synchronization engine" / migration/implementation planners.** The delivery chain already exists: brain → daily GitHub Actions cron (`sync-ui-design-brain.yml`, note: **daily**, not weekly — the workflow's "weekly" header comment is stale) → re-vendor → PR on drift → ai-orchestration → submodule bump → projects. The retro plugs into the *front* of this chain and touches none of it.
8. **Mining raw code as primary evidence.** Pipeline projects already emit normalized evidence: `artifacts/build-packs/<slug>/` (DOM contract, tokens, a11y, AC), `component-index.json`, `fingerprint.json`, `memory/` shards. Artifacts-first; code-scan is the degraded mode for pre-pipeline projects.
9. **"Brain contains Markdown documentation only."** It also has ~3,100 lines of Node tooling, a committed graph, six workflows, and the manifest JSON that actually drives resolution. The retro must respect its real invariants (below), not just its prose.

**What belongs where** (proposal deliverable #4): brain = canonical vocabulary + pattern guidance + aliases; ai-orchestration = CMS/adapter/rule/validator knowledge (drafts only, human carries them over); project repo = everything client-specific + all retro run outputs; this new repo = the skill only, versioned, zero client data (it is public).

## Decisions locked (Joe, 2026-07-26)

- **Standalone versioned skill repo**; a separate repo for "everything else" (cross-project data) later — outputs are relocatable via an `Output:` param, defaulting into the analyzed project's artifacts dir. Nothing client-derived is ever committed to this public repo; test fixtures synthetic.
- **Build scope: slices 1–3** (scaffold+toolchain, analyze skill, promote step). Slice 4 (cross-project Sigma graph, house pattern, local-only data) deferred; schema sketched in Roadmap below.
- **Invocation: user-level install, param-driven** (`Project:`/`Brain:` paths). Zero footprint in client repos.
- **ai-orchestration routing: paste-ready drafts only**, following its `_rule-sections.md` spine; never applied automatically.

## Architecture

```
completed project (artifacts/, components, memory)
        │  /project-retrospective  Action: analyze
        ▼
scripts: inventory.cjs → resolve.cjs (vs brain patterns-manifest.json)
        ▼
LLM triage (evidence-rubric) → report.md + proposals/*.md + orchestration-drafts.md
        │  human review
        ▼
/project-retrospective  Action: promote  Proposal: <path>  Brain: <local checkout>
        ▼
edits brain working tree per 5-point catalog-integrity checklist → verify → STOP
        │  Joe: pnpm commit (ai-commit) + pnpm pr:create (ai-pr) in the brain repo
        ▼
existing daily uidb-sync cron → ai-orchestration → submodule bump → next projects
```

Existing mechanisms reused, not rebuilt: brain manifest resolution semantics (name → alias → context-alias; unresolved = novel, **no fuzzy matching**), brain graph build as promote verification, ai-commit/ai-pr as the commit/PR mechanism, the daily sync as distribution.

## Implementation

### Slice 1 — repo scaffold + toolchain (donor: ui-design-brain)

```
project-retrospective/
├── .github/pull_request_template.md        [copy-adapt donor]
├── .github/workflows/commitlint.yml        [copy verbatim]
├── .github/workflows/pr.yml                [copy-adapt: GH_TOKEN → ${{ secrets.PR_BOT_TOKEN || github.token }} fallback]
├── .github/workflows/release.yml           [copy verbatim]
│      (NO graph/wiki/uidb workflows)
├── .husky/commit-msg                       [verbatim: pnpm exec ai-commit lint --edit "$1"]
├── .husky/prepare-commit-msg               [verbatim: pnpm exec ai-commit prepare-commit-msg "$1" "$2"]
│      (NO pre-commit — donor's is wiki/graph-specific)
├── scripts/commit-pr/semantic-release-structured-notes.cjs  [copy verbatim — required by .releaserc.cjs]
├── scripts/tests/                          [new, slice 2]
├── skills/_meta/_sections.md               [new: this repo's skill-authoring spec, adapted from
│                                            ai-orchestration _skill-sections.md; codifies: inline 3-attempt
│                                            retry cap (no _shared/retry-contract here), synthetic-fixtures-only rule]
├── skills/project-retrospective/           [slice 2]
├── .releaserc.cjs                          [verbatim: branches ['main'], npmPublish:false, structured-notes plugin]
├── .env-example .gitignore .npmrc .nvmrc   [copy; .gitignore += retrospective-output/ guard]
├── AGENTS.md                               [new ~100 lines: repo purpose, env, skill-integrity rule
│                                            (SKILL.md ↔ references ↔ scripts ↔ tests move together;
│                                            validate-report.cjs is the sanctioned validator), data boundary
│                                            (public repo — no client data ever), commits are maintainer's job]
├── CLAUDE.md                               [verbatim donor shim: @AGENTS.md]
├── CONTRIBUTING.md                         [copy-adapt: drop wiki/graph/consumer-sync sections; add no-client-data rule]
├── LICENSE                                 [verbatim MIT]
├── README.md                               [new: purpose, ecosystem diagram, install via skills CLI, invocation]
├── package.json                            [adapt below]
└── pnpm-lock.yaml                          [from pnpm install]
```

package.json: name `@verndale/project-retrospective`, private, version 0.0.0 (semantic-release owns it), `packageManager: pnpm@10.33.0`, `engines.node >=24.14.0` (lockstep with .nvmrc `24.14.0` + workflow pins). Scripts kept from donor: `prepare`, `commit` (=`ai-commit run`), `pr:create` (=`ai-pr`), `lint:commits:last`, `release:dry`. Added: `test` (=`node --test scripts/tests/`), `retro:inventory|resolve|validate` dev conveniences. devDependencies identical to donor: `@verndale/ai-commit ^2.6.3`, `@verndale/ai-pr ^1.3.5`, `@commitlint/cli`, semantic-release stack, husky, dotenv.

Setup: `git init -b main` + `git remote add origin git@github.com:verndale/project-retrospective.git` (init/remote only — **no commits/pushes by Claude, ever; Joe owns all git-mutating actions**).

### Slice 2 — the skill (analyze path)

`skills/project-retrospective/` = `SKILL.md` + `README.md` (operator docs) + `references/` (8 files) + `scripts/` (inside the skill dir so vendoring carries them).

**SKILL.md** — conforms to ai-orchestration `_meta` spine AND Anthropic best practices (frontmatter name+description only; third-person description ≤1024 chars with trigger terms; body ~180 lines with `## Contents`; sections: Use when / First-hop references / Workflow / Inputs and outputs / Validation loops / Guardrails). Draft description:

> Analyzes a completed frontend project repository and mines it for promotable architectural knowledge. Inventories the components that were built (from pipeline artifacts — build packs, component-index, fingerprints, project memory — or a degraded code scan), resolves every component label against the ui-design-brain patterns manifest, triages unresolved labels into Promote / Watch / Reject candidates with cited evidence, and drafts brain-format pattern and alias proposals plus paste-ready ai-orchestration rule drafts. With Action promote, applies one approved proposal to a local ui-design-brain checkout following the catalog-integrity checklist and stops before committing. Use when a project wraps and the user wants a retrospective, pattern harvest, catalog gap analysis, alias audit, or to promote a pattern or alias into ui-design-brain.

**Param block:** `Project:` (required, abs path) · `Brain:` (optional; required for promote; must contain `skills/ui-design-brain/patterns-manifest.json`) · `Output:` (default `<Project>/<artifactsRoot|artifacts>/retrospective/<YYYY-MM-DD>/`) · `Scope: full|inventory|candidates` · `PriorReports:` (paths; cross-project recurrence elevates Watch→Promote) · `Action: analyze|promote` · `Proposal:` (promote only).

**Workflow (analyze):** 0 validate inputs, write phase checklist → 1 `inventory.cjs` (surface `warnings` verbatim; `mode: code-scan` → read `code-scan-mode.md`) → 2 `resolve.cjs` (ambiguous context-aliases: model confirms from usage evidence — build pack, fingerprint affordance/role — or demotes to unresolved; never guesses) → 3 triage per `evidence-rubric.md` → 4 draft report + proposals + orchestration-drafts → 5 `validate-report.cjs` self-check, ≤3 repair attempts then report-and-stop.

**Guardrails (core):** never run git commit/push/tag anywhere; no fuzzy matching; child-part names never proposed as aliases; aliases require consumer evidence; hard exclusions never promoted (pages, business logic, auth, checkout, search APIs, commerce, routing, client workflows, client branding); writes only inside `Output` (analyze) / brain working tree (promote); client data never committed to this repo.

**references/** (one hop, per ai-orchestration conventions — templates positional, conditional docs open with `## Use when`):

| File | Content |
|---|---|
| `report-template.md` | Frozen H2 set (validate-report checks): Run / Summary / Inventory / Resolution / Candidates (each `### <Label>` + `Verdict:` line + evidence paths) / Learnings / Gaps / Next steps. No numeric scores. |
| `evidence-rubric.md` | Promote bar (reusable UI vocabulary + ≥2 independent evidence sources in-project OR 1 + PriorReport recurrence + client-neutral describable + not resolvable as existing canonical/variant); Watch; Reject (exclusions, thin wrappers, one-offs); alias rules (consumer-evidenced, never child parts, context-scoped only when label demonstrably maps to 2 canonicals); variant rule (documented misresolution incident only — precedent: pill-tabs); recurrence elevation. |
| `proposal-new-pattern-template.md` | Proposal type / Pattern draft (fenced block in brain `_sections.md` shape: H2 name, optional Also-known-as with `  ·  `, 1-sentence definition, optional cross-refs/child-parts, `**Best practices:**` ~6 bullets ≥1 a11y, `**Common layouts:**` ~4, closing `---`) / Manifest entry (fenced JSON `{name,slug,aliases,file}`, slug==kebab(name)) / Evidence / Integrity checklist delta / Suggested commit. |
| `proposal-new-alias-template.md` | Type / Target canonical / Alias (string or `{name,context}` + parenthetical) / Consumer evidence / Edits (manifest position, Also-known-as rewrite, index context-table rows incl. counterpart when label becomes ambiguous) / Suggested commit. |
| `proposal-guidance-edit-template.md` | Type / Target file(s) / Edit (before→after; variants heading verbatim `**Visual variants (orthogonal to ARIA):**`) / Incident evidence / Cross-reference reciprocity / Suggested commit. |
| `brain-integrity-checklist.md` | Promote mechanics (below). |
| `orchestration-draft-template.md` | Draft shell per ai-orchestration `_rule-sections.md` spine (Purpose / Critical Rules / body with RFC-2119 / Guardrails / Examples) + suggested destination path + footer: "Paste-ready draft — apply via ai-orchestration's own contribution flow; never applied automatically." |
| `code-scan-mode.md` | Opens `## Use when` (inventory `mode: code-scan`). Heuristics, what counts as evidence, Gaps recording, confidence downgrade: code-scan-only evidence caps candidates at **Watch** unless a PriorReport supplies the second source. |

**scripts/** (zero-dep Node CJS in `skills/project-retrospective/scripts/`, shared `lib/util.cjs`):

- `inventory.cjs --project <path> [--out <file>] [--pretty]` — reads `build.config.json`, `component-index.json`, `build-packs/*` (dir-style `<slug>/master.md` AND legacy flat `<slug>.md` — the reference project has both), per-component `fingerprint.json` (disk wins over index `null`), `memory/` shard names, `design-facts/*`, `ship-log.jsonl` line count. `mode: artifacts` when index or packs exist, else `code-scan` (componentBuckets when config present, else heuristic probe of `src/components`, `components`, `src/ui`, `app/components`). Output `{schemaVersion:1, mode, config, components[{name,folder,bucket,domain,path,sources[],buildPack,fingerprint}], evidence, warnings[{code,message}]}`. Warnings never crash (solve-don't-defer). Exit: 0 ok/degraded, 2 usage, 3 bad project path, 1 unexpected.
- `resolve.cjs --inventory <file> (--brain <dir>|--manifest <file>) [--out] [--pretty]` — exact matching after normalization (lowercase, camelCase-boundary split, collapse spaces/underscores to `-`; **no stemming/plural folding**): name → plain alias → object alias (single owner → resolved with context; multiple owners e.g. Banner→Alert|Hero → `ambiguous:true` + candidates, script never picks). Unresolved grouped by normalized label with occurrences + locations; **no nearest-match suggestions**. Output `{schemaVersion:1, manifest:{path,entries}, resolved[], unresolved[], counts, warnings}`. Exit: 0/2/3 (inventory)/4 (manifest invalid)/1.
- `validate-report.cjs --output <dir> [--scope] [--no-brain] [--manifest <file>] [--json]` — required-file matrix per scope; JSON schema checks; report frozen-H2 + one `Verdict: (Promote|Watch|Reject)` per candidate; Promote↔`proposals/<kebab(label)>.md` parity; per-type proposal section checks (new-pattern: manifest JSON parses, slug==kebab(name), file==`patterns/<slug>.md`, draft starts `## <Name>` ends `---`, ≥1 a11y bullet; `--manifest` → slug/name collision = failure, alias dup = warning); exclusion-pattern match = warning not failure; drafts contain Purpose + Guardrails. PASS/FAIL lines (skills-lint style). Exit: 0 pass, 1 fail, 2 usage, 3 missing dir.

### Slice 3 — promote path

`references/brain-integrity-checklist.md`, formatting invariants: manifest alphabetical by `name`, entries exactly `{name,slug,aliases,file}`, aliases alphabetical (objects by `name`), 2-space indent; Also-known-as mirrors **manifest order**, `  ·  ` separated, context aliases carry short parentheticals (e.g. `CTA (in-page action)`); `slug == kebab(name) == filename`; H2 matches manifest name verbatim; file ends `---`; index.md canonical list alphabetical + context table synced; README pattern count updated at **every occurrence** (currently 3 spots incl. `accordion.md … wizard.md` range endpoints).

Ordered edits — **new-pattern:** write `patterns/<slug>.md` → manifest insert (alpha) → index.md list insert → context-table rows if object aliases → README counts. **new-alias:** manifest aliases insert (alpha, object form if context-scoped) → rewrite pattern Also-known-as line → context-table rows both canonicals if label now ambiguous. **guidance-edit:** pattern file edit only + reverse cross-reference edit (bidirectionality is a hard brain constraint).

Verification: `node scripts/graph/build-graph.cjs` from brain root (fails on dangling manifest→file edge — the brain's sanctioned validator; regenerated graph/connections files are left in place, brain's own pre-commit re-stages them). ≤3 fix attempts, then revert guidance + stop.

Handback (exact stop point — **never commits**): edited-file list (`git -C <Brain> status --short`), verification result, suggested commit per brain history style (`feat(ui-design-brain): Add <Name> pattern` / `feat(ui-design-brain): Add <alias> alias to <Name>` / `docs|fix(ui-design-brain): <Subject>`), note to run `pnpm commit` inside the brain.

### Tests (slice 2, extended in 3)

`scripts/tests/` node:test; fixtures 100% synthetic: `fake-project/` (5 components covering name-match, alias-match, context-ambiguity Banner→Alert|Hero, novel×2-locations, excluded `checkout-panel`; dir-style AND flat build packs; fingerprint on disk with index `null`), `fake-project-bare/` (code-scan heuristic), `fake-brain/` (4-entry manifest), `fake-output/` (one golden analyze output set; broken variants generated into tmpdir at runtime). Suites: `inventory.test.cjs`, `resolve.test.cjs` (incl. `cards`≠`card` no-plural-folding assertion), `validate-report.test.cjs` (golden passes + per-mutation failures), `skill-conformance.test.cjs` (self-lint port of skills-lint checks: name regex, no reserved words, description ≤1024 third-person no-XML, body <500 lines, `## Contents` >100 lines, no backslash paths).

## Verification

- **Slice 1:** `pnpm install` clean on Node 24.14.0; `printf 'feat(scaffold): Add repo toolchain\n' | pnpm -s exec commitlint --config node_modules/@verndale/ai-commit/lib/commitlint-preset.cjs`; `node -e "require('./.releaserc.cjs')"`; `pnpm release:dry` reaches auth (config parses). Hand back for Joe's first commit (`pnpm commit` — dogfoods ai-commit; hooks fire there).
- **Slice 2:** `pnpm test` green; smoke: inventory→resolve→validate chain against synthetic fixtures exits 0.
- **Slice 3:** real analyze against a completed pipeline project (`<Project>`) with `Brain: /Users/joe.fusco/Projects/@verndale/ui-design-brain`, output into that project's artifacts (local only; **not** committed by Claude); outputs pass validate-report; promote rehearsal against a disposable **copy** of the brain checkout in the scratchpad — apply a proposal, `node scripts/graph/build-graph.cjs` exits 0, inspect `git status --short`, discard copy. Brain repo itself untouched.
- **Final:** launch read-only review agent(s) over the working tree per Joe's workflow; report findings. Deliver as uncommitted working tree + suggested Conventional Commits sequence (e.g. `feat(scaffold): …`, `feat(project-retrospective): Add analyze workflow…`, `feat(project-retrospective): Add promote workflow…`). Joe commits/pushes; CI (commitlint/pr/release workflows) validates post-push.

## Post-push checklist (Joe — Claude cannot do these)

1. GitHub default branch `main` (releaserc + workflows assume it).
2. Secret `PR_BOT_TOKEN` (classic PAT, `repo` scope) for pr.yml; optional `PR_AI*` vars/secret, `RELEASE_NOTES_AI*`.
3. Actions → workflow permissions allow write (release commits CHANGELOG/tag).
4. Optional local `.env` with `OPENAI_API_KEY` for ai-commit AI messages (falls back safely without).
5. First `feat:` commit is what cuts v1.0.0 via semantic-release.

## Risks / flagged decisions

- **normalizeLabel splits camelCase** (`StatusChip`→`status-chip`) — slightly beyond "case/spacing only" but without it PascalCase index names never match multi-word canonicals. No stemming/plurals ever.
- **Context-alias ambiguity**: script surfaces candidates; model confirms from usage evidence or demotes to unresolved — mirrors the brain's own resolver rule ("if the context is unclear, treat the name as novel").
- **pr.yml fallback** `PR_BOT_TOKEN || github.token` deviates from donor to avoid red CI before the secret exists.
- **skills CLI user-level install flag** for `~/.claude/skills` to be confirmed against the current vercel-labs CLI when writing the README install section (donor script installs cwd-relative; do not fabricate a flag).
- Historical projects may have artifact shapes beyond the reference project's two build-pack styles — warnings + Gaps section is the escape hatch.
- `dotenv` kept (donor parity for ai-commit `.env` flow); candidate for later trim.

## Roadmap (deferred)

- **Slice 4 — cross-project graph:** port house `build-graph.cjs` + vendored Sigma viewer into this repo; ingests N `inventory.json`/`resolution.json` files (paths via args) + brain manifest. Nodes: project, component, pattern, candidate; edges: resolves-to, novel-in, proposes, evidenced-by. Data dir gitignored (public repo) — generated locally on demand. Same determinism/byte-compare eval pattern.
- **Separate private data repo** ("everything else"): becomes the standing `Output:`/`PriorReports:` home + where the graph reads from; no design changes needed here thanks to path params.
- Token-architecture knowledge (primitives/semantic conventions à la the reference project's `tokens/*.css`) recorded as evidence now; whether the brain grows a token section is a human call fed by that evidence.
