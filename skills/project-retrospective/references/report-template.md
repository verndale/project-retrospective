# report.md template

The run's human-readable output. The `##` headings inside the template are **frozen** — `validate-report.cjs` checks for them by name. Content between them is yours to write.

## Contents

- Scope waivers
- Template
- Rules

## Scope waivers

`Scope: inventory` emits only Run, Summary, Inventory, Gaps. `Scope: candidates` adds Resolution, Candidates, Next steps. `Scope: full` adds Captures and Learnings. When `Retrospectives` was supplied, candidates/full also add Team retrospectives. `Scope: retrospectives` emits Run, Summary, Team retrospectives, Gaps, Next steps. A run with no `Brain:` omits Resolution and says so under Gaps.

## Template

```markdown
# Project retrospective — <project name>

## Run

| Field | Value |
|---|---|
| Project | `<absolute path>` |
| Client | `<display name>` (`<client-slug>`) |
| Platform | `<Platform display>` (`<adapter-key>`) |
| Date | `<YYYY-MM-DD>` |
| Mode | `artifacts` or `code-scan` |
| Catalog | `<brain path>` (<N> canonical entries) |
| Scope | `full` |
| Prior reports | `<paths>` or none |

## Summary

| Metric | Count |
|---|---|
| Components inventoried | |
| Resolved to a canonical | |
| Ambiguous (context confirmed) | |
| Unresolved labels | |
| Promote | |
| Watch | |
| Reject | |

<One paragraph: what this project taught us. Lead with the finding, not the process.>

## Inventory

| Component | Bucket | Domain | Evidence |
|---|---|---|---|
| `<folder>` | ui / rendering | <domain> | build-pack, fingerprint, memory |

<Only list what informs a judgment. For a large project, summarize by bucket and list the components that carry a build pack or fingerprint.>

## Resolution

<N> of <M> labels resolved against the catalog.

| Label | Canonical | Via |
|---|---|---|
| `Tag` | Badge | alias (`Tag`) |
| `TextLink` | Link | alias (`Text link`) |

**Ambiguity resolved:** `<label>` → **<canonical>** — the manifest scopes it to two canonicals; <the usage evidence that decided it, with the path>. <Or: left unresolved because the context was unclear.>

## Candidates

### <Label>

Verdict: Promote

- <Evidence bullet citing a path.>
- <Evidence bullet citing a path.>
- <Which rubric test it passes, or which prior report it recurs in.>

### <Label>

Verdict: Watch

- <Evidence.>
- <What would elevate it: a second source, or recurrence in another project.>

### <Label>

Verdict: Reject

- <The rule that applied — exclusion, child part, thin wrapper, one-off — and the canonical that already covers it, if any.>

## Captures

Implementations the next project should start from rather than rebuild. Drafted in `captures/`, executed into ui-design-library by `Action: capture`. A capture whose canonical is established by a `new-pattern` proposal in this run is a **deferred** capture — note that on its entry and link the proposal; `capture-preflight.cjs` holds it `deferred` until the pattern is promoted.

### <Canonical Name> [/ <Structural variant label>]

`captures/<slug>[--<variant>].md` — from `<component directory in the analyzed project>`.

- <Why this implementation, not just the concept, is worth keeping — cite a path.>
- <The de-clienting headline: the largest thing the rewrite must strip.>

## Team retrospectives

<N> page(s) captured from <seeded project space(s)>; <M> automatic candidate(s) excluded with recorded reasons. Dates below are observed page/event dates, not an inferred cadence.

| Page | Phase | Format | Observed date | Source |
|---|---|---|---|---|
| <client-safe title> | design / build / release / incident / unknown | retrospective / post-mortem / lessons-learned / other | <date or unknown> | `retrospectives.json` page `<id>` |

### Themes

- <Client-safe cross-page takeaway with source page ids.>

### Contradictions

- <Disagreement or "None observed.">

### Actions

- `<action-id>` — <title>; status: <status>; owner: <owner or needs-owner>; destination: <destination>. Living register: `<Data>/wiki/actions/<client>/<project>.md`.

## Learnings

Pipeline-shaped findings that belong in ai-orchestration rather than the catalog. Drafted in `orchestration-drafts.md`. Optionally group them under `### Gotchas` (a pitfall to avoid) and `### Tips` (a practice to adopt) — see Rules.

- **<Short title>** — <one line>. Suggested destination: `<path in ai-orchestration>`.

## Gaps

What this run could not see. Script warnings verbatim, then anything the mode itself limits.

- `<warning code>` — <message>
- <e.g. No Storybook in the project, so component API surface came from fingerprints only.>

## Next steps

1. Review the proposals in `proposals/`.
2. Apply an approved one:
   `/project-retrospective` with `Action: promote`, `Proposal: <path>`, `Brain: <path>`
3. Review the captures in `captures/`, then apply the set:
   `/project-retrospective` with `Action: capture`, `Captures: <path>`, `Library: <path>`, `Brain: <path>`
4. Carry the drafts in `orchestration-drafts.md` into ai-orchestration through its own contribution flow.
5. Keep this report — pass it as `PriorReports:` on the next project so Watch candidates can be elevated.
```

## Rules

- **One `Verdict:` line per candidate.** Write `Verdict: Promote` (or Watch / Reject); `**Verdict:** Promote` also validates. Nothing else on that line.
- **Headings are matched exactly.** `## Candidates (3 evaluated)` is not `## Candidates` and fails validation — keep the frozen headings bare and put counts in the Summary table.
- **Every `### <Label>` under `## Candidates` needs one.** A label with no verdict fails validation.
- **Promote candidates need a matching proposal file** at `proposals/<kebab-label>.md`.
- **Every capture heading needs an exact file.** Default `### <Canonical Name>` maps to `captures/<kebab-canonical>.md`; alternate `### <Canonical Name> / <Variant label>` maps to `captures/<kebab-canonical>--<kebab-variant-label>.md`. Every file needs an entry.
- **Capture entries carry no `Verdict:` line.** There is no triage axis: the entry's presence is the assertion. *Verdict* stays reserved for Candidates.
- **`## Captures` is required at `full` scope even when nothing qualified.** Keep the heading and say so in a sentence, with no `### ` entries under it.
- **`### Gotchas` / `### Tips` under `## Learnings` are optional.** Use them to separate a pitfall the next project should avoid from a practice it should adopt from the start; a finding that is neither, or both, stays a bare bullet under `## Learnings`. Never force the split. These H3s carry no `Verdict:` line and need no proposal or capture file — the downstream start pack surfaces them verbatim.
- **`## Team retrospectives` is required when retrospective artifacts exist.** Keep source titles/content client-safe in the report; page ids and URLs stay in the private JSON/archive. A retrospectives-only run uses only Run, Summary, Team retrospectives, Gaps, and Next steps.
- **No numeric scores** — evidence and a verdict, nothing in between.
- Write for a reviewer who was not on the project: name paths, not impressions.
