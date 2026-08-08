# triage.json schema

The machine-readable twin of `report.md`'s `## Candidates` verdicts. `report.md` is for a reviewer; `triage.json` is for the evidence promotion radar (`scripts/query/start-pack.cjs` in the `ui-design-evidence` repo), which reads each run's `watch[]` to rank promotion candidates across runs. A run without `triage.json` is a **gap note**: the radar goes dark for that project, and cross-run recurrence — the whole reason a Watch becomes a Promote — cannot be seen.

The model writes it at Step 4 (Draft), from its Step-3 triage verdicts plus the metadata already in `resolution.json` (bucket, domain, entry, evidence sources) and `inventory.json`. It is a Step-4 model output, not a script output — no script emits it. Emit it at `full` and `candidates` scope; an `inventory` run has no candidates, so it has no triage.

`validate-report.cjs` checks its structure — schema, the run-dir join, the three arrays, per-entry `label`/`verdict`, and `counts`. It cannot check judgment.

## Shape

```json
{
  "schemaVersion": 1,
  "run": "<project-slug>/<YYYY-MM-DD>",
  "promote": [<entry>],
  "watch": [<entry>],
  "reject": [<entry>],
  "counts": { "Promote": 1, "Watch": 3, "Reject": 10 }
}
```

- **`schemaVersion`** — always `1`.
- **`run`** — `<project-slug>/<YYYY-MM-DD>`, equal to the run directory's `<parent>/<basename>`. This is the join key the radar and the wiki share; it must match `meta.json`'s `project.slug` and `date`.
- **`promote` / `watch` / `reject`** — one entry per triaged candidate, sorted into the array for its verdict. Every `### <Label>` under `report.md`'s `## Candidates` appears in exactly one array.
- **`counts`** — the per-verdict totals, mirroring the report's Summary table.

## Entry

```json
{
  "label": "feature-blocks",
  "verdict": "Watch",
  "rule": "coverage-uncertain (Card-grid boundary)",
  "note": "provisional canonical: Feature grid — a reusable grid of label+description+link blocks not tied to a page or data source; overlaps Card's product-grid layout.",
  "bucket": "rendering",
  "domain": null,
  "entry": "src/stories/modules/feature-blocks.stories.js",
  "sources": ["spec", "storybook"]
}
```

| Field | Type | Meaning |
|---|---|---|
| `label` | non-empty string | The project's label for the component, kebab-case. |
| `verdict` | `Promote` \| `Watch` \| `Reject` | The Step-3 verdict; matches the report's `Verdict:` line. |
| `rule` | string | The short reason the rubric test named — the same call the report makes. |
| `note` | string \| null | A **Watch** MUST start `provisional canonical: <Name> — …` (see below). A Promote or Reject carries a short reason or `null`. |
| `bucket` | `ui` \| `rendering` \| `template` \| null | From `inventory.json`/`resolution.json`. |
| `domain` | string \| null | The component's domain, when one was recorded. |
| `entry` | path string \| null | The evidence entry point (story, spec, or component file), or `null`. |
| `sources` | string[] | Evidence sources: `storybook`, `spec`, `build-pack`, `fingerprint`, `memory`, `code-scan`, `component-index`, … |

## The Watch `provisional canonical:` note

Every `watch` entry's `note` MUST start with the literal `provisional canonical:`, followed by a proposed canonical name and a one-line definition:

```
provisional canonical: Feature grid — a reusable grid of label+description+link blocks …
```

This is what the radar keys on. A Watch is a candidate that has not yet cleared the promotion bar; the radar needs a provisional name to group the same concept across runs, so that a label seen as a Watch in three projects surfaces as one ready-to-promote pattern rather than three unrelated notes. A note that omits the prefix starves the radar of that name — `validate-report.cjs` **warns** `triage-provisional` (it does not fail the run, but the candidate ranks weaker).

## Validation

`validate-report.cjs` runs `checkTriage` at `full` and `candidates` scope. It fails:

- `triage-present` — `triage.json` is missing;
- `triage-parses` — it is not a JSON object;
- `triage-schema` — `schemaVersion` is not `1`;
- `triage-run` — `run` does not match the run directory (checked only for a real `runs/<slug>/<date>/` output dir);
- `triage-shape` — `promote`, `watch`, or `reject` is not an array;
- `triage-entry` — an entry lacks a non-empty string `label`, or its `verdict` is outside `{Promote, Watch, Reject}`;
- `triage-counts` — `counts` is missing or not an object, or a present `Promote`/`Watch`/`Reject` is non-numeric.

And it warns:

- `triage-provisional` — a `watch` entry's `note` does not start `provisional canonical:`.
