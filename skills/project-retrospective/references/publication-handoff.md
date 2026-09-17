# Authorized publication and exact handoff

Use this after an action has completed its writes, tracking, and validation. It separates routine continuation from the decisions that genuinely need a person.

## Resolve authority once

- `Publication: pull-request`, or an unambiguous current-request instruction to commit, push, and open a pull request, authorizes those operations for the repositories and issue branches named by the action.
- `Publication: working-tree` explicitly requests a local-only handoff.
- When the parameter is absent, use only explicit publication language in the current request. A general request to analyze, promote, capture, or "do it" is not commit/push authority.
- Do not ask again for authority already present. Do not broaden authority from one target repository or branch to another.
- The analyzed `Project` remains read-only under every publication mode.

Merge, tag, release, issue closure, Figma publication, and native Figma Dev Mode readiness remain outside this skill. A request for one of those actions does not invalidate the authorized commit/push/PR work: complete the permitted portion, then name the policy boundary as the remaining blocker.

## Continue automatically when authorized

For each action-owned repository, in dependency order:

1. Confirm the current branch is the exact issue/run branch emitted by tracking and the action-owned diff contains no unrelated changes.
2. Run the target repository's documented pre-push gate. Prefer `pnpm verify:push`; otherwise run the verification commands already required by the action. Fix in-scope failures under the normal three-attempt cap.
3. Stage only the action-owned write set and use the repository's commit helper (`pnpm commit`) when present. Read the resulting message and correct malformed issue references or a misleading subject before push.
4. Push only the exact current issue/run branch.
5. Let repository automation create or update its draft pull request. If none appears, use the repository's `pnpm pr:create`; when that helper cannot consume otherwise-valid GitHub authentication, use the authenticated GitHub CLI directly.
6. Read the saved pull request back. Verify its canonical URL, conventional title, base/head branches, draft state, issue link, body summary, and current checks. Do not claim green checks while any are pending or failing.
7. Return the commit, branch, pull-request URL, verification result, and the next downstream action. Do not leave routine commands for the operator to run.

When one action writes both private evidence and a shared downstream repository, publish the private evidence reconciliation first. Publish the shared repository only after its own complete verification passes. Never combine unrelated repositories in one commit or pull request.

## Make `## Next steps` run-specific

Before the final analyze or ingest validation, replace template instructions with the current run's real state:

- Start with `Next action:` and name the exact action, repository, branch or artifact path, and tracking issue.
- List dependencies in execution order. A capture for a new canonical names the exact proposal(s) that must land first.
- Give counts and exact paths for pending proposals, captures, and orchestration drafts. Omit empty destinations.
- Name the first unresolved content decision or publication permission as `Human decision:`. Write `none` when nothing is waiting on a person.
- Never tell the operator merely to "review the report" or "run the next step." Name what must be approved or executed.

After tracking adds issue URLs or changes the branch state, update `## Next steps` and rerun `validate-report.cjs` before publication.

## Stop only on a real boundary

Without publication authority, do not end with a generic handoff. Ask one exact question:

```text
Next action: authorize commit, push, and draft PR for <repository> branch <branch> (tracking issue <url>)?
```

For an ambiguity or blocker, state the known facts, the one missing decision/capability, and the exact continuation that answer unlocks. Authentication, dirty/stale main, missing write capability, failed validation after three attempts, and content approval are real boundaries. A routine next command, an already-authorized publication, or a check that is merely still running is not.

## Final handoff

Lead with outcome and the remaining action:

```text
Next action: <exact downstream action, or "human review and merge of <PR>" when policy is the only boundary>
Completed: <artifacts and repositories>
Published: <commit, branch, PR URL, issue URL>
Checks: <passed, pending, or failed with links/details>
Human decision: <none, or one exact decision>
```

Include warnings and deferred work after this block. The operator should never have to infer whether the run is local-only, published, waiting on checks, waiting on content approval, or ready for the next action.
