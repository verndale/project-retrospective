# Downstream wiki

How `Action: promote` and `Action: capture` author a client-agnostic entry in the downstream repo's own **context wiki**, in the same delivery, without committing. This is the promote/capture counterpart to Step 6's `wiki-feed.md` (which feeds the evidence *client* wiki). The format is owned by the target repo — read its `wiki/MECHANICS.md` and follow its per-capture protocol and templates; this file adds only the data boundary, the skip rule, and how to ground each entry. Other references are named in plain text, not linked; references stay one hop deep.

## Contents

- When it runs
- The data boundary
- Skip rule
- Procedure (both repos)
- promote → ui-design-brain
- capture → ui-design-library
- Grounding each entry
- Guardrails

## When it runs

- **promote** — into the `Brain` checkout, after the catalog edits verify (the checklist's Verification step), before the handback. One entry per promoted proposal.
- **capture** — into the `Library` checkout, after `pnpm contracts` and `pnpm test` pass, before the handback. One entry per component actually written.
- Both — only when `<repo>/wiki/` exists. The entry is part of the same working-tree delivery as the catalog/component change, never a separate commit.

## The data boundary

`ui-design-brain` and `ui-design-library` are shared platform repos, not the private evidence store — the opposite of `wiki-feed.md`, where naming the client is correct. Here the entry MUST be client-agnostic. Enforce it as a positive allowlist, not a blocklist: the run slug is not automatically safe — a real one is `runs/canadian-national/2026-07-26/`, where the slug *is* the client.

- **Safe to cite:** the canonical name/slug; the manifest count delta (e.g. 70 → 71); the platform *adapter key* (`optimizely`) as a generic capability note; the recurrence *count* ("two independent retrospectives"); the de-cliented decision prose; `pr: pending`.
- **Never write:** the client display name; the `runs/<project-slug>/...` slug or a `provenance.source` path quoted in prose; any `declienting` string that names the client or a client repo path, including a client-prefixed *source* token name (e.g. `--cn-brand-red`).
- **Provenance stays in `component.json`.** The run and source already live there inside the library repo; the journal points at `component.json` and does not re-quote the path in prose. Say "a project retrospective", never the run slug — do not make it a per-slug judgement call.

## Skip rule

When `<repo>/wiki/` is absent — an older checkout without the context-wiki subsystem — skip the wiki entry and say: "Wiki not updated — `<repo>` has no `wiki/` (older checkout); pull a checkout with `wiki/` to feed the context wiki." Never create a `wiki/` tree the repo does not already have; the catalog/component apply still completes. If `wiki/` exists but a target topic page does not, write the journal and INDEX line, skip the Decisions bullet, and say so — a promote never creates a topic page.

## Procedure (both repos)

The target repo's `wiki/MECHANICS.md` is authoritative for the journal/topic templates and the "per capture, in the same delivery" protocol. Read it, then:

1. Write `wiki/journal/<date>-<change-slug>.md` from that repo's journal template. `<change-slug>` is **deterministic** and describes the change (per-repo below), never the run's project-slug — that is the evidence-wiki convention and would leak a client-identifying name. Frontmatter `plan: none`, `pr: pending`.
2. Add exactly one `wiki/INDEX.md` **Journal** line, reverse-chronological at the top: `- <date> — [Title](journal/<file>.md) — <hook>.`
3. Update the affected topic page's Decisions section where one applies (brain only — below).
4. Rebuild the connections graph with the repo's own graph build, run from that repo's root — `pnpm graph:build`, or `node scripts/graph/build-graph.cjs` (the per-repo sections below give the exact command). Leave the regenerated `wiki/connections*` and `graph.json` in place; do not hand-edit them.
5. Hand back the wiki paths touched. Do not commit.

**Append-only.** If `wiki/journal/<date>-<change-slug>.md` already exists, do not overwrite or duplicate it; if an INDEX line already names that file, do not add a second; if a Decisions bullet already links that journal file, leave it. The deterministic slug is what lets a re-run detect its own prior write.

## promote → ui-design-brain

Run the brain's own `node scripts/graph/build-graph.cjs` from the `Brain` root — the same command the checklist's Verification step runs. Running it *after* the wiki edit folds the new journal, topic, and INDEX nodes into `wiki/connections*` and re-confirms exit 0. Bar to match: `wiki/journal/2026-07-30-add-stat-pattern.md` and its `topics/component-catalog.md` Decisions bullet.

| Proposal type | `<change-slug>` | Journal title | `topics` | Decisions bullet on `component-catalog.md` |
|---|---|---|---|---|
| new-pattern | `add-<slug>-pattern` | `Add the <Name> pattern` | `[component-catalog]` | Yes — required |
| new-alias | `add-<label>-alias-to-<slug>` | `Add <alias> alias to <Name>` | `[component-catalog]` | Yes |
| guidance-edit | `<slug>-<subject>` | `<Name>: <subject>` | `[component-catalog]` | Only if substantive — a variants block, a cross-reference, a corrected resolution. A pure reword is MECHANICS "do not capture": write no journal at all. |

The Decisions bullet is newest-first, one line, mirroring the stat bullet: `- <date> — Added the **<Name>** pattern (<N-1> → <N>): <generic why> ([journal](../journal/<file>.md)).`

## capture → ui-design-library

One entry per component **actually written** — a `ready` capture that passed `pnpm contracts` and `pnpm test`. Skip a `deferred` (preflight exit 6), `blocked` (exit 1), or `skipped` capture: nothing was written, so an entry would be an invented outcome and a dangling link. `<change-slug>` is `add-<canonical-slug>-component`; title `Add the <Name> component`; `topics: []` — this repo has no per-component catalog topic, and MECHANICS creates a topic page only once two related entries exist. No Decisions bullet.

The graph rebuild is **new work** here: capture verifies with `pnpm contracts` + `pnpm test`, which do not touch the graph. After the last component's journal entry, rebuild from the `Library` root. Prefer `pnpm graph:build` — it resolves from the library's own `package.json`; a bare `node scripts/graph/build-graph.cjs` run from the wrong directory silently rebuilds *this* skill's graph instead, because this repo has a file at the identical path. Bar to match: `wiki/journal/2026-07-30-add-stat-component.md` — match its shape, but per the data boundary do not quote the run path as its line does; point at `component.json` only.

## Grounding each entry

- **promote, from the proposal:** *Why* ← the proposal's `## Evidence` (recurrence count and rubric pass; "no existing canonical covered it", naming the confusable neighbours) — client-agnostic. *What changed* ← the proposal's `## Manifest entry` and integrity delta (canonical added, count N → N+1, aliases-or-none, reciprocal cross-references). *Files* ← the real `git -C <Brain> status --short` set. *Follow-ups* ← consumer pickup, and that the evidence stays in the private evidence store per the data boundary.
- **capture, from the capture file and `component.json`:** *Why* ← the capture's rationale and that the pattern was promoted to the catalog as `<Name>`. *What changed* ← the de-cliented exports, what was dropped as page/brand concern, what was kept verbatim, and the token mappings — all traceable to `declienting`, citing only the semantic destination token, never the client source token. *Files* ← `components/<slug>/{<PascalCase>.tsx,<PascalCase>.stories.tsx,component.json}`. *Follow-ups* ← missing tokens or approximations. Provenance is "in `component.json`", never the run slug in prose.

## Guardrails

- MUST be client-agnostic by the allowlist above — no client display name, no run-slug or source path in prose, no client-naming `declienting` string. This is what separates these shared repos from the private evidence wiki.
- MUST treat the target repo's `wiki/MECHANICS.md` as authoritative for format; this file adds only the boundary, the skip rule, and the grounding.
- MUST skip the entry, with a stated message, when the checkout has no `wiki/`. Never create a `wiki/` tree the repo lacks.
- MUST write a library entry only for a capture actually executed into `components/<slug>/`; skip deferred, blocked, and skipped captures.
- MUST rebuild the connections graph with the repo's own graph build from its root — `pnpm graph:build` for the library, `node scripts/graph/build-graph.cjs` for the brain (the command its verify already runs) — and MUST NOT hand-edit the generated `wiki/connections*` pages.
- MUST be append-only — one journal file per change, never overwritten — and MUST NOT `git commit`, `push`, `merge`, `tag`, or open a PR. The handback ends at the paths touched.
