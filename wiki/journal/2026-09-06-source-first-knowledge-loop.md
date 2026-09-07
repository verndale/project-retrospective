---
date: 2026-09-06
topics: [retrospective-workflow, library-capture]
plan: plans/2026-09-06-source-first-knowledge-loop.md
pr: https://github.com/verndale/project-retrospective/pull/91
issue: https://github.com/verndale/project-retrospective/issues/90
issues: [https://github.com/verndale/project-retrospective/issues/90]
---
# Make the retrospective knowledge loop source-first

## Why

- Ordinary frontend repositories were treated as degraded input unless orchestration artifacts existed, even though their manifests, source graph, tests, stories, styles, and consumers already provide a deterministic inventory surface.
- Analyze drafted target architecture, realization, and Figma claims before a human selected a capture and before the pinned source was audited closely enough to support them.
- Manual prior-report selection allowed stale or invalid runs to influence recurrence and made a routine evidence loop depend on operator bookkeeping.
- The retained `PriorReports` compatibility input was initially inert: it returned existing paths in JSON without admitting their triage into recurrence, so it was not a real escape hatch when an eligible run lived outside `Data`.
- A resumed Figma capture could remain pending after capability returned, and the public Applied marker did not contain enough state evidence for the private evidence graph to verify landing independently.
- The first capture branch decision overloaded `ready`, so it could authorize a library branch before enrichment/preflight, and source parity could accidentally prove a different inventoried component.
- Nested example manifests and impossible date-shaped run directories could contaminate otherwise deterministic discovery and latest-run selection.
- Symlinked workspace/component/delivery/memory paths could escape the pinned repository, while symlinked evidence runs could inject external recurrence.
- Capture accepted ambiguous duplicate inventory owners and duplicate/malformed Source declarations, and source parity could be internally consistent while naming the wrong sibling run.
- Figma preflight expected obsolete interaction-state registry field names, so the actual governed library could fail despite being valid; a loose capability label could also impersonate the supported writer.
- Unsafe or duplicate capture/remediation identities could flow into deterministic tracking inputs before a branch was emitted.

## What changed

Inventory schema v1 now discovers ordinary single-package and workspace projects from the root plus explicitly admitted workspace manifests, exact framework/platform markers, conventional roots, imports, tests/stories/styles/tokens, consumers, and delivery configuration. Unrelated nested packages are excluded from workspace evidence. Pipeline artifacts remain optional corroboration. Exact platform conflicts stay unknown unless the operator supplies a canonical override.

Every source walk now stays inside the pinned checkout: unsafe configured roots fall back safely; workspace/component/delivery/artifact signals and cycles through symlinks are skipped with run-scoped warnings. The memory archive applies the same boundary to its root and nested shards instead of byte-copying an external symlink target.

Analyze now selects eligible cross-project recurrence automatically and emits lightweight pending capture intents only. `PriorReports` can explicitly supply an eligible run outside `Data`, or work without `Data`; real non-symlink run surfaces, sibling metadata/inventory/report platform parity, triage, and resolution must prove its identity, and all automatic/explicit inputs enter one latest-per-project merge. A stale explicit path warns and is omitted rather than overriding the newer run. Retrospective-only runs are excluded. One project's code/test/story family contributes one occurrence; prior Watch and Promote count, while Reject, invalid-calendar, identity-invalid, resolution-invalid, and superseded eligible runs do not. Intent structural identity is type-checked and keeps variant label, kebab key, filename, and report entry in exact parity.

Capture now gates the exact supported `figma-use` writer and live registry before branching and gives selected intents an explicit `enrichment-pending` stage that can prepare only the evidence run branch. Enrichment accepts exactly one safe Source declaration, joins source-parity project/run to sibling metadata, rejects multiple inventory owners, keeps snapshot/inspection/hash on the same file, and uses sibling resolution or a source-linked proposal alias to prove that owner belongs to the intended canonical. Only schema-v6 `ready` can authorize the library issue/branch. Missing source accessibility is explicit remediation. Preflight accepts the current governed library registry schema (rather than obsolete `presentation`/`masterPolicy`/`instancePolicy`/`labels` names), still rejects missing governed fields and Code Connect, and recognizes only `figma-use` as writer capability. The execution instructions preserve the live reference split and exact numbered Documentation/Main/structural-alternate/Interaction-states order with a separate unnumbered publish-source master. Modern Applied evidence carries unpublished Figma identity, reviews, and exact semantic state coverage; component-set and child-variant IDs may differ.

Tracking can branch private evidence before enrichment and resumes an existing library branch after a mid-run Figma loss. Code Connect, automatic publication, new artifact types, and relaxed hard exclusions were ruled out.

Tracking now validates component/remediation keys, project slugs, and real dates before deriving issue or branch output, so duplicate or path-shaped inputs fail deterministically.

## Files

- `skills/project-retrospective/SKILL.md`
- `skills/project-retrospective/scripts/inventory.cjs`
- `skills/project-retrospective/scripts/archive-memory.cjs`
- `skills/project-retrospective/scripts/prior-evidence.cjs`
- `skills/project-retrospective/scripts/lib/util.cjs`
- `skills/project-retrospective/scripts/source-parity.cjs`
- `skills/project-retrospective/scripts/capture-preflight.cjs`
- `skills/project-retrospective/scripts/tracking-targets.cjs`
- `skills/project-retrospective/scripts/validate-report.cjs`
- `skills/project-retrospective/references/`
- `scripts/tests/`

## Follow-ups

- Coordinate the same modern Applied projection with the private evidence graph before treating it as landing proof across repositories.
