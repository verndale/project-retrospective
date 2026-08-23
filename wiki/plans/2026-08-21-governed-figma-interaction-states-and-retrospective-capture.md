---
status: implemented
executed: 2026-08-21
date: 2026-08-21
evidence: ["issue #78", "working tree tests", "authenticated live Figma audit of 28 registered nodes"]
source_tool: file
source: "/tmp/governed-figma-interaction-states-plan.md"
topics: [library-capture]
---
# Governed Figma Interaction States and Retrospective Capture

## Summary

Add code-backed interaction-state frames to five Figma component families without changing their canonical masters or public React APIs. Extend project-retrospective so every future capture must classify visual and runtime states and carry that plan through Storybook, Figma promotion, tracking issues, and capture preflight.

## Phase 0 — Issues, Branches, and Discovery

- Create or reuse two GitHub issues using the fixed five-section issue template:
  - `ui-design-library`: `[Feature] Add governed Figma interaction-state frames`, labels `Feature` and `area: components`.
  - `project-retrospective`: `[Feature] Require Figma state coverage in component captures`, labels `Feature` and `area:tooling`.
- Before creating issues, verify GitHub authentication, confirm the labels still match their sanctioned definitions, and search for an exact open duplicate. The labels currently exist and both repositories currently have no open issues.
- After obtaining issue numbers, update each clean local `main` from `origin/main` with fast-forward only, then create:
  - `codex/<library-issue>-figma-interaction-states`
  - `codex/<retro-issue>-figma-state-capture-contract`
- Recheck alignment immediately before branching. `ui-design-library` is currently aligned; `project-retrospective` is currently two commits behind `origin/main`.
- Post the required Phase 0 checklist, then perform read-only Figma discovery:
  - Inspect pages, registered masters, variables, styles, and existing presentation conventions.
  - Call Figma library discovery before searching the design system.
  - Compare code, Storybook, the registry, and live Figma for the pilot families.
  - Produce a state gap analysis and pause for the required post-Phase-0 approval before any Figma writes.
- Keep both branches local. Do not commit, push, open PRs, publish Figma, merge, or release.

## Phase 1 — Library State Contract and Storybook Evidence

- Add a governed `figma.stateCoverage` contract to each covered registration:
  - `status`: `covered` or `not-applicable`
  - `storyExport`: normally `InteractionStates`
  - `states[]`: stable ID, label, source/target, and classification
  - Classifications: `rendered`, `already-represented`, or `runtime-only`
  - Visual states receive frame, instance, and component-node IDs after Figma creation.
  - Runtime-only states require a reason and cannot claim visual node IDs.
  - `not-applicable` requires a reason and an empty state list.
- Keep `figma/library.json` schema version 1; the new field is additive. Require it for future candidate captures while allowing untouched supported registrations to remain outside the pilot.
- Extend the promotion pattern, Figma README, and promotion checklist with an `Interaction states` presentation:
  - State frames are documentation specimens, not new master properties.
  - Canonical node identity and existing property APIs remain unchanged.
  - Instances stay connected to the registered master.
  - State labels remain outside the component instance.
  - State visuals use the same semantic variables as code; no raster screenshots or raw colors.
- Add an `InteractionStates` Storybook export for each pilot implementation. Force pseudo-states with targeted `parameters.pseudo` selectors and assert the rendered targets and meaningful computed-style differences in `play` functions.
- Pilot state inventory:
  - **Button family:** medium-size label and icon-only rows for every valid light/dark variant; Default, Hover, Focus visible, Disabled.
  - **Link:** Default, Hover, Focus visible, Disabled.
  - **Search input:** Empty, Filled, Results visible, Input focus visible, Clear hover, Submit hover, Control focus visible.
  - **Accordion:** Collapsed, Expanded, Trigger focus visible, Reveal collapsed, Reveal expanded.
  - **Tabs family:** Pills and Stroke selected/unselected rows, Unselected hover, Focus visible; include the native-select structural implementation and its mobile focus state.
- Do not invent Pressed, Loading, Error, or other states absent from the code.

## Phase 2 — Figma State Frames

- Cover five canonical families, including their related registrations:
  - Four Button registrations
  - Link
  - Search input
  - Accordion
  - Tabs and Tabs native-select
- Add a deterministic `Interaction states` frame after Main on each applicable canonical page. Use states as columns and variant/presentation/target as rows.
- Use existing component variants for `already-represented` states. Reproduce pseudo-state appearances through semantic-variable-bound instance overrides and documented focus-ring layers; do not detach instances or alter published masters.
- Record deterministic frame and instance IDs in each registration’s `stateCoverage`.
- After each component family:
  - Validate component-set metadata and connected instance containment.
  - Capture and review a page screenshot.
  - Check state differentiation, focus visibility, disabled contrast treatment, spacing, labels, clipping, and token bindings.
  - Fix findings in place without recreating canonical masters.
- Runtime-only behaviors—keyboard navigation, focus containment/restoration, inert handling, motion timing, and announcements—remain documented and tested in Storybook rather than represented by misleading static frames.

## Phase 3 — Project-Retrospective Integration

- Introduce source-parity schema version 2 for newly generated captures with a required `interactionStates` block:
  - `status`: `covered` or `not-applicable`
  - Each entry declares stable ID, label, source trigger (`pseudo`, public prop, derived state, or behavior), target, source citations, and Figma classification.
  - `rendered` identifies a new state specimen.
  - `already-represented` identifies an existing Figma property/variant reused in the matrix.
  - `runtime-only` requires evidence and a reason.
  - `not-applicable` requires an explicit component-level reason.
- Bump capture-preflight output to schema version 6 and return the validated interaction-state model separately from `componentJson`, like runtime architecture and source parity.
- Backward compatibility:
  - New analyze runs emit source-parity v2.
  - Pending, deferred, ready, or reopened actionable captures require v2.
  - Legacy v1 evidence remains readable only for captures already landed/skipped.
- Update the capture template, source-parity reference, library integrity checklist, runtime skill workflow, README, validators, fixtures, and tests.
- During `Action: capture`, require:
  - An `InteractionStates` Storybook story or an explicit not-applicable result.
  - The corresponding unpublished Figma state frames before review can pass.
  - Registry `stateCoverage` IDs and post-remediation source-parity, adversarial, and design evidence.
- Reuse the existing project-retrospective tracking lifecycle:
  - Actionable captures still create/reuse the labeled library issue first.
  - Clean aligned `main`, required Figma capability, and a non-empty write set remain prerequisites.
  - The runtime branch remains `feat/<issue-number>-library-capture`.
  - Missing Figma capability stops before branch creation.
- Update tracking-issue guidance so each library capture checkbox includes Storybook and Figma state coverage; do not add a second issue or branch workflow.

## Phase 4 — Verification and History

- `ui-design-library`:
  - Run `pnpm test:code` and `pnpm build` before Figma mutation.
  - After Figma registration, run `pnpm figma:coverage`, authenticated `pnpm figma:live`, `pnpm figma:validate`, `pnpm contracts`, `pnpm contracts:selftest`, `pnpm test`, and `pnpm build`.
  - Run `pnpm graphify:sync` and rebuild the repository graph/wiki artifacts.
- `project-retrospective`:
  - Cover valid v2 models and every malformed/legacy boundary in validator and preflight tests.
  - Add regression coverage proving state-aware captures still use the existing issue-first, clean-main branch lifecycle.
  - Run `pnpm graph:build` and `pnpm test`.
  - Review the skill against the current Anthropic skill-authoring best practices.
- In both repositories, archive this executed plan, add client-neutral journal entries, update the Figma/library-capture topic decisions, refresh indexes, and validate generated graph output.
- Completion requires live Figma validation and reviewed screenshots for all pilot families. Missing write-capable Figma access or a read-only validation token is a blocker, not a partial pass.

## Assumptions

- “Actual states” means states demonstrably present in code and Storybook, recreated with semantic Figma variables—not invented design states or screenshots.
- State frames are documentation and handoff specimens; designers will not receive a new selectable `State` property in v1.
- Existing canonical master IDs, component keys, property mappings, publication state, and React APIs remain unchanged.
- Any newly discovered code/Figma disagreement or missing semantic token becomes a decision fork during Phase 0 rather than being approximated.
