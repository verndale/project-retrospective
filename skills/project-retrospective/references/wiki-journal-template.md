# wiki journal entry template

The per-run event page in `ui-design-evidence`, at `wiki/journal/<date>-<project-slug>.md`. One per run, append-only — never overwrite. Written by Step 6 (see `references/wiki-feed.md`).

## Template

```markdown
---
date: <YYYY-MM-DD>
client: <client-slug>
project: <project-slug>
platform: <adapter-key, or unknown when the run has no adapter — never "none">
run: runs/<project-slug>/<date>/
prior_run: <same-client previous run, e.g. runs/<slug>/<date>/, or none>
pr: pending
---
# <Client display name> — <project-slug> (<date>)

## What happened
<2–4 plain statements grounded in the report Summary: mode, counts, the headline>

## Outcomes
- Promoted: <label(s)> — `proposals/<slug>.md`   (or none)
- Watched: <label(s)>                             (or none)
- Rejected: <count>, in <k> groups
- Captured: <Canonical> — `captures/<slug>.md`    (or none)
- Specs: <N approved, M matched as-built, K spec-only>   (or none — no Specs input)
- Team retrospectives: <N included, M excluded, K actions; U need owners>   (or none — no Retrospectives input)

## Links
- Report: ../../runs/<project-slug>/<date>/report.md
- Client: ../clients/<client-slug>.md
- Specs archive: ../specs/<client-slug>/<project-slug>/   (or none)
- Retrospective archive: ../retrospectives/<client-slug>/<project-slug>/   (or none)
- Action register: ../actions/<client-slug>/<project-slug>.md   (or none)
- Prior run (this client): <link or none>
- Recurrence sources (PriorReports): <links or none>
```

## Rules

- Journal entries target 20–50 lines.
- The frontmatter `client`, `project`, and `platform` MUST equal the run's `meta.json` — the coverage gate checks this.
- `prior_run` is the same-client previous run (or `none`) — distinct from `PriorReports`, which is cross-project recurrence and lives only in the Links body.
- Every Outcome traces to the run: Promoted/Watched from the report's `## Candidates` verdicts, Captured from the run's `captures/` files, counts from `resolution.json`. The `Specs` line maps to `resolution.json`'s `specs.counts` — `total` (approved), `matched`, `specOnly` — and is omitted when the run had no `Specs` input. The Team retrospectives line maps to `retrospectives.json` coverage and `retrospective-actions.json` counts and is omitted when the run had no `Retrospectives` input. No invented outcomes.
- `pr: pending` is filled by the merge-sync bot; leave it pending at authoring time.
