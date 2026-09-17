# Authorized publication and exact handoff

Use this after an action has completed its writes, tracking, and validation. It separates routine continuation from genuine external blockers and carries hands-off runs across repository boundaries.

## Resolve publication mode once

- `Publication: merge` is the default for every retrospective invocation. It authorizes the full continuation contract for the repositories and issue branches deterministically named by the action.
- `Publication: pull-request`, or an unambiguous current-request instruction to stop after opening a pull request, is an explicit override that stops before ready/merge.
- `Publication: working-tree` explicitly requests a local-only handoff.
- When the parameter is absent, resolve it to `merge`; ordinary instructions such as analyze, promote, capture, continue, or "do it" need no separate publication confirmation.
- Do not ask for routine publication authority. Do not broaden the standing default from deterministic action-owned targets to unrelated repositories or branches.
- The analyzed `Project` remains read-only under every publication mode.

`Publication: merge` includes closure of issues linked through the merged PR's closing keywords. Direct closure of unrelated issues, manual tags/releases, Figma publication, native Figma Dev Mode readiness, force-merge, and bypassing required protection remain outside this mode unless separately and exactly authorized. A repository's normal post-merge release automation may run.

## Dependency and priority order

Create an issue and its exact action branch in every repository with a validated non-empty write set; never create either for a read-only, skipped, deferred, blocked, or already-landed target. Process them in this order:

1. **Evidence intake** — private run issue/branch, validated run/wiki output, and initial Evidence PR merge.
2. **Brain promotion** — one client-agnostic issue/branch for the run's pending proposals; apply proposals in deterministic proposal-path order and merge only after the Evidence source is on `main`.
3. **Library capture** — one client-agnostic issue/branch for the ready capture set; order captures by canonical dependency, then capture key. Promote and merge required canonicals before re-running capture preflight. Finish each component's code, variants, states, Figma review, style-guide audit, and verification before starting the next.
4. **Evidence reconciliation** — proposal/capture lifecycle markers, execution-ledger completion, generated evidence artifacts, and closing issue state land last.

Never begin a lower-priority write until the upstream PR is merged and its default branch is verified. A real blocker pauses that item and every dependent item; independent higher-priority work may continue. Do not trade dependency order for convenience or parallelize writes to the same repository.

## Continue automatically when authorized

For each action-owned repository, in dependency order:

1. Confirm the current branch is the exact issue/run branch emitted by tracking and the action-owned diff contains no unrelated changes.
2. Run the target repository's documented pre-push gate. Prefer `pnpm verify:push`; otherwise run the verification commands already required by the action. Fix in-scope failures under the normal three-attempt cap.
3. Stage only the action-owned write set and use the repository's commit helper (`pnpm commit`) when present. Read the resulting message and correct malformed issue references or a misleading subject before push.
4. Push only the exact current issue/run branch.
5. Let repository automation create or update its draft pull request. If none appears, use the repository's `pnpm pr:create`; when that helper cannot consume otherwise-valid GitHub authentication, use the authenticated GitHub CLI directly. The PR body MUST connect the exact repository issue with a closing keyword; if automation omitted it, update the PR before readying it.
6. Read the saved pull request back. Verify its canonical URL, conventional title, base/head branches, draft state, issue closing link, body summary, and current checks. Confirm the issue also shows the PR connection. Do not claim green checks while any are pending or failing.
7. Under `pull-request`, return the verified draft PR and stop before ready/merge.
8. Under `merge`, wait for every required check, fix in-scope failures under the normal three-attempt cap, mark the PR ready, and use the repository's allowed merge method without bypassing protection. Prefer auto-merge when required review/checks are still pending and the repository supports it; otherwise wait for the terminal state and merge directly.
9. Verify the PR is merged, the default branch contains the result, and closing-keyword issues reached their expected state. Pull the updated default branch only when the next dependent action needs it; never leave routine synchronization to the operator.
10. Append the verified branch/commit/PR/check/merge/issue outcome to the run execution ledger, then continue to the next dependency. Return only after the requested chain completes or a real blocker remains.

When one action writes both private evidence and a shared downstream repository, merge the private evidence reconciliation first. Publish and merge the shared repository only after its own complete verification passes. Never combine unrelated repositories in one commit or pull request.

## Continue validated downstream work

In `merge` mode, validated artifacts are executable decisions rather than another approval queue:

- Every candidate carrying `Verdict: Promote` plus a validator-passing proposal is approved for `Action: promote`. Do not ask a person to approve it again.
- Apply eligible proposals in deterministic proposal-path order. Exact prior-proposal or already-applied collisions reuse the established proposal/canonical and do not create a duplicate catalog change.
- `Watch` and `Reject` create no downstream writes.
- After the evidence PR merges, apply and merge the Brain work. Re-run capture preflight only after each required canonical is present on Brain `main`.
- Execute every capture that becomes `ready`; keep deterministic `deferred`, `blocked`, `skipped`, and `landed` states honest. Merge the Library PR and reconcile evidence lifecycle markers in dependency order.
- A validator-approved alias/new-pattern proposal and a `ready` capture are not human content decisions in this mode. Stop only for contradictory evidence, ambiguous identity, failed validation after the retry cap, required external review that automation cannot satisfy, or missing write capability.

## Make `## Next steps` run-specific

Before the final analyze or ingest validation, replace template instructions with the current run's real state:

- Start with `Next action:` and name the exact action, repository, branch or artifact path, and tracking issue.
- List dependencies in execution order. A capture for a new canonical names the exact proposal(s) that must land first.
- Give counts and exact paths for pending proposals, captures, and orchestration drafts. Omit empty destinations.
- Name the first unresolved external decision or capability as `Human decision:`. In `merge` mode, write `none` for validated Promote proposals and ready captures; their verdict/lifecycle state already authorizes continuation.
- Never tell the operator merely to "review the report" or "run the next step." Name what will execute automatically or the exact external blocker.

After tracking adds issue URLs or changes the branch state, update `## Next steps` and rerun `validate-report.cjs` before publication.

## Stop only on a real boundary

When a request explicitly selected a stop-early mode, do not end with a generic handoff. State the exact continuation that remains available:

```text
Next action: rerun with Publication: merge to commit, push, ready, and merge <repository> branch <branch> (tracking issue <url>).
```

For an ambiguity or blocker, state the known facts, the one missing decision/capability, and the exact continuation that answer unlocks. Authentication, dirty/stale main, merge conflict, missing write capability, failed validation after three attempts, and a repository-enforced review that automation cannot satisfy are real boundaries. Validated Promote/capture work, a routine next command, an already-authorized publication, a draft PR, or a check that is merely still running is not.

## Final handoff

Lead with outcome and the remaining action:

```text
Next action: <exact downstream action, or "complete" when the authorized chain merged>
Completed: <artifacts and repositories>
Published: <commit, branch, PR URL, merge commit, issue URL/state>
Checks: <passed, pending, or failed with links/details>
Audit: <Output>/execution-log.md (status and remaining work)
Human decision: <none, or one exact decision>
```

Include warnings and deferred work after this block. The operator should never have to infer whether the run is local-only, awaiting PR review, merged, waiting on a real external blocker, or complete.
