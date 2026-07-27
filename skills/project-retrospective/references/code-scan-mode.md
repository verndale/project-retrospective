# Code-scan mode

## Use when

Read this reference when:

- `inventory.json` reports `"mode": "code-scan"`.
- The warnings include `no-build-config`, `no-artifacts-root`, `no-component-index`, or `heuristic-buckets`.

Skip when the run is in `artifacts` mode — the pipeline evidence is richer and this document's caps do not apply.

## What code-scan mode means

The project has no pipeline artifacts to read: no `component-index.json`, no build packs. The inventory came from walking directories and treating any directory that directly contains a `.tsx`/`.jsx`/`.vue`/`.svelte` file as a component.

That gets you names and locations. It gets you nothing about contract, reuse, or intent. Treat the inventory as a list of *candidate* components, not a verified one.

## How the scan chose its roots

1. **`componentBuckets` from `build.config.json`** when present — trustworthy, since the project declared them.
2. **Heuristic probe** otherwise: `src/components`, `components`, `src/ui`, `app/components`. A `heuristic-buckets` warning records this. Bucket and domain are usually `null`, and a directory that is a helper rather than a component may appear.

The scan does not descend into a component's own subdirectories, skips `node_modules`, `__tests__`, `dist`, `.next`, `stories`, and similar, and stops at four levels below a bucket root. Deeply nested or unconventional layouts will be under-reported — say so under Gaps.

## What still counts as evidence

- **`fingerprint.json`** next to a component — read even in this mode, and still a strong source.
- **Project memory** (`MEMORY.md`, `memory/*.md`) if the project has any — a component discussed by name is real.
- **The directory name itself** — the label to resolve. A kebab-case directory beside a PascalCase entry file is a genuine naming convention, not noise.
- **Co-located tests or stories** — evidence the component was built deliberately. The scan does not collect these; check by hand for a candidate you are considering promoting.

## The evidence cap

**A candidate evidenced only by `code-scan` caps at Watch.** One weak source cannot clear the rubric's two-source bar.

It can still reach Promote when either holds:

- A second source appears for that component in this project (`fingerprint`, `memory`).
- A `PriorReports` entry supplies the recurrence — the same label surfaced in another project's run.

Do not compensate by counting directories: five components in a folder is one source, not five.

## What to record under Gaps

Be explicit about what the mode could not see, so the reviewer reads the verdicts correctly:

- Every script warning, verbatim with its code.
- That no build packs existed, so DOM contracts, token usage, and acceptance criteria were unavailable.
- The roots that were probed and any that did not exist.
- Whether the project has tests, stories, or a design-token layer that a future run should read.
- That verdicts are capped at Watch absent a second source, with the count of candidates that cap affected. This is a cap on the *evidence*, not a confidence number — never express it as a score.

## Recommend the upgrade

A code-scan retrospective is the weakest version of this analysis. When the project is ongoing or a sibling project is starting, note in Next steps that running it through the build pipeline produces build packs and fingerprints, which makes the next retrospective materially better evidence. Frame it as what it is — an observation about evidence quality, not a mandate.
