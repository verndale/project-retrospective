# Project retrospective — fake-project

## Run

| Field | Value |
|---|---|
| Project | `/tmp/fake-project` |
| Date | `2026-01-01` |
| Mode | `artifacts` |
| Catalog | `/tmp/fake-brain` (6 canonical entries) |
| Scope | `full` |
| Prior reports | none |

## Summary

| Metric | Count |
|---|---|
| Components inventoried | 4 |
| Resolved to a canonical | 1 |
| Ambiguous (context confirmed) | 0 |
| Unresolved labels | 3 |
| Promote | 1 |
| Watch | 1 |
| Reject | 1 |

A synthetic fixture run. One label — the logo ribbon — carries enough independent evidence to be worth catalog vocabulary; the rest either duplicate an existing canonical or fall inside an excluded category.

## Inventory

| Component | Bucket | Domain | Evidence |
|---|---|---|---|
| `modal` | ui | — | build-pack, component-index, fingerprint |
| `logo-ribbon` | rendering | marketing | build-pack, component-index, memory |
| `cards` | ui | — | component-index |
| `checkout-panel` | rendering | marketing | component-index |

## Resolution

1 of 4 labels resolved against the catalog.

| Label | Canonical | Via |
|---|---|---|
| `Modal` | Modal | name |

No ambiguous context aliases in this run.

## Candidates

### LogoRibbon

Verdict: Promote

- `artifacts/build-packs/logo-ribbon.md` — a normalized spec exists for it.
- `artifacts/memory/design-system.md` — project memory records its token behavior by name.
- Two independent sources (`build-pack`, `memory`), describable without naming the client, and not an existing canonical under another name.

### Cards

Verdict: Watch

- `src/components/ui/cards` — single source (`component-index`) and no build pack.
- Plural of an existing canonical (**Card**); it is most likely a collection wrapper rather than new vocabulary. A build pack or a second project using the same label would settle it.

### CheckoutPanel

Verdict: Reject

- Checkout is a hard exclusion — commerce flow, not reusable UI vocabulary.

## Captures

Implementations the next project should start from rather than rebuild. Drafted in `captures/`, executed into ui-design-library by `Action: capture`.

### Modal

`captures/modal.md` — from `src/components/ui/modal`.

- The only component in the run carrying a build pack, a `fingerprint.json`, and a resolved canonical at once.
- De-clienting headline: the overlay reads its surface colour from a project token that has no semantic home yet.

## Learnings

Pipeline-shaped findings that belong in ai-orchestration rather than the catalog. Drafted in `orchestration-drafts.md`.

- **Semantic token enforcement** — the project's memory records a convention worth making a rule. Suggested destination: `frontend-ai/skills/implement-build-pack/references/core/`.

## Gaps

- No script warnings for this run.
- The fixture project has no tests or stories, so component maturity beyond the build pack could not be assessed.

## Next steps

1. Review the proposals in `proposals/`.
2. Apply an approved one:
   `/project-retrospective` with `Action: promote`, `Proposal: proposals/logo-ribbon.md`, `Brain: /tmp/fake-brain`
3. Review the captures in `captures/`, then apply the set:
   `/project-retrospective` with `Action: capture`, `Captures: captures/`, `Library: /tmp/fake-library`, `Brain: /tmp/fake-brain`
4. Carry the drafts in `orchestration-drafts.md` into ai-orchestration through its own contribution flow.
5. Keep this report — pass it as `PriorReports:` on the next project so Watch candidates can be elevated.
