---
date: 2026-07-31
topics: [retrospective-workflow]
plan: plans/2026-07-31-fix-the-shallow-scan-folder-collapse-in-inventory-cjs.md
pr: pending
issue: https://github.com/verndale/project-retrospective/issues/26
---
# Read a grouping folder the same way at both scan granularities

## Why

- Measuring the stack-aware discovery change against live checkouts — before deciding whether
  earlier runs were worth re-running — surfaced two defects in the `toolkit` path.
- `scanBucketShallow` treated **every** immediate subdirectory as exactly one component named
  after the folder. Right for `card/card.hbs`; wrong for a folder that groups unrelated primitives.
- Two symptoms, one cause: a `components/<group>/` folder of independent siblings collapsed to one
  component and its primitives were never discovered; a `modules/<group>/` folder of page partials
  emitted a component literally named `<group>`.
- The blast radius was hidden by Storybook. On the measured checkout the real component inside the
  grouping folder survived only because a story happened to carry it — a `toolkit` project without
  that story coverage loses the component and gains a junk label.
- `scanBucket` had decided this correctly since the stack-aware change. The rule existed; only one
  of the two scanners had it.

## What changed

- Extracted the one-component-vs-siblings decision out of `scanBucket`'s leaf branch into a
  module-scope `classifyComponentDir(folderName, compFiles, fileRe)`, and called it from both
  scanners. `isBarrelName` moved to module scope with it.
- A directory is one component when it holds a single file, names a matching entry file, or is a
  compound whose every part is namespaced under the folder. Otherwise its files are independent
  siblings, each its own component, and the folder is not recorded. Shallow-scanned siblings carry
  the containing folder as their `domain`, matching what the recursive scanner records.
- `scanBucket` is behavior-preserving: the classifier is consulted only from depth 1 down, so
  component files at a bucket root still take the flat path. Verified by diffing a React checkout's
  full component records before and after — byte-identical.
- Ruled out: giving `toolkit` `granularity: 'recursive'` and deleting the shallow scanner. It
  reaches the same result on the trees measured, but discards a deliberate boundary — the shallow
  profile exists so template stacks do not descend into partial trees — for a larger change than
  the defect needs.
- Accepted: page-chrome partials inside a grouping folder now surface as components (trivially
  Rejected in triage; filtering them would need a denylist with no signal behind it), and emitting
  siblings can raise additional `duplicate-component` warnings where a label is genuinely reachable
  from more than one path. On the measured toolkit checkout that is exactly one new warning, and it
  reports a real ambiguity.

## Files

- skills/project-retrospective/scripts/inventory.cjs
- skills/project-retrospective/references/code-scan-mode.md
- scripts/tests/inventory.test.cjs, scripts/tests/fixtures/fake-project-toolkit

## Follow-ups

- Carried from the stack-aware change and still open: flat layouts surface icon sets as many
  components, so triage and resolution should treat icon-class labels as a set rather than as
  distinct promotable patterns. That is a triage-rubric change, not a discovery one.
- A folder whose only component files are two or more barrels (`chrome/index.hbs` +
  `chrome/index.handlebars`, reachable because the `toolkit` profile carries two extensions) is
  classified as siblings and then emits nothing, with no warning. `pushFlat` has the identical
  hole, so the two scanners stay consistent — but it is a silent drop, and the honest fix is a
  warning shared by both rather than a guard on one.
