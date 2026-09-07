#!/usr/bin/env node
/**
 * inventory.cjs — what did this project actually build?
 *
 * Reads a completed frontend project and emits one JSON record per component,
 * with the evidence sources that back it. Source is always the primary census:
 * package manifests, framework markers, imports, tests, stories, styles, tokens,
 * consumers, and delivery configuration enrich conventional component roots.
 * Pipeline artifacts remain optional corroboration.
 *
 * Usage:
 *   node inventory.cjs --project <path> [--platform <canonical-key>] [--out <file>] [--pretty]
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

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  parseArgs,
  checkArgs,
  readJsonSafe,
  readTextSafe,
  isDir,
  isFile,
  listEntries,
  isSafeRepositoryRelativePath,
  normalizeLabel,
  resolveArtifactsRoot,
  Warnings,
  writeOut,
  usage,
} = require('./lib/util.cjs');
const { cmsForKey } = require('./lib/cms-taxonomy.cjs');

const USAGE = [
  'Usage: node inventory.cjs --project <path> [--platform <canonical-key>] [--out <file>] [--pretty]',
  '',
  '  --project  Absolute or relative path to the completed project repository (required)',
  '  --platform Exact canonical CMS key; overrides deterministic marker inference',
  '  --out      Write JSON here instead of stdout',
  '  --pretty   Indent the JSON output',
];

// Heavy directories never descended into by any scan.
const HEAVY_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];

// Skipped during the component (markup) walk. Storybook lives under `stories`/
// `.storybook`; those are excluded here because stories are discovered separately.
const SKIP_DIRS = new Set([
  ...HEAVY_DIRS, '__tests__', '__snapshots__', '__mocks__', 'e2e', 'stories', '.storybook',
]);

// Skipped during Storybook discovery — the same heavy dirs, but NOT `stories`/`.storybook`.
const STORY_SKIP_DIRS = new Set([...HEAVY_DIRS, '__tests__', '__snapshots__', '__mocks__', 'e2e']);

// Probed only when nothing is declared (no componentBuckets, no adapter roots, no
// reusableComponentsBase). Conventional roots across the stacks this skill analyzes.
const HEURISTIC_ROOTS = [
  'src/components', 'components', 'src/ui', 'app/components',
  'frontend/src/html/components', 'frontend/src/html/modules', 'src/modules',
  'src/widgets', 'src/layouts', 'src/features', 'lib/components',
];

// Every package root in a workspace receives the same conventional probes. Paths
// are exact; no package-name or directory-name fuzzing is used.
const PACKAGE_COMPONENT_ROOTS = [
  ['src/components', 'ui'],
  ['components', 'ui'],
  ['src/ui', 'ui'],
  ['app/components', 'ui'],
  ['src/modules', 'rendering'],
  ['src/widgets', 'ui'],
  ['src/layouts', 'layout'],
  ['src/features', 'rendering'],
  ['lib/components', 'ui'],
];

const MANIFEST_SCAN_DEPTH = 5;
const SOURCE_SIGNAL_DEPTH = 12;
const SOURCE_FILE_RE = /\.(?:tsx?|jsx?|vue|svelte|astro|hbs|handlebars|twig|liquid|css|scss|sass|less)$/i;
const TEST_FILE_RE = /\.(?:test|spec|cy)\.[cm]?[jt]sx?$/i;
const STYLE_FILE_RE = /(?:\.module)?\.(?:css|scss|sass|less)$/i;
const TOKEN_PATH_RE = /(?:^|\/)(?:tokens?|theme|themes|design-tokens?)(?:\/|\.|$)/i;

// Platform inference is deliberately conservative. Only exact dependency names or
// an exact canonical build-config key count; overlapping SDKs make the result null.
const PLATFORM_DEPENDENCIES = new Map([
  ['contentful', 'contentful'],
  ['@contentful/app-sdk', 'contentful'],
  ['@contentful/rich-text-react-renderer', 'contentful'],
  ['contentstack', 'contentstack'],
  ['@contentstack/delivery-sdk', 'contentstack'],
  ['@contentstack/management', 'contentstack'],
  ['@optimizely/cms-sdk', 'optimizely-saas'],
  ['@optimizely/cms-cli', 'optimizely-saas'],
  ['@sitecore-content-sdk/nextjs', 'sitecore-ai'],
  ['@sitecore-content-sdk/react', 'sitecore-ai'],
  ['@wordpress/api-fetch', 'wordpress'],
  ['@wordpress/element', 'wordpress'],
]);

const FRAMEWORK_DEPENDENCIES = new Map([
  ['next', 'next'],
  ['react', 'react'],
  ['vue', 'vue'],
  ['nuxt', 'nuxt'],
  ['svelte', 'svelte'],
  ['@sveltejs/kit', 'sveltekit'],
  ['astro', 'astro'],
]);

const DELIVERY_FILES = new Set([
  'vercel.json', 'netlify.toml', 'azure-pipelines.yml', 'azure-pipelines.yaml',
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
]);

// Depth guard for the recursive component walk: bucket root -> [domain] -> component -> files.
const MAX_SCAN_DEPTH = 4;
// Depth guard for Storybook discovery (stories nest a few levels under src/stories).
const MAX_STORY_DEPTH = 8;

// Story files are deterministically named `<slug>.stories.<ext>` (plain `.mdx` docs excluded).
const STORY_FILE_RE = /\.stories\.(?:tsx?|jsx?|mdx)$/;

// Co-located test/spec/story/cypress files carry a component extension but are not components
// (`Modal.test.tsx`, `useX.a11y.test.tsx`, `Card.stories.tsx`). Excluded from component discovery.
const NON_COMPONENT_RE = /\.(?:test|spec|stories|cy)\.[jt]sx?$/i;

// Discovery profiles: which file extensions mark a component, which conventional roots hold
// components (as [path, bucket] pairs), how deep the walk goes, and whether Storybook is
// the component registry. These are deliberately separate from the seven-entry CMS catalog:
// a recognized CMS without a profile falls back to the broad default rather than gaining
// invented discovery behavior.
const REACT_EXTS = ['.tsx', '.jsx'];
const ADAPTER_PROFILES = {
  toolkit: {
    exts: ['.hbs', '.handlebars'],
    roots: [
      ['frontend/src/html/components', 'ui'],
      ['frontend/src/html/modules', 'rendering'],
      ['frontend/src/html/templates', 'template'],
    ],
    granularity: 'shallow',
    storybook: true,
  },
  'optimizely-saas': { exts: REACT_EXTS, roots: [], granularity: 'recursive', storybook: false },
  'sitecore-ai': { exts: REACT_EXTS, roots: [], granularity: 'recursive', storybook: false },
  contentstack: { exts: REACT_EXTS, roots: [], granularity: 'recursive', storybook: false },
};
const DEFAULT_PROFILE = {
  exts: ['.tsx', '.jsx', '.vue', '.svelte', '.astro', '.hbs', '.handlebars', '.twig', '.liquid'],
  roots: [],
  granularity: 'recursive',
  storybook: true,
};

/** Record the exact local Git revision used for all future source citations. */
function sourceSnapshot(projectDir, warnings) {
  const git = (args) => spawnSync('git', ['-C', projectDir, ...args], { encoding: 'utf8' });
  const inside = git(['rev-parse', '--is-inside-work-tree']);
  if (inside.status !== 0 || inside.stdout.trim() !== 'true') {
    warnings.add('git-snapshot-unavailable', 'Project is not a readable Git worktree — sourceSnapshot has no pinned commit.');
    return { strategy: 'unavailable', commit: null, dirty: null };
  }
  const head = git(['rev-parse', 'HEAD']);
  if (head.status !== 0 || !/^[a-f0-9]{40}$/.test(head.stdout.trim())) {
    warnings.add('git-snapshot-unavailable', 'Project Git HEAD could not be resolved — sourceSnapshot has no pinned commit.');
    return { strategy: 'unavailable', commit: null, dirty: null };
  }
  const status = git(['status', '--porcelain', '--untracked-files=normal']);
  if (status.status !== 0) {
    warnings.add('git-dirty-state-unavailable', 'Project Git dirty state could not be read; the pinned commit is still recorded.');
  }
  const dirty = status.status === 0 ? Boolean(status.stdout.trim()) : null;
  if (dirty) {
    warnings.add(
      'git-worktree-dirty',
      'Project has uncommitted changes; future source-parity citations must read the pinned commit rather than the current worktree.',
    );
  }
  return { strategy: 'recorded', commit: head.stdout.trim(), dirty };
}

/** Resolve a stackAdapter to its discovery profile; warns when it falls back to the default. */
function profileFor(stackAdapter, warnings) {
  if (stackAdapter == null || stackAdapter === '') return DEFAULT_PROFILE;
  // Treat the registry as a closed allowlist. Direct indexing would expose
  // Object.prototype members (for example "toString" or "constructor") as
  // truthy pseudo-profiles and crash later when their extension list is read.
  const profile = Object.hasOwn(ADAPTER_PROFILES, stackAdapter) ? ADAPTER_PROFILES[stackAdapter] : null;
  if (profile) return profile;
  const cms = cmsForKey(stackAdapter);
  if (cms) {
    warnings.add(
      'unsupported-cms-discovery',
      `${cms.label} ("${cms.key}") is a recognized CMS but has no dedicated discovery profile — using the broad default (all known extensions, heuristic roots).`,
    );
    return DEFAULT_PROFILE;
  }
  warnings.add(
    'unknown-adapter',
    `stackAdapter "${stackAdapter}" has no discovery profile — using the broad default (all known extensions, heuristic roots).`,
  );
  return DEFAULT_PROFILE;
}

/** Build a component-file matcher from a profile's extension list. */
function makeFileRe(exts) {
  const alt = exts.map((e) => e.replace(/^\./, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`\\.(?:${alt})$`);
}

function relativePath(projectDir, absolutePath) {
  return path.relative(projectDir, absolutePath).split(path.sep).join('/');
}

// A filesystem symlink is not proof of the target bytes at the pinned Git
// revision. Source discovery therefore records the link as skipped instead of
// following it into another checkout (or around a cycle).
const WARNED_SOURCE_SYMLINKS = new WeakMap();

function warnSourceSymlink(projectDir, linkPath, warnings) {
  const rel = relativePath(projectDir, linkPath);
  const warned = WARNED_SOURCE_SYMLINKS.get(warnings) || new Set();
  if (warned.has(rel)) return;
  warned.add(rel);
  WARNED_SOURCE_SYMLINKS.set(warnings, warned);
  warnings.add(
    'source-symlink-skipped',
    `Skipped source symlink "${rel}" because its target bytes are not proven by the pinned Git revision.`,
  );
}

function sourceEntries(projectDir, directory, warnings) {
  const directoryRel = relativePath(projectDir, directory);
  if (directoryRel && sourcePathHasSymlink(projectDir, directoryRel, warnings)) return [];
  return listEntries(directory).filter((entry) => {
    if (!entry.symlink) return true;
    warnSourceSymlink(projectDir, entry.path, warnings);
    return false;
  });
}

function sourcePathHasSymlink(projectDir, relative, warnings) {
  let current = projectDir;
  for (const segment of relative.split('/')) {
    current = path.join(current, segment);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        warnSourceSymlink(projectDir, current, warnings);
        return true;
      }
    } catch {
      return false; // A missing path is handled by the caller, not a symlink escape.
    }
  }
  return false;
}

/** Reject a configured/discovered root when any descendant segment is a symlink. */
function sourceDirectory(projectDir, rootRel, warnings) {
  return isSafeRepositoryRelativePath(rootRel) &&
    !sourcePathHasSymlink(projectDir, rootRel, warnings) &&
    isDir(path.join(projectDir, rootRel));
}

function sourceFile(projectDir, fileRel, warnings) {
  return isSafeRepositoryRelativePath(fileRel) &&
    !sourcePathHasSymlink(projectDir, fileRel, warnings) &&
    isFile(path.join(projectDir, fileRel));
}

function indexedSourcePath(projectDir, value, field, warnings) {
  if (typeof value !== 'string') return null;
  if (!isSafeRepositoryRelativePath(value)) {
    warnings.add(
      'path-outside-project',
      `component-index ${field} ${JSON.stringify(value)} is not a safe repository-relative path and was skipped.`,
    );
    return null;
  }
  return sourcePathHasSymlink(projectDir, value, warnings) ? null : value;
}

/** Bounded repository walk shared by manifest, source-signal, and delivery discovery. */
function walkFiles(projectDir, maxDepth, include, warnings) {
  const files = [];
  const walk = (directory, depth) => {
    if (depth > maxDepth) return;
    for (const entry of sourceEntries(projectDir, directory, warnings)) {
      if (entry.dir) {
        if (HEAVY_DIRS.includes(entry.name)) continue;
        walk(entry.path, depth + 1);
      } else {
        const rel = relativePath(projectDir, entry.path);
        if (include(entry.name, rel)) files.push(rel);
      }
    }
  };
  walk(projectDir, 0);
  return files.sort();
}

function expandWorkspacePattern(pattern) {
  const match = /\{([^{}]+)\}/.exec(pattern);
  if (!match) return [pattern];
  return match[1].split(',').flatMap((choice) =>
    expandWorkspacePattern(`${pattern.slice(0, match.index)}${choice}${pattern.slice(match.index + match[0].length)}`));
}

function normalizeWorkspacePattern(value, source, warnings) {
  if (typeof value !== 'string' || !value.trim()) {
    warnings.add('workspace-manifest-invalid', `${source} contains a non-string or empty workspace pattern; it was ignored.`);
    return [];
  }
  const negative = value.trim().startsWith('!');
  let pattern = value.trim().replace(/^!/, '').replace(/^\.\//, '').replace(/\/+$/, '');
  pattern = pattern.replace(/\/package\.json$/, '');
  if (!pattern || pattern === '.' || path.posix.isAbsolute(pattern) || /^[A-Za-z]:/.test(pattern) ||
    pattern.includes('\\') || pattern.split('/').includes('..')) {
    warnings.add('workspace-manifest-invalid', `${source} contains unsafe workspace pattern ${JSON.stringify(value)}; it was ignored.`);
    return [];
  }
  return expandWorkspacePattern(pattern).map((expanded) => `${negative ? '!' : ''}${expanded}`);
}

function packageWorkspacePatterns(manifest, warnings) {
  const workspaces = manifest?.workspaces;
  if (workspaces === undefined) return [];
  const values = Array.isArray(workspaces)
    ? workspaces
    : workspaces && typeof workspaces === 'object' && !Array.isArray(workspaces) && Array.isArray(workspaces.packages)
      ? workspaces.packages
      : null;
  if (!values) {
    warnings.add('workspace-manifest-invalid', 'package.json workspaces must be an array or an object with a packages array; nested manifests were ignored.');
    return [];
  }
  return values.flatMap((value) => normalizeWorkspacePattern(value, 'package.json workspaces', warnings));
}

function pnpmWorkspacePatterns(projectDir, warnings) {
  const file = path.join(projectDir, 'pnpm-workspace.yaml');
  if (!sourceFile(projectDir, 'pnpm-workspace.yaml', warnings)) return [];
  const text = readTextSafe(file, 256 * 1024, warnings);
  if (text === null) {
    warnings.add('workspace-manifest-invalid', 'pnpm-workspace.yaml could not be read; nested manifests were ignored.');
    return [];
  }
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => /^packages:\s*(?:#.*)?$/.test(line));
  if (start === -1) {
    warnings.add('workspace-manifest-invalid', 'pnpm-workspace.yaml has no block-style packages list; nested manifests were ignored.');
    return [];
  }
  const values = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (!/^\s/.test(line)) break;
    const match = /^\s+-\s+(.+?)\s*(?:#.*)?$/.exec(line);
    if (!match) continue;
    let value = match[1].trim();
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1);
    }
    values.push(value);
  }
  return values.flatMap((value) => normalizeWorkspacePattern(value, 'pnpm-workspace.yaml packages', warnings));
}

function workspacePatternRegex(pattern) {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '*' && pattern[index + 1] === '*') {
      if (pattern[index + 2] === '/') {
        source += '(?:[^/]+/)*';
        index += 2;
      } else {
        source += '.*';
        index += 1;
      }
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`${source}$`);
}

function matchesWorkspace(directory, patterns) {
  const positives = patterns.filter((pattern) => !pattern.startsWith('!'));
  const negatives = patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1));
  return positives.some((pattern) => workspacePatternRegex(pattern).test(directory)) &&
    !negatives.some((pattern) => workspacePatternRegex(pattern).test(directory));
}

/** Read the root and only manifests admitted by declared workspace membership. */
function discoverManifests(projectDir, warnings) {
  const paths = walkFiles(projectDir, MANIFEST_SCAN_DEPTH, (name) => name === 'package.json', warnings);
  const rootRead = paths.includes('package.json') ? readJsonSafe(path.join(projectDir, 'package.json')) : null;
  const rootManifest = rootRead?.ok && rootRead.value && typeof rootRead.value === 'object' && !Array.isArray(rootRead.value)
    ? rootRead.value
    : null;
  if (rootRead && !rootManifest) {
    warnings.add('manifest-unreadable', 'package.json is not a readable package.json object — root manifest evidence was skipped.');
  }
  const patterns = [...new Set([
    ...packageWorkspacePatterns(rootManifest, warnings),
    ...pnpmWorkspacePatterns(projectDir, warnings),
  ])];
  const accepted = paths.filter((rel) => {
    if (rel === 'package.json') return Boolean(rootManifest);
    const dir = path.posix.dirname(rel);
    return patterns.length > 0 && matchesWorkspace(dir, patterns);
  });
  const manifests = [];
  for (const rel of accepted) {
    const read = rel === 'package.json' ? rootRead : readJsonSafe(path.join(projectDir, rel));
    if (!read.ok || !read.value || typeof read.value !== 'object' || Array.isArray(read.value)) {
      warnings.add('manifest-unreadable', `${rel} is not a readable package.json object — workspace evidence from it was skipped.`);
      continue;
    }
    const value = read.value;
    const dependencies = new Set();
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      if (!value[field] || typeof value[field] !== 'object' || Array.isArray(value[field])) continue;
      for (const dependency of Object.keys(value[field])) dependencies.add(dependency);
    }
    const frameworks = [...new Set(
      [...dependencies].map((dependency) => FRAMEWORK_DEPENDENCIES.get(dependency)).filter(Boolean),
    )].sort();
    const dir = path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel);
    manifests.push({
      path: rel,
      dir,
      name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : null,
      dependencies: [...dependencies].sort(),
      frameworks,
    });
  }
  return manifests;
}

/** Existing conventional component roots under every package in a workspace. */
function manifestComponentRoots(projectDir, manifests, warnings) {
  const roots = [];
  const seen = new Set();
  for (const manifest of manifests) {
    for (const [suffix, bucketKey] of PACKAGE_COMPONENT_ROOTS) {
      const rel = manifest.dir ? `${manifest.dir}/${suffix}` : suffix;
      if (seen.has(rel) || !sourceDirectory(projectDir, rel, warnings)) continue;
      seen.add(rel);
      roots.push({ rootRel: rel, bucketKey, speculative: true });
    }
  }
  return roots.sort((a, b) => a.rootRel.localeCompare(b.rootRel));
}

function discoverDeliveryConfig(projectDir, manifests, warnings) {
  const packageDirs = new Set(manifests.map((manifest) => manifest.dir));
  packageDirs.add('');
  const paths = new Set();
  for (const dir of packageDirs) {
    for (const name of DELIVERY_FILES) {
      const rel = dir ? `${dir}/${name}` : name;
      if (sourceFile(projectDir, rel, warnings)) paths.add(rel);
    }
  }
  const workflows = path.join(projectDir, '.github/workflows');
  for (const entry of sourceEntries(projectDir, workflows, warnings)) {
    if (!entry.dir && /\.ya?ml$/i.test(entry.name)) paths.add(`.github/workflows/${entry.name}`);
  }
  return [...paths].sort();
}

/** Resolve exact CMS markers, preferring an explicit canonical override. */
function resolvePlatform(config, manifests, override, warnings) {
  if (override) {
    const cms = cmsForKey(override);
    if (!cms) usage(`--platform must be one of the canonical CMS keys; got ${JSON.stringify(override)}`, USAGE);
    return { cms, source: 'override', markers: [`override:${cms.key}`] };
  }

  const markers = [];
  const configured = cmsForKey(config.stackAdapter);
  if (configured) markers.push({ key: configured.key, marker: `build.config.json:stackAdapter=${configured.key}` });
  for (const manifest of manifests) {
    for (const dependency of manifest.dependencies) {
      const key = PLATFORM_DEPENDENCIES.get(dependency);
      if (key) markers.push({ key, marker: `${manifest.path}:dependency=${dependency}` });
    }
  }
  const keys = [...new Set(markers.map((marker) => marker.key))].sort();
  if (keys.length > 1) {
    warnings.add(
      'ambiguous-platform',
      `Exact platform markers disagree (${keys.join(', ')}) — CMS identity remains null; pass --platform to resolve it.`,
    );
    return { cms: null, source: 'ambiguous', markers: markers.map((marker) => marker.marker).sort() };
  }
  const cms = keys.length === 1 ? cmsForKey(keys[0]) : null;
  return {
    cms,
    source: configured ? 'build-config' : cms ? 'manifest' : null,
    markers: markers.map((marker) => marker.marker).sort(),
  };
}

function importedSpecifiers(source) {
  const values = new Set();
  const patterns = [
    /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) values.add(match[1]);
  }
  return [...values].sort();
}

function nearestManifest(componentPath, manifests) {
  const candidates = manifests.filter((manifest) =>
    !manifest.dir || componentPath === manifest.dir || componentPath.startsWith(`${manifest.dir}/`));
  return candidates.sort((a, b) => b.dir.length - a.dir.length)[0] || null;
}

/** Gather concrete, path-citable evidence around one source component. */
function inspectSourceEvidence(projectDir, component, repositoryFiles, manifests, deliveryConfig, readRepositoryText) {
  const entry = typeof component.entry === 'string' ? component.entry : null;
  const componentDir = typeof component.path === 'string' ? component.path.replace(/\/+$/, '') : null;
  const key = normalizeLabel(component.folder || component.name);
  const entryStem = entry ? normalizeLabel(path.posix.basename(entry).replace(/\.[^.]+$/, '')) : key;
  const ownPrefix = componentDir ? `${componentDir}/` : null;
  const ownFiles = repositoryFiles.filter((file) => file === entry || (ownPrefix && file.startsWith(ownPrefix)));
  const sourceFiles = ownFiles.filter((file) => SOURCE_FILE_RE.test(file) && !TEST_FILE_RE.test(file) && !STORY_FILE_RE.test(file));
  const tests = repositoryFiles.filter((file) => {
    if (!TEST_FILE_RE.test(file)) return false;
    return (ownPrefix && file.startsWith(ownPrefix)) || normalizeLabel(path.posix.basename(file).replace(TEST_FILE_RE, '')) === entryStem;
  });

  const imports = new Set();
  for (const file of sourceFiles) {
    const text = readRepositoryText(file);
    if (text !== null) for (const specifier of importedSpecifiers(text)) imports.add(specifier);
  }
  const stories = repositoryFiles.filter((file) => {
    if (!STORY_FILE_RE.test(file)) return false;
    const storyStem = normalizeLabel(path.posix.basename(file).replace(STORY_FILE_RE, ''));
    if (storyStem === key || storyStem === entryStem) return true;
    const text = readRepositoryText(file);
    return text !== null && importedSpecifiers(text).some((specifier) => normalizeLabel(specifier).endsWith(key));
  });
  const styles = ownFiles.filter((file) => STYLE_FILE_RE.test(file));
  const tokenFiles = repositoryFiles.filter((file) => {
    if (!TOKEN_PATH_RE.test(file)) return false;
    return [...imports].some((specifier) => {
      const normalized = specifier.replace(/^\.\//, '');
      return file.includes(normalized.replace(/\.[^.]+$/, '')) || TOKEN_PATH_RE.test(specifier);
    });
  });
  const consumers = repositoryFiles.filter((file) => {
    if (ownFiles.includes(file) || TEST_FILE_RE.test(file) || STORY_FILE_RE.test(file) || !/\.[cm]?[jt]sx?$/.test(file)) return false;
    const text = readRepositoryText(file);
    if (text === null) return false;
    return importedSpecifiers(text).some((specifier) => {
      const normalized = normalizeLabel(specifier);
      return normalized === key || normalized.endsWith(`-${key}`) || normalized.endsWith(entryStem);
    });
  });
  const manifest = nearestManifest(componentDir || entry || '', manifests);
  const packagePrefix = manifest?.dir ? `${manifest.dir}/` : '';
  const packageDelivery = deliveryConfig.filter((file) =>
    !manifest || !manifest.dir || !file.includes('/') || file.startsWith('.github/workflows/') || file.startsWith(packagePrefix));

  return {
    entryPoints: entry ? [entry] : [],
    tests: [...new Set(tests)].sort(),
    stories: [...new Set(stories)].sort(),
    styles: [...new Set(styles)].sort(),
    tokens: [...new Set(tokenFiles)].sort(),
    imports: [...imports],
    consumers: [...new Set(consumers)].sort(),
    manifests: manifest ? [manifest.path] : [],
    frameworks: manifest ? [...manifest.frameworks] : [],
    deliveryConfig: [...new Set(packageDelivery)].sort(),
  };
}

function loadConfig(projectDir, warnings) {
  // The artifacts-root read + "artifacts" default are shared with archive-memory.cjs
  // via resolveArtifactsRoot so the two scripts can never disagree on where pipeline
  // evidence lives; the contextual warnings stay here.
  const resolved = resolveArtifactsRoot(projectDir);
  if (resolved.status === 'absent') {
    warnings.add(
      'no-build-config',
      'No build.config.json at the project root — artifacts root assumed to be "artifacts" and component buckets discovered heuristically.',
    );
    return {
      present: false,
      path: null,
      artifactsRoot: resolved.artifactsRoot,
      stackAdapter: null,
      cmsKey: null,
      cmsLabel: null,
    };
  }
  if (resolved.status === 'unreadable') {
    warnings.add('unreadable-json', `build.config.json could not be parsed: ${resolved.error}`);
    return {
      present: false,
      path: resolved.path,
      artifactsRoot: resolved.artifactsRoot,
      stackAdapter: null,
      cmsKey: null,
      cmsLabel: null,
    };
  }
  if (resolved.status === 'unsafe') {
    warnings.add(
      'source-symlink-skipped',
      'Skipped source symlink "build.config.json" because its target bytes are not proven by the pinned Git revision; using the default artifacts root and heuristic component discovery.',
    );
    return {
      present: false,
      path: resolved.path,
      artifactsRoot: resolved.artifactsRoot,
      stackAdapter: null,
      cmsKey: null,
      cmsLabel: null,
    };
  }
  const cfg = resolved.config;
  if (resolved.unsafeArtifactsRoot !== null) {
    warnings.add(
      'path-outside-project',
      `build.config.json artifactsRoot ${JSON.stringify(resolved.unsafeArtifactsRoot)} is not a safe repository-relative path — using "artifacts".`,
    );
  }
  const stackAdapter = cfg.stackAdapter ?? null;
  const cms = cmsForKey(stackAdapter);
  return {
    present: true,
    path: resolved.path,
    artifactsRoot: resolved.artifactsRoot,
    stackAdapter,
    cmsKey: cms?.key ?? null,
    cmsLabel: cms?.label ?? null,
    componentBuckets: cfg.componentBuckets ?? null,
    renderingDomains: cfg.renderingDomains ?? null,
    // Deprecated pipeline-side (superseded by componentBuckets) but still declared by some
    // toolkit projects as their only component-root pointer, so it is honored as a root.
    reusableComponentsBase: typeof cfg.reusableComponentsBase === 'string' ? cfg.reusableComponentsBase : null,
  };
}

function loadComponentIndex(projectDir, artifactsDir, warnings) {
  const indexPath = path.join(artifactsDir, 'component-index.json');
  if (!sourceFile(projectDir, relativePath(projectDir, indexPath), warnings)) {
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

function loadBuildPacks(projectDir, artifactsDir, warnings) {
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

  for (const entry of sourceEntries(projectDir, packsDir, warnings)) {
    if (entry.name.startsWith('.')) continue;

    if (entry.dir) {
      const files = sourceEntries(projectDir, entry.path, warnings)
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

function loadMemory(projectDir, artifactsDir, warnings) {
  const memoryDir = path.join(artifactsDir, 'memory');
  const shards = [];
  let text = '';

  for (const entry of sourceEntries(projectDir, memoryDir, warnings)) {
    if (entry.dir || !entry.name.endsWith('.md')) continue;
    shards.push(entry.name);
    text += `\n${readTextSafe(entry.path, undefined, warnings) || ''}`;
  }

  const indexPath = path.join(artifactsDir, 'MEMORY.md');
  const hasIndex = sourceFile(projectDir, relativePath(projectDir, indexPath), warnings);
  if (hasIndex) text += `\n${readTextSafe(indexPath, undefined, warnings) || ''}`;

  // Component-scoped memory shards are named per component slug.
  const componentShards = sourceEntries(projectDir, path.join(memoryDir, 'components'), warnings)
    .filter((e) => !e.dir && e.name.endsWith('.md'))
    .map((e) => normalizeLabel(e.name.slice(0, -3)));

  // Normalize the prose the same way labels are normalized, so "AccordionItem",
  // "Accordion Item", and "accordion-item" all become the same token sequence.
  // Wrapping in hyphens lets callers match on token boundaries rather than any
  // substring, so "card" does not match "flashcard".
  const blob = text ? `-${normalizeLabel(text)}-` : '';

  return { shards, hasIndex, componentShards, blob };
}

function loadDesignFacts(projectDir, artifactsDir, warnings) {
  const factsDir = path.join(artifactsDir, 'design-facts');
  // Directory names are slugs, but a stray run can append a suffix (e.g. a
  // timestamp), so match on the leading slug rather than requiring equality.
  return sourceEntries(projectDir, factsDir, warnings)
    .filter((e) => e.dir)
    .map((e) => normalizeLabel(e.name));
}

function loadShipLog(projectDir, artifactsDir, warnings) {
  const logPath = path.join(artifactsDir, 'ship-log.jsonl');
  if (!sourceFile(projectDir, relativePath(projectDir, logPath), warnings)) return { present: false, lines: 0 };
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
  if (!sourceFile(projectDir, relativePath(projectDir, fpPath), warnings)) return null;
  const read = readJsonSafe(fpPath);
  if (!read.ok) {
    warnings.add('unreadable-json', `fingerprint.json for "${componentPath}" could not be parsed: ${read.error}`);
    return null;
  }
  // A fingerprint that parses to something other than an object (an array, string, or
  // number) is not a usable API surface — warn and ignore it rather than counting it as
  // evidence, matching how loadComponentIndex/loadConfig treat malformed JSON.
  if (!read.value || typeof read.value !== 'object' || Array.isArray(read.value)) {
    warnings.add('unreadable-json', `fingerprint.json for "${componentPath}" is not a JSON object — ignored.`);
    return null;
  }
  return read.value;
}

/**
 * Normalize a component fingerprint into a stable, queryable facet surface.
 *
 * Two fingerprint schemas appear in the wild: a semantic/ARIA shape
 * (`{ slots[], affordance, role, variants[] }`) and an authoring shape
 * (`{ slot, primaryAffordance, contentRole, notes }`). Both fold into one surface so a
 * facet can be queried without knowing which schema a project's pipeline emitted. Missing
 * fields degrade to null / []; the raw `fingerprint` is kept alongside for anything richer.
 */
function liftFacets(fingerprint) {
  if (!fingerprint || typeof fingerprint !== 'object' || Array.isArray(fingerprint)) return null;
  // Trim on the way out: this skill turns on exact label matching, so a padded facet
  // value would silently miss once `facets` is consumed downstream.
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const arr = (v) =>
    Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : [];
  const slots = arr(fingerprint.slots);
  const slot = str(fingerprint.slot);
  return {
    role: str(fingerprint.role) ?? str(fingerprint.contentRole),
    affordance: str(fingerprint.affordance) ?? str(fingerprint.primaryAffordance),
    slots: slots.length ? slots : slot ? [slot] : [],
    variants: arr(fingerprint.variants),
    notes: str(fingerprint.notes),
  };
}

/**
 * Lift a declared composition parent from a fingerprint. Composition is never inferred from
 * names — real projects prove that unreliable (`button-group` is not a part of `button`) — so
 * it is recorded only when the pipeline DECLARES it via `fingerprint.partOf`. Returns the
 * normalized parent slug; the caller validates it against the discovered component set.
 */
function liftPartOf(fingerprint) {
  if (!fingerprint || typeof fingerprint !== 'object' || Array.isArray(fingerprint)) return null;
  const raw = fingerprint.partOf;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  // A value that normalizes to empty (all separators/punctuation) is not a usable parent —
  // treat it as no declaration rather than emitting an unvalidated empty slug.
  const slug = normalizeLabel(raw);
  return slug || null;
}

// A dir-style build pack's leaf files are per-component contracts (dom-contract, interaction,
// state-machine, …); `master.md` is the pack index, not a facet. A flat pack is a single file
// that IS the pack, so it declares no facets.
const BUILD_PACK_INDEX = 'master.md';
function buildPackFacets(pack) {
  if (!pack || pack.style !== 'dir' || !Array.isArray(pack.files)) return [];
  return pack.files
    .filter((f) => typeof f === 'string' && f.endsWith('.md') && f !== BUILD_PACK_INDEX)
    .map((f) => f.slice(0, -3))
    .sort();
}

// A barrel (any-extension `index.*`, not just the component extensions) re-exports a folder's
// parts, marking the folder as one component rather than a flat container of siblings.
const isBarrelName = (name) => /^index\.[a-z]+$/i.test(name);

/**
 * Is a directory of component files ONE component, or a flat set of independent siblings?
 *
 * One component when it holds a single file, names a matching entry file (`Modal/Modal.tsx`), or
 * is a compound whose every part is namespaced under the folder (`accordion/AccordionItem.tsx`,
 * `AccordionTrigger.tsx`). A flat set of independent siblings (`ui/icons/ArrowIcon.tsx`,
 * `CloseIcon.tsx`) is NOT — each file is its own component. A barrel (`index.*`) marks neither on
 * its own: icon sets carry one too.
 *
 * Shared by both scanners so a grouping folder is read the same way at any granularity. Callers
 * apply their own depth guard — the helper does not know where it sits in a tree.
 */
function classifyComponentDir(folderName, compFiles, fileRe) {
  const kebabFolder = normalizeLabel(folderName);
  const norm = (name) => normalizeLabel(name.replace(fileRe, ''));
  const nonBarrel = compFiles.filter((e) => !isBarrelName(e.name));
  const matchesFolder = compFiles.find((e) => norm(e.name) === kebabFolder);
  const compound =
    nonBarrel.length > 1 && nonBarrel.every((e) => norm(e.name).startsWith(`${kebabFolder}-`));
  return {
    oneComponent: compFiles.length === 1 || Boolean(matchesFolder) || compound,
    // Prefer the folder-matching file, then a PascalCase entry, then whatever came first.
    entryFile: matchesFolder || compFiles.find((e) => /^[A-Z]/.test(e.name)) || compFiles[0],
    nonBarrel,
  };
}

/** Walk a bucket root collecting directories that directly hold a component file. */
function scanBucket(projectDir, rootRel, bucketKey, fileRe, opts, warnings) {
  const rootAbs = path.join(projectDir, rootRel);
  if (!sourceDirectory(projectDir, rootRel, warnings)) {
    if (!opts.silentEmpty) warnings.add('empty-bucket', `Component bucket "${rootRel}" does not exist in the project.`);
    return [];
  }

  const found = [];

  /** Does this directory, or anything below it, hold a component file? */
  const holdsComponentBelow = (absDir, depth) => {
    if (depth > MAX_SCAN_DEPTH) return false;
    for (const entry of sourceEntries(projectDir, absDir, warnings)) {
      if (!entry.dir || SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      const entries = sourceEntries(projectDir, entry.path, warnings);
      if (entries.some((e) => !e.dir && fileRe.test(e.name) && !NON_COMPONENT_RE.test(e.name))) return true;
      if (holdsComponentBelow(entry.path, depth + 1)) return true;
    }
    return false;
  };

  const rootDepth = rootRel.split('/').filter(Boolean).length;

  const walk = (absDir, relDir, depth) => {
    if (depth > MAX_SCAN_DEPTH) return;
    const entries = sourceEntries(projectDir, absDir, warnings);
    const compFiles = entries.filter(
      (e) => !e.dir && !e.name.startsWith('.') && fileRe.test(e.name) && !NON_COMPONENT_RE.test(e.name),
    );
    // A leaf holds component files and nothing component-like deeper (a barrel re-exporting
    // subfolders would otherwise mask the real components beneath it).
    const isLeaf = compFiles.length > 0 && !holdsComponentBelow(absDir, depth);
    const segments = relDir.split('/').filter(Boolean);

    // Emit each non-barrel file in a flat directory as its own component.
    const pushFlat = (files, domain) => {
      for (const e of files) {
        if (files.length > 1 && isBarrelName(e.name)) continue;
        const stem = e.name.replace(fileRe, '');
        // Kebab the folder to match the dir-per-component convention; keep the file stem as name.
        found.push({ folder: normalizeLabel(stem), name: stem, bucket: bucketKey, domain, path: relDir, entry: `${relDir}/${e.name}` });
      }
    };

    if (isLeaf) {
      const folder = path.basename(relDir);
      // Component files at the bucket root itself are always flat siblings — only a nested
      // directory can be one component, so the classifier applies from depth 1 down.
      const cls = depth > 0 ? classifyComponentDir(folder, compFiles, fileRe) : null;

      if (cls && cls.oneComponent) {
        // A single path segment between the bucket root and the component dir is the domain
        // (e.g. renderings/<domain>/<component>).
        const between = segments.slice(rootDepth, -1);
        const entryFile = cls.entryFile;
        found.push({
          folder,
          name: entryFile.name.replace(fileRe, ''),
          bucket: bucketKey,
          domain: between.length === 1 ? between[0] : null,
          path: relDir,
          entry: `${relDir}/${entryFile.name}`,
        });
      } else {
        const between = segments.slice(rootDepth); // the container segment, if any, is the domain
        pushFlat(compFiles, between.length === 1 ? between[0] : null);
      }
      return; // Do not descend into a component's own subdirectories.
    }

    // Not a leaf. Component files sitting directly at the bucket root are still real components
    // (e.g. `src/components/Layout.tsx` alongside `src/components/forms/`) — emit them, then descend.
    if (depth === 0 && compFiles.length > 0) pushFlat(compFiles, null);

    for (const entry of entries) {
      if (!entry.dir || SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      walk(entry.path, `${relDir}/${entry.name}`, depth + 1);
    }
  };

  walk(rootAbs, rootRel, 0);
  if (found.length === 0 && !opts.silentEmpty) {
    warnings.add('empty-bucket', `Component bucket "${rootRel}" contained no component directories.`);
  }
  return found;
}

/**
 * Shallow (depth-1) discovery: each flat component file, or each immediate subdir holding
 * one, is one component. Suits template stacks (Handlebars) where components are flat files
 * or single-level folders; fine-grained leaves inside a folder come from Storybook instead.
 */
function scanBucketShallow(projectDir, rootRel, bucketKey, fileRe, opts, warnings) {
  const rootAbs = path.join(projectDir, rootRel);
  if (!sourceDirectory(projectDir, rootRel, warnings)) {
    if (!opts.silentEmpty) warnings.add('empty-bucket', `Component bucket "${rootRel}" does not exist in the project.`);
    return [];
  }

  const found = [];
  for (const entry of sourceEntries(projectDir, rootAbs, warnings)) {
    if (entry.name.startsWith('.')) continue;
    if (entry.dir) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const inner = sourceEntries(projectDir, entry.path, warnings).filter(
        (e) => !e.dir && fileRe.test(e.name) && !NON_COMPONENT_RE.test(e.name),
      );
      if (inner.length === 0) continue; // a folder with no component file is not a component
      const { oneComponent, entryFile, nonBarrel } = classifyComponentDir(entry.name, inner, fileRe);
      if (oneComponent) {
        found.push({
          folder: entry.name,
          name: entry.name,
          bucket: bucketKey,
          domain: null,
          path: `${rootRel}/${entry.name}`,
          entry: `${rootRel}/${entry.name}/${entryFile.name}`,
        });
      } else {
        // A grouping folder, not a component: each file inside it is its own component, and the
        // folder names their shared domain. Collapsing here would drop every leaf but one and
        // emit a component named after the folder, which nothing declares.
        for (const e of nonBarrel) {
          const stem = e.name.replace(fileRe, '');
          found.push({
            folder: normalizeLabel(stem),
            name: stem,
            bucket: bucketKey,
            domain: entry.name,
            path: `${rootRel}/${entry.name}`,
            entry: `${rootRel}/${entry.name}/${e.name}`,
          });
        }
      }
    } else if (fileRe.test(entry.name) && !NON_COMPONENT_RE.test(entry.name)) {
      const stem = entry.name.replace(fileRe, '');
      found.push({
        folder: stem,
        name: stem,
        bucket: bucketKey,
        domain: null,
        path: rootRel,
        entry: `${rootRel}/${entry.name}`,
      });
    }
  }

  if (found.length === 0 && !opts.silentEmpty) {
    warnings.add('empty-bucket', `Component bucket "${rootRel}" contained no components.`);
  }
  return found;
}

/**
 * Discovery roots as {rootRel, bucketKey} entries: declared componentBuckets, the adapter
 * profile's conventional roots, a deprecated reusableComponentsBase pointer, and a layouts
 * root derived from the buckets. Heuristic roots are added later, only when nothing declared.
 */
function resolveRoots(config, profile, packageRoots, warnings) {
  const roots = [];
  const seen = new Set();
  // `speculative` roots (adapter conventions, reusableComponentsBase, the derived layouts
  // root) are probes — missing is not noteworthy. Declared componentBuckets are not.
  const add = (rel, bucketKey, speculative) => {
    if (typeof rel !== 'string' || !rel) return;
    const norm = rel.replace(/\/+$/, '');
    if (!isSafeRepositoryRelativePath(norm)) {
      warnings.add(
        'path-outside-project',
        `Component root ${JSON.stringify(rel)} is not a safe repository-relative path and was skipped.`,
      );
      return;
    }
    if (seen.has(norm)) return;
    seen.add(norm);
    roots.push({ rootRel: norm, bucketKey, speculative });
  };

  const buckets = config.componentBuckets && typeof config.componentBuckets === 'object'
    ? Object.entries(config.componentBuckets) : [];
  for (const [key, rel] of buckets) {
    if (typeof rel !== 'string' || !rel) {
      warnings.add('unreadable-config', `componentBuckets.${key} is not a path string — that bucket was skipped.`);
      continue;
    }
    add(rel, key, false);
  }
  for (const [rel, bucketKey] of profile.roots) add(rel, bucketKey, true);
  if (config.reusableComponentsBase) add(config.reusableComponentsBase, 'ui', true);
  for (const root of packageRoots) add(root.rootRel, root.bucketKey, true);

  // Census breadth: a layouts root alongside the declared buckets (e.g. src/components/layouts).
  const uiBucket = config.componentBuckets && typeof config.componentBuckets.ui === 'string'
    ? config.componentBuckets.ui : null;
  if (uiBucket) {
    const base = path.posix.dirname(uiBucket.replace(/\/+$/, ''));
    if (base && base !== '.') add(`${base}/layouts`, 'layout', true);
  }

  return roots;
}

/** Collapse scan results by normalized key. Two entries that normalize to the same key — sibling
 *  files in a flat directory, or components under different roots — are genuine ambiguity: warn
 *  (identifying each by its entry file) and keep the first. */
function dedupeScan(comps, warnings) {
  const byKey = new Map();
  for (const c of comps) {
    const key = normalizeLabel(c.folder || c.name);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, c);
      continue;
    }
    warnings.add(
      'duplicate-component',
      `Components "${prev.entry || prev.path || prev.folder}" and "${c.entry || c.path || c.folder}" normalize to the same key "${key}" — only the first was kept.`,
    );
  }
  return [...byKey.values()];
}

/**
 * Discover components from the filesystem, driven by the stack profile. Runs in BOTH modes:
 * in artifacts mode it corroborates and supplements the index; in code-scan mode it is the
 * component source. Heuristic roots are probed only when nothing is declared and heuristics
 * are allowed (code-scan mode).
 */
function discoverComponents(projectDir, config, profile, fileRe, opts, warnings) {
  const roots = resolveRoots(config, profile, opts.packageRoots || [], warnings);
  const scan = profile.granularity === 'shallow' ? scanBucketShallow : scanBucket;

  const out = [];
  if (roots.length > 0) {
    for (const r of roots) {
      // Declared buckets warn when missing (except in artifacts mode, where the index is
      // authoritative and the scan only corroborates); speculative roots stay quiet.
      const silentEmpty = r.speculative || !opts.allowHeuristic;
      out.push(...scan(projectDir, r.rootRel, r.bucketKey, fileRe, { silentEmpty }, warnings));
    }
  } else if (opts.allowHeuristic) {
    const probed = HEURISTIC_ROOTS.filter((rel) => sourceDirectory(projectDir, rel, warnings));
    if (probed.length > 0) {
      warnings.add('heuristic-buckets', `No componentBuckets or adapter roots — probed conventional roots: ${probed.join(', ')}.`);
      for (const rel of probed) out.push(...scanBucket(projectDir, rel, null, fileRe, { silentEmpty: false }, warnings));
    }
  }
  return dedupeScan(out, warnings);
}

/**
 * Discover Storybook stories as a supplementary signal. Most projects have none (a no-op);
 * for the toolkit stack Storybook is the registry, so stories contribute to the census. Each
 * `<slug>.stories.<ext>` yields one component keyed by its slug, bucketed by its story path.
 */
function discoverStories(projectDir, warnings) {
  const found = [];
  const walk = (absDir, relDir, depth) => {
    if (depth > MAX_STORY_DEPTH) return;
    for (const entry of sourceEntries(projectDir, absDir, warnings)) {
      if (entry.name.startsWith('.')) continue;
      if (entry.dir) {
        if (STORY_SKIP_DIRS.has(entry.name)) continue;
        walk(entry.path, relDir ? `${relDir}/${entry.name}` : entry.name, depth + 1);
      } else if (STORY_FILE_RE.test(entry.name)) {
        const slug = entry.name.replace(STORY_FILE_RE, '');
        const hay = `/${relDir.toLowerCase()}/`;
        const bucket = hay.includes('/components/') ? 'ui'
          : hay.includes('/modules/') ? 'rendering'
            : hay.includes('/shared/') ? 'ui'
              : hay.includes('/templates/') ? 'template'
                : null;
        found.push({
          folder: slug,
          name: slug,
          bucket,
          domain: null,
          path: relDir,
          entry: relDir ? `${relDir}/${entry.name}` : entry.name,
          source: 'storybook',
        });
      }
    }
  };
  walk(projectDir, '', 0);

  // A slug can appear under two hierarchies (e.g. modules/ and templates/); keep the first.
  const byKey = new Map();
  for (const c of found) {
    const key = normalizeLabel(c.folder);
    if (!byKey.has(key)) byKey.set(key, c);
  }
  return [...byKey.values()];
}

/** Warn when a declared renderingDomain has no directory on disk (a stale/fictional mapping). */
function warnRenderingDomainDrift(projectDir, config, warnings) {
  const rd = config.renderingDomains;
  const buckets = config.componentBuckets;
  if (!rd || typeof rd !== 'object' || !buckets || typeof buckets.rendering !== 'string') return;
  const renderingRoot = buckets.rendering.replace(/\/+$/, '');
  for (const [key, sub] of Object.entries(rd)) {
    if (typeof sub !== 'string' || !sub) continue;
    const domRel = `${renderingRoot}/${sub.replace(/^\/+|\/+$/g, '')}`;
    if (!isSafeRepositoryRelativePath(domRel) || !sourceDirectory(projectDir, domRel, warnings)) {
      warnings.add('rendering-domain-missing', `renderingDomains.${key} → "${domRel}" does not exist on disk (stale declaration).`);
    }
  }
}

/**
 * Fold discovered/story components into the keyed map: corroborate an existing component (add
 * the source, fill null fields) or add one that was missing. Cross-signal matches (index vs
 * scan vs story) are expected, so this is silent — genuine duplicates are caught upstream.
 */
function foldSignals(byKey, comps, defaultSource) {
  for (const c of comps) {
    const key = normalizeLabel(c.folder || c.name);
    const src = c.source || defaultSource;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        name: c.name,
        folder: c.folder,
        bucket: c.bucket ?? null,
        domain: c.domain ?? null,
        path: c.path ?? null,
        entry: c.entry ?? null,
        sources: [src],
      });
      continue;
    }
    if (!existing.sources.includes(src)) existing.sources.push(src);
    existing.bucket = existing.bucket ?? c.bucket ?? null;
    existing.domain = existing.domain ?? c.domain ?? null;
    existing.path = existing.path ?? c.path ?? null;
    existing.entry = existing.entry ?? c.entry ?? null;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    keys: ['project', 'platform', 'out'],
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
  const snapshot = sourceSnapshot(projectDir, warnings);
  const config = loadConfig(projectDir, warnings);
  const manifests = discoverManifests(projectDir, warnings);
  const platform = resolvePlatform(config, manifests, values.platform, warnings);
  config.cmsKey = platform.cms?.key ?? null;
  config.cmsLabel = platform.cms?.label ?? null;
  config.platformSource = platform.source;
  config.platformMarkers = platform.markers;
  const profile = profileFor(config.stackAdapter ?? config.cmsKey, warnings);
  const fileRe = makeFileRe(profile.exts);
  const artifactsDir = path.join(projectDir, config.artifactsRoot);
  const artifactsAvailable = sourceDirectory(projectDir, config.artifactsRoot, warnings);
  const packageRoots = manifestComponentRoots(projectDir, manifests, warnings);
  const deliveryConfig = discoverDeliveryConfig(projectDir, manifests, warnings);
  const repositoryFiles = walkFiles(projectDir, SOURCE_SIGNAL_DEPTH, (name, rel) =>
    SOURCE_FILE_RE.test(name) || (TOKEN_PATH_RE.test(rel) && /\.(?:json|ya?ml)$/i.test(name)), warnings);
  const sourceTextCache = new Map();
  const readRepositoryText = (rel) => {
    if (!sourceTextCache.has(rel)) {
      sourceTextCache.set(rel, readTextSafe(path.join(projectDir, rel), 2 * 1024 * 1024, warnings));
    }
    return sourceTextCache.get(rel);
  };

  if (!artifactsAvailable) {
    warnings.add('no-artifacts-root', `No artifacts root at ${config.artifactsRoot}/ — pipeline evidence is unavailable.`);
  }

  const componentIndex = artifactsAvailable ? loadComponentIndex(projectDir, artifactsDir, warnings) : null;
  const { packs, dirStyle, flatStyle } = artifactsAvailable
    ? loadBuildPacks(projectDir, artifactsDir, warnings)
    : { packs: new Map(), dirStyle: 0, flatStyle: 0 };
  const memory = artifactsAvailable
    ? loadMemory(projectDir, artifactsDir, warnings)
    : { shards: [], hasIndex: false, componentShards: [], blob: '' };
  const designFacts = artifactsAvailable ? loadDesignFacts(projectDir, artifactsDir, warnings) : [];
  const shipLog = artifactsAvailable ? loadShipLog(projectDir, artifactsDir, warnings) : { present: false, lines: 0 };

  // An empty component-index.json ([]) is not artifacts evidence — fall through to a code scan so
  // the heuristic roots are still probed rather than the run yielding zero components.
  const hasIndex = Array.isArray(componentIndex) && componentIndex.length > 0;
  const mode = hasIndex || packs.size > 0 ? 'artifacts' : 'code-scan';

  // Discovery unions every signal: the component index (when present), a filesystem scan of the
  // declared + adapter + heuristic roots (run in BOTH modes so it corroborates and supplements
  // the index), and Storybook stories where the stack uses them.
  const indexComps = componentIndex
    ? componentIndex.map((c) => ({
        name: typeof c.name === 'string' ? c.name : String(c.folder ?? ''),
        folder: typeof c.folder === 'string' ? c.folder : normalizeLabel(typeof c.name === 'string' ? c.name : ''),
        bucket: typeof c.bucket === 'string' ? c.bucket : null,
        domain: typeof c.domain === 'string' ? c.domain : null,
        path: indexedSourcePath(projectDir, c.path, 'path', warnings),
        entry: indexedSourcePath(projectDir, c.entry, 'entry', warnings),
        sources: ['component-index'],
      }))
    : [];
  const scanComps = discoverComponents(
    projectDir,
    config,
    profile,
    fileRe,
    { allowHeuristic: mode === 'code-scan', packageRoots },
    warnings,
  );
  // Story files are always inspected as source evidence. Only profiles that use
  // Storybook as their registry may introduce a story-only component.
  const storyComps = discoverStories(projectDir, warnings);
  warnRenderingDomainDrift(projectDir, config, warnings);

  // The index is authoritative on conflict; a duplicate-component warning is kept for genuine
  // index collisions. Scan + story signals are then folded in (corroborate or supplement).
  const byKey = new Map();
  for (const component of indexComps) {
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
  foldSignals(byKey, scanComps, 'code-scan');
  if (profile.storybook) foldSignals(byKey, storyComps, 'storybook');

  // Build packs with no matching component still count as evidence of something built.
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
  const componentKeys = new Set(byKey.keys());
  const components = [...byKey.entries()]
    .map(([key, component]) => {
      const sources = new Set(component.sources);
      const sourceEvidence = inspectSourceEvidence(
        projectDir,
        component,
        repositoryFiles,
        manifests,
        deliveryConfig,
        readRepositoryText,
      );
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

      // Composition is recorded only when a fingerprint declares it, and only when the declared
      // parent is itself a discovered component (and not this component) — a dangling or
      // self-referential partOf is dropped with a warning rather than written as a broken edge.
      let partOf = liftPartOf(fingerprint);
      if (partOf && (partOf === key || !componentKeys.has(partOf))) {
        warnings.add(
          'part-of-unresolved',
          `Component "${component.folder}" declares partOf "${partOf}" — ${partOf === key ? 'a self-reference' : 'not a discovered component'}; dropped.`,
        );
        partOf = null;
      }

      return {
        name: component.name,
        folder: component.folder,
        bucket: component.bucket,
        domain: component.domain,
        path: component.path,
        entry: component.entry,
        sources: [...sources].sort(),
        sourceEvidence,
        facets: liftFacets(fingerprint),
        partOf,
        buildPack: pack ? { style: pack.style, files: pack.files, facets: buildPackFacets(pack) } : null,
        fingerprint,
      };
    })
    .sort((a, b) => (a.folder < b.folder ? -1 : a.folder > b.folder ? 1 : 0));

  if (components.length === 0) {
    warnings.add('no-components-found', 'No components were discovered from source roots or optional build artifacts — check the project path and package manifests.');
  }

  writeOut(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      project: projectDir,
      sourceSnapshot: snapshot,
      mode,
      config,
      discovery: {
        manifests: manifests.map(({ path: manifestPath, dir, name, frameworks }) => ({ path: manifestPath, dir, name, frameworks })),
        componentRoots: packageRoots.map((root) => root.rootRel),
        frameworks: [...new Set(manifests.flatMap((manifest) => manifest.frameworks))].sort(),
        deliveryConfig,
        sourceFiles: repositoryFiles.length,
      },
      components,
      evidence: {
        componentIndex: hasIndex,
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
