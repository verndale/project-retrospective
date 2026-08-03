# Wiki feed

How an `analyze` run feeds the client/project knowledge wiki in the `ui-design-evidence` repo. This is Step 6 of the analyze workflow. It runs only when the run lands in that repo; the templates it uses are `references/wiki-client-template.md` and `references/wiki-journal-template.md` (named here in plain text, not linked — references stay one hop deep).

## Contents

- When it runs
- Identity resolution
- meta.json
- Project-memory archive
- Step 6 procedure
- Guardrails

## When it runs

Only when `Output` resolved under a `Data` checkout that is `ui-design-evidence` — i.e. `<Data>/wiki/` sits beside `<Data>/runs/`. When the run landed in the home fallback (no `Data`), do not write the wiki; say: "Wiki not updated — this run is in the home fallback; pass `Data:` (the ui-design-evidence checkout) to feed the client wiki." `meta.json` is still written either way; it is a run artifact. So is `memory-archive.json` — the project-memory archive's manifest (below) — though the near-raw copy and its digest land in `<Data>/wiki/memory/` only under the evidence checkout.

## Identity resolution

The run already chose a **project-slug** (the `runs/<project-slug>/<date>/` directory). Step 6 also resolves a **client**, which is distinct — one client may own several project-slugs.

- **Client display name**: the `Client` input if given; else the client name in the report H1 (`# Project retrospective — <name> (<platform>)`); else the humanized project-dir basename, flagged `nameSource: "project-dir"`.
- **Client-slug**: `kebab(Client)` if `Client` given; else `kebab(display name)` — but first check existing `<Data>/wiki/clients/*.md`: if one already matches this client (by `slug` or `aliases`, or already lists a sibling project-slug for it), reuse that client-slug. The client-slug is not the project-slug.
- **Platform**: `platform` = `inventory.json → config.stackAdapter` (the adapter key, e.g. `optimizely`); `platformDisplay` = the H1 parenthetical. Both `null`/`"unknown"` when there is no adapter.

## meta.json

Write `runs/<project-slug>/<date>/meta.json` in Step 4 (the model writes it — the deterministic scripts stay client-agnostic). `validate-report.cjs` checks it at `full` and `candidates` scope.

```json
{
  "schemaVersion": 1,
  "date": "<YYYY-MM-DD>",
  "scope": "full",
  "client": { "name": "<Client>", "slug": "<client-slug>", "nameSource": "input|h1|project-dir" },
  "project": { "name": "<Project>", "slug": "<project-slug>", "path": "<abs path, optional>" },
  "platform": "<adapter-key or null>",
  "platformDisplay": "<Platform display or null>",
  "priorReports": ["runs/<slug>/<date>/report.md"]
}
```

`project.slug` and `date` MUST equal the run's own directory. One `project.slug` maps to exactly one `client.slug`.

## Project-memory archive

A completed project's `artifacts/memory/` (architecture, caveats, conventions, component notes — durable engineering knowledge the pipeline generated) is otherwise read only to name-match components, then dropped. Preserve it, near-raw, before the project is archived. It is produced in **Step 4** so the `memory-archive.json` manifest lands in `Output` before the Step 5 validator; the copy and digest are gated on the evidence checkout exactly like the rest of the wiki.

`archive-memory.cjs` resolves the artifacts root from `build.config.json` the same way `inventory.cjs` does, walks `<artifactsRoot>/memory/**` (the shards only — the `MEMORY.md` index is navigation, not memory content, so it is **not** preserved; the Step 6 digest carries any navigation), **skips empty placeholder shards** (frontmatter + heading only — a migration leaves these for topics the project never filled in; they land in the manifest's `skippedEmpty`), and always writes the manifest to `Output`:

```bash
node <skill>/scripts/archive-memory.cjs --project <Project> \
  [--archive <Data>/wiki/memory/<client-slug>/<project-slug>/source] \
  --out <Output>/memory-archive.json --pretty
```

- **Under a `Data` = ui-design-evidence checkout** — pass `--archive` (using `meta.json`'s `client-slug`). The memory is byte-copied near-raw into `<Data>/wiki/memory/<client-slug>/<project-slug>/source/`; the manifest reports `status: archived`. Then author `index.md` beside `source/` (Step 6): a cleaned-up, fuller paraphrase of the memory that reads well — comprehensive, not the terse `## What we know` bullets — and link it from the client page.
- **Home fallback (no evidence checkout)** — omit `--archive`. Nothing is copied; the manifest reports `status: skipped-no-data` (memory found, not preserved) or `no-memory`, and `validate-report.cjs` warns `memory-not-preserved` so the gap stays visible.

`validate-report.cjs` fails `memory-archive-missing` when inventory shows memory but no manifest exists — the archive step is not optional.

**Fidelity carve-out.** The `source/` copy is verbatim and `index.md` is a fuller paraphrase — both permitted **only because they live in the private, client-scoped evidence repo**, never in this public repo or the client-agnostic downstream repos. They carry engineering knowledge only; end-customer PII is out of scope by the nature of `artifacts/memory/`. This does not relax the `## What we know` rule — those bullets stay a summary.

## Step 6 procedure

1. Resolve client identity (above).
2. Upsert `<Data>/wiki/clients/<client-slug>.md` from the client template: create it if absent; otherwise add the project-slug to `projects[]`, the platform to `platforms[]`, any new alias, and a `## Runs` line. Keep these sets additive. Distil the analyzed project's `artifacts/memory/*.md` — architecture and platform decisions, known issues and caveats, naming and coding conventions — into durable `## What we know` bullets: summarize in your own words, attribute to the project memory, and carry only what a sibling project would benefit from. Link the per-project memory archive (`../memory/<client-slug>/<project-slug>/`) from the client page, and author its `index.md` digest (see Project-memory archive).
3. Append `<Data>/wiki/journal/<date>-<project-slug>.md` from the journal template — never overwrite. Outcomes are grounded in this run's `resolution.json` counts and the report's `## Candidates`/`## Captures` verdicts.
4. Add exactly one line per new file to `<Data>/wiki/INDEX.md` (Journal always; Clients only when the client page is new). Create a minimal INDEX if it does not exist.
5. Stop and hand back the wiki paths touched alongside the run paths. Do not commit.

## Guardrails

- MUST NOT `git commit`, `push`, `merge`, `tag`, or open a PR for the wiki either — Step 6 ends at a handback.
- MUST write client wiki content only under `<Data>/wiki/`, never into this (public) skill repository.
- MUST be append-only: one journal file per run, additive client pages. Supersede a stale fact with a new entry, not by rewriting an old one.
- MUST NOT invent outcomes. Every journal Outcome traces to the run's `resolution.json` and the report verdicts.
- MUST keep journal and client bodies free of client copy, credentials, and customer data. Client name and platform are permitted (the wiki lives only in the private evidence repo); cite report paths, not payloads. The client page's `## What we know` bullets are a summary of durable engineering knowledge — never verbatim. The project-memory archive (`wiki/memory/…`) may hold the memory near-raw (`source/`) and a fuller `index.md` paraphrase, but it too carries engineering knowledge only — never client copy, credentials, or customer data.
