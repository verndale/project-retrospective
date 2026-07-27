# Wiki Mechanics

Write-side protocol for the context wiki: when to capture, what to write, and the templates. The read-side protocol lives in [INDEX.md](INDEX.md).

## Contents

- Capture trigger
- Per capture, in the same delivery
- Automation
- Generated pages
- Content rules
- Size and pruning
- Templates

## Capture trigger

Capture when a substantive change is delivered to the working tree:

- an executed plan (approved in plan mode, then implemented), or
- a change to the skill (`SKILL.md`, a reference, a script, or the authoring spec), or its tests, or the graph/wiki tooling, workflows, or hooks.

Do not capture: typo fixes, formatting-only changes, dependency bumps, or CHANGELOG/version commits.

## Per capture, in the same delivery

1. Write the journal entry to `journal/YYYY-MM-DD-<slug>.md` (template below).
2. If a plan was executed, archive it with `pnpm wiki:archive-plan <plan.md> --status <status> [--topics <slug>]` (Codex: `--codex-session <session.jsonl> [--codex-plan <id>]`), which copies the plan body verbatim into `plans/YYYY-MM-DD-<slug>.md` with status frontmatter and adds a row to [plans/INDEX.md](plans/INDEX.md).
3. Update the affected topic page's Decisions section. Create a new topic page when at least two related entries exist; before that, journal entries carry the thread.
4. Add exactly one index line per new file to [INDEX.md](INDEX.md) (Journal and/or Topics section).

PR number and commit sha are usually unknown at delivery time (the maintainer commits). Write `pr: pending`; when one journal entry covers a related PR after its original PR has already merged, retain `pr:` and write `follow_up_pr: pending`. The merge automation fills the appropriate field when it is pending (see below).

**This repo is public and the skill reads client repositories.** A plan or journal entry may name what was learned, never who it was learned from. Archived plans are redacted on the way in: no client name, no client repo path, no run output. See the data boundary in [AGENTS.md](../AGENTS.md).

## Automation

Capture is backed by automation under `scripts/wiki/` — a safety net, not a replacement for authoring. When an agent does the work it still writes the entry directly (richer than any stub). The automation catches what a manual or out-of-session commit misses:

- **Merge sync** (`.github/workflows/wiki-sync.yml`): on PR merge, fills `pr: pending` or `follow_up_pr: pending` → the PR URL and derives `issue:` from `Closes #N`. For a substantive PR with no such entry, it writes a deterministic stub marked `draft: ai` (with `WIKI_AI=true`, its Why/What are AI-drafted and discarded unless grounded in the real diff); appends a topic Decisions bullet; and — when the PR body or a filled journal entry's `plan:` field names an archived plan — completes its `plans/INDEX.md` row and back-fills the plan file's own `evidence:` frontmatter with the PR. It lands as a one-click `bot/wiki-sync/<pr>` PR — never a direct push to main.
- **Pre-commit warn** (`.husky/pre-commit`): reminds when a substantive commit stages no journal entry, and when a local plan looks executed but unarchived. Also rebuilds and stages the knowledge graph. Never blocks.
- **Nightly issue sync** (`.github/workflows/wiki-issue-sync.yml`): marks issues cited under a topic's Open threads with ` — closed` once they close.

`draft: ai` on an entry means it was auto-drafted and needs a human pass — replace the `TODO: why` line with the real reasoning and drop the marker.

**Executed plans enter locally** (CI cannot access local agent stores): archive an approved plan at execution with `pnpm wiki:archive-plan` (see above). `pnpm wiki:find-plans` is the explicit recovery backstop for Claude plan directories and live Codex sessions; with `--archive`, it files candidates as `not-verified`. Codex archives carry a stable `codex-session:<session>#<line>:<block>:<plan>:<digest>` source and add that digest to their archive filename, so same-title plans never overwrite each other. The pre-commit hook never scans Codex sessions.

## Generated pages

The knowledge graph renders a set of machine-generated connection pages — the exception to the closed set of authored page types:

- [connections.md](connections.md) — a small index that routes to per-section files under `wiki/connections/`: [skill contract](connections/contract.md), [coverage](connections/coverage.md), [document links](connections/links.md), [wiki wiring](connections/wiki-wiring.md) — all rendered from the knowledge graph by [`scripts/graph/build-graph.cjs`](../scripts/graph/build-graph.cjs). **Do not hand-edit them.** They are rebuilt + staged by `.husky/pre-commit`, staged by the wiki bots, and verified byte-fresh by `pnpm evals:graph`; an edit that isn't a rebuild fails CI. To change them, change the skill or wiki and run `pnpm graph:build`.

The pages are deliberately excluded from the graph's own nodes so they never become self-referential mega-nodes.

## Content rules

- Record the why and what was ruled out — the parts `git log` and CHANGELOG.md cannot tell you. Link to commits/PRs instead of duplicating them.
- Topic frontmatter is part of navigation: `aliases` lists grounded natural-language lookup terms, and `covers` lists exact repo-relative surfaces the topic explains (a reference, a script, a doc). Covered paths must resolve to a graph node — a stale path fails `pnpm evals:graph` as a dangling edge.
- Plain statements, no emphasis language. H2/H3 headers only.

## Size and pruning

- Journal entries: target 20–50 lines. Topic pages: budget ~150 lines.
- Topic pages: prune superseded Decisions bullets rather than annotating them as done; the pruned detail stays recoverable via the journal entry the bullet linked.
- INDEX.md Journal section: when it exceeds ~100 lines, roll the oldest year's lines into `journal/ARCHIVE-<year>.md` (same line format) and leave one `Older:` pointer line.
- Any wiki file over 100 lines opens with `## Contents` right after the H1 + purpose line.

## Templates

### Journal entry

```markdown
---
date: YYYY-MM-DD
topics: [<topic-slug>]              # topic slugs touched, or []
plan: plans/YYYY-MM-DD-<slug>.md    # or none
pr: https://github.com/verndale/project-retrospective/pull/NNN   # or pending
follow_up_pr: https://github.com/verndale/project-retrospective/pull/NNN   # optional; or pending
---
# <Title>

## Why
<the problem/motivation — the part git can't tell you; 2–6 bullets>

## What changed
<decision-level summary, not a diff; include what was ruled out and why, if anything>

## Files
<key paths only>

## Follow-ups
<open threads; omit the section if none>
```

### Topic page

```markdown
---
aliases: [<grounded lookup phrase>, <entrypoint or subsystem name>]
covers: [skills/project-retrospective/<exact runtime path>, <other exact runtime path>]   # optional
---
# <Subsystem> — Design History

<one-line purpose>

## Current state
<5–15 bullets: how it works now, linking into the skill or tooling>

## Decisions
- YYYY-MM-DD — <decided X over Y because Z> ([PR #N](url), [plan](../plans/<file>.md), [journal](../journal/<file>.md))

## Open threads
<unresolved questions / open issues; omit the section if none>
```

Decisions are newest-first, one bullet per decision.

### Archived plan frontmatter

Prepended to the verbatim plan text (written by `pnpm wiki:archive-plan`):

```markdown
---
status: implemented | partial | not-implemented | superseded | out-of-scope
executed: YYYY-MM-DD            # or n/a
evidence: ["PR #N", "commit <sha>", ...]
source_tool: claude | codex | file
source: <original path on disk or codex-session:<session>#<line>:<block>:<plan>:<digest>>
topics: [<topic-slug>]
---
```

### plans/INDEX.md row

```markdown
| YYYY-MM-DD | [<title>](<file>.md) | <status> | <evidence, comma-separated> | <topic slugs> |
```
