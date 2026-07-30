# Wiki feed

How an `analyze` run feeds the client/project knowledge wiki in the `ui-design-evidence` repo. This is Step 6 of the analyze workflow. It runs only when the run lands in that repo; the templates it uses are `references/wiki-client-template.md` and `references/wiki-journal-template.md` (named here in plain text, not linked — references stay one hop deep).

## Contents

- When it runs
- Identity resolution
- meta.json
- Step 6 procedure
- Guardrails

## When it runs

Only when `Output` resolved under a `Data` checkout that is `ui-design-evidence` — i.e. `<Data>/wiki/` sits beside `<Data>/runs/`. When the run landed in the home fallback (no `Data`), do not write the wiki; say: "Wiki not updated — this run is in the home fallback; pass `Data:` (the ui-design-evidence checkout) to feed the client wiki." `meta.json` is still written either way; it is a run artifact.

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

## Step 6 procedure

1. Resolve client identity (above).
2. Upsert `<Data>/wiki/clients/<client-slug>.md` from the client template: create it if absent; otherwise add the project-slug to `projects[]`, the platform to `platforms[]`, any new alias, and a `## Runs` line. Keep these sets additive.
3. Append `<Data>/wiki/journal/<date>-<project-slug>.md` from the journal template — never overwrite. Outcomes are grounded in this run's `resolution.json` counts and the report's `## Candidates`/`## Captures` verdicts.
4. Add exactly one line per new file to `<Data>/wiki/INDEX.md` (Journal always; Clients only when the client page is new). Create a minimal INDEX if it does not exist.
5. Stop and hand back the wiki paths touched alongside the run paths. Do not commit.

## Guardrails

- MUST NOT `git commit`, `push`, `merge`, `tag`, or open a PR for the wiki either — Step 6 ends at a handback.
- MUST write client wiki content only under `<Data>/wiki/`, never into this (public) skill repository.
- MUST be append-only: one journal file per run, additive client pages. Supersede a stale fact with a new entry, not by rewriting an old one.
- MUST NOT invent outcomes. Every journal Outcome traces to the run's `resolution.json` and the report verdicts.
- MUST keep journal and client bodies free of client copy, credentials, and customer data. Client name and platform are permitted (the wiki lives only in the private evidence repo); cite report paths, not payloads.
