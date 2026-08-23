# Source-parity inventory

Use this contract before drafting or applying any component capture. It records which reusable behavior, visual layout, and invariants existed in the analyzed project, then proves how the normalized library represents or deliberately rejects each fact.

## Contents

- Source snapshot
- Audit matrix
- Interaction-state inventory
- Difference classifications
- Artifact contract
- Decision rules
- Validation and lifecycle

## Source snapshot

`inventory.cjs` records `sourceSnapshot.strategy`, the full Git `commit`, and whether the analyzed worktree was dirty. Always read cited source from the recorded commit, not the current worktree. A dirty worktree is a warning because the pinned commit remains reproducible while uncommitted files do not.

Historical inventories without a snapshot use one of two explicit strategies:

- `reconstructed` — select the last commit at or before `inventory.generatedAt`, record the full commit, and hash cited files from that commit.
- `legacy-untracked` — only when no commit can be recovered. Record the limitation; never present it as exact provenance.

Every citation is repository-relative, includes an inclusive positive line range, and carries the SHA-256 digest of the entire file at the pinned revision. Do not cite absolute paths or paths containing `..`.

Record the inspected source matrix separately from citations. `entryPoints`, `tests`, `styles`, `buildPacks`, `directImporters`, and `composedConsumers` each declare `status: reviewed | not-present` plus repository-relative `paths`. A reviewed category requires at least one path; `not-present` requires an empty list. Verification proves every listed path exists in the pinned Git object. Citations support observations; the inspection matrix proves the required search was actually performed.

## Audit matrix

Review every surface; do not infer one from another:

1. Source behavior — state transitions, keyboard/pointer behavior, focus, announcements, and authored interactions.
2. Source visual layout — responsive sizing, ordering, overflow, cardinality, peek/containment, and exact values that define recognition.
3. Source invariants — semantics, accessible names, native structures, IDREFs, motion/reduced-motion, and ownership boundaries.
4. Normalized code — public TypeScript API, defaults, DOM, styling, and implementation architecture.
5. Storybook — controlled props, representative compositions, widths, an `InteractionStates` export (or explicit component-level not-applicable result), forced pseudo-state evidence, and play-function evidence for runtime behavior.
6. Figma — canonical master, public properties, variants, responsive specimens, stable identity, and state specimens linked to the registered master.
7. AI registry — canonical/variant resolution, export, rendering, reuse fingerprint, and realization.

Inspect direct importers and composed consumers when they own sizing or composition. A primitive's source directory alone is insufficient when the recognizable behavior is applied by its consumers.

Reject client branding, copy, CMS data mapping, analytics, routing, and project orchestration unless they expose a reusable invariant. Record the rejection; do not silently drop the fact.

## Interaction-state inventory

Every source-parity v2 artifact has an `interactionStates` block. Use `status: covered` when source or normalized code exposes any user-observable interaction state. Use `status: not-applicable` only with an explicit component-level reason and `states: []`; it does not declare a Storybook export.

A covered inventory uses `storyExport: InteractionStates`. Each state declares:

- a stable lowercase dot/kebab `id` and human `label`;
- `source.trigger`: `pseudo`, `public-prop`, `derived-state`, or `behavior`, plus the exact source `value`;
- the rendered or behavioral `target` and one or more declared `sourceCitationIds`;
- Figma `classification`: `rendered`, `already-represented`, or `runtime-only`.

`rendered` means the Figma matrix needs a new connected state specimen. `already-represented` means the matrix reuses an existing public property or master variant. Both receive frame, instance, and component-node IDs later in `figma.library.json`, never in private source-parity evidence. `runtime-only` is reserved for behavior across time—keyboard navigation, focus containment/restoration, inert handling, motion timing, and announcements. It must use the `behavior` trigger and include a reason plus non-empty executable evidence. Never turn it into a misleading static frame.

Do not invent states. If Pressed, Loading, Error, or another state is absent from source and normalized code, it is absent from this inventory.

## Difference classifications

Every `difference` observation uses exactly one classification:

| Classification | Meaning | Decision |
|---|---|---|
| `intentional-declienting` | Project-specific behavior was deliberately removed and should remain absent. | `document` |
| `semantic-public-prop` | Reusable behavior belongs in the public component API. | `accept` |
| `composition-specimen` | Existing component APIs already express it; documentation/specimens were missing. | `accept` |
| `structural-alternate` | Same role, affordance, and interaction semantics require a distinct structural implementation. | `accept` |
| `new-brain-canonical` | Role, affordance, or interaction semantics differ and need a new canonical. | `accept` |
| `rejection` | The fact is not reusable library behavior. | `reject` |

Styling alone never creates a new canonical. A structural alternate stays in the same canonical family. A `new-brain-canonical` decision is the only classification that authorizes brain tracking.

## Artifact contract

Write exactly one `source-parity/<component-key>.json` beside each `captures/<component-key>.md`. Default and structural-alternate keys follow the capture filename exactly.

```json
{
  "schemaVersion": 2,
  "componentKey": "notice-panel",
  "canonical": "Notice panel",
  "capture": "captures/notice-panel.md",
  "status": "actionable",
  "remediationStatus": "pending",
  "sourceSnapshot": {
    "project": "synthetic-project",
    "run": "runs/synthetic-project/2026-01-01/",
    "entry": "src/components/notice-panel/NoticePanel.tsx",
    "revision": {
      "strategy": "recorded",
      "commit": "0123456789012345678901234567890123456789",
      "inventoryGeneratedAt": "2026-01-01T00:00:00.000Z"
    },
    "citations": [{
      "id": "src-notice-panel",
      "path": "src/components/notice-panel/NoticePanel.tsx",
      "startLine": 1,
      "endLine": 80,
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }]
  },
  "sourceInspection": {
    "entryPoints": { "status": "reviewed", "paths": ["src/components/notice-panel/NoticePanel.tsx"] },
    "tests": { "status": "reviewed", "paths": ["src/components/notice-panel/NoticePanel.test.tsx"] },
    "styles": { "status": "not-present", "paths": [] },
    "buildPacks": { "status": "not-present", "paths": [] },
    "directImporters": { "status": "reviewed", "paths": ["src/features/alerts/Alerts.tsx"] },
    "composedConsumers": { "status": "not-present", "paths": [] }
  },
  "coverage": {
    "sourceBehavior": "reviewed",
    "sourceVisualLayout": "reviewed",
    "sourceInvariants": "reviewed",
    "normalizedCode": "reviewed",
    "storybook": "reviewed",
    "figma": "reviewed",
    "aiRegistry": "reviewed"
  },
  "interactionStates": {
    "status": "covered",
    "storyExport": "InteractionStates",
    "states": [
      {
        "id": "notice.dismiss-hover",
        "label": "Dismiss hover",
        "source": { "trigger": "pseudo", "value": ":hover" },
        "target": "Dismiss button",
        "sourceCitationIds": ["src-notice-panel"],
        "classification": "rendered"
      },
      {
        "id": "notice.dismiss-announcement",
        "label": "Dismiss announcement",
        "source": { "trigger": "behavior", "value": "dismissal status announcement" },
        "target": "Assistive-technology announcement",
        "sourceCitationIds": ["src-notice-panel"],
        "classification": "runtime-only",
        "reason": "An announcement requires executable assistive-technology evidence and has no honest static appearance.",
        "evidence": ["notice.dismiss.announcement"]
      }
    ]
  },
  "observations": [{
    "id": "sp-notice-panel-001",
    "kind": "behavior",
    "sourceFact": "The source exposes a dismissible state.",
    "sourceValues": {},
    "sourceCitationIds": ["src-notice-panel"],
    "normalizedEvidence": {
      "code": [],
      "storybook": [],
      "figma": [],
      "aiRegistry": []
    },
    "comparison": "difference",
    "classification": "semantic-public-prop",
    "decision": "accept",
    "implementationStatus": "pending",
    "targetSurfaces": ["code", "storybook", "figma", "ai-registry"]
  }],
  "reviews": {
    "sourceParity": { "status": "passed", "phase": "decision", "evidence": ["reviews/source-parity.md"] },
    "adversarial": { "status": "pending", "evidence": [] },
    "design": { "status": "pending", "evidence": [] }
  }
}
```

Allowed observation kinds are `behavior`, `visual-layout`, and `invariant`. Allowed target surfaces are `code`, `storybook`, `figma`, `ai-registry`, `brain`, and `evidence`.

New analyze runs always emit schema v2. Pending, deferred, ready, or reopened actionable captures require v2. A schema-v1 companion remains readable only when its matching capture is already landed/skipped; reactivation requires upgrading the companion to v2 before work resumes.

Use `remediationStatus: not-required` when no accepted difference exists, `pending` while any accepted decision remains unrepresented, and `complete` only after every accepted decision is represented and fresh review evidence exists. `status` is `actionable` only while remediation is pending; it becomes `cleared` for `not-required` or completed work. Preserved observations use `classification: null`, `decision: document`, `implementationStatus: not-required`, and no remediation targets. Accepted observations use `implementationStatus: pending` or `complete`.

## Decision rules

- State source facts in client-neutral terms even though the artifact stays private.
- Preserve exact source values when they define the behavior. Never replace them with an estimated percentage, nearest token, or visual guess.
- Cite every observation to at least one declared source citation.
- Put evidence for every normalized surface in its own array. An empty array means the surface was reviewed and the behavior is absent, not that review was skipped.
- Accepted classifications require at least one target surface.
- Every observation records `implementationStatus`; a completed accepted decision is invalid until both adversarial and design review are passed with evidence.
- Rejections have no target surfaces.
- `intentional-declienting` documents an intentional absence and does not create implementation work.
- When applying an accepted decision to the public library, retain one audited family identity and set its `implementationKey` to the exact default or `components/<slug>--<variant>` directory that owns the representation. New captures cannot use the legacy baseline's null structural-target exception.
- Complete the `decision` source-parity review before component implementation. It cannot cite the decision JSON itself. Completed remediation requires a fresh `post-remediation` source-parity pass plus adversarial and design passes after the changed code, Storybook, unpublished Figma representation, and AI metadata agree.

## Validation and lifecycle

Run the validator during authoring:

```bash
node <skill>/scripts/source-parity.cjs \
  --source-parity <Output>/source-parity \
  --captures <Output>/captures \
  --project <Project> \
  --verify-source \
  --pretty
```

`validate-report.cjs` invokes the same implementation and fails a full run when cardinality, inspected-source coverage, citations and real line ranges, normalized coverage, interaction-state classification, decisions, review phases, or pinned hashes do not validate. `capture-preflight.cjs` revalidates structure, returns `interactionStates` separately from `componentJson`, `architecture`, and the source-parity decision summary in its schema-v6 plan, and blocks any capture without a passed source-parity review.

Historical landed/skipped schema-v1 captures remain readable. If one becomes actionable again, upgrade its companion to v2 before preflight; use `reconstructed` provenance where possible and `legacy-untracked` only when recovery is impossible.

The source-parity artifact records the decision's implementation state at run handback. Capture `## Progress` and `## Applied` continue to record the detailed implementation lifecycle. Do not rewrite a historical artifact merely because later library work supersedes it; write the later audit/lifecycle record in the private evidence repository.
