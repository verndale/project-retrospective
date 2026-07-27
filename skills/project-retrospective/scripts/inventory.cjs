#!/usr/bin/env node
/**
 * inventory.cjs — what did this project actually build?
 *
 * Reads a completed frontend project and emits one JSON record per component,
 * with the evidence sources that back it. Pipeline projects carry normalized
 * evidence under the artifacts root (component index, build packs, fingerprints,
 * project memory); projects that predate the pipeline degrade to a code scan.
 *
 * Usage:
 *   node inventory.cjs --project <path> [--out <file>] [--pretty]
 *
 * Exit codes:
 *   0  success — including a degraded run (see the `warnings` array)
 *   1  unexpected failure
 *   2  invalid invocation
 *   3  --project is missing or is not a directory
 *
 * Missing or malformed inputs never throw: each one records a warning and the run
 * continues with less evidence. The caller reports `warnings` verbatim.
 */

'use strict';

const path = require('node:path');
const {
  parseArgs,
  checkArgs,
  readJsonSafe,
  readTextSafe,
  isDir,
  isFile,
  listEntries,
  normalizeLabel,
  Warnings,
  writeOut,
  usage,
} = require('./lib/util.cjs');

const USAGE = [
  'Usage: node inventory.cjs --project <path> [--out <file>] [--pretty]',
  '',
  '  --project  Absolute or relative path to the completed project repository (required)',
  '  --out      Write JSON here instead of stdout',
  '  --pretty   Indent the JSON output',
];

// Probed in order when build.config.json declares no componentBuckets. These are
// the conventional roots across the frontend stacks this skill analyzes.
const HEURISTIC_ROOTS = ['src/components', 'components', 'src/ui', 'app/components'];

// A directory holding one of these directly is treated as a component directory.
const COMPONENT_FILE_RE = /\.(tsx|jsx|vue|svelte)$/;

// Never descended into during a code scan.
const SKIP_DIRS = new Set([
  'node_modules', '.git', '__tests__', '__snapshots__', '__mocks__',
  'dist', 'build', '.next', 'coverage', 'e2e', 'stories', '.storybook',
]);

// Depth guard for the code scan: bucket root -> [domain] -> component -> files.
const MAX_SCAN_DEPTH = 4;

function loadConfig(projectDir, warnings) {
  const configPath = path.join(projectDir, 'build.config.json');
  if (!isFile(configPath)) {
    warnings.add(
      'no-build-config',
      'No build.config.json at the project root — artifacts root assumed to be "artifacts" and component buckets discovered heuristically.',
    );
    return { present: false, path: null, artifactsRoot: 'artifacts' };
  }
  const read = readJsonSafe(configPath);
  if (!read.ok) {
    warnings.add('unreadable-json', `build.config.json could not be parsed: ${read.error}`);
    return { present: false, path: configPath, artifactsRoot: 'artifacts' };
  }
  const cfg = read.value || {};
  return {
    present: true,
    path: configPath,
    artifactsRoot: typeof cfg.artifactsRoot === 'string' ? cfg.artifactsRoot : 'artifacts',
    stackAdapter: cfg.stackAdapter ?? null,
    componentBuckets: cfg.componentBuckets ?? null,
    renderingDomains: cfg.renderingDomains ?? null,
  };
}

function loadComponentIndex(artifactsDir, warnings) {
  const indexPath = path.join(artifactsDir, 'component-index.json');
  if (!isFile(indexPath)) {
    warnings.add('no-component-index', `No component-index.json under ${artifactsDir} — component list falls back to build packs or a code scan.`);
    return null;
  }
  const read = readJsonSafe(indexPath);
  if (!read.ok) {
    warnings.add('unreadable-json', `component-index.json could not be parsed: ${read.error}`);
    return null;
  }
  const value = read.value;
  const list = Array.isArray(value) ? value : Array.isArray(value?.components) ? value.components : null;
  if (!list) {
    warnings.add('unreadable-json', 'component-index.json has no recognizable component array (expected a bare array or { components: [...] }).');
    return null;
  }
  const usable = list.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry));
  if (usable.length !== list.length) {
    warnings.add(
      'unreadable-json',
      `component-index.json has ${list.length - usable.length} entr(ies) that are not objects — they were skipped.`,
    );
  }
  return usable;
}

function loadBuildPacks(artifactsDir, warnings) {
  const packsDir = path.join(artifactsDir, 'build-packs');
  const packs = new Map();
  let dirStyle = 0;
  let flatStyle = 0;

  // Two build packs whose names differ only in case or separators would collapse
  // into one record, so the collision is reported rather than silently resolved.
  const addPack = (key, pack) => {
    const existing = packs.get(key);
    if (existing) {
      warnings.add(
        'duplicate-build-pack',
        `Build packs "${existing.slug}" and "${pack.slug}" normalize to the same slug "${key}" — only the second was kept.`,
      );
    }
    packs.set(key, pack);
  };

  if (!isDir(packsDir)) {
    warnings.add('no-build-packs', `No build-packs directory under ${artifactsDir}.`);
    return { packs, dirStyle, flatStyle };
  }

  for (const entry of listEntries(packsDir)) {
    if (entry.name.startsWith('.')) continue;

    if (entry.dir) {
      const files = listEntries(entry.path)
        .filter((f) => !f.dir && f.name.endsWith('.md'))
        .map((f) => f.name);
      if (!files.includes('master.md')) {
        warnings.add('build-pack-missing-master', `Build pack directory "${entry.name}" has no master.md.`);
      }
      dirStyle += 1;
      addPack(normalizeLabel(entry.name), { slug: entry.name, style: 'dir', path: entry.path, files });
      continue;
    }

    if (entry.name.endsWith('.md')) {
      const slug = entry.name.slice(0, -3);
      flatStyle += 1;
      addPack(normalizeLabel(slug), { slug, style: 'flat', path: entry.path, files: [entry.name] });
    }
  }

  return { packs, dirStyle, flatStyle };
}

function loadMemory(artifactsDir, warnings) {
  const memoryDir = path.join(artifactsDir, 'memory');
  const shards = [];
  let text = '';

  for (const entry of listEntries(memoryDir)) {
    if (entry.dir || !entry.name.endsWith('.md')) continue;
    shards.push(entry.name);
    text += `\n${readTextSafe(entry.path, undefined, warnings) || ''}`;
  }

  const indexPath = path.join(artifactsDir, 'MEMORY.md');
  const hasIndex = isFile(indexPath);
  if (hasIndex) text += `\n${readTextSafe(indexPath, undefined, warnings) || ''}`;

  // Component-scoped memory shards are named per component slug.
  const componentShards = listEntries(path.join(memoryDir, 'components'))
    .filter((e) => !e.dir && e.name.endsWith('.md'))
    .map((e) => normalizeLabel(e.name.slice(0, -3)));

  // Normalize the prose the same way labels are normalized, so "AccordionItem",
  // "Accordion Item", and "accordion-item" all become the same token sequence.
  // Wrapping in hyphens lets callers match on token boundaries rather than any
  // substring, so "card" does not match "flashcard".
  const blob = text ? `-${normalizeLabel(text)}-` : '';

  return { shards, hasIndex, componentShards, blob };
}

function loadDesignFacts(artifactsDir) {
  const factsDir = path.join(artifactsDir, 'design-facts');
  // Directory names are slugs, but a stray run can append a suffix (e.g. a
  // timestamp), so match on the leading slug rather than requiring equality.
  return listEntries(factsDir)
    .filter((e) => e.dir)
    .map((e) => normalizeLabel(e.name));
}

function loadShipLog(artifactsDir, warnings) {
  const logPath = path.join(artifactsDir, 'ship-log.jsonl');
  if (!isFile(logPath)) return { present: false, lines: 0 };
  const text = readTextSafe(logPath, undefined, warnings);
  if (text === null) return { present: true, lines: null };
  return { present: true, lines: text.split('\n').filter((l) => l.trim()).length };
}

/**
 * Read a component's fingerprint.json.
 *
 * The component path comes from the project's own index, so it is untrusted input:
 * a non-string or a path escaping the project root is ignored rather than followed.
 */
function readFingerprint(projectDir, componentPath, warnings) {
  if (typeof componentPath !== 'string' || !componentPath) return null;
  const componentDir = path.resolve(projectDir, componentPath);
  if (componentDir !== projectDir && !componentDir.startsWith(projectDir + path.sep)) {
    warnings.add('path-outside-project', `Component path "${componentPath}" resolves outside the project root and was skipped.`);
    return null;
  }
  const fpPath = path.join(componentDir, 'fingerprint.json');
  if (!isFile(fpPath)) return null;
  const read = readJsonSafe(fpPath);
  return read.ok ? read.value : null;
}

/** Walk a bucket root collecting directories that directly hold a component file. */
function scanBucket(projectDir, rootRel, bucketKey, warnings) {
  const rootAbs = path.join(projectDir, rootRel);
  if (!isDir(rootAbs)) {
    warnings.add('empty-bucket', `Component bucket "${rootRel}" does not exist in the project.`);
    return [];
  }

  const found = [];

  /** Does this directory, or anything below it, hold a component file? */
  const holdsComponentBelow = (absDir, depth) => {
    if (depth > MAX_SCAN_DEPTH) return false;
    for (const entry of listEntries(absDir)) {
      if (!entry.dir || SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      const entries = listEntries(entry.path);
      if (entries.some((e) => !e.dir && COMPONENT_FILE_RE.test(e.name))) return true;
      if (holdsComponentBelow(entry.path, depth + 1)) return true;
    }
    return false;
  };

  const walk = (absDir, relDir, depth) => {
    if (depth > MAX_SCAN_DEPTH) return;
    const entries = listEntries(absDir);
    // A barrel file (index.tsx re-exporting the folder) would otherwise make the
    // parent look like the component and hide every real component beneath it.
    const hasComponentFile =
      entries.some((e) => !e.dir && COMPONENT_FILE_RE.test(e.name)) &&
      !holdsComponentBelow(absDir, depth);

    if (hasComponentFile && depth > 0) {
      const folder = path.basename(relDir);
      const segments = relDir.split('/').filter(Boolean);
      const rootDepth = rootRel.split('/').filter(Boolean).length;
      // A single path segment between the bucket root and the component dir is
      // the domain (e.g. renderings/<domain>/<component>).
      const between = segments.slice(rootDepth, -1);
      const entryFile = entries.find((e) => !e.dir && COMPONENT_FILE_RE.test(e.name) && /^[A-Z]/.test(e.name));
      found.push({
        folder,
        name: entryFile ? entryFile.name.replace(COMPONENT_FILE_RE, '') : folder,
        bucket: bucketKey,
        domain: between.length === 1 ? between[0] : null,
        path: relDir,
        entry: entryFile ? `${relDir}/${entryFile.name}` : null,
      });
      return; // Do not descend into a component's own subdirectories.
    }

    for (const entry of entries) {
      if (!entry.dir || SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      walk(entry.path, `${relDir}/${entry.name}`, depth + 1);
    }
  };

  walk(rootAbs, rootRel, 0);
  if (found.length === 0) {
    warnings.add('empty-bucket', `Component bucket "${rootRel}" contained no component directories.`);
  }
  return found;
}

function codeScan(projectDir, config, warnings) {
  const buckets = config.componentBuckets && typeof config.componentBuckets === 'object'
    ? Object.entries(config.componentBuckets)
    : null;

  if (buckets && buckets.length > 0) {
    return buckets.flatMap(([key, rel]) => {
      if (typeof rel !== 'string' || !rel) {
        warnings.add('unreadable-config', `componentBuckets.${key} is not a path string — that bucket was skipped.`);
        return [];
      }
      return scanBucket(projectDir, rel.replace(/\/+$/, ''), key, warnings);
    });
  }

  warnings.add(
    'heuristic-buckets',
    `No componentBuckets configured — probing conventional roots: ${HEURISTIC_ROOTS.join(', ')}.`,
  );
  const results = [];
  for (const root of HEURISTIC_ROOTS) {
    if (!isDir(path.join(projectDir, root))) continue;
    results.push(...scanBucket(projectDir, root, null, warnings));
  }
  return results;
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    keys: ['project', 'out'],
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
  const config = loadConfig(projectDir, warnings);
  const artifactsDir = path.join(projectDir, config.artifactsRoot);

  if (!isDir(artifactsDir)) {
    warnings.add('no-artifacts-root', `No artifacts root at ${config.artifactsRoot}/ — pipeline evidence is unavailable.`);
  }

  const componentIndex = isDir(artifactsDir) ? loadComponentIndex(artifactsDir, warnings) : null;
  const { packs, dirStyle, flatStyle } = isDir(artifactsDir)
    ? loadBuildPacks(artifactsDir, warnings)
    : { packs: new Map(), dirStyle: 0, flatStyle: 0 };
  const memory = isDir(artifactsDir)
    ? loadMemory(artifactsDir, warnings)
    : { shards: [], hasIndex: false, componentShards: [], blob: '' };
  const designFacts = isDir(artifactsDir) ? loadDesignFacts(artifactsDir) : [];
  const shipLog = isDir(artifactsDir) ? loadShipLog(artifactsDir, warnings) : { present: false, lines: 0 };

  const mode = componentIndex || packs.size > 0 ? 'artifacts' : 'code-scan';

  // Component list: the index when present, otherwise a code scan.
  const base = componentIndex
    ? componentIndex.map((c) => ({
        name: typeof c.name === 'string' ? c.name : String(c.folder ?? ''),
        folder: typeof c.folder === 'string' ? c.folder : normalizeLabel(typeof c.name === 'string' ? c.name : ''),
        bucket: typeof c.bucket === 'string' ? c.bucket : null,
        domain: typeof c.domain === 'string' ? c.domain : null,
        path: typeof c.path === 'string' ? c.path : null,
        entry: typeof c.entry === 'string' ? c.entry : null,
        sources: ['component-index'],
      }))
    : codeScan(projectDir, config, warnings).map((c) => ({ ...c, sources: ['code-scan'] }));

  // Build packs with no matching component still count as evidence of something built.
  const byKey = new Map();
  for (const component of base) {
    const key = normalizeLabel(component.folder || component.name);
    const existing = byKey.get(key);
    if (existing) {
      warnings.add(
        'duplicate-component',
        `Components "${existing.folder || existing.name}" and "${component.folder || component.name}" normalize to the same key "${key}" — only the second was kept.`,
      );
    }
    byKey.set(key, component);
  }
  for (const [key, pack] of packs) {
    if (byKey.has(key)) continue;
    byKey.set(key, {
      name: pack.slug,
      folder: pack.slug,
      bucket: null,
      domain: null,
      path: null,
      entry: null,
      sources: [],
    });
  }

  let fingerprintCount = 0;
  const components = [...byKey.entries()]
    .map(([key, component]) => {
      const sources = new Set(component.sources);

      const pack = packs.get(key) || null;
      if (pack) sources.add('build-pack');

      // The component index can carry `fingerprint: null` while the file exists on
      // disk, so disk always wins.
      const fingerprint = readFingerprint(projectDir, component.path, warnings);
      if (fingerprint) {
        sources.add('fingerprint');
        fingerprintCount += 1;
      }

      if (designFacts.some((slug) => slug === key || slug.startsWith(`${key}-`))) {
        sources.add('design-facts');
      }

      const nameToken = normalizeLabel(component.name);
      const namedInMemory =
        memory.blob &&
        (memory.blob.includes(`-${key}-`) || (nameToken && memory.blob.includes(`-${nameToken}-`)));
      if (memory.componentShards.includes(key) || namedInMemory) {
        sources.add('memory');
      }

      return {
        name: component.name,
        folder: component.folder,
        bucket: component.bucket,
        domain: component.domain,
        path: component.path,
        entry: component.entry,
        sources: [...sources].sort(),
        buildPack: pack ? { style: pack.style, files: pack.files } : null,
        fingerprint,
      };
    })
    .sort((a, b) => (a.folder < b.folder ? -1 : a.folder > b.folder ? 1 : 0));

  if (components.length === 0) {
    warnings.add('no-components-found', 'No components were discovered from artifacts or a code scan — check the project path and build.config.json.');
  }

  writeOut(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      project: projectDir,
      mode,
      config,
      components,
      evidence: {
        componentIndex: Boolean(componentIndex),
        buildPacksDir: dirStyle,
        buildPacksFlat: flatStyle,
        fingerprints: fingerprintCount,
        memoryShards: memory.shards,
        memoryIndex: memory.hasIndex,
        designFacts: designFacts.length,
        shipLog,
      },
      counts: { components: components.length },
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
