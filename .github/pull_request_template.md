## Conventional commits

If this PR merges with **squash and merge**, the **PR title** becomes the single commit on `main` and must match [Conventional Commits](https://www.conventionalcommits.org/) (same rules as this repo's commitlint), for example:

`feat(project-retrospective): Short imperative subject`

Use a **scope** and a valid type (`feat`, `fix`, `docs`, `chore`, etc.). Commit hygiene is enforced by commitlint, and the type drives the `semantic-release` version bump on `main` (`feat` → minor, `fix` → patch, `BREAKING` → major). This repo is distributed as an agent skill via the `skills` CLI and is **not** published to npm.

## Data boundary

- [ ] No client-derived data (component inventories, resolution output, reports, memory excerpts, client names) is included — fixtures are synthetic.
