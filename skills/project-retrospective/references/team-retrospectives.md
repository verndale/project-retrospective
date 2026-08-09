# Team retrospective capture

Capture design, build, release, incident, post-mortem, and lessons-learned pages as durable knowledge with accountable follow-through. Use for `Action: analyze` when `Retrospectives` is supplied and for `Action: ingest-retrospectives`.

## Contents

- Inputs and discovery
- Fetch and raw capture
- Findings contract
- Normalize and archive
- Action accountability
- Retrospectives-only runs
- Data boundary

## Inputs and discovery

`Retrospectives` is a comma/newline-separated list of Confluence page or space URLs. Each URL seeds one `(site, space)` pair. Search only those spaces; never search the whole organization.

Explicit page URLs are always fetched. For each seeded space, enumerate current pages with title queries for `retrospective`, `retro`, `post-mortem`, `postmortem`, and `lessons learned`. Record each query's `totalCount` and complete `pageIds` list. Fetch likely matches; keep genuine team retrospectives and record every excluded automatic candidate with a reason. Resolve legacy `/display/<SPACE>/<title>` URLs by exact title inside that space before fetching by id.

Use the Atlassian REST API and ADF route from `spec-capture.md`: scripts stay offline, page fetches are id-addressed, and `adf-to-markdown.cjs` preserves arbitrary headings, tables, task lists, status lozenges, mentions, and dates. The Atlassian MCP remains the verified fallback.

## Fetch and raw capture

Write `retrospectives-raw.json`:

```json
{
  "schemaVersion": 1,
  "source": {
    "spaces": [{
      "site": "https://<site>.atlassian.net",
      "space": "<KEY>",
      "queries": [{ "term": "retrospective", "totalCount": 2, "pageIds": ["1", "2"] }]
    }]
  },
  "pages": [{
    "pageId": "1",
    "version": 3,
    "title": "Build Retrospective",
    "url": "https://<site>.atlassian.net/wiki/spaces/<KEY>/pages/1",
    "space": "<KEY>",
    "explicit": true,
    "createdAt": "<ISO timestamp>",
    "updatedAt": "<ISO timestamp>",
    "bodyMarkdown": "<converted ADF>"
  }],
  "excluded": [{ "pageId": "2", "title": "Retro playlist", "url": "<url>", "reason": "Not a team retrospective." }]
}
```

Do not infer cadence. Report observed page/event dates and counts; say when frequency is unknown.

## Findings contract

Read the captured bodies and write `retrospective-findings.json` with `schemaVersion: 1`, `pages[]`, `themes[]`, `contradictions[]`, and `actions[]`.

- Each page finding carries `pageId`, a client-safe `summary`, `takeaways[]`, optional `phase`/`format`, and `componentSignals[]`.
- A component signal carries `label`, `summary`, `agreesWithAsBuilt`, and `corroboratingPaths[]`. Set agreement true only after checking the project evidence.
- Each action carries `title`, `summary`, `sourcePageIds[]`, `destination`, `owner`, `nextStep`, `status`, optional `evidence`/`rationale`, `componentLabels[]`, and `corroboratingPaths[]`.
- Allowed destinations: `project`, `ui-design-brain`, `ui-design-library`, `ai-orchestration`, `evidence-wiki`, `external`.

## Normalize and archive

Run:

```bash
node <skill>/scripts/normalize-retrospectives.cjs \
  --raw <Output>/retrospectives-raw.json \
  --findings <Output>/retrospective-findings.json \
  --project-slug <project-slug> [--inventory <Output>/inventory.json] \
  [--archive <Data>/wiki/retrospectives/<client-slug>/<project-slug>/source] \
  --actions-out <Output>/retrospective-actions.json \
  --out <Output>/retrospectives.json --pretty
```

The script reconciles discovery, deduplicates by page id/version, validates finding references, classifies phase/format, assigns action ids, and omits page bodies from the normalized pack. Report warnings verbatim. Resolve incomplete enumeration or uncaptured-page warnings before trusting the synthesis.

Only a component signal with model-confirmed agreement, a matched inventory component, a cited path, and a strong as-built source becomes eligible for `team-retrospective` evidence. `code-scan` alone never qualifies.

## Action accountability

Statuses are `needs-owner`, `open`, `in-progress`, `blocked`, `done`, and `wont-do`. Missing owners normalize to `needs-owner`; `done` requires evidence; `wont-do` requires a rationale.

Under a `Data` evidence checkout, merge the immutable action pack into the living register:

```bash
node <skill>/scripts/update-retrospective-register.cjs \
  --actions <Output>/retrospective-actions.json \
  --client-slug <client-slug> --project-slug <project-slug> \
  --run runs/<project-slug>/<date>/ [--issue-url <private issue>] \
  --out <Data>/wiki/actions/<client-slug>/<project-slug>.md
```

Existing lifecycle edits win; source pages/runs remain additive. Surface `needs-owner` first. Add the action checklist to the private evidence-hub issue; arbitrary client-derived actions never become public issues.

## Retrospectives-only runs

`Action: ingest-retrospectives` requires `Data`, `ProjectSlug`, and `Retrospectives`. Derive identity/platform from the latest existing run. Write a new append-only `runs/<ProjectSlug>/<Date>/` with `meta.scope: retrospectives`, the four retrospective JSON artifacts, and `report.md`. Never amend historical runs.

Its report headings are `Run`, `Summary`, `Team retrospectives`, `Gaps`, and `Next steps`. Add the wiki archive digest, register, journal entry, client-page links, and generated rollups, then run the evidence checkout's graph/wiki/query builds.

## Data boundary

Page bodies, ids, URLs, names, and client detail live only in the private evidence checkout. Before archiving, remove credentials and customer data; the normalizer also refuses obvious secret assignments. Public proposals, captures, orchestration rules, fixtures, and this repository stay client-neutral and synthetic.
