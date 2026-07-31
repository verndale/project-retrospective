# Code-scan mode

## Use when

Read this reference when:

- `inventory.json` reports `"mode": "code-scan"`.
- The warnings include `no-build-config`, `no-artifacts-root`, `no-component-index`, `heuristic-buckets`, or `unknown-adapter`.

Skip when the run is in `artifacts` mode — the pipeline evidence is richer and this document's caps do not apply.

## What code-scan mode means

The project has no pipeline artifacts to read: no `component-index.json`, no build packs. The inventory came from a stack-aware filesystem scan — the component file extensions and roots are chosen from the project's `stackAdapter`, and Storybook stories are folded in where the stack uses them (see below).

That gets you names and locations. It gets you nothing about contract, reuse, or intent. Treat the inventory as a list of *candidate* components, not a verified one.

## How the scan chose its extensions, roots, and signals

**Extensions and granularity come from the `stackAdapter` profile.** React-family adapters (`optimizely`, `sitecore-ai`, `contentstack`, `contentstack-sdk`) look for `.tsx`/`.jsx` and treat a directory that holds one as a component (recursive). The `toolkit` adapter looks for `.hbs` and treats each flat file or immediate folder under a root as a component (shallow). An unknown or absent adapter falls back to a broad extension set and records an `unknown-adapter` warning. Co-located test, spec, and story files (`*.test.tsx`, `*.spec.tsx`, `*.stories.tsx`) are never counted as components.

In the recursive case, a directory is one component when it holds a matching entry file (`Modal/Modal.tsx`), a single file, or a compound whose parts are all namespaced under the folder (`accordion/AccordionItem.tsx`, `AccordionTrigger.tsx`); a flat container of independent sibling files (`ui/icons/ArrowIcon.tsx`, `CloseIcon.tsx`) — or component files sitting directly at a bucket root — yields one component per file rather than collapsing to the folder.

**Roots**, in order, de-duplicated:

1. **`componentBuckets` from `build.config.json`** when present — trustworthy, since the project declared them. Every bucket is walked recursively, so rendering domains are discovered from the directory structure whether or not they are listed in `renderingDomains` (a declared domain that has no directory is flagged with `rendering-domain-missing`).
2. **The adapter profile's conventional roots** (e.g. `toolkit` → `frontend/src/html/{components,modules,templates}`) and a deprecated `reusableComponentsBase` pointer, when declared.
3. **A `layouts` root** derived alongside the buckets, so layouts and page templates are covered.
4. **Heuristic probe** only when nothing above is declared: `src/components`, `components`, `src/ui`, `app/components`, `frontend/src/html/{components,modules}`, `src/modules`. A `heuristic-buckets` warning records this; bucket and domain are usually `null`.

**Storybook** stories (`*.stories.*`) are a supplementary signal, not a first-class one — most projects have none and it is a no-op. For the `toolkit` stack, where Storybook is the component registry, each story contributes to the census (a `storybook` source), unioned with the markup.

This same scan **also runs in artifacts mode**, where it corroborates and supplements `component-index.json` rather than replacing it — so a component the index omitted is still found.

The recursive walk does not descend into a component's own subdirectories, skips `node_modules`, `__tests__`, `dist`, `.next`, and similar, and stops four levels below a root. Deeply nested or unconventional layouts will be under-reported — say so under Gaps.

## What still counts as evidence

- **`fingerprint.json`** next to a component — read even in this mode, and still a strong source.
- **Project memory** (`MEMORY.md`, `memory/*.md`) if the project has any — a component discussed by name is real.
- **The directory name itself** — the label to resolve. A kebab-case directory beside a PascalCase entry file is a genuine naming convention, not noise.
- **Co-located tests or stories** — evidence the component was built deliberately. Storybook stories are collected automatically (the `storybook` source); co-located tests are not — check by hand for a candidate you are considering promoting.

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
