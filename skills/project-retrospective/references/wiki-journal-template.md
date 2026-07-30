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

## Links
- Report: ../../runs/<project-slug>/<date>/report.md
- Client: ../clients/<client-slug>.md
- Prior run (this client): <link or none>
- Recurrence sources (PriorReports): <links or none>
```

## Rules

- Journal entries target 20–50 lines.
- The frontmatter `client`, `project`, and `platform` MUST equal the run's `meta.json` — the coverage gate checks this.
- `prior_run` is the same-client previous run (or `none`) — distinct from `PriorReports`, which is cross-project recurrence and lives only in the Links body.
- Every Outcome traces to the run: Promoted/Watched from the report's `## Candidates` verdicts, Captured from the run's `captures/` files, counts from `resolution.json`. No invented outcomes.
- `pr: pending` is filled by the merge-sync bot; leave it pending at authoring time.
