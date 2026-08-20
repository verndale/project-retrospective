# Tracking issues and local branches

GitHub tracking is deterministic and automatic. An explicit retrospective target authorizes sanctioned label reconciliation, exact open-issue reuse, issue creation, issue linking, and the required local `git switch -c`. Do not pause for approval. This authority does not include commits, pushes, PRs, issue closure, Figma publication, merges, or releases.

Run `tracking-targets.cjs` before a write and again after issue/repository checks. It emits `skip`, `issue-pending`, or `write-ready` for every repository, with artifact IDs, an opaque `issueMatchKey`, `issueRequired`, labels, the exact open issue when supplied, blockers, and the required local branch. Scripts decide the work set; the model writes the five-section issue prose. Never file from `issue-pending` unless `issueRequired` is true; evidence prewrite failures use that state only to stop the branch.

## Contents

- Target matrix
- Deterministic sequence
- Issue content
- Sanctioned labels
- Evidence hub and downstream linking
- Failure behavior

## Target matrix

| Repository | Issue trigger | Local branch trigger | Labels |
|---|---|---|---|
| `verndale/project-retrospective` | an approved source-parity contract changes the skill/tooling | a non-empty contract write set exists | `Feature`, `area:tooling` |
| `verndale/ui-design-evidence` | a validated analyze or retrospective-ingestion run is written in the evidence checkout | before the run/wiki's first write | `Feature`, `area: retrospectives` |
| `verndale/ui-design-brain` | at least one pending catalog proposal exists | promote has an approved proposal and a non-empty brain write set | `Feature`, `area: catalog` |
| `verndale/ui-design-library` | capture preflight reports actionable library work | capture has a non-empty library write set and required capabilities | `Feature`, `area: components` |
| `ai-orchestration` | never | never | none |

- Analyze never creates brain or library branches.
- A proposal creates brain tracking, never library tracking.
- A draft capture does not itself create library tracking. `ready` or `figma-pending` work from schema-v5 capture preflight does; `deferred`, `blocked`, `skipped`, `landed`, and evidence-only reconciliation do not.
- `source-parity-audit` uses one foundation issue per repository with a non-empty contract/audit/governance write set, then one library issue per `actionable` component remediation. Cleared components and absent brain canonicals create no downstream issue or branch.
- A missing Figma writer keeps actionable work `issue-pending` and creates no empty library branch.
- Home fallback creates no evidence issue or branch.

## Deterministic sequence

1. Write a JSON snapshot of the action, exact artifact IDs, capture statuses, existing exact open issues, repository readiness, and capabilities. Analyze/ingest use `stage: "prewrite"` before the evidence write and `stage: "postvalidate"` only after the run validator passes. Run:

   ```bash
   node <skill>/scripts/tracking-targets.cjs --input <snapshot.json> --pretty
   ```

2. On analyze/ingest `prewrite`, create only the evidence branch emitted as `write-ready`; do not file the evidence or brain issue yet. On `postvalidate`, each `issue-pending` target is authorized: reconcile only the sanctioned labels, search open issues for the exact `Tracking key: <issueMatchKey>` line, and reuse it or use `github-issue-creator` to file immediately without a confirmation pause.
3. Link a later library issue from the private evidence hub. Never put the private hub URL or run identity in the shared library issue.
4. Before a promote/capture target becomes `write-ready`, require successful GitHub authentication/issue creation, exact labels, a clean local `main`, and local `main` aligned with `origin/main`. Evidence prewrite also requires authentication, exact labels, clean main, and alignment, but its hub issue is deliberately post-validation. Rerun the resolver with those checks and the exact issue number where an issue is required.
5. Create only the emitted branch and only while the target is `write-ready`:
   - Evidence: `feat/<project>-<date>-run`
   - Brain: `feat/<issue-number>-catalog-promotion`
   - Library: `feat/<issue-number>-library-capture`
6. Keep the branch local. Stop at handback with nothing committed or pushed.

Compute a branch from actual planned writes, never artifact presence alone. If the work set becomes empty after preflight, do not create the branch.

## Issue content

Use the github-issue-creator `[Feature] <summary>` title and its fixed five body sections: Summary, Context, Details, Expected Outcome, and Additional Notes.

Put `Tracking key: <issueMatchKey>` on its own line in Additional Notes. This opaque repository-plus-artifact-set key, not a mutable title, defines an exact match.

- Brain Details: one checkbox per pending proposal, named by client-agnostic canonical/alias and proposal type.
- Library Details: one checkbox per actionable exact `(canonical, variant)` capture identity.
- Reuse an exact matching open issue instead of creating a duplicate.

Brain and library content is client-agnostic. Describe the pattern, alias, component, structural import, and recurrence; never include client names, run slugs, private URLs, owners, source copy, or client paths.

## Sanctioned labels

Retrospective automation may create or repair only these exact definitions, idempotently. It must not modify unrelated labels.

| Repository | Label | Color | Description |
|---|---|---|---|
| project-retrospective | `Feature` | `0E8A16` | `New feature or request` |
| project-retrospective | `area:tooling` | `C5DEF5` | `Repository tooling, build, CI, linting, and developer workflows` |
| governed repos | `Feature` | `0E8A16` | `New feature or request` |
| evidence | `area: retrospectives` | `1D76DB` | `Retrospective runs, lifecycle records, and downstream tracking` |
| evidence | `area: tooling` | `C5DEF5` | `Repository tooling, build, CI, linting, and developer workflows` |
| brain | `area: catalog` | `1D76DB` | `Pattern catalog content, aliases, and manifest` |
| brain | `area: tooling` | `C5DEF5` | `Repository tooling, build, CI, linting, and developer workflows` |
| library | `area: components` | `1D76DB` | `Component library implementations, contracts, and Figma promotion` |

## Evidence hub and downstream linking

The evidence issue alone may name the client and run. Its five sections record:

- Summary: `<Client> <project-slug> <date>`.
- Context: the completed run and `feat/<project>-<date>-run` branch.
- Details: run/wiki artifacts, downstream issue links, and not-done retrospective actions from the private living register.
- Expected Outcome: the run is recorded and downstream work reaches `landed`.
- Additional Notes: other private handoff context or `None`.

Deferred captures remain only in this hub. When a later capture preflight makes one actionable, create/reuse the library issue automatically and append its URL to the hub automatically. The shared issue must not link back to the private hub.

## Failure behavior

Authentication/issue failure, label failure, dirty or stale main, and missing required capability stop before branch creation. Diagnose the condition and return it; do not ask for approval and do not downgrade it to a successful no-op. Publication actions remain separately authorized.
