# Spec capture

How to capture a project's Confluence functional specs (ba-spec-writer output) into a raw JSON file that `normalize-specs.cjs` can structure. This is Step 1b of the analyze workflow. It runs only when a `Specs` input is given.

**Division of labour.** The skill's scripts are offline — no network. So the *fetch* is yours (the model); the deterministic *structuring* and *rendering* are the scripts'. Fetch from the **Atlassian REST API** — it is id-addressed and reliable — pulling each page as ADF, then render it to markdown with the vendored `adf-to-markdown.cjs` (offline, zero-dep). This mirrors how project memory is captured: the model gathers, the scripts preserve and validate; do not ask a script to reach Confluence. The Atlassian **MCP** (`searchConfluenceUsingCql`, `getConfluencePage`) is a documented fallback when the REST API is not configured — but it can silently truncate a search and occasionally returns a *different* page than the id requested, so verify counts and ids when you use it; the REST API has neither failure mode.

## Contents

- Inputs
- Access (REST API)
- Step 1 — discover the spec pages
- Step 2 — fetch each page
- Step 3 — write specs-raw.json
- De-clienting the label
- Data boundary

## Inputs

- **`Specs`** — where the specs live. Either a Confluence **space key + label(s)** (e.g. space `ACME`, labels `acme-batch1, acme-batch2`), or the URL of an **approvals/parent page** whose Page Properties Report macros list the batches. ba-spec-writer tags each spec page with a batch label and a `requirements` label. The component label is taken from each spec's title; the retrospective resolves it against the brain (`resolve.cjs`), so no external canonical map is needed.

## Access (REST API)

- **Base:** `https://<site>.atlassian.net/wiki` — the Confluence Cloud site (e.g. the space's host).
- **Auth:** HTTP Basic, `<email>:<api-token>`. Read both from the environment and pass them straight to `curl` — never print, echo, log, or commit the token: `curl -s -u "$ATLASSIAN_USER_EMAIL:$ATLASSIAN_API_TOKEN" …` (variable names vary per machine; a fallback pair is `ATLASSIAN_EMAIL` / `ATLASSIAN_API_TOKEN`). Confirm the vars are set (non-empty) without revealing their values before starting.
- **No token configured?** Fall back to the MCP path noted in Steps 1–2.

## Step 1 — discover the spec pages

Enumerate by label with the search API, one query per batch label. The CQL is `label = "<batch-label>" AND space = <SPACE_KEY> AND type = page ORDER BY title ASC`, URL-encoded:

```bash
curl -s -u "$ATLASSIAN_USER_EMAIL:$ATLASSIAN_API_TOKEN" \
  "https://<site>.atlassian.net/wiki/rest/api/content/search?limit=200&cql=$(printf %s 'label="<batch-label>" and space=<SPACE_KEY> and type=page' | jq -sRr @uri)"
```

The response's `size`/`totalSize` and `results[].id` are the batch's authoritative membership. (MCP fallback: `searchConfluenceUsingCql` with the same CQL.) If `Specs` is an approvals-page id, fetch it as ADF first (`?body-format=atlas_doc_format`) and read each Page Properties Report macro's `cql`/`label` params to recover the batch labels — the macros also scope by an `ancestor` page and a secondary `requirements` label.

**Record the enumeration so the script verifies completeness — don't eyeball counts.** `searchConfluenceUsingCql` can silently return a *partial* node set (a 16-page batch has come back with 1). Enumerate the full pageId set per batch first, then capture bodies. For each batch, record the search's own `totalCount` and the enumerated `pageIds` into `source.batches` (Step 3); `normalize-specs.cjs` then reconciles the captured bodies against that enumeration and emits deterministic warnings — `batch-enumeration-incomplete` (search returned fewer ids than its `totalCount`), `spec-uncaptured` (an enumerated page was never fetched), `spec-unexpected`, and `duplicate-page` — so a truncated search or dropped fetch surfaces rather than passing silently. When a batch's node count is below its `totalCount`, re-run that query (the truncation is transient) until they agree before capturing bodies.

Discovery returns candidates; the **approved-only gate is applied downstream** by `normalize-specs.cjs` (Document Status = APPROVED), so capture every candidate and let the script drop the rest into `skipped`. Do not pre-filter by guessing status. Beware two adjacent labels: the batch labels are the spec corpus, whereas the `requirements` label alone also matches non-component deliverable pages (redirects, analytics, error pages) that are not ba-spec-writer specs.

## Step 2 — fetch each page

Fetch each enumerated page as ADF, straight to disk, then render the directory to markdown in one call:

```bash
# one per page id — id-addressed, so the right page comes back every time
curl -s -u "$ATLASSIAN_USER_EMAIL:$ATLASSIAN_API_TOKEN" \
  "https://<site>.atlassian.net/wiki/api/v2/pages/<id>?body-format=atlas_doc_format" > <adf-dir>/<id>.json
# render all fetched pages to markdown deterministically
node <skill>/scripts/adf-to-markdown.cjs --adf-dir <adf-dir> --out-dir <bodies-dir>
```

Because the REST API is addressed by id, it never returns a different page or a truncated body — no id-verification loop is needed (that guard is only for the MCP fallback). `adf-to-markdown.cjs` renders exactly the structures `normalize-specs.cjs` parses: the **Page Properties table** (so `| Document Status | … |` survives — it is the gate), Overview (+ `baseType`), Used By, Component Elements (ba-spec-writer's numbered bold leads are promoted to `### N. Name` element headings, carrying the ARIA/keyboard bullets), Style Options (**bold** variants), and the Editable Fields / Dynamic Data tables. Curl writes the ADF straight to a file, so the page bodies never pass through your context.

**MCP fallback (no REST token):** call `getConfluencePage` with `contentFormat: "markdown"` per page; **verify the returned id equals the requested id and re-fetch on a mismatch**, and cross-check counts per Step 1 — the MCP can truncate and mis-return. Write each body verbatim; do not summarize, trim, or reword.

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
      "documentStatus": "<optional — omit and normalize reads it from the body's Page Properties row>",
      "bodyMarkdown": "<contents of <bodies-dir>/<id>.md from Step 2>"
    }
  ]
}
```

`bodyMarkdown` is the converted markdown from Step 2 (`<bodies-dir>/<id>.md`); `documentStatus` is optional because `normalize-specs.cjs` reads the gate from the body's `| Document Status | … |` row when it is absent. `title` is the page's Confluence title (from Step 1's `results[]`), which the script de-clients to the component label.

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
