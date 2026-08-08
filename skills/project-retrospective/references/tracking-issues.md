# Tracking issues — one per repo the retro touches

At the end of an `Action: analyze` run (Workflow Step 7), file a GitHub issue for each repo the run gives pending work, using the `github-issue-creator` skill — it drafts the issue, shows you the exact title and body, waits for your yes, and only then runs `gh issue create`. Never file silently. Filing reaches outside the working tree: get the maintainer's go-ahead first.

These issues are the tracking counterpart to the branches the skill's write-actions create off `main`: the **evidence** hub records the whole run, and the **brain** and **library** issues track the promote/capture work still to apply. `ai-orchestration` is out of scope here — its pipeline drafts are paste-ready notes the maintainer carries over by hand, with no issue and no branch.

## Which repos get an issue

Skip a repo with no pending work.

| Repo | File an issue when | Title | Names the client? |
|---|---|---|---|
| `verndale/ui-design-evidence` | the run landed under a `Data` = evidence checkout (Step 6 ran) | `[Feature] Record the <Client> <date> retrospective run` | yes — private repo |
| `verndale/ui-design-brain` | the run drafted catalog proposals (`proposals/*.md`) | `[Feature] <short pattern/alias summary>` | no — shared/public |
| `verndale/ui-design-library` | the run drafted captures (`captures/*.md`) | `[Feature] <short capture summary>` | no — shared/public |

- **ui-design-library** gets neither a branch nor an issue unless the run flagged a capture. No captures → no `Action: capture`, no library branch, no library issue.
- **ai-orchestration** gets no issue.
- In the home fallback (no `Data` = evidence checkout), there is no evidence repo to record — skip the evidence hub and say so; the brain and library issues still apply when their work exists.

## Title and body

Title is the github-issue-creator `[Feature] <summary>` format. The body uses that skill's fixed five sections (Summary / Context / Details / Expected Outcome / Additional Notes). Put the repo's pending work as a checklist in **Details**:

- **brain** — one checkbox per proposal in `proposals/*.md`: each new pattern and each new alias to apply, named by canonical.
- **library** — one checkbox per capture in `captures/*.md`, named by canonical.

The brain and library issues are **client-agnostic** — the same data boundary the proposals and downstream wiki follow. Describe the pattern, alias, or capture and its recurrence; never the client name, the run slug, or client copy.

## Labels

Label sets differ per repo, so run `gh label list --repo <owner>/<repo>` first. Then:

- **Type** — `Feature` on `ui-design-brain`, `ui-design-library`, and `ui-design-evidence`.
- **Area** — one label in the `area: <area>` convention (a space after the colon, lowercase): `area: catalog` (brain), `area: components` (library). Reuse an existing area label when one fits; create one in the `area: <area>` format when none does. Never apply a label the repo lacks.

## The evidence hub

`ui-design-evidence` is private, so its issue alone may name the client and cite run paths. It uses the same github-issue-creator five sections as the others — map the run-record content into them:

- **Summary** — the run: `<Client> <project-slug> <date>`.
- **Context** — that this records a completed retrospective run, on the run branch `feat/<project>-<date>-run`.
- **Details** — what's included: the run outputs (`runs/<project-slug>/<date>/`) and the wiki feed Step 6 wrote; link the brain issue, and the library issue when one was filed.
- **Expected Outcome** — the run is recorded and its downstream issues applied.
- **Additional Notes** — anything else, or "None".
