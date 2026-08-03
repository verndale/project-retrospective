#!/usr/bin/env node
/**
 * archive-memory.cjs — preserve a project's engineering memory before it is lost.
 *
 * A completed project carries durable engineering memory under its artifacts
 * root (`<artifactsRoot>/memory/**`). The
 * retrospective otherwise reads it only to name-match components and then drops
 * the prose; once the project is archived, that knowledge is gone. This script
 * byte-copies the memory near-raw into a destination directory (the private
 * ui-design-evidence archive) and always emits a self-describing manifest, so a
 * run cannot silently drop memory — validate-report.cjs checks the manifest.
 *
 * It preserves; it does not summarize. The readable, paraphrased digest is
 * authored separately (skill Step 6). This script's only job is the faithful
 * copy plus the manifest that proves it happened.
 *
 * Usage:
 *   node archive-memory.cjs --project <path> [--archive <dir>] [--out <file>] [--pretty]
 *
 *   --project  Path to the completed project repository (required)
 *   --archive  Directory to copy memory into (the evidence-repo source/ dir);
 *              omit for a record-only run (home-fallback) — manifest only, no copy
 *   --out      Write the manifest JSON here instead of stdout
 *   --pretty   Indent the JSON output
 *
 * Exit codes:
 *   0  success — including a degraded run (see the `warnings` array)
 *   1  unexpected failure
 *   2  invalid invocation
 *   3  --project is missing or is not a directory
 *
 * Missing or malformed inputs never throw: each records a warning and the run
 * continues. Memory is markdown by convention, so only `*.md` files are copied.
 * Placeholder shards (frontmatter + heading only, no content — a migration leaves
 * these for topics the project never filled in) are skipped as empty and listed in
 * the manifest's `skippedEmpty`. The artifacts root is resolved from
 * build.config.json via the same helper inventory.cjs uses, so the two scripts can
 * never disagree on where memory is.
 */

'use strict';

const path = require('node:path');
const {
  parseArgs,
  checkArgs,
  isDir,
  listFilesRecursive,
  readTextSafe,
  copyFileTo,
  resolveArtifactsRoot,
  Warnings,
  writeOut,
  usage,
} = require('./lib/util.cjs');

const USAGE = [
  'Usage: node archive-memory.cjs --project <path> [--archive <dir>] [--out <file>] [--pretty]',
  '',
  '  --project  Path to the completed project repository (required)',
  '  --archive  Directory to copy memory into (the evidence-repo source/ dir);',
  '             omit for a record-only run (home-fallback) — manifest only, no copy',
  '  --out      Write the manifest JSON here instead of stdout',
  '  --pretty   Indent the JSON output',
];

/**
 * True when a memory shard carries real content — not just frontmatter, a heading,
 * and a placeholder comment. A migration leaves skeleton shards for topics the
 * project never filled in (e.g. an `architecture.md` that is only a title); copying
 * those preserves noise, so they are dropped. Substance = any line that is not
 * blank, not an ATX heading, and not a thematic break, after YAML frontmatter and
 * HTML comments are stripped.
 */
function isSubstantiveMemory(text) {
  let body = text.replace(/^\uFEFF/, '');
  const frontmatter = body.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (frontmatter) body = body.slice(frontmatter[0].length);
  body = body.replace(/<!--[\s\S]*?-->/g, '');
  return body.split(/\r?\n/).some((line) => {
    const t = line.trim();
    if (!t) return false; // blank
    if (/^#{1,6}(\s|$)/.test(t)) return false; // ATX heading
    if (/^[-*_=]{3,}$/.test(t)) return false; // thematic break / setext underline
    return true;
  });
}

/**
 * The project's substantive memory files, each as { rel, src }: `rel` is the
 * forward-slash path it should take inside the archive, `src` its absolute source
 * path. `<root>/memory/**` files keep their sub-path (so `components/cards.md`
 * stays nested). The sibling `MEMORY.md` index is deliberately NOT archived: it is
 * navigation (a redundant file list plus a load-map whose source of truth lives in
 * the skill), not memory content, and once the shards are flattened into the
 * archive its internal `memory/…` paths no longer resolve — so the digest (skill
 * Step 6) carries any navigation instead. Markdown only: memory is markdown by
 * convention, and scoping to `.md` keeps this in step with what inventory.cjs
 * treats as memory evidence. Empty placeholder shards are dropped and returned in
 * `skippedEmpty` so the manifest can report them.
 */
function findMemoryFiles(artifactsDir, warnings) {
  const memoryDir = path.join(artifactsDir, 'memory');
  const candidates = listFilesRecursive(memoryDir)
    .filter((rel) => rel.toLowerCase().endsWith('.md'))
    .map((rel) => ({ rel, src: path.join(memoryDir, rel) }));

  // The `MEMORY.md` index (a sibling of memory/) is intentionally not collected —
  // see this function's doc comment: it is navigation, not memory content.

  const files = [];
  const skippedEmpty = [];
  for (const f of candidates) {
    // readTextSafe returns null when unreadable or over the size cap; a large file
    // is definitely substantive, so null means "keep", never "empty".
    const text = readTextSafe(f.src, undefined, warnings);
    if (text !== null && !isSubstantiveMemory(text)) skippedEmpty.push(f.rel);
    else files.push(f);
  }

  const byRel = (a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0);
  return { files: files.sort(byRel), skippedEmpty: skippedEmpty.sort() };
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    keys: ['project', 'archive', 'out'],
    flags: ['pretty'],
  });
  const { values } = args;

  checkArgs(args, USAGE);
  if (!values.project) usage('--project is required', USAGE);

  const projectDir = path.resolve(values.project);
  if (!isDir(projectDir)) {
    process.stderr.write(`error: --project is not a directory: ${projectDir}\n`);
    process.exit(3);
  }

  const warnings = new Warnings();

  const resolved = resolveArtifactsRoot(projectDir);
  if (resolved.status === 'absent') {
    warnings.add('no-build-config', 'No build.config.json at the project root — artifacts root assumed to be "artifacts".');
  } else if (resolved.status === 'unreadable') {
    warnings.add('unreadable-json', `build.config.json could not be parsed: ${resolved.error} — artifacts root assumed to be "artifacts".`);
  }
  const artifactsRoot = resolved.artifactsRoot;
  const artifactsDir = path.join(projectDir, artifactsRoot);
  const memoryDir = path.join(artifactsDir, 'memory');

  const { files: found, skippedEmpty } = findMemoryFiles(artifactsDir, warnings);
  const archiveDir = values.archive ? path.resolve(values.archive) : null;

  if (skippedEmpty.length) {
    warnings.add(
      'empty-memory-skipped',
      `Skipped ${skippedEmpty.length} empty/placeholder shard(s) (frontmatter + heading only, no content): ${skippedEmpty.join(', ')}`,
    );
  }

  let status;
  let files = [];
  let bytes = null;

  if (found.length === 0) {
    // Nothing worth preserving — not a failure; the project carries no substantive
    // memory (none found, or every shard was an empty placeholder).
    warnings.add(
      'no-memory',
      `No substantive memory under ${artifactsRoot}/memory/ — nothing to archive.`,
    );
    status = 'no-memory';
  } else if (!archiveDir) {
    // Record-only (home-fallback): memory exists but there is no evidence-repo
    // checkout to copy it into. Record what WOULD be preserved so the run can
    // flag the gap instead of silently dropping it.
    status = 'skipped-no-data';
    files = found.map((f) => f.rel);
  } else {
    let copied = 0;
    let total = 0;
    for (const f of found) {
      const res = copyFileTo(f.src, path.join(archiveDir, f.rel));
      if (res.ok) {
        files.push(f.rel);
        copied += 1;
        total += res.bytes;
      } else {
        warnings.add('memory-file-unreadable', `Could not copy ${f.rel}: ${res.error}`);
      }
    }
    bytes = total;
    status = 'archived';
    if (copied === 0) {
      // Every copy failed — the destination is unusable. Say so loudly rather than
      // reporting a green "archived" with an empty archive behind it.
      warnings.add('archive-empty', `No memory files could be copied into ${archiveDir} — the archive is empty.`);
    }
  }

  writeOut(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      project: projectDir,
      artifactsRoot,
      status,
      memoryDir,
      destination: archiveDir,
      files,
      skippedEmpty,
      counts: { files: files.length, bytes },
      warnings: warnings.toJSON(),
    },
    values.out,
    values.pretty,
  );
}

try {
  main();
} catch (err) {
  process.stderr.write(`error: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
}
