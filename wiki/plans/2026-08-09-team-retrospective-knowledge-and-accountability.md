---
status: implemented
executed: 2026-08-09
date: 2026-08-09
evidence:
  - "https://github.com/verndale/project-retrospective/issues/57"
  - "PR #58 https://github.com/verndale/project-retrospective/pull/58 (merged 2026-08-09)"
source_tool: file
source: "/private/tmp/team-retrospective-knowledge-and-accountability.md"
topics: [retrospective-workflow]
audit_note: "Implemented the public skill contract and private append-only retrofit; all quality, freshness, accountability, immutability, and data-boundary gates passed."
---
# Team Retrospective Knowledge and Accountability

## Tracking setup

- Create a working branch from current `main` and file the approved public tracking issue.
- Do not commit, push, or open a pull request.

## Skill interfaces and artifacts

- Add optional Confluence page/space inputs and an append-only retrospective-ingestion action.
- Emit audited raw capture, model-authored findings, deterministic normalization, deterministic action lifecycle, and a matching report section.
- Restrict discovery to seeded project spaces; reconcile every explicit and discovered candidate.
- Preserve heterogeneous source structure without assuming a standard template or cadence.

## Evidence and accountability

- Allow retrospective evidence into component triage only when it names an inventoried component and agrees with strong non-code-scan as-built evidence.
- Give each action a stable ID, destination, owner, next step, and validated lifecycle status.
- Require proof for completion and rationale for declined work; escalate missing owners.
- Archive reviewed source Markdown and maintain living project registers only in the private evidence repository.
- Add retrospective/action collections and an open-action rollup to the private Evidence Explorer.
- Route shared-repository work only through existing client-neutral proposals, captures, and orchestration drafts.

## Historical retrofit

- Create a new retrospectives-only run for each existing project, linked to its latest run.
- Seed the known pages, search only their project spaces, and audit every candidate as included or excluded.
- Never modify historical runs; process project branches and handoffs independently.
- Produce archive, synthesis, action artifacts, report, register, private wiki links, and an approved private issue for each project.

## Tests and acceptance

- Cover discovery reconciliation, deduplication, heterogeneous ADF, exclusions, malformed/sensitive pages, archive collisions, stable action IDs, register merging, owner escalation, completion proof, and declined-work rationale.
- Cover evidence eligibility, artifact/report parity, new scope, backward compatibility, private wiki rollups/collections, and downstream data boundaries.
- Run both repositories' complete gates and rebuild generated graph, wiki, query, and explorer artifacts.
- Accept only when the four append-only runs are navigable, all actions have dispositions, historical runs are untouched, and no private content enters the public repository.

## Assumptions

- The public issue and labels are approved.
- Authenticated Confluence access will be available for backfill.
- Raw pages remain private and shared summaries are de-identified.
- The private register plus evidence-hub issue is the accountability mechanism.
- Unrelated working-tree changes remain untouched.
