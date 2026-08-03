# Spec capture

How to capture a project's Confluence functional specs (ba-spec-writer output) into a raw JSON file that `normalize-specs.cjs` can structure. This is Step 1b of the analyze workflow. It runs only when a `Specs` input is given.

**Division of labour.** The skill's scripts are offline — no network, no MCP. So the fetch is yours (the model, via the Atlassian MCP); the deterministic structuring is the script's. This mirrors how project memory is captured: the model gathers, the script preserves and validates. Do not ask a script to reach Confluence.

## Contents

- Inputs
- Step 1 — discover the spec pages
- Step 2 — fetch each page
- Step 3 — write specs-raw.json
- De-clienting the label
- Data boundary

## Inputs

- **`Specs`** — where the specs live. Either a Confluence **space key + label(s)** (e.g. space `ACME`, labels `acme-batch1, acme-batch2`), or the URL of an **approvals/parent page** whose Page Properties Report macros list the batches. ba-spec-writer tags each spec page with a batch label and a `requirements` label. The component label is taken from each spec's title; the retrospective resolves it against the brain (`resolve.cjs`), so no external canonical map is needed.

## Step 1 — discover the spec pages

Enumerate by label with `searchConfluenceUsingCql`, one query per batch label:

```
label = "<batch-label>" AND space = <SPACE_KEY> AND type = page ORDER BY title ASC
```

If `Specs` is an approvals-page URL — or an approvals-page id is supplied alongside the labels — first `getConfluencePage` it (use `contentFormat: "adf"` so the macro parameters are visible) and read each Page Properties Report macro's `cql` **and** the row count it renders. Use the `cql` to recover/confirm the batch labels, and keep the rendered count as the **authoritative membership** for that batch.

**Record the enumeration so the script verifies completeness — don't eyeball counts.** `searchConfluenceUsingCql` can silently return a *partial* node set (a 16-page batch has come back with 1). Enumerate the full pageId set per batch first, then capture bodies. For each batch, record the search's own `totalCount` and the enumerated `pageIds` into `source.batches` (Step 3); `normalize-specs.cjs` then reconciles the captured bodies against that enumeration and emits deterministic warnings — `batch-enumeration-incomplete` (search returned fewer ids than its `totalCount`), `spec-uncaptured` (an enumerated page was never fetched), `spec-unexpected`, and `duplicate-page` — so a truncated search or dropped fetch surfaces rather than passing silently. When a batch's node count is below its `totalCount`, re-run that query (the truncation is transient) until they agree before capturing bodies.

Discovery returns candidates; the **approved-only gate is applied downstream** by `normalize-specs.cjs` (Document Status = APPROVED), so capture every candidate and let the script drop the rest into `skipped`. Do not pre-filter by guessing status. Beware two adjacent labels: the batch labels are the spec corpus, whereas the `requirements` label alone also matches non-component deliverable pages (redirects, analytics, error pages) that are not ba-spec-writer specs.

## Step 2 — fetch each page

For each page, call `getConfluencePage` with `contentFormat: "markdown"`. Read from the returned `body`:

- **Verify the returned id.** `getConfluencePage` occasionally returns a *different* page than the id requested; confirm the returned page's id equals the requested id and re-fetch on a mismatch. Capturing the wrong body silently mis-labels a spec — the `spec-uncaptured`/`spec-unexpected` reconciliation (Step 1) is the backstop, but catch it at the fetch.
- **Document Status** — from the leading Page Properties table row (`| Document Status | APPROVED |`). Record it explicitly; it is the gate.
- **The section body** — the ba-spec-writer schema is publish-enforced, so these headings are stable: Overview (+ `baseType`), Used By, Layout & Structure, Component Elements (numbered element H3s with the ARIA/keyboard contract), Style Options, Component Content → Editable Fields table + Dynamic Data. Capture the whole `body` markdown verbatim — the script parses these; you do not.

Keep the markdown as-is. Do not summarize, trim, or reword — `normalize-specs.cjs` needs the real headings and tables.

## Step 3 — write specs-raw.json

Write `<Output>/specs-raw.json`, one entry per fetched page:

```json
{
  "schemaVersion": 1,
  "source": {
    "space": "<SPACE_KEY>",
    "batches": [
      { "label": "<batch-label>", "totalCount": 21, "pageIds": ["<id>", "<id>"] }
    ]
  },
  "specs": [
    {
      "pageId": "<id>",
      "title": "<page title, verbatim>",
      "url": "<page web URL>",
      "labels": ["<batch-label>", "requirements"],
      "documentStatus": "<APPROVED | DRAFT | …, from Page Properties>",
      "bodyMarkdown": "<the full page body markdown, verbatim>"
    }
  ]
}
```

`source.batches` is the enumeration `normalize-specs.cjs` reconciles against (Step 1): per batch, `totalCount` is the search's own reported total and `pageIds` is every id it returned. It is optional — omit it and the script skips reconciliation — but recording it is what makes the completeness check deterministic rather than a manual count. One entry per `pageId` is required; the script dedupes a page that carries several batch labels.

Then structure it:

```bash
node <skill>/scripts/normalize-specs.cjs --raw <Output>/specs-raw.json [--archive <Data>/wiki/specs/<client-slug>/<project-slug>/source] --out <Output>/specs.json --pretty
```

Report `specs.json`'s `warnings` verbatim (they become Gaps). A `section-missing` warning flags a legacy or hand-edited spec the parser degraded on — not a failure; a `title-no-separator` warning flags a title with no `|` to de-client. A `batch-enumeration-incomplete` or `spec-uncaptured` warning means the fetch was **not complete** — resolve it (re-enumerate or re-fetch) before trusting the pack, rather than reporting it as an accepted gap.

## De-clienting the label

Spec titles carry a client prefix — `Acme Rebuild | Accordion Container`. The script de-clients by taking the trailing `|` segment (`Accordion Container`). Batch labels (`acme-batch1`) name the client — they stay in the private capture but the normalized pack keeps only the batch ordinal. Client copy inside a spec body is de-cliented later, at proposal-drafting time, exactly as any other evidence.

## Data boundary

`specs-raw.json`, `specs.json`, and any `--archive` copy are **client-derived output**. They live only under `Output` (or, under a `Data` = ui-design-evidence checkout, the archive under `<Data>/wiki/specs/`). They never land in this public skill repository. Confluence page IDs, URLs, client copy, reviewer names, and Epic/JIRA IDs stay in that private capture — never in a proposal, a downstream wiki entry, or this repo.
