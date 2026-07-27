# report.md template

The run's human-readable output. The `##` headings inside the template are **frozen** — `validate-report.cjs` checks for them by name. Content between them is yours to write.

## Contents

- Scope waivers
- Template
- Rules

## Scope waivers

`Scope: inventory` emits only Run, Summary, Inventory, Gaps. `Scope: candidates` adds Resolution, Candidates, Next steps. A run with no `Brain:` omits Resolution and says so under Gaps.

## Template

```markdown
# Project retrospective — <project name>

## Run

| Field | Value |
|---|---|
| Project | `<absolute path>` |
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

## Learnings

Pipeline-shaped findings that belong in ai-orchestration rather than the catalog. Drafted in `orchestration-drafts.md`.

- **<Short title>** — <one line>. Suggested destination: `<path in ai-orchestration>`.

## Gaps

What this run could not see. Script warnings verbatim, then anything the mode itself limits.

- `<warning code>` — <message>
- <e.g. No Storybook in the project, so component API surface came from fingerprints only.>

## Next steps

1. Review the proposals in `proposals/`.
2. Apply an approved one:
   `/project-retrospective` with `Action: promote`, `Proposal: <path>`, `Brain: <path>`
3. Carry the drafts in `orchestration-drafts.md` into ai-orchestration through its own contribution flow.
4. Keep this report — pass it as `PriorReports:` on the next project so Watch candidates can be elevated.
```

## Rules

- **One `Verdict:` line per candidate.** Write `Verdict: Promote` (or Watch / Reject); `**Verdict:** Promote` also validates. Nothing else on that line.
- **Headings are matched exactly.** `## Candidates (3 evaluated)` is not `## Candidates` and fails validation — keep the frozen headings bare and put counts in the Summary table.
- **Every `### <Label>` under `## Candidates` needs one.** A label with no verdict fails validation.
- **Promote candidates need a matching proposal file** at `proposals/<kebab-label>.md`.
- **No numeric scores** — evidence and a verdict, nothing in between.
- Write for a reviewer who was not on the project: name paths, not impressions.
