# Deterministic execution ledger

Use this for every action. It keeps one private, append-only account of what analyze, publication, promotion, capture, and reconciliation actually did. The canonical `execution-log.json` and its generated `execution-log.md` live in the run `Output`; client-derived values never land in the public skill repository.

## Contents

- Contract
- Initialize
- Record outcomes
- Required coverage
- Finish or stop
- Read and validate

## Contract

- `execution-log.json` is canonical; never hand-edit `execution-log.md`.
- `execution-log.md` is regenerated after every mutation and is byte-checked by `validate-report.cjs`.
- Events are ordered by integer `sequence`, not time. The script never reads the clock, so the same commands produce the same files.
- Every event has an explicit stable `id`. Replaying identical content is a no-op. Reusing the id with different content exits `4`; record a real retry with the next deterministic suffix such as `.attempt-2`.
- Record outcomes, not noisy command starts. A passed verification can cite the command; a failed attempt remains visible when a later attempt passes.
- Evidence values are concise repository-relative paths, canonical issue/PR URLs, commit SHAs, or check names. Never put credentials, client copy, terminal dumps, or local absolute paths in an event.
- Repository roles are `project`, `evidence`, `brain`, `library`, `orchestration`, or `none`. The analyzed project is always read-only.

## Initialize

Immediately after creating `Output`, before the first other run artifact, run:

```bash
node <skill>/scripts/execution-ledger.cjs init \
  --output <Output> \
  --run <project-slug>/<YYYY-MM-DD> \
  --publication <merge|pull-request|working-tree>
```

An existing ledger for the same run/publication is preserved and re-rendered. A different identity is a conflict, not an overwrite. For an older run first encountered by promote/capture, initialize it from sibling `meta.json` before recording the resumed action.

## Record outcomes

Run this after each material deterministic outcome:

```bash
node <skill>/scripts/execution-ledger.cjs record \
  --output <Output> \
  --id <stable-event-id> \
  --phase <analyze|publish-evidence|promote|capture|reconcile> \
  --action <lowercase-action> \
  --status <passed|warning|skipped|blocked|failed> \
  --summary "<one plain-language result sentence>" \
  --repository <role> \
  --evidence '["<path-or-url>","<path-or-url>"]'
```

Use IDs from the action plus the concrete subject, for example `analyze.inventory`, `publish-evidence.pull-request`, `promote.datepicker.merge`, `capture.modal.preflight`, or `reconcile.lifecycle`. Normalize proposal/capture keys to kebab-case. When one action handles several items, record each item separately and then record a phase-complete event.

Warnings, skips, blockers, and failed attempts are events, not prose added later. Use the script's exact event status, keep the summary readable without opening the cited artifact, and preserve the validator/check output in its normal artifact or PR rather than pasting it into the ledger.

## Required coverage

Record an event for every applicable row; use `skipped` with the reason when a row is inapplicable.

| Phase | Required material outcomes |
|---|---|
| `analyze` | evidence branch, inventory, specs/retrospectives, prior evidence, resolution, triage/proposals/capture intents, wiki feed, tracking issues, validation |
| `publish-evidence` | repository gate, commit, push, pull request, checks, merge/default-branch verification, linked issue state |
| `promote` | proposal preflight or prior-art reuse, catalog apply, integrity/wiki/graph verification, commit, push, pull request, checks, merge/default-branch verification |
| `capture` | capability/source/style-guide gate, enrichment/preflight, implementation, Figma master plus properties/variants/states, style-guide audit/update, code/source-parity/adversarial/UI-design verification, commit, push, pull request, checks, merge/default-branch verification |
| `reconcile` | proposal/capture lifecycle markers, evidence graph/wiki/query rebuilds, final validation, evidence publication, closing issue state |

Use the canonical PR URL and merge commit as evidence for a merge event. A check event says which documented gate passed or failed. Never call a phase passed merely because a command started or a PR exists.

## Finish or stop

After the final evidence reconciliation, write one `reconcile.complete` event and finish the ledger:

```bash
node <skill>/scripts/execution-ledger.cjs finish \
  --output <Output> \
  --status complete \
  --summary "The authorized retrospective chain completed."
```

`complete` deterministically sets remaining work to `None.`. An explicit `pull-request`/`working-tree` boundary uses `stopped`; a real unresolved blocker uses `blocked`; exhausted verification uses `failed`. Those states require exact remaining work:

```bash
node <skill>/scripts/execution-ledger.cjs finish \
  --output <Output> \
  --status blocked \
  --summary "The required writer capability is unavailable." \
  --remaining '["Restore the write-capable session, then resume capture modal."]'
```

A `blocked` finish requires a preceding blocked event; `failed` similarly requires a failed event. Do not finish while routine checks are merely pending in default `merge` mode—wait and continue.

## Read and validate

Read `execution-log.md` first. It shows overall status, one current row per phase, the full numbered event sequence, warnings/blockers, and remaining work. It is intentionally simpler than terminal history.

`validate-report.cjs` requires both files for every scope, validates identities and event structure, and compares Markdown to the canonical rendering. If only the Markdown drifted, repair it without changing history:

```bash
node <skill>/scripts/execution-ledger.cjs render --output <Output>
```

Then rerun the normal report validator. The ledger follows the same three-attempt cap as the run output.
