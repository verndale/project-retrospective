# wiki client page template

The durable per-client page in `ui-design-evidence`, at `wiki/clients/<client-slug>.md`. One per client; a living document, additive across runs. Written by Step 6 (see `references/wiki-feed.md`) and editable by hand.

## Template

```markdown
---
slug: <client-slug>
aliases: [<display name>, <other known names>]
platforms: [<adapter-key>, ...]
projects: [<project-slug>, ...]
---
# <Client display name> — Client Knowledge

<one line: who they are and the platform(s) they build on>

## Profile
- Platforms: <Optimizely SaaS>, <Sitecore>, …
- Project slugs: `<project-slug>` (first run <date>), …

## What we know
- <durable facts learned across this client's runs — platform quirks, recurring
  components, naming conventions, and durable engineering knowledge distilled from
  the project's `artifacts/memory/` (architecture, known issues, conventions).
  Cite the report path or name the memory source; summarize, never copy client prose.>

## Runs
- <YYYY-MM-DD> — `<project-slug>` — [journal](../journal/<date>-<project-slug>.md) · [report](../../runs/<project-slug>/<date>/report.md) · [memory](../memory/<client-slug>/<project-slug>/) · [specs](../specs/<client-slug>/<project-slug>/) · [retrospectives](../retrospectives/<client-slug>/<project-slug>/) · [actions](../actions/<client-slug>/<project-slug>.md)

## Open threads
- <Watch candidates awaiting recurrence; unresolved questions>   (omit if none)
```

## Rules

- `projects[]`, `platforms[]`, and `aliases` are additive sets — never drop a prior run's entry.
- `## Runs` is newest-first, one line per run, never deleted.
- Each `## Runs` line links that project's memory archive (`../memory/<client-slug>/<project-slug>/`) — the near-raw `source/` and its `index.md` digest live there; link it, never paste memory into this page. The `specs` link is present only for a run that captured functional specs (`../specs/<client-slug>/<project-slug>/`); omit it otherwise. The `retrospectives` and `actions` links are present only when the run captured team retrospectives; they point to the private archive and living register, never copied source content.
- Body budget ~150 lines; open with `## Contents` only if it exceeds 100.
- Every "What we know" bullet traces to a run report or the analyzed project's `artifacts/memory/` (cite the report path, or name the memory source). No invented facts.
- No client copy, credentials, or customer data — this is the private evidence repo, so client name and platform are fine, but bodies cite paths.
