---
aliases: [analyze path, retrospective run, component inventory, label resolution, evidence triage, promote watch reject]
covers: [skills/project-retrospective/SKILL.md, skills/project-retrospective/scripts/inventory.cjs, skills/project-retrospective/scripts/resolve.cjs, skills/project-retrospective/scripts/validate-report.cjs, skills/project-retrospective/scripts/normalize-specs.cjs, skills/project-retrospective/scripts/adf-to-markdown.cjs, skills/project-retrospective/references/spec-capture.md]
---
# Retrospective workflow — Design History

The analyze path: what a completed project is read for, how its labels are resolved, and what gates the output.

## Current state

- Three deterministic scripts do the mechanical work. `inventory.cjs` reads pipeline artifacts (build packs, component index, fingerprints, project memory) and unions them with a stack-aware filesystem scan: `stackAdapter` selects the component extensions and roots, the scan runs in both modes so it recovers components the index omitted, and Storybook is counted where the stack uses it. `resolve.cjs` matches every component label against the ui-design-brain manifest. `validate-report.cjs` is the sanctioned validator for a run's output directory.
- Resolution is exact after normalization — lowercase, camelCase-boundary split, spaces and underscores collapsed to hyphens. No stemming, no plural folding, no nearest-match. A label resolves or it is novel.
- A label that maps to two canonicals through a context-scoped alias is reported `ambiguous` with its candidates; the script never picks. The model confirms from usage evidence or demotes the label to unresolved.
- The model's only job is judgment: triage into Promote / Watch / Reject with cited evidence, then draft prose. Verdicts carry evidence paths, never numeric scores.
- The validator runs under a stated cap of three attempts. On the third failure the run stops and reports the remaining failures verbatim rather than reshaping output to satisfy the validator.
- Captures are a separate track from proposals: the best component-library candidates are labels that already resolve cleanly, not novel ones. They are enumerated in the report's `## Captures` section and held in two-way parity with `captures/` — see [library capture](library-capture.md).
- The report's three downstream sections each pair with one artifact and one repo: `## Candidates` with `proposals/` for ui-design-brain, `## Captures` with `captures/` for ui-design-library, `## Learnings` with `orchestration-drafts.md` for ai-orchestration.

## Decisions

- 2026-08-08 — chore(project-retrospective): Update documentation for tracking issues p ([PR #55](https://github.com/verndale/project-retrospective/pull/55))
- 2026-08-08 — feat(project-retrospective): Update triage schema and related documentat ([PR #52](https://github.com/verndale/project-retrospective/pull/52))
- 2026-08-08 — fix(normalize-specs): Read the gate from a bold or bare Status row ([PR #49](https://github.com/verndale/project-retrospective/pull/49))
- 2026-08-03 — chore(project-retrospective): Update report template and validation test ([PR #45](https://github.com/verndale/project-retrospective/pull/45))
- 2026-08-03 — chore(project-retrospective): Update graph data and enhance wiki documen ([PR #43](https://github.com/verndale/project-retrospective/pull/43))
- 2026-08-03 — feat(project-retrospective): Update graph data and enhance markdown conv ([PR #40](https://github.com/verndale/project-retrospective/pull/40))
- 2026-08-03 — feat(project-retrospective): Add specs input handling to project retrosp ([PR #38](https://github.com/verndale/project-retrospective/pull/38))
- 2026-08-03 — fix(project-retrospective): Update memory archive logic to exclude index ([PR #36](https://github.com/verndale/project-retrospective/pull/36))
- 2026-08-03 — `validate-report.cjs --data` flags a capture or proposal a prior run already made (`capture-duplicate` / `proposal-duplicate`) — the analyze-draft dedup the Breadcrumbs re-capture exposed, keyed on prior artifacts so cross-run recurrence stays valid evidence. `adf-to-markdown.cjs` renders spec media as markdown links (private Confluence images, not mirrored into the repo) and keeps whitespace outside emphasis delimiters so an ADF strong run like `**label: **` renders instead of showing literal asterisks ([journal](../journal/2026-08-03-prior-art-dedup-and-spec-images.md))
- 2026-08-02 — Spec capture fetches from the Atlassian REST API (id-addressed — no truncated searches or wrong-page returns) as ADF rendered by the vendored `adf-to-markdown.cjs`, and `normalize-specs.cjs` reconciles the capture against a per-batch enumeration (`source.batches`) so completeness is a deterministic script warning, not a prose count. MCP stays a documented fallback ([journal](../journal/2026-08-02-spec-capture-rest-api.md))
- 2026-08-02 — feat(project-retrospective): Add archive memory functionality and tests ([PR #33](https://github.com/verndale/project-retrospective/pull/33))
- 2026-08-01 — feat(project-retrospective): Enhance fingerprint normalization and testi ([PR #30](https://github.com/verndale/project-retrospective/pull/30))
- 2026-07-31 — feat(project-retrospective): Add new components for brand mark and cart  ([PR #27](https://github.com/verndale/project-retrospective/pull/27))
- 2026-07-31 — Both scanners share one `classifyComponentDir` rule for whether a directory is one component or a folder of siblings, rather than the shallow scan collapsing every subfolder to a folder-named component. Ruled out making `toolkit` recursive: same result on the trees measured, but it discards the boundary that keeps template stacks out of partial trees ([journal](../journal/2026-07-31-shallow-scan-sibling-folders.md), [plan](../plans/2026-07-31-fix-the-shallow-scan-folder-collapse-in-inventory-cjs.md))
- 2026-07-31 — feat(project-retrospective): Add new components and update graph data ([PR #24](https://github.com/verndale/project-retrospective/pull/24))
- 2026-07-31 — Made discovery stack-aware (`stackAdapter` → extensions/roots/Storybook) and unioned a filesystem scan with the index in both modes; demoted `renderingDomains` to a drift check and gated Storybook to the stacks that use it, rather than trusting the index or keying discovery on declared domains ([journal](../journal/2026-07-31-stack-aware-inventory-discovery.md), [plan](../plans/2026-07-31-stack-aware-inventory-discovery.md))
- 2026-07-31 — feat(project-retrospective): Enhance proposal validation logic ([PR #21](https://github.com/verndale/project-retrospective/pull/21))
- 2026-07-30 — feat(project-retrospective): Update graph data and enhance documentation ([PR #19](https://github.com/verndale/project-retrospective/pull/19))
- 2026-07-30 — feat(project-retrospective): Enhance client wiki integration and documen ([PR #16](https://github.com/verndale/project-retrospective/pull/16))
- 2026-07-30 — Added Step 6 (wiki feed) and a machine-readable `meta.json` identity contract, so an analyze run feeds a per-client knowledge wiki in ui-design-evidence; `validate-report.cjs` gained `checkMeta` at full/candidates scope, and identity stays model-written so the deterministic scripts remain client-agnostic ([journal](../journal/2026-07-30-client-wiki-feed.md)).
- 2026-07-30 — feat(project-retrospective): Update graph data and enhance capture prefl ([PR #13](https://github.com/verndale/project-retrospective/pull/13))
- 2026-07-27 — feat(project-retrospective): Enhance capture functionality in project ([PR #10](https://github.com/verndale/project-retrospective/pull/10))
- 2026-07-27 — `## Captures` is required at `full` scope only, alongside Learnings, because it pairs with an artifact the drafting step produces and `Scope: candidates` waives that step. A run that captured nothing keeps the heading and says so in prose; nothing regexes that sentence ([journal](../journal/2026-07-27-auditable-captures-and-capture-action.md)).
- 2026-07-27 — `sections()` and `fencedBlock()` moved from `validate-report.cjs` into `scripts/lib/util.cjs` rather than being copied into the new preflight script. Two fence-aware parsers diverge silently the first time one is fixed ([journal](../journal/2026-07-27-auditable-captures-and-capture-action.md)).
- 2026-07-27 — feat(project-retrospective): Enhance graph builder to include module ([PR #7](https://github.com/verndale/project-retrospective/pull/7))
- 2026-07-27 — chore(ci): Add workflows for wiki issue synchronization ([PR #1](https://github.com/verndale/project-retrospective/pull/1))
- 2026-07-26 — Rejected the original proposal's 20-subagent fan-out and its numeric promotion, architectural, and confidence scores. Discovery, resolution, and validation are deterministic scripts; uncalibrated numbers are noise ([journal](../journal/2026-07-26-build-project-retrospective-skill.md), [plan](../plans/2026-07-26-project-retrospective-critique-build-plan.md)).
- 2026-07-26 — Reversed the plan's in-project `Output:` default. The analyzed project is strictly read-only; runs land in the private evidence repo instead ([plan](../plans/2026-07-26-project-retrospective-critique-build-plan.md)).
