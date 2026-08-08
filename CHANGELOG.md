# v1.14.1 — 2026-08-08

## Summary (AI, bounded)
- Fixed normalize-specs to properly read the gate from a bold or bare Status row (commit 1f51385).
- Updated CI workflows by removing unnecessary push steps (commit 37aaeae).
- Enhanced project retrospective documentation, including updates to AGENTS.md with branch and ticket guidelines and improvements to report templates and validation tests (commits af12501, 7c09634).
- Synced wiki documentation including journal, topics, and plans across multiple updates (commits 5d51d37, 472aefa, 8229ee1).
- Merged several pull requests to facilitate documentation synchronization and fixes (commit 553cb12).

## Highlights
- commit: Merge pull request #49 from verndale/fix/normalize-specs-status-gate (553cb12)
- fix(normalize-specs): Read the gate from a bold or bare Status row (1f51385)
- chore(ci): Update workflows to remove unnecessary push (37aaeae)
- chore(project-retrospective): Update AGENTS.md with branch and ticket guidelines (af12501)
- commit: Merge pull request #47 from verndale/bot/wiki-sync/45 (7ae3e76)
- docs(wiki): sync journal, topics, and plans for #45 (8229ee1)
- commit: Merge pull request #45 from verndale/feat/gotchas-in-documentation (4ab0632)
- chore(project-retrospective): Update report template and validation tests (7c09634)

## Breaking changes
- None

## Changes by type
### Fixes
- fix(normalize-specs): Read the gate from a bold or bare Status row (1f51385)

### Docs
- docs(wiki): sync journal, topics, and plans for #40 (5d51d37)
- docs(wiki): sync journal, topics, and plans for #43 (472aefa)
- docs(wiki): sync journal, topics, and plans for #45 (8229ee1)

### Chore
- chore(ci): Update workflows to remove unnecessary push (37aaeae)
- chore(project-retrospective): Update AGENTS.md with branch and ticket guidelines (af12501)
- chore(project-retrospective): Update graph data and enhance wiki documentation (71d07cd)
- chore(project-retrospective): Update report template and validation tests (7c09634)

### Other (unknown)
- commit: Merge pull request #41 from verndale/bot/wiki-sync/40 (9b721ef)
- commit: Merge pull request #43 from verndale/fix/analyze-rebuild-evidence-generated-trees (680563e)
- commit: Merge pull request #44 from verndale/bot/wiki-sync/43 (1b3db98)
- commit: Merge pull request #45 from verndale/feat/gotchas-in-documentation (4ab0632)
- commit: Merge pull request #47 from verndale/bot/wiki-sync/45 (7ae3e76)
- commit: Merge pull request #49 from verndale/fix/normalize-specs-status-gate (553cb12)

## Full commit list
- 553cb12 commit: Merge pull request #49 from verndale/fix/normalize-specs-status-gate
- 1f51385 fix(normalize-specs): Read the gate from a bold or bare Status row
- 37aaeae chore(ci): Update workflows to remove unnecessary push
- af12501 chore(project-retrospective): Update AGENTS.md with branch and ticket guidelines
- 7ae3e76 commit: Merge pull request #47 from verndale/bot/wiki-sync/45
- 8229ee1 docs(wiki): sync journal, topics, and plans for #45
- 4ab0632 commit: Merge pull request #45 from verndale/feat/gotchas-in-documentation
- 7c09634 chore(project-retrospective): Update report template and validation tests
- 1b3db98 commit: Merge pull request #44 from verndale/bot/wiki-sync/43
- 472aefa docs(wiki): sync journal, topics, and plans for #43
- 680563e commit: Merge pull request #43 from verndale/fix/analyze-rebuild-evidence-generated-trees
- 71d07cd chore(project-retrospective): Update graph data and enhance wiki documentation
- 9b721ef commit: Merge pull request #41 from verndale/bot/wiki-sync/40
- 5d51d37 docs(wiki): sync journal, topics, and plans for #40

# v1.14.0 — 2026-08-03

## Summary (AI, bounded)
- Introduced enhancements to markdown conversion and updated graph data in the project-retrospective feature (fda55ba).
- Fixed graph data issues and improved the validation script within the project-retrospective module (031b3ac).
- Merged pull request for prior art check and specification images (b33be6e).

## Highlights
- commit: Merge pull request #40 from verndale/feat/prior-art-check-and-spec-images (b33be6e)
- fix(project-retrospective): Update graph data and enhance validation script (031b3ac)
- feat(project-retrospective): Update graph data and enhance markdown conversion (fda55ba)

## Breaking changes
- None

## Changes by type
### Features
- feat(project-retrospective): Update graph data and enhance markdown conversion (fda55ba)

### Fixes
- fix(project-retrospective): Update graph data and enhance validation script (031b3ac)

### Other (unknown)
- commit: Merge pull request #40 from verndale/feat/prior-art-check-and-spec-images (b33be6e)

## Full commit list
- b33be6e commit: Merge pull request #40 from verndale/feat/prior-art-check-and-spec-images
- 031b3ac fix(project-retrospective): Update graph data and enhance validation script
- fda55ba feat(project-retrospective): Update graph data and enhance markdown conversion

# v1.13.0 — 2026-08-03

## Summary (AI, bounded)
- Updated graph data and added tests for ADF in the project retrospective module.
- Implemented in commit a03ab13.
- No breaking changes introduced in this release.

## Highlights
- feat(project-retrospective): Update graph data and add tests for ADF to (a03ab13)

## Breaking changes
- None

## Changes by type
### Features
- feat(project-retrospective): Update graph data and add tests for ADF to (a03ab13)

## Full commit list
- a03ab13 feat(project-retrospective): Update graph data and add tests for ADF to

# v1.12.0 — 2026-08-03

## Summary (AI, bounded)
- Enhanced project retrospective feature with improved spec normalization and source tracking (commit 9f307e2).
- Synchronized wiki content including journal, topics, and plans to ensure up-to-date documentation (commit d2ee62f).
- Merged pull request to update bot wiki synchronization processes (commit 7b4bab2).

## Highlights
- feat(project-retrospective): Enhance spec normalization with source tracking (9f307e2)
- commit: Merge pull request #39 from verndale/bot/wiki-sync/38 (7b4bab2)
- docs(wiki): sync journal, topics, and plans for #38 (d2ee62f)

## Breaking changes
- None

## Changes by type
### Features
- feat(project-retrospective): Enhance spec normalization with source tracking (9f307e2)

### Docs
- docs(wiki): sync journal, topics, and plans for #38 (d2ee62f)

### Other (unknown)
- commit: Merge pull request #39 from verndale/bot/wiki-sync/38 (7b4bab2)

## Full commit list
- 9f307e2 feat(project-retrospective): Enhance spec normalization with source tracking
- 7b4bab2 commit: Merge pull request #39 from verndale/bot/wiki-sync/38
- d2ee62f docs(wiki): sync journal, topics, and plans for #38

# v1.11.0 — 2026-08-03

## Summary (AI, bounded)
- Added specs input handling to project retrospective feature (commit 829064f)
- Synchronized journal, topics, and plans in the wiki documentation (commit 0dcd400)
- Merged pull request for capturing confluence specs (commit f2009a2)
- Merged wiki sync pull request for improvements (commit 00b64c7)

## Highlights
- commit: Merge pull request #38 from verndale/feat/35-capture-confluence-specs (f2009a2)
- feat(project-retrospective): Add specs input handling to project retrospective (829064f)
- commit: Merge pull request #37 from verndale/bot/wiki-sync/36 (00b64c7)
- docs(wiki): sync journal, topics, and plans for #36 (0dcd400)

## Breaking changes
- None

## Changes by type
### Features
- feat(project-retrospective): Add specs input handling to project retrospective (829064f)

### Docs
- docs(wiki): sync journal, topics, and plans for #36 (0dcd400)

### Other (unknown)
- commit: Merge pull request #37 from verndale/bot/wiki-sync/36 (00b64c7)
- commit: Merge pull request #38 from verndale/feat/35-capture-confluence-specs (f2009a2)

## Full commit list
- f2009a2 commit: Merge pull request #38 from verndale/feat/35-capture-confluence-specs
- 829064f feat(project-retrospective): Add specs input handling to project retrospective
- 00b64c7 commit: Merge pull request #37 from verndale/bot/wiki-sync/36
- 0dcd400 docs(wiki): sync journal, topics, and plans for #36

# v1.10.1 — 2026-08-03

## Summary (AI, bounded)
- Updated memory archive logic to exclude the index file in the project retrospective feature (commit d38352b).
- Synced journal, topics, and plans documentation in the wiki (commit 07fee73).
- Merged feature branch for memory archive improvements (commit b0aa9ac).
- Integrated automated wiki synchronization updates (commit aff8d91).

## Highlights
- commit: Merge pull request #36 from verndale/feat/memory-archive (b0aa9ac)
- fix(project-retrospective): Update memory archive logic to exclude index file (d38352b)
- commit: Merge pull request #34 from verndale/bot/wiki-sync/33 (aff8d91)
- docs(wiki): sync journal, topics, and plans for #33 (07fee73)

## Breaking changes
- None

## Changes by type
### Fixes
- fix(project-retrospective): Update memory archive logic to exclude index file (d38352b)

### Docs
- docs(wiki): sync journal, topics, and plans for #33 (07fee73)

### Other (unknown)
- commit: Merge pull request #34 from verndale/bot/wiki-sync/33 (aff8d91)
- commit: Merge pull request #36 from verndale/feat/memory-archive (b0aa9ac)

## Full commit list
- b0aa9ac commit: Merge pull request #36 from verndale/feat/memory-archive
- d38352b fix(project-retrospective): Update memory archive logic to exclude index file
- aff8d91 commit: Merge pull request #34 from verndale/bot/wiki-sync/33
- 07fee73 docs(wiki): sync journal, topics, and plans for #33

# v1.10.0 — 2026-08-02

## Summary (AI, bounded)
- Added archive memory functionality and tests to project retrospective (commit 653ce10).
- Synced journal, topics, and plans documentation in the wiki (commit 8cbf1c5).
- Merged pull request #33 related to capturing project memory (commit ecf31bd).
- Merged pull request #31 for wiki synchronization updates (commit 5986457).

## Highlights
- commit: Merge pull request #33 from verndale/feat/32-capture-project-memory (ecf31bd)
- feat(project-retrospective): Add archive memory functionality and tests (653ce10)
- commit: Merge pull request #31 from verndale/bot/wiki-sync/30 (5986457)
- docs(wiki): sync journal, topics, and plans for #30 (8cbf1c5)

## Breaking changes
- None

## Changes by type
### Features
- feat(project-retrospective): Add archive memory functionality and tests (653ce10)

### Docs
- docs(wiki): sync journal, topics, and plans for #30 (8cbf1c5)

### Other (unknown)
- commit: Merge pull request #31 from verndale/bot/wiki-sync/30 (5986457)
- commit: Merge pull request #33 from verndale/feat/32-capture-project-memory (ecf31bd)

## Full commit list
- ecf31bd commit: Merge pull request #33 from verndale/feat/32-capture-project-memory
- 653ce10 feat(project-retrospective): Add archive memory functionality and tests
- 5986457 commit: Merge pull request #31 from verndale/bot/wiki-sync/30
- 8cbf1c5 docs(wiki): sync journal, topics, and plans for #30

# v1.9.0 — 2026-08-01

## Summary (AI, bounded)
- Enhanced fingerprint normalization and testing in the project retrospective module (commit 7b22064).
- Updated project retrospective documentation with necessary fixes (commit a6e9f98).
- Improved fingerprint handling and updated related test cases (commit 9eabe5a).
- Synced wiki journal, topics, and plans to ensure up-to-date documentation (commit a49653a).
- Merged significant pull requests to integrate organizational memory features and wiki synchronization (commits 0b87060, 4326bc9).

## Highlights
- commit: Merge pull request #30 from verndale/feat/retro-org-memory (0b87060)
- fix(project-retrospective): Update project retrospective documentation (a6e9f98)
- chore(project-retrospective): Update fingerprint handling and test cases (9eabe5a)
- feat(project-retrospective): Enhance fingerprint normalization and testing (7b22064)
- commit: Merge pull request #28 from verndale/bot/wiki-sync/27 (4326bc9)
- docs(wiki): sync journal, topics, and plans for #27 (a49653a)

## Breaking changes
- None

## Changes by type
### Features
- feat(project-retrospective): Enhance fingerprint normalization and testing (7b22064)

### Fixes
- fix(project-retrospective): Update project retrospective documentation (a6e9f98)

### Docs
- docs(wiki): sync journal, topics, and plans for #27 (a49653a)

### Chore
- chore(project-retrospective): Update fingerprint handling and test cases (9eabe5a)

### Other (unknown)
- commit: Merge pull request #28 from verndale/bot/wiki-sync/27 (4326bc9)
- commit: Merge pull request #30 from verndale/feat/retro-org-memory (0b87060)

## Full commit list
- 0b87060 commit: Merge pull request #30 from verndale/feat/retro-org-memory
- a6e9f98 fix(project-retrospective): Update project retrospective documentation
- 9eabe5a chore(project-retrospective): Update fingerprint handling and test cases
- 7b22064 feat(project-retrospective): Enhance fingerprint normalization and testing
- 4326bc9 commit: Merge pull request #28 from verndale/bot/wiki-sync/27
- a49653a docs(wiki): sync journal, topics, and plans for #27

# v1.8.0 — 2026-07-31

## Summary (AI, bounded)
- Added new components for project-retrospective including brand mark and cart button (commit 6092220).
- Synced wiki journal, topics, and plans documentation (#24) to keep content up-to-date (commit 54f8c65).
- Merged pull request fixing shallow scan issues in sibling folders (commit afba4f7).
- Merged pull request for bot wiki synchronization improvements (commit 9143132).

## Highlights
- commit: Merge pull request #27 from verndale/fix/26-shallow-scan-sibling-folders (afba4f7)
- feat(project-retrospective): Add new components for brand mark and cart button (6092220)
- commit: Merge pull request #25 from verndale/bot/wiki-sync/24 (9143132)
- docs(wiki): sync journal, topics, and plans for #24 (54f8c65)

## Breaking changes
- None

## Changes by type
### Features
- feat(project-retrospective): Add new components for brand mark and cart button (6092220)

### Docs
- docs(wiki): sync journal, topics, and plans for #24 (54f8c65)

### Other (unknown)
- commit: Merge pull request #25 from verndale/bot/wiki-sync/24 (9143132)
- commit: Merge pull request #27 from verndale/fix/26-shallow-scan-sibling-folders (afba4f7)

## Full commit list
- afba4f7 commit: Merge pull request #27 from verndale/fix/26-shallow-scan-sibling-folders
- 6092220 feat(project-retrospective): Add new components for brand mark and cart button
- 9143132 commit: Merge pull request #25 from verndale/bot/wiki-sync/24
- 54f8c65 docs(wiki): sync journal, topics, and plans for #24

# v1.7.0 — 2026-07-31

## Summary (AI, bounded)
- Introduced new components and updated graph data in the project retrospective feature (commit bd31d3c).
- Added stack-aware inventory discovery capabilities as part of the update (commit 02c5c5b).
- No breaking changes were introduced in this release.

## Highlights
- commit: Merge pull request #24 from verndale/feat/23-stack-aware-inventory-discovery (02c5c5b)
- feat(project-retrospective): Add new components and update graph data (bd31d3c)

## Breaking changes
- None

## Changes by type
### Features
- feat(project-retrospective): Add new components and update graph data (bd31d3c)

### Other (unknown)
- commit: Merge pull request #24 from verndale/feat/23-stack-aware-inventory-discovery (02c5c5b)

## Full commit list
- 02c5c5b commit: Merge pull request #24 from verndale/feat/23-stack-aware-inventory-discovery
- bd31d3c feat(project-retrospective): Add new components and update graph data

# v1.6.1 — 2026-07-31

## Summary (AI, bounded)
- Fixed update of graph data in project retrospective component.
- Enhanced validation tests in project retrospective module.
- Commit reference: 7a3d0fa.

## Highlights
- fix(project-retrospective): Update graph data and enhance validation tests (7a3d0fa)

## Breaking changes
- None

## Changes by type
### Fixes
- fix(project-retrospective): Update graph data and enhance validation tests (7a3d0fa)

## Full commit list
- 7a3d0fa fix(project-retrospective): Update graph data and enhance validation tests

# v1.6.0 — 2026-07-31

## Summary (AI, bounded)
- Updated graph data and enhanced validation tests in the project-retrospective feature (commit 664595e)
- Synced wiki content including journal, topics, and plans (commit 0e4e4f8)
- Merged pull request related to wiki synchronization (commit 84068b6)

## Highlights
- feat(project-retrospective): Update graph data and enhance validation tests (664595e)
- commit: Merge pull request #22 from verndale/bot/wiki-sync/21 (84068b6)
- docs(wiki): sync journal, topics, and plans for #21 (0e4e4f8)

## Breaking changes
- None

## Changes by type
### Features
- feat(project-retrospective): Update graph data and enhance validation tests (664595e)

### Docs
- docs(wiki): sync journal, topics, and plans for #21 (0e4e4f8)

### Other (unknown)
- commit: Merge pull request #22 from verndale/bot/wiki-sync/21 (84068b6)

## Full commit list
- 664595e feat(project-retrospective): Update graph data and enhance validation tests
- 84068b6 commit: Merge pull request #22 from verndale/bot/wiki-sync/21
- 0e4e4f8 docs(wiki): sync journal, topics, and plans for #21

# v1.5.0 — 2026-07-31

## Summary (AI, bounded)
- Enhanced proposal validation logic in the project-retrospective feature (commit d415966)
- Synchronized wiki content including journal, topics, and plans (commit 3af696e)
- Integrated downstream wiki feed improvements (commit c248264)
- Included updates from bot wiki synchronization (commit 81bc19a)

## Highlights
- commit: Merge pull request #21 from verndale/feat/downstream-wiki-feed (c248264)
- feat(project-retrospective): Enhance proposal validation logic (d415966)
- commit: Merge pull request #20 from verndale/bot/wiki-sync/19 (81bc19a)
- docs(wiki): sync journal, topics, and plans for #19 (3af696e)

## Breaking changes
- None

## Changes by type
### Features
- feat(project-retrospective): Enhance proposal validation logic (d415966)

### Docs
- docs(wiki): sync journal, topics, and plans for #19 (3af696e)

### Other (unknown)
- commit: Merge pull request #20 from verndale/bot/wiki-sync/19 (81bc19a)
- commit: Merge pull request #21 from verndale/feat/downstream-wiki-feed (c248264)

## Full commit list
- c248264 commit: Merge pull request #21 from verndale/feat/downstream-wiki-feed
- d415966 feat(project-retrospective): Enhance proposal validation logic
- 81bc19a commit: Merge pull request #20 from verndale/bot/wiki-sync/19
- 3af696e docs(wiki): sync journal, topics, and plans for #19

# v1.4.0 — 2026-07-30

## Summary (AI, bounded)
- Updated graph data and enhanced documentation for project retrospective (commit 75fd299)
- Synchronized wiki journal, topics, and plans (commit 48d5bfc)
- Merged pull request adding downstream wiki feed functionality (commit e38efac)
- Incorporated wiki synchronization improvements via bot (commit 85d11ba)

## Highlights
- commit: Merge pull request #19 from verndale/feat/downstream-wiki-feed (e38efac)
- feat(project-retrospective): Update graph data and enhance documentation (75fd299)
- commit: Merge pull request #17 from verndale/bot/wiki-sync/16 (85d11ba)
- docs(wiki): sync journal, topics, and plans for #16 (48d5bfc)

## Breaking changes
- None

## Changes by type
### Features
- feat(project-retrospective): Update graph data and enhance documentation (75fd299)

### Docs
- docs(wiki): sync journal, topics, and plans for #16 (48d5bfc)

### Other (unknown)
- commit: Merge pull request #17 from verndale/bot/wiki-sync/16 (85d11ba)
- commit: Merge pull request #19 from verndale/feat/downstream-wiki-feed (e38efac)

## Full commit list
- e38efac commit: Merge pull request #19 from verndale/feat/downstream-wiki-feed
- 75fd299 feat(project-retrospective): Update graph data and enhance documentation
- 85d11ba commit: Merge pull request #17 from verndale/bot/wiki-sync/16
- 48d5bfc docs(wiki): sync journal, topics, and plans for #16

# v1.3.0 — 2026-07-30

## Summary (AI, bounded)
- Enhanced client wiki integration and documentation as part of project retrospective (commit dbcedea).
- Wiki updated to sync journal, topics, and plans (commit caa7375).
- Merged pull requests related to wiki feed and bot wiki sync to improve functionality (commits 159bf07, 32d8631).

## Highlights
- commit: Merge pull request #16 from verndale/feat/wiki-feed-step6 (159bf07)
- feat(project-retrospective): Enhance client wiki integration and documentation (dbcedea)
- commit: Merge pull request #14 from verndale/bot/wiki-sync/13 (32d8631)
- docs(wiki): sync journal, topics, and plans for #13 (caa7375)

## Breaking changes
- None

## Changes by type
### Features
- feat(project-retrospective): Enhance client wiki integration and documentation (dbcedea)

### Docs
- docs(wiki): sync journal, topics, and plans for #13 (caa7375)

### Other (unknown)
- commit: Merge pull request #14 from verndale/bot/wiki-sync/13 (32d8631)
- commit: Merge pull request #16 from verndale/feat/wiki-feed-step6 (159bf07)

## Full commit list
- 159bf07 commit: Merge pull request #16 from verndale/feat/wiki-feed-step6
- dbcedea feat(project-retrospective): Enhance client wiki integration and documentation
- 32d8631 commit: Merge pull request #14 from verndale/bot/wiki-sync/13
- caa7375 docs(wiki): sync journal, topics, and plans for #13

# v1.2.0 — 2026-07-30

## Summary (AI, bounded)
- Updated graph data and enhanced capture preflight in project retrospective (commit ba2b761)
- Synchronized wiki content including journal, topics, and plans (commit ed2a3b2)
- Merged pull request adding deferred captures variant triage feature (commit 8f2e7aa)
- Merged pull request for bot wiki synchronization updates (commit 02cf839)

## Highlights
- commit: Merge pull request #13 from verndale/feat/defer-captures-variant-triage (8f2e7aa)
- feat(project-retrospective): Update graph data and enhance capture preflight (ba2b761)
- commit: Merge pull request #11 from verndale/bot/wiki-sync/10 (02cf839)
- docs(wiki): sync journal, topics, and plans for #10 (ed2a3b2)

## Breaking changes
- None

## Changes by type
### Features
- feat(project-retrospective): Update graph data and enhance capture preflight (ba2b761)

### Docs
- docs(wiki): sync journal, topics, and plans for #10 (ed2a3b2)

### Other (unknown)
- commit: Merge pull request #11 from verndale/bot/wiki-sync/10 (02cf839)
- commit: Merge pull request #13 from verndale/feat/defer-captures-variant-triage (8f2e7aa)

## Full commit list
- 8f2e7aa commit: Merge pull request #13 from verndale/feat/defer-captures-variant-triage
- ba2b761 feat(project-retrospective): Update graph data and enhance capture preflight
- 02cf839 commit: Merge pull request #11 from verndale/bot/wiki-sync/10
- ed2a3b2 docs(wiki): sync journal, topics, and plans for #10

# v1.1.0 — 2026-07-27

## Summary (AI, bounded)
- Enhanced capture functionality in the project-retrospective feature (commit 8ac1bf7).
- Synced journal, topics, and plans documentation in the wiki (commit ab55eed).
- Merged improvements related to auditable captures (commit b784b05).
- Integrated updates from the wiki synchronization bot (commit cd61aa7).

## Highlights
- commit: Merge pull request #10 from verndale/feat/auditable-captures (b784b05)
- feat(project-retrospective): Enhance capture functionality in project (8ac1bf7)
- commit: Merge pull request #8 from verndale/bot/wiki-sync/7 (cd61aa7)
- docs(wiki): sync journal, topics, and plans for #7 (ab55eed)

## Breaking changes
- None

## Changes by type
### Features
- feat(project-retrospective): Enhance capture functionality in project (8ac1bf7)

### Docs
- docs(wiki): sync journal, topics, and plans for #7 (ab55eed)

### Other (unknown)
- commit: Merge pull request #10 from verndale/feat/auditable-captures (b784b05)
- commit: Merge pull request #8 from verndale/bot/wiki-sync/7 (cd61aa7)

## Full commit list
- b784b05 commit: Merge pull request #10 from verndale/feat/auditable-captures
- 8ac1bf7 feat(project-retrospective): Enhance capture functionality in project
- cd61aa7 commit: Merge pull request #8 from verndale/bot/wiki-sync/7
- ab55eed docs(wiki): sync journal, topics, and plans for #7

# v1.0.0 — 2026-07-27

## Summary (AI, bounded)
- Enhanced graph builder to include module support (commit ecb9066)
- Synchronized wiki journal, topics, and plans in multiple updates (commits 56ecdf4, afed287)
- Added initial CI configuration files and workflows, including workflows for wiki issue synchronization (commit caebd12, 782c330)
- Performed multiple merges from main branch and rebuilt the project-retrospective graph (commits 605d093, 6573e43)
- Updated pre-commit hooks, documentation, and repository name references (commits 764c1d9, 012a6f0)
- Improved graph navigability with merged pull request #7 (commit ed92826)

## Highlights
- commit: Merge pull request #7 from verndale/feat/graph-navigability (ed92826)
- chore(project-retrospective): merge main and rebuild graph (605d093)
- feat(project-retrospective): Enhance graph builder to include module (ecb9066)
- commit: Merge pull request #5 from verndale/bot/wiki-sync/4 (d885285)
- docs(wiki): sync journal, topics, and plans for #4 (56ecdf4)
- commit: Merge pull request #4 from verndale/feat/knowledge-graph-wiki (065381d)
- chore(project-retrospective): merge main and rebuild graph (6573e43)
- commit: Merge pull request #3 from verndale/bot/wiki-sync/1 (4cf3cda)

## Breaking changes
- None

## Changes by type
### Features
- feat(project-retrospective): Enhance graph builder to include module (ecb9066)

### Docs
- docs(wiki): sync journal, topics, and plans for #1 (afed287)
- docs(wiki): sync journal, topics, and plans for #4 (56ecdf4)

### Chore
- chore(ci): Add initial configuration files and workflows (caebd12)
- chore(ci): Add workflows for wiki issue synchronization (782c330)
- chore(project-retrospective): merge main and rebuild graph (605d093)
- chore(project-retrospective): merge main and rebuild graph (6573e43)
- chore(project-retrospective): Update pre-commit hook and documentation (764c1d9)
- chore(project-retrospective): Update references to new repository names (012a6f0)

### Other (unknown)
- commit: Merge pull request #1 from verndale/feat/knowledge-graph-wiki (f07aa94)
- commit: Merge pull request #3 from verndale/bot/wiki-sync/1 (4cf3cda)
- commit: Merge pull request #4 from verndale/feat/knowledge-graph-wiki (065381d)
- commit: Merge pull request #5 from verndale/bot/wiki-sync/4 (d885285)
- commit: Merge pull request #7 from verndale/feat/graph-navigability (ed92826)

## Full commit list
- ed92826 commit: Merge pull request #7 from verndale/feat/graph-navigability
- 605d093 chore(project-retrospective): merge main and rebuild graph
- ecb9066 feat(project-retrospective): Enhance graph builder to include module
- d885285 commit: Merge pull request #5 from verndale/bot/wiki-sync/4
- 56ecdf4 docs(wiki): sync journal, topics, and plans for #4
- 065381d commit: Merge pull request #4 from verndale/feat/knowledge-graph-wiki
- 6573e43 chore(project-retrospective): merge main and rebuild graph
- 4cf3cda commit: Merge pull request #3 from verndale/bot/wiki-sync/1
- 764c1d9 chore(project-retrospective): Update pre-commit hook and documentation
- afed287 docs(wiki): sync journal, topics, and plans for #1
- f07aa94 commit: Merge pull request #1 from verndale/feat/knowledge-graph-wiki
- 782c330 chore(ci): Add workflows for wiki issue synchronization
- 012a6f0 chore(project-retrospective): Update references to new repository names
- caebd12 chore(ci): Add initial configuration files and workflows
