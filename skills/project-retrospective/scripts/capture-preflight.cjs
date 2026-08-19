#!/usr/bin/env node
/**
 * capture-preflight.cjs — can these captures be applied to this library checkout?
 *
 * Reads a run's whole `captures/` directory, checks every capture against the
 * ui-design-brain manifest and the state of a local ui-design-library checkout,
 * and emits one plan covering all of them: which are ready to execute, which are
 * blocked and why, and which resume at code, Figma, or evidence. Its schema-v4 component record
 * emits the validated server-first architecture beside the exact `component.json`
 * object to write. Schema v4 also carries the structural identity, lifecycle,
 * intended de-cliented realization, and accessibility ownership. Architecture governs the rewrite and is never copied into the
 * library manifest.
 *
 * What it deliberately does NOT do:
 *   - Write into the library. Not one byte. Executing a capture is a rewrite, not
 *     a copy, so the facade/types/tree/parts/hooks, stories, and `declienting`
 *     record are the model's to author. A scaffolded component.json alone would
 *     leave the library failing its own contracts until the rewrite landed.
 *   - Spawn `pnpm contracts` or anything else. This pre-flights the inputs to that
 *     checker so a rewrite is not wasted; it does not restate its verdicts, and it
 *     stays runnable with no node_modules anywhere.
 *
 * Usage:
 *   node capture-preflight.cjs --captures <dir> --library <dir>
 *                              [--brain <dir> | --manifest <file>]
 *                              [--out <file>] [--pretty]
 *
 * Exit codes:
 *   0  every capture is ready or already applied
 *   1  one or more captures are blocked, or an unexpected failure
 *   2  invalid invocation
 *   3  --captures is missing or is not a directory
 *   4  --library is missing or is not a ui-design-library checkout
 *   5  the manifest is missing, unreadable, or structurally invalid
 *   6  no capture is blocked, but one or more are deferred: their canonical is
 *      only established by a new-pattern proposal in this run. Promote the
 *      proposal first (Action: promote), then re-run — the capture becomes ready.
 *
 * A missing manifest is the one input that degrades rather than fails: without
 * --brain or --manifest the run records a warning and skips the catalog check.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  parseArgs,
  checkArgs,
  readJsonSafe,
  readTextSafe,
  isDir,
  isFile,
  listEntries,
  listFilesRecursive,
  normalizeLabel,
  kebab,
  sections,
  fencedBlock,
  parseCanonicalLine,
  Warnings,
  writeOut,
  usage,
} = require('./lib/util.cjs');

const USAGE = [
  'Usage: node capture-preflight.cjs --captures <dir> --library <dir> [--brain <dir> | --manifest <file>] [--out <file>] [--pretty]',
  '',
  "  --captures  A run's captures/ directory, applied as a set (required)",
  '  --library   Local ui-design-library checkout (required)',
  '  --brain     Local ui-design-brain checkout, for the canonical check',
  '  --manifest  patterns-manifest.json directly; wins over --brain',
  '  --out       Write the plan to a file instead of stdout',
  '  --pretty    Indent the JSON output',
];

const MANIFEST_REL = 'skills/ui-design-brain/patterns-manifest.json';
const CAPTURE_TYPE = 'component-capture';
const ARCHITECTURE_KEYS = ['hydration', 'mode', 'modules', 'serverOutput'];
const MODULE_KEYS = ['path', 'role', 'runtime'];
const ARCHITECTURE_MODES = ['server', 'hybrid', 'client'];
const HYDRATION_REASONS = [
  'state',
  'event-handler',
  'effect',
  'context',
  'portal',
  'timer',
  'observer',
  'browser-api',
  'third-party-client',
];
const MODULE_ROLES = ['facade', 'types', 'tree', 'branch', 'leaf', 'hook', 'styles'];
const MODULE_RUNTIMES = ['server', 'client'];
const IMPLEMENTATION_ROLES = ['tree', 'branch', 'leaf'];
const REUSE_SLOTS = [
  'media',
  'heading',
  'body',
  'meta',
  'action',
  'badge',
  'icon',
  'footer',
  'stat',
  'chart',
  'avatar',
  'caption',
  'toolbar',
  'field',
  'panel',
  'row',
  'close',
  'other',
];
const REUSE_AFFORDANCES = ['navigate', 'display', 'input', 'expand', 'select', 'trigger', 'contain', 'feedback', 'other'];
const REUSE_ROLES = [
  'entity-summary',
  'metric',
  'media-showcase',
  'editorial',
  'action-group',
  'container',
  'structural',
  'notification',
  'other',
];
const RENDERING_MODES = ['server', 'hybrid', 'client'];
const REALIZATION_PROP_TYPES = ['string', 'number', 'boolean', 'node', 'callback', 'collection', 'enum', 'ref', 'element'];
const REALIZATION_CARDINALITIES = ['one', 'zero-or-one', 'zero-or-more', 'one-or-more'];
const REALIZATION_BEHAVIOR_KINDS = ['semantics', 'keyboard', 'focus', 'state', 'announcement', 'motion', 'pointer-alternative'];
const REALIZATION_RESPONSIBILITIES = [
  'accessible-copy',
  'text-alternatives',
  'heading-context',
  'landmark-context',
  'dynamic-content',
  'timed-content',
  'token-contrast',
  'safe-class-overrides',
  'complete-page-assistive-technology-testing',
];
const REALIZATION_PROTECTED_PROPERTIES = [
  'display',
  'visibility',
  'pointer-events',
  'focus-indicator',
  'semantics',
  'reading-order',
  'target-size',
];
const IDREF_ATTRIBUTES = ['aria-controls', 'aria-describedby', 'aria-labelledby', 'for'];
const CONDITION_PREDICATES = ['present', 'truthy', 'equals', 'not-equals', 'non-empty'];
const CAPTURE_PROGRESS_STATES = ['pending', 'code-complete'];
const CAPTURE_APPLIED_STATES = ['landed'];

// Semantic tokens are declared in component.json without the leading dashes, so
// harvest the names the same way the library's own contract checker does.
const TOKEN_DECL_RE = /^\s*--([a-z0-9-]+):/gm;

// ui-design-library's own kebab lacks the acronym split and the accent fold that
// normalizeLabel applies. No canonical in the catalog triggers the difference
// today, but a capture that did would produce a directory this repo and that one
// disagree about — cheap to detect here, expensive to find there.
function libraryKebab(input) {
  return String(input)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function fail(code, message) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(code);
}

/**
 * Load the patterns manifest, or return null when none was requested.
 *
 * Strict when a path was given: a structurally broken manifest makes every
 * canonical check meaningless, so exiting beats reporting confident nonsense.
 */
function loadManifest(manifestPath, warnings) {
  if (!manifestPath) {
    warnings.add(
      'manifest-absent',
      'No --brain or --manifest given, so no capture was checked against the catalog. Canonical names are taken on trust.',
    );
    return null;
  }
  if (!isFile(manifestPath)) fail(5, `manifest not found: ${manifestPath}`);
  const read = readJsonSafe(manifestPath);
  if (!read.ok) fail(5, `manifest could not be parsed: ${read.error}`);
  const entries = read.value;
  if (!Array.isArray(entries)) fail(5, 'manifest must be a top-level JSON array');
  entries.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object' || typeof entry.name !== 'string' || !entry.name) {
      fail(5, `manifest entry ${i} has no string "name"`);
    }
  });
  return entries;
}

/** Semantic token names the library defines, without the leading `--`. */
function loadTokens(libraryDir, warnings) {
  const tokensPath = path.join(libraryDir, 'src/tokens/semantic.css');
  const css = readTextSafe(tokensPath, 2 * 1024 * 1024, warnings);
  if (css === null) {
    warnings.add(
      'tokens-unreadable',
      `${tokensPath} could not be read, so declared tokens were not checked against the semantic layer.`,
    );
    return null;
  }
  const names = new Set();
  for (const match of css.matchAll(TOKEN_DECL_RE)) names.add(match[1]);
  return names;
}

/**
 * The run's new-pattern proposals, reduced to the canonical each would establish.
 * A capture whose canonical is absent from the manifest but named by one of these
 * is deferred, not blocked: the canonical becomes real the moment its proposal is
 * promoted. Read the same way validate-report.cjs reads a new-pattern entry —
 * fence-aware, new-pattern only, and guarded so a malformed proposal never throws
 * past the top-level catch and loses the plan for every other capture.
 */
function loadProposals(proposalsDir, warnings) {
  if (!isDir(proposalsDir)) return [];
  const out = [];
  for (const file of listEntries(proposalsDir).filter((e) => !e.dir && e.name.endsWith('.md'))) {
    const text = readTextSafe(file.path, 2 * 1024 * 1024, warnings);
    if (text === null) continue;
    const top = sections(text, 2);
    const typeSection = top.find((s) => s.heading === 'Proposal type');
    if (!typeSection || !/\bnew-pattern\b/.test(typeSection.body)) continue;
    const entrySection = top.find((s) => s.heading === 'Manifest entry');
    const entryJson = entrySection ? fencedBlock(entrySection.body, 'json') : null;
    let entry = null;
    if (entryJson) {
      try {
        entry = JSON.parse(entryJson);
      } catch {
        entry = null;
      }
    }
    if (!entry || typeof entry.name !== 'string' || !entry.name) {
      warnings.add(
        'proposal-unparsable',
        `${file.name} is a new-pattern proposal but its "## Manifest entry" has no parseable canonical name, so a capture that would defer to it stays blocked.`,
      );
      continue;
    }
    out.push({ file: file.name, canonical: entry.name });
  }
  return out;
}

function hasClientDirective(source) {
  return /^\s*(?:(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))\s*)*(['"])use client\1\s*;/.test(source);
}

function relativeImports(source) {
  const imports = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?[^;]*?\sfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1].startsWith('.')) imports.add(match[1]);
    }
  }
  return [...imports];
}

function resolveModule(from, specifier, modules) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((candidate) => modules.has(candidate)) || null;
}

/** Confirm that an existing multifile implementation matches the captured graph. */
function inspectAppliedArchitecture(dir, architecture, files) {
  if (!architecture) return ['the capture has no validated runtime architecture'];
  const issues = [];
  const sources = new Map();

  for (const module of architecture.modules) {
    const source = fs.readFileSync(path.join(dir, module.path), 'utf8');
    sources.set(module.path, source);
    if (source.trim().length === 0) issues.push(`${module.path} is empty`);
    const directive = hasClientDirective(source);
    if (module.runtime === 'server' && directive) {
      issues.push(`${module.path} is declared server but contains 'use client'`);
    }
  }

  const modulePaths = new Set(architecture.modules.map((module) => module.path));
  const graph = new Map(
    [...sources].map(([modulePath, source]) => [
      modulePath,
      relativeImports(source)
        .map((specifier) => resolveModule(modulePath, specifier, modulePaths))
      .filter(Boolean),
    ]),
  );
  const facadeSource = sources.get('index.ts') || '';
  const reachable = new Set();
  const clientReachable = new Set();
  const visitedStates = new Set();
  const queue = [{ modulePath: 'index.ts', client: hasClientDirective(facadeSource) }];
  while (queue.length > 0) {
    const { modulePath, client } = queue.shift();
    const state = `${modulePath}:${client}`;
    if (visitedStates.has(state)) continue;
    visitedStates.add(state);
    reachable.add(modulePath);
    if (client) clientReachable.add(modulePath);
    for (const imported of graph.get(modulePath) || []) {
      queue.push({
        modulePath: imported,
        client: client || hasClientDirective(sources.get(imported) || ''),
      });
    }
  }

  for (const module of architecture.modules) {
    if (!reachable.has(module.path)) issues.push(`${module.path} is not reachable from index.ts`);
  }
  for (const module of architecture.modules.filter((candidate) => candidate.runtime === 'client')) {
    if (!clientReachable.has(module.path)) {
      issues.push(`${module.path} is declared client but is not beneath a 'use client' boundary`);
    }
  }
  if (architecture.mode === 'client' && !hasClientDirective(facadeSource)) {
    issues.push("client mode requires index.ts to contain 'use client'");
  }
  if (architecture.mode !== 'client' && hasClientDirective(facadeSource)) {
    issues.push(`${architecture.mode} mode requires a server index.ts facade`);
  }

  const rootStories = files.filter((file) => !file.includes('/') && file.endsWith('.stories.tsx'));
  if (rootStories.length !== 1) issues.push('the component must contain exactly one root stories file');
  return issues;
}

/** What `components/<slug>/` currently holds, if anything. */
function inspectLibraryDir(libraryDir, slug, architecture) {
  const dir = path.join(libraryDir, 'components', slug);
  if (!isDir(dir)) {
    return {
      dir: `components/${slug}`,
      exists: false,
      files: [],
      has: { componentJson: false, implementation: false, stories: false },
      plannedModules: [],
      missingModules: [],
      unexpectedModules: [],
      architectureIssues: [],
      complete: false,
    };
  }
  const files = listFilesRecursive(dir);
  const plannedModules = architecture ? architecture.modules.map((module) => module.path) : [];
  const missingModules = plannedModules.filter((modulePath) => !files.includes(modulePath));
  const actualModules = files.filter((file) => /\.tsx?$/.test(file) && !/\.stories\.tsx?$/.test(file));
  const unexpectedModules = actualModules.filter((modulePath) => !plannedModules.includes(modulePath));
  const componentJson = files.includes('component.json');
  const implementation = files.some((file) => file.endsWith('.tsx') && !file.endsWith('.stories.tsx'));
  const stories = files.some((file) => !file.includes('/') && file.endsWith('.stories.tsx'));
  const architectureIssues =
    architecture && missingModules.length === 0 && unexpectedModules.length === 0
      ? inspectAppliedArchitecture(dir, architecture, files)
      : [];
  return {
    dir: `components/${slug}`,
    exists: true,
    files,
    has: {
      componentJson,
      implementation,
      stories,
    },
    plannedModules,
    missingModules,
    unexpectedModules,
    architectureIssues,
    complete: Boolean(
      architecture &&
        componentJson &&
        stories &&
        missingModules.length === 0 &&
        unexpectedModules.length === 0 &&
        architectureIssues.length === 0
    ),
  };
}

function validateReuseFingerprint(value, block) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    block('reuse-fingerprint', 'the proposed entry is missing reuseFingerprint.');
    return { slots: [], affordance: null, role: null };
  }
  if (!sameKeys(value, ['affordance', 'role', 'slots'])) {
    block('reuse-fingerprint', 'reuseFingerprint keys must be exactly affordance, role, slots.');
  }
  if (!Array.isArray(value.slots) || value.slots.length === 0) {
    block('reuse-fingerprint', 'reuseFingerprint.slots must be a non-empty array.');
  } else {
    const seen = new Set();
    for (const slot of value.slots) {
      if (!REUSE_SLOTS.includes(slot)) block('reuse-fingerprint', `reuseFingerprint slot ${JSON.stringify(slot)} is not governed.`);
      if (seen.has(slot)) block('reuse-fingerprint', `reuseFingerprint slot ${JSON.stringify(slot)} is duplicated.`);
      seen.add(slot);
    }
  }
  if (!REUSE_AFFORDANCES.includes(value.affordance)) {
    block('reuse-fingerprint', `reuseFingerprint affordance ${JSON.stringify(value.affordance)} is not governed.`);
  }
  if (!REUSE_ROLES.includes(value.role)) {
    block('reuse-fingerprint', `reuseFingerprint role ${JSON.stringify(value.role)} is not governed.`);
  }
  return {
    slots: Array.isArray(value.slots) ? [...value.slots] : [],
    affordance: value.affordance ?? null,
    role: value.role ?? null,
  };
}

function nodeReferences(value, label, block) {
  const hasNode = typeof value?.node === 'string' && value.node.length > 0;
  const hasNodes = Array.isArray(value?.nodes) && value.nodes.length > 0;
  if (hasNode === hasNodes) {
    block('realization-nodes', `${label} requires exactly one of node or non-empty nodes.`);
    return [];
  }
  const refs = hasNode ? [value.node] : value.nodes;
  if (new Set(refs).size !== refs.length || refs.some((ref) => typeof ref !== 'string' || !ref)) {
    block('realization-nodes', `${label} has invalid or duplicate node references.`);
    return [];
  }
  return refs;
}

function sameValueSet(left, right) {
  const normalize = (items) => [...new Set(items.map((item) => JSON.stringify(item)))].sort();
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function valueMatchesProp(value, prop) {
  if (prop.type === 'string' || prop.type === 'ref') return typeof value === 'string';
  if (prop.type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (prop.type === 'boolean') return typeof value === 'boolean';
  if (prop.type === 'enum') return Array.isArray(prop.values) && prop.values.some((item) => sameValueSet([item], [value]));
  if (prop.type === 'element') return typeof value === 'string' && (!Array.isArray(prop.values) || prop.values.includes(value));
  if (prop.type === 'collection') return value !== null && typeof value === 'object';
  if (prop.type === 'callback' || prop.type === 'node') return false;
  return true;
}

function validateRealization(value, block) {
  const before = block.count();
  const requiredKeys = [
    'accessibility',
    'behaviors',
    'contentBindings',
    'dom',
    'props',
    'relationships',
    'safeAttributes',
    'styleSlots',
    'version',
  ];
  const allowedKeys = [...requiredKeys, 'constraints'];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    block('realization-missing', 'the proposed entry is missing realization v1.');
    return null;
  }
  const actualKeys = Object.keys(value);
  if (requiredKeys.some((key) => !actualKeys.includes(key)) || actualKeys.some((key) => !allowedKeys.includes(key))) {
    block('realization-keys', `realization requires ${requiredKeys.join(', ')} and may additionally contain constraints.`);
  }
  if (value.version !== 1) block('realization-version', 'realization.version must equal 1.');

  const props = Array.isArray(value.props) ? value.props : [];
  if (props.length === 0) block('realization-props', 'realization.props must be a non-empty array.');
  const propPaths = new Set();
  for (const prop of props) {
    if (!prop || typeof prop.path !== 'string' || !prop.path) {
      block('realization-props', 'every realization prop requires a non-empty path.');
      continue;
    }
    if (propPaths.has(prop.path)) block('realization-props', `realization prop ${JSON.stringify(prop.path)} is duplicated.`);
    propPaths.add(prop.path);
    if (!REALIZATION_PROP_TYPES.includes(prop.type)) {
      block('realization-props', `realization prop ${JSON.stringify(prop.path)} has unsupported type ${JSON.stringify(prop.type)}.`);
    }
    if (typeof prop.required !== 'boolean') {
      block('realization-props', `realization prop ${JSON.stringify(prop.path)} requires a boolean required field.`);
    }
    if (prop.type === 'enum' && prop.values !== undefined &&
        (!Array.isArray(prop.values) || prop.values.length === 0 || prop.values.some((item) => !['string', 'number'].includes(typeof item) || (typeof item === 'string' && !item) || (typeof item === 'number' && !Number.isFinite(item))))) {
      block('realization-props', `enum prop ${JSON.stringify(prop.path)} has invalid values.`);
    }
    if (prop.type === 'element' && prop.values !== undefined &&
        (!Array.isArray(prop.values) || prop.values.length === 0 || prop.values.some((item) => typeof item !== 'string' || !item))) {
      block('realization-props', `element prop ${JSON.stringify(prop.path)} has invalid safe values.`);
    }
    if (prop.type === 'enum' && prop.values === undefined) {
      block('realization-props', `enum prop ${JSON.stringify(prop.path)} requires values.`);
    }
    if (Object.hasOwn(prop, 'default') && !valueMatchesProp(prop.default, prop)) {
      block('realization-props', `realization prop ${JSON.stringify(prop.path)} has a default incompatible with ${JSON.stringify(prop.type)}.`);
    }
  }

  const nodes = Array.isArray(value.dom?.nodes) ? value.dom.nodes : [];
  if (nodes.length === 0) block('realization-dom', 'realization.dom.nodes must be a non-empty array.');
  const nodeIds = new Set();
  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || !node.id) {
      block('realization-dom', 'every realization DOM node requires a non-empty id.');
      continue;
    }
    if (nodeIds.has(node.id)) block('realization-dom', `realization DOM node ${JSON.stringify(node.id)} is duplicated.`);
    nodeIds.add(node.id);
  }
  for (const node of nodes) {
    const elements = Array.isArray(node?.element) ? node.element : [node?.element];
    if (elements.length === 0 || elements.some((element) => typeof element !== 'string' || !element)) {
      block('realization-dom', `DOM node ${JSON.stringify(node?.id)} requires an element or safe element alternatives.`);
    }
    if (!REALIZATION_CARDINALITIES.includes(node?.cardinality)) {
      block('realization-dom', `DOM node ${JSON.stringify(node?.id)} has unsupported cardinality ${JSON.stringify(node?.cardinality)}.`);
    }
    if (node?.parent !== null && !nodeIds.has(node?.parent)) {
      block('realization-dom', `DOM node ${JSON.stringify(node?.id)} references missing parent ${JSON.stringify(node?.parent)}.`);
    }
    if (Array.isArray(node?.element)) {
      const selection = node.elementSelection;
      const selectionProp = props.find((prop) => prop.path === selection?.prop);
      const cases = Array.isArray(selection?.cases) ? selection.cases : [];
      const caseValues = cases.map((item) => item?.value);
      const caseElements = cases.map((item) => item?.element);
      if (!selection || typeof selection !== 'object' || Array.isArray(selection) ||
          !selectionProp || !Array.isArray(selectionProp.values) || cases.length === 0) {
        block('realization-dom', `DOM node ${JSON.stringify(node?.id)} element alternatives require prop-backed elementSelection cases.`);
      } else if (
        new Set(caseValues.map(JSON.stringify)).size !== caseValues.length ||
        new Set(caseElements).size !== caseElements.length ||
        cases.some((item) => !item || typeof item !== 'object' || Array.isArray(item) || typeof item.element !== 'string' || !item.element || Object.keys(item).some((key) => !['value', 'element'].includes(key))) ||
        !sameValueSet(caseValues, selectionProp.values) ||
        !sameValueSet(caseElements, elements)
      ) {
        block('realization-dom', `DOM node ${JSON.stringify(node?.id)} elementSelection must exactly cover its prop values and element alternatives.`);
      }
    } else if (node?.elementSelection !== undefined) {
      block('realization-dom', `DOM node ${JSON.stringify(node?.id)} cannot declare elementSelection for one fixed element.`);
    }
    if (node?.attributes !== undefined && (!node.attributes || typeof node.attributes !== 'object' || Array.isArray(node.attributes))) {
      block('realization-dom', `DOM node ${JSON.stringify(node?.id)} attributes must be an object.`);
    }
    for (const [attribute, source] of Object.entries(node?.attributes ?? {})) {
      if (!attribute || IDREF_ATTRIBUTES.includes(attribute)) {
        block('realization-dom', `DOM node ${JSON.stringify(node?.id)} has invalid owned attribute ${JSON.stringify(attribute)}.`);
      }
      if (source && typeof source === 'object' && !Array.isArray(source)) {
        const keys = Object.keys(source);
        const hasProp = keys.length === 1 && typeof source.prop === 'string' && source.prop.length > 0;
        const hasState = keys.length === 1 && typeof source.state === 'string' && source.state.length > 0;
        if (hasProp === hasState) block('realization-dom', `DOM node ${JSON.stringify(node?.id)} attribute ${JSON.stringify(attribute)} requires exactly one prop or state source.`);
        if (hasProp && !propPaths.has(source.prop)) block('realization-dom', `DOM node ${JSON.stringify(node?.id)} attribute ${JSON.stringify(attribute)} references missing prop ${JSON.stringify(source.prop)}.`);
      } else if (!['string', 'boolean', 'number'].includes(typeof source)) {
        block('realization-dom', `DOM node ${JSON.stringify(node?.id)} attribute ${JSON.stringify(attribute)} has an unsupported value.`);
      }
    }

    const condition = node?.condition;
    if (node?.cardinality === 'zero-or-one' && (!condition || typeof condition !== 'object' || Array.isArray(condition))) {
      block('realization-dom', `DOM node ${JSON.stringify(node?.id)} requires a structured condition for zero-or-one cardinality.`);
    } else if (node?.cardinality !== 'zero-or-one' && condition !== undefined) {
      block('realization-dom', `DOM node ${JSON.stringify(node?.id)} may declare condition only with zero-or-one cardinality.`);
    }
    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      const hasProp = typeof condition.prop === 'string' && condition.prop.length > 0;
      const hasState = typeof condition.state === 'string' && condition.state.length > 0;
      if (hasProp === hasState) block('realization-dom', `DOM node ${JSON.stringify(node?.id)} condition requires exactly one of prop or state.`);
      if (hasProp && !propPaths.has(condition.prop)) block('realization-dom', `DOM node ${JSON.stringify(node?.id)} references missing condition prop ${JSON.stringify(condition.prop)}.`);
      if (!CONDITION_PREDICATES.includes(condition.predicate)) block('realization-dom', `DOM node ${JSON.stringify(node?.id)} has unsupported condition predicate ${JSON.stringify(condition.predicate)}.`);
      if (['equals', 'not-equals'].includes(condition.predicate) !== Object.hasOwn(condition, 'value')) {
        block('realization-dom', `DOM node ${JSON.stringify(node?.id)} condition value does not match predicate ${JSON.stringify(condition.predicate)}.`);
      }
    }

    const repeat = node?.repeat;
    if (['zero-or-more', 'one-or-more'].includes(node?.cardinality)) {
      const hasProp = typeof repeat?.prop === 'string' && repeat.prop.length > 0;
      const hasState = typeof repeat?.state === 'string' && repeat.state.length > 0;
      const repeatProp = props.find((prop) => prop.path === repeat?.prop);
      if (!repeat || typeof repeat !== 'object' || Array.isArray(repeat) || hasProp === hasState || (hasProp && repeatProp?.type !== 'collection')) {
        block('realization-dom', `DOM node ${JSON.stringify(node?.id)} requires exactly one collection prop or derived state repeat declaration.`);
      }
    } else if (repeat !== undefined) {
      block('realization-dom', `DOM node ${JSON.stringify(node?.id)} may declare repeat only with repeated cardinality.`);
    }
  }

  const nodesById = new Map(nodes.map((node) => [node?.id, node]));
  for (const node of nodes) {
    const seen = new Set([node?.id]);
    let current = node;
    while (current?.parent !== null && nodeIds.has(current?.parent)) {
      if (seen.has(current.parent)) {
        block('realization-dom', `DOM ancestry for ${JSON.stringify(node?.id)} contains a cycle at ${JSON.stringify(current.parent)}.`);
        break;
      }
      seen.add(current.parent);
      current = nodesById.get(current.parent);
    }
  }

  if (value.constraints !== undefined && !Array.isArray(value.constraints)) block('realization-constraints', 'realization.constraints must be an array when present.');
  for (const [index, constraint] of (Array.isArray(value.constraints) ? value.constraints : []).entries()) {
    const when = constraint?.when;
    const whenProp = props.find((prop) => prop.path === when?.prop);
    if (!constraint || typeof constraint !== 'object' || Array.isArray(constraint) || JSON.stringify(Object.keys(constraint).sort()) !== JSON.stringify(['requireAny', 'when'])) {
      block('realization-constraints', `constraint ${index} must contain exactly when and requireAny.`);
    }
    if (!when || typeof when !== 'object' || Array.isArray(when) || JSON.stringify(Object.keys(when).sort()) !== JSON.stringify(['equals', 'prop'])) {
      block('realization-constraints', `constraint ${index}.when must contain exactly prop and equals.`);
    }
    if (!whenProp) block('realization-constraints', `constraint ${index} references missing condition prop ${JSON.stringify(when?.prop)}.`);
    else if (!valueMatchesProp(when?.equals, whenProp)) block('realization-constraints', `constraint ${index}.when.equals is incompatible with ${JSON.stringify(whenProp.path)}.`);
    if (!Array.isArray(constraint?.requireAny) || constraint.requireAny.length === 0) {
      block('realization-constraints', `constraint ${index} requires a non-empty requireAny.`);
    }
    for (const prop of constraint?.requireAny ?? []) {
      if (!propPaths.has(prop)) block('realization-constraints', `constraint ${index} references missing required prop ${JSON.stringify(prop)}.`);
    }
  }

  if (!Array.isArray(value.contentBindings)) block('realization-content', 'realization.contentBindings must be an array.');
  for (const binding of Array.isArray(value.contentBindings) ? value.contentBindings : []) {
    if (!propPaths.has(binding?.prop)) block('realization-content', `content binding references missing prop ${JSON.stringify(binding?.prop)}.`);
    for (const node of nodeReferences(binding, `content binding for ${JSON.stringify(binding?.prop)}`, block)) {
      if (!nodeIds.has(node)) block('realization-content', `content binding references missing node ${JSON.stringify(node)}.`);
    }
  }
  if (!Array.isArray(value.safeAttributes)) block('realization-attributes', 'realization.safeAttributes must be an array.');
  for (const attribute of Array.isArray(value.safeAttributes) ? value.safeAttributes : []) {
    if (!propPaths.has(attribute?.prop)) block('realization-attributes', `safe attribute references missing prop ${JSON.stringify(attribute?.prop)}.`);
    for (const node of nodeReferences(attribute, `safe attribute for ${JSON.stringify(attribute?.prop)}`, block)) {
      if (!nodeIds.has(node)) block('realization-attributes', `safe attribute references missing node ${JSON.stringify(node)}.`);
    }
    if (typeof attribute?.attribute !== 'string' || !attribute.attribute) {
      block('realization-attributes', `safe attribute for ${JSON.stringify(attribute?.prop)} requires an attribute.`);
    }
  }
  if (!Array.isArray(value.relationships)) block('realization-idref', 'realization.relationships must be an array.');
  for (const relationship of Array.isArray(value.relationships) ? value.relationships : []) {
    if (!nodeIds.has(relationship?.from)) block('realization-idref', `relationship references missing source node ${JSON.stringify(relationship?.from)}.`);
    if (!nodeIds.has(relationship?.to)) block('realization-idref', `relationship references missing target node ${JSON.stringify(relationship?.to)}.`);
    if (!IDREF_ATTRIBUTES.includes(relationship?.attribute)) {
      block('realization-idref', `relationship has unsupported IDREF attribute ${JSON.stringify(relationship?.attribute)}.`);
    }
  }

  const stylePaths = new Set();
  if (!Array.isArray(value.styleSlots)) block('realization-style', 'realization.styleSlots must be an array.');
  for (const slot of Array.isArray(value.styleSlots) ? value.styleSlots : []) {
    if (typeof slot?.path !== 'string' || !slot.path.startsWith('classNames.')) {
      block('realization-style', `style slot ${JSON.stringify(slot?.path)} must start with classNames.`);
    } else if (stylePaths.has(slot.path)) {
      block('realization-style', `style slot ${JSON.stringify(slot.path)} is duplicated.`);
    }
    stylePaths.add(slot?.path);
    if (!propPaths.has(slot?.path)) block('realization-style', `style slot ${JSON.stringify(slot?.path)} references a missing public prop path.`);
    for (const node of nodeReferences(slot, `style slot ${JSON.stringify(slot?.path)}`, block)) {
      if (!nodeIds.has(node)) block('realization-style', `style slot ${JSON.stringify(slot?.path)} references missing node ${JSON.stringify(node)}.`);
    }
    if (!Array.isArray(slot?.protectedProperties) || slot.protectedProperties.length === 0) {
      block('realization-style', `style slot ${JSON.stringify(slot?.path)} requires protectedProperties.`);
    }
    for (const property of Array.isArray(slot?.protectedProperties) ? slot.protectedProperties : []) {
      if (!REALIZATION_PROTECTED_PROPERTIES.includes(property)) {
        block('realization-style', `style slot ${JSON.stringify(slot?.path)} has unsupported protected property ${JSON.stringify(property)}.`);
      }
    }
  }

  const behaviorIds = new Set();
  const behaviors = Array.isArray(value.behaviors) ? value.behaviors : [];
  if (behaviors.length === 0) block('realization-behaviors', 'realization.behaviors must be a non-empty array.');
  for (const behavior of behaviors) {
    if (typeof behavior?.id !== 'string' || !behavior.id) {
      block('realization-behaviors', 'every owned behavior requires a non-empty id.');
      continue;
    }
    if (behaviorIds.has(behavior.id)) block('realization-behaviors', `behavior id ${JSON.stringify(behavior.id)} is duplicated.`);
    behaviorIds.add(behavior.id);
    if (!REALIZATION_BEHAVIOR_KINDS.includes(behavior.kind)) {
      block('realization-behaviors', `behavior ${JSON.stringify(behavior.id)} has unsupported kind ${JSON.stringify(behavior.kind)}.`);
    }
    if (!Array.isArray(behavior.wcag) || behavior.wcag.length === 0 || behavior.wcag.some((id) => !/^\d+\.\d+\.\d+$/.test(id))) {
      block('realization-accessibility', `behavior ${JSON.stringify(behavior.id)} requires WCAG criterion IDs.`);
    }
    if (behavior.evidence !== behavior.id) {
      block('realization-evidence', `behavior ${JSON.stringify(behavior.id)} must use the same stable evidence ID.`);
    }
    if (behavior.evidenceType !== 'storybook-step') {
      block('realization-evidence', `behavior ${JSON.stringify(behavior.id)} evidenceType must equal storybook-step.`);
    }
  }

  const accessibility = value.accessibility;
  if (!accessibility || typeof accessibility !== 'object' || Array.isArray(accessibility)) {
    block('realization-accessibility', 'realization requires accessibility metadata.');
  } else {
    if (accessibility.standard !== 'WCAG-2.2-AA') {
      block('realization-accessibility', 'accessibility.standard must equal WCAG-2.2-AA.');
    }
    if (!(accessibility.apgPattern === null || typeof accessibility.apgPattern === 'string')) {
      block('realization-accessibility', 'accessibility.apgPattern must be a string or null.');
    }
    if (!Array.isArray(accessibility.consumerResponsibilities) || accessibility.consumerResponsibilities.length === 0) {
      block('realization-accessibility', 'accessibility.consumerResponsibilities must be a non-empty array.');
    } else {
      for (const responsibility of accessibility.consumerResponsibilities) {
        if (!REALIZATION_RESPONSIBILITIES.includes(responsibility)) {
          block('realization-accessibility', `consumer responsibility ${JSON.stringify(responsibility)} is not governed.`);
        }
      }
    }
  }
  return block.count() === before ? value : null;
}

function appliedMetadataIssues(dir, files, existing, expected, expectedStoryTitle) {
  const issues = [];
  const stableKeys = [
    'canonical',
    'slug',
    'variant',
    'default',
    'framework',
    'styling',
    'slots',
    'variants',
    'exportName',
    'rendering',
    'reuseFingerprint',
    'realization',
    'tokens',
    'provenance',
  ];
  for (const key of stableKeys) {
    if (JSON.stringify(existing?.[key]) !== JSON.stringify(expected[key])) {
      issues.push(`component.json ${key} does not match the capture`);
    }
  }

  const story = files.find((file) => !file.includes('/') && file.endsWith('.stories.tsx'));
  if (story) {
    const source = fs.readFileSync(path.join(dir, story), 'utf8');
    const escapedTitle = expectedStoryTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`title\\s*:\\s*['"]${escapedTitle}['"]`).test(source)) {
      issues.push(`the root story title does not match ${JSON.stringify(expectedStoryTitle)}`);
    }
    const maturity = existing?.maturity;
    if (typeof maturity !== 'string' || !source.includes(`maturity:${maturity}`)) {
      issues.push('the root story maturity tag does not match component.json');
    }
  }
  return issues;
}

function sameKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function safeModulePath(modulePath) {
  if (typeof modulePath !== 'string' || !modulePath || modulePath !== modulePath.trim()) return false;
  if (modulePath.includes('\\') || modulePath.includes(':') || /[\u0000-\u001f\u007f]/.test(modulePath)) return false;
  if (path.posix.isAbsolute(modulePath) || /^[A-Za-z]:/.test(modulePath)) return false;
  if (path.posix.normalize(modulePath) !== modulePath) return false;
  if (modulePath === '.' || modulePath.startsWith('../') || modulePath.includes('/../')) return false;
  return /\.tsx?$/.test(modulePath) && !/\.stories\.tsx?$/.test(modulePath);
}

/** Validate the exact server-first module graph a capture promises to write. */
function validateArchitecture(value, block) {
  const before = block.count();

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    block('architecture-unparsable', 'the Runtime architecture JSON must be an object.');
    return null;
  }
  if (!sameKeys(value, ARCHITECTURE_KEYS)) {
    block(
      'architecture-keys',
      `Runtime architecture keys must be exactly ${ARCHITECTURE_KEYS.join(', ')}.`,
    );
  }

  const modeValid = ARCHITECTURE_MODES.includes(value.mode);
  if (!modeValid) {
    block('architecture-mode', `mode must be one of ${ARCHITECTURE_MODES.join(', ')}.`);
  }

  let hydration = [];
  if (!Array.isArray(value.hydration)) {
    block('architecture-hydration', 'hydration must be an array.');
  } else {
    hydration = value.hydration;
    const seen = new Set();
    for (const reason of hydration) {
      if (!HYDRATION_REASONS.includes(reason)) {
        block(
          'architecture-hydration',
          `hydration reason ${JSON.stringify(reason)} is not one of ${HYDRATION_REASONS.join(', ')}.`,
        );
      }
      if (seen.has(reason)) {
        block('architecture-hydration', `hydration reason ${JSON.stringify(reason)} is duplicated.`);
      }
      seen.add(reason);
    }
  }

  if (!['full', 'shell', 'none'].includes(value.serverOutput)) {
    block('architecture-server-output', 'serverOutput must be one of full, shell, none.');
  }

  const modules = [];
  if (!Array.isArray(value.modules) || value.modules.length === 0) {
    block('architecture-modules', 'modules must be a non-empty array.');
  } else {
    const paths = new Set();
    value.modules.forEach((module, index) => {
      if (!sameKeys(module, MODULE_KEYS)) {
        block(
          'architecture-module',
          `modules[${index}] keys must be exactly ${MODULE_KEYS.join(', ')}.`,
        );
      }
      if (!module || typeof module !== 'object' || Array.isArray(module)) return;

      const modulePath = module.path;
      if (!safeModulePath(modulePath)) {
        block(
          'architecture-path',
          `modules[${index}].path must be a normalized, safe, relative .ts/.tsx path and must not be a story: ${JSON.stringify(modulePath)}.`,
        );
      } else if (paths.has(modulePath)) {
        block('architecture-path-duplicate', `module path ${JSON.stringify(modulePath)} is duplicated.`);
      } else {
        paths.add(modulePath);
      }
      if (!MODULE_ROLES.includes(module.role)) {
        block(
          'architecture-module',
          `modules[${index}].role must be one of ${MODULE_ROLES.join(', ')}.`,
        );
      }
      if (!MODULE_RUNTIMES.includes(module.runtime)) {
        block(
          'architecture-module',
          `modules[${index}].runtime must be one of ${MODULE_RUNTIMES.join(', ')}.`,
        );
      }
      if (safeModulePath(modulePath) && MODULE_ROLES.includes(module.role) && MODULE_RUNTIMES.includes(module.runtime)) {
        modules.push({ path: modulePath, role: module.role, runtime: module.runtime });
      }
    });
  }

  const facades = modules.filter((module) => module.role === 'facade');
  if (facades.length !== 1 || facades[0]?.path !== 'index.ts') {
    block('architecture-facade', 'modules must contain exactly one facade, and its path must be index.ts.');
  }

  const types = modules.filter((module) => module.role === 'types');
  if (types.length !== 1 || !/^[^/]+\.types\.ts$/.test(types[0].path)) {
    block(
      'architecture-types',
      'modules must contain exactly one root types module named <Component>.types.ts.',
    );
  }
  if (types[0]?.runtime === 'client') {
    block('architecture-types', 'the types module is type-only and must declare runtime "server".');
  }

  const implementationTsx = modules.filter(
    (module) => IMPLEMENTATION_ROLES.includes(module.role) && module.path.endsWith('.tsx'),
  );
  if (implementationTsx.length < 2) {
    block(
      'architecture-tsx',
      'modules must plan at least two tree/branch/leaf .tsx implementation modules.',
    );
  }

  for (const module of modules) {
    const clientNamed = /\.client\.tsx?$/.test(module.path);
    if (module.runtime === 'client' && module.path !== 'index.ts' && !clientNamed) {
      block(
        'architecture-client-path',
        `client module ${JSON.stringify(module.path)} must end in .client.ts or .client.tsx; index.ts is the only facade exception.`,
      );
    }
    if (module.runtime === 'server' && clientNamed) {
      block(
        'architecture-client-path',
        `server module ${JSON.stringify(module.path)} must not use the .client.ts/.client.tsx suffix.`,
      );
    }
  }

  if (modeValid) {
    const facade = facades[0];
    const executable = modules.filter((module) => !['types', 'styles'].includes(module.role));
    const clientExecutable = executable.filter((module) => module.runtime === 'client');
    const serverImplementation = implementationTsx.filter((module) => module.runtime === 'server');
    const expectedOutput = { server: 'full', hybrid: 'shell', client: 'none' }[value.mode];

    if (value.serverOutput !== expectedOutput) {
      block(
        'architecture-consistency',
        `${value.mode} mode requires serverOutput ${JSON.stringify(expectedOutput)}.`,
      );
    }
    if (value.mode === 'server') {
      if (hydration.length !== 0) {
        block('architecture-consistency', 'server mode requires hydration: [].');
      }
      if (modules.some((module) => module.runtime === 'client')) {
        block('architecture-consistency', 'server mode cannot declare client modules.');
      }
      if (facade?.runtime !== 'server') {
        block('architecture-consistency', 'server mode requires a server index.ts facade.');
      }
    }
    if (value.mode === 'hybrid') {
      if (hydration.length === 0) {
        block('architecture-consistency', 'hybrid mode requires at least one hydration reason.');
      }
      if (clientExecutable.length === 0 || serverImplementation.length === 0) {
        block(
          'architecture-consistency',
          'hybrid mode requires at least one server implementation module and one client module.',
        );
      }
      if (facade?.runtime !== 'server') {
        block('architecture-consistency', 'hybrid mode requires a server index.ts facade.');
      }
    }
    if (value.mode === 'client') {
      if (hydration.length === 0) {
        block('architecture-consistency', 'client mode requires at least one hydration reason.');
      }
      if (facade?.runtime !== 'client') {
        block('architecture-consistency', 'client mode requires a client index.ts facade.');
      }
      if (!implementationTsx.some((module) => module.runtime === 'client')) {
        block('architecture-consistency', 'client mode requires at least one client tree/branch/leaf module.');
      }
    }
  }

  if (block.count() !== before) return null;
  return {
    mode: value.mode,
    hydration: [...value.hydration],
    serverOutput: value.serverOutput,
    modules: value.modules.map((module) => ({
      path: module.path,
      role: module.role,
      runtime: module.runtime,
    })),
  };
}

/**
 * Read one capture file into a record: canonical, slug, the proposed
 * component.json, and every blocker that would waste a rewrite.
 */
function readCapture(file, ctx) {
  const name = path.basename(file.path);
  const stem = path.basename(file.path, '.md');
  const record = {
    file: name,
    canonical: null,
    slug: stem,
    componentKey: stem,
    componentPath: `components/${stem}`,
    variant: null,
    variantLabel: null,
    default: true,
    status: 'blocked',
    blockers: [],
    deferred: false,
    deferral: null,
    manifest: null,
    library: null,
    architecture: null,
    componentJson: null,
    stories: null,
    structuralImplementation: null,
    progress: { status: 'pending' },
    applied: null,
    companionWrites: [],
    figma: null,
    tokens: { declared: [], undefined: [] },
  };
  const block = (code, message) => record.blockers.push({ code, message });
  block.count = () => record.blockers.length;

  const text = readTextSafe(file.path, 2 * 1024 * 1024, ctx.warnings);
  if (text === null) {
    ctx.warnings.add('capture-unreadable', `${name} could not be read and was skipped.`);
    block('capture-unreadable', `${name} could not be read.`);
    return record;
  }

  const topLevel = sections(text, 2);
  const typeSection = topLevel.find((s) => s.heading === 'Proposal type');
  if (!typeSection || !new RegExp(`\\b${CAPTURE_TYPE}\\b`).test(typeSection.body)) {
    block('capture-type', `${name} does not declare "## Proposal type" of ${CAPTURE_TYPE}.`);
    return record;
  }

  // Canonical, structural identity, and filename form one exact library key.
  const canonicalSection = topLevel.find((s) => s.heading === 'Canonical');
  const parsed = canonicalSection ? parseCanonicalLine(canonicalSection.body) : null;
  if (!parsed) {
    block(
      'canonical-missing',
      canonicalSection
        ? `${name} does not open "## Canonical" with a "**Name** (\`slug\`)" line.`
        : `${name} has no "## Canonical" section (the heading must match exactly).`,
    );
    return record;
  }
  const { canonical, slug: declaredSlug } = parsed;
  const expected = kebab(canonical);
  record.canonical = canonical;
  record.slug = expected;

  const structuralSection = topLevel.find((s) => s.heading === 'Structural implementation');
  const structuralJson = structuralSection ? fencedBlock(structuralSection.body, 'json') : null;
  let structural = null;
  if (!structuralJson) {
    block('structural-implementation-missing', `${name} has no fenced json block under "## Structural implementation".`);
  } else {
    try {
      structural = JSON.parse(structuralJson);
    } catch (err) {
      block('structural-implementation-unparsable', `${name} Structural implementation is not valid JSON: ${err.message}`);
    }
  }
  if (!structural || typeof structural !== 'object' || Array.isArray(structural)) {
    if (structuralJson) block('structural-implementation-unparsable', `${name} Structural implementation must be a JSON object.`);
    structural = {};
  }
  const variant = structural.variant == null ? null : structural.variant;
  const variantLabel = structural.variantLabel == null ? null : structural.variantLabel;
  const isDefault = structural.default !== false;
  if (!(variant === null || (typeof variant === 'string' && variant.length > 0 && libraryKebab(variant) === variant))) {
    block('structural-variant', 'variant must be null or a non-empty kebab-case string.');
  }
  if (variant !== null && (typeof variantLabel !== 'string' || !variantLabel.trim())) {
    block('structural-variant-label', 'a structural variant requires a non-empty variantLabel.');
  }
  if (structural.default !== true && structural.default !== false) {
    block('structural-default', 'default must be a boolean.');
  }
  if (!isDefault && variant === null) {
    block('structural-variant', 'an alternate structural implementation requires variant.');
  }
  const componentKey = isDefault ? expected : `${expected}--${variant}`;
  if (structural.componentKey !== componentKey) {
    block('component-key', `Structural implementation componentKey must equal ${JSON.stringify(componentKey)}.`);
  }
  if (structural.canonical !== canonical) {
    block('structural-canonical', `Structural implementation canonical must equal ${JSON.stringify(canonical)}.`);
  }
  record.variant = variant;
  record.variantLabel = variantLabel;
  record.default = isDefault;
  record.componentKey = componentKey;
  record.componentPath = `components/${componentKey}`;
  record.structuralImplementation = {
    componentKey,
    canonical,
    variant,
    variantLabel,
    default: isDefault,
    ...(structural.companionDefault ? { companionDefault: structural.companionDefault } : {}),
  };

  if (declaredSlug !== expected || stem !== componentKey) {
    block(
      'slug-mismatch',
      `canonical "${canonical}" kebabs to base slug "${expected}" and structural identity requires "${componentKey}.md", but the declared slug is "${declaredSlug}" and the filename is "${stem}.md".`,
    );
  }
  if (libraryKebab(canonical) !== expected) {
    block(
      'kebab-divergence',
      `this repo kebabs "${canonical}" to "${expected}" but ui-design-library's own checker produces "${libraryKebab(canonical)}" — the component directory would fail its slug-equality contract.`,
    );
  }

  const progressSection = topLevel.find((s) => s.heading === 'Progress');
  const progressJson = progressSection ? fencedBlock(progressSection.body, 'json') : null;
  if (progressSection && !progressJson) {
    block('progress-unparsable', `${name} Progress requires a fenced json block.`);
  } else if (progressJson) {
    try {
      const progress = JSON.parse(progressJson);
      if (!progress || !CAPTURE_PROGRESS_STATES.includes(progress.status)) {
        block('progress-status', `Progress status must be one of ${CAPTURE_PROGRESS_STATES.join(', ')}.`);
      } else if (progress.status === 'code-complete' && progress.componentPath !== `components/${componentKey}`) {
        block('progress-component-path', `code-complete Progress componentPath must equal "components/${componentKey}".`);
      } else {
        record.progress = progress;
      }
    } catch (err) {
      block('progress-unparsable', `${name} Progress is not valid JSON: ${err.message}`);
    }
  }
  const appliedSection = topLevel.find((s) => s.heading === 'Applied');
  const appliedJson = appliedSection ? fencedBlock(appliedSection.body, 'json') : null;
  if (appliedSection && !appliedJson) {
    block('applied-unparsable', `${name} Applied requires a fenced json block.`);
  } else if (appliedJson) {
    try {
      const applied = JSON.parse(appliedJson);
      if (!applied || !CAPTURE_APPLIED_STATES.includes(applied.status)) {
        block('applied-status', `Applied status must equal ${CAPTURE_APPLIED_STATES.join(', ')}.`);
      } else if (applied.componentPath !== `components/${componentKey}` || !applied.figma?.nodeId || !applied.figma?.nodeKey) {
        block('applied-evidence', `landed Applied metadata requires componentPath "components/${componentKey}" and stable Figma nodeId/nodeKey.`);
      } else {
        record.applied = applied;
      }
    } catch (err) {
      block('applied-unparsable', `${name} Applied is not valid JSON: ${err.message}`);
    }
  }

  if (ctx.manifest) {
    const entry = ctx.manifest.find((e) => normalizeLabel(e.name) === normalizeLabel(canonical)) || null;
    record.manifest = { matched: Boolean(entry), entry };
    if (!entry) {
      // Deferred, not blocked: a sibling new-pattern proposal in THIS run establishes
      // the canonical. It cannot be in the manifest yet, but it will be the moment that
      // proposal is promoted — so the capture is valid, just not executable now. Set a
      // flag, not the status: any other blocker must still win at the terminal gate.
      const proposal =
        ctx.proposals.find((p) => normalizeLabel(p.canonical) === normalizeLabel(canonical)) || null;
      if (proposal) {
        record.deferred = true;
        record.deferral = {
          reason: 'pending-promotion',
          proposal: `proposals/${proposal.file}`,
          message: `Promote "${canonical}" first — proposals/${proposal.file} establishes it this run, then re-run capture-preflight.`,
        };
      } else {
        block(
          'canonical-unknown',
          `"${canonical}" is not a canonical in the catalog. Promote it first — the library keys on names the catalog resolves to.`,
        );
      }
    }
  }

  const architectureSection = topLevel.find((s) => s.heading === 'Runtime architecture');
  const architectureJson = architectureSection ? fencedBlock(architectureSection.body, 'json') : null;
  if (!architectureJson) {
    block(
      'architecture-missing',
      `${name} has no fenced json block under "## Runtime architecture".`,
    );
  } else {
    let architecture = null;
    try {
      architecture = JSON.parse(architectureJson);
    } catch (err) {
      block('architecture-unparsable', `${name} Runtime architecture is not valid JSON: ${err.message}`);
    }
    if (architecture !== null) record.architecture = validateArchitecture(architecture, block);
  }

  const entrySection = topLevel.find((s) => s.heading === 'Proposed library entry');
  const entryJson = entrySection ? fencedBlock(entrySection.body, 'json') : null;
  if (!entryJson) {
    block('entry-unparsable', `${name} has no fenced json block under "## Proposed library entry".`);
    return record;
  }
  let entry;
  try {
    entry = JSON.parse(entryJson);
  } catch (err) {
    block('entry-unparsable', `${name} proposed library entry is not valid JSON: ${err.message}`);
    return record;
  }
  // `null`, an array, and a bare string all parse. Reading a field off any of them
  // would throw past the top-level catch and lose the plan for every other capture
  // in the set, so reject the shape before touching it.
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    block('entry-unparsable', `${name} proposed library entry is not a JSON object.`);
    return record;
  }

  if (entry.canonical !== canonical || entry.slug !== expected) {
    block(
      'entry-disagrees',
      `the proposed entry declares "${entry.canonical}" (${entry.slug}) but "## Canonical" declares "${canonical}" (${expected}).`,
    );
  }
  if ((entry.variant ?? null) !== variant || Boolean(entry.default) !== (isDefault && variant !== null)) {
    block(
      'entry-structural-identity',
      'the proposed entry variant/default fields must match Structural implementation; a bare default declares default:true only when it has a named structural variant.',
    );
  }
  if (!Array.isArray(entry.slots) || entry.slots.length === 0) {
    block('slots-empty', 'the proposed entry declares no slots; ui-design-library requires a non-empty slots array.');
  }
  if (typeof entry.exportName !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(entry.exportName)) {
    block('export-name', 'the proposed entry requires an exportName JavaScript identifier.');
  }
  if (!RENDERING_MODES.includes(entry.rendering)) {
    block('rendering', `the proposed entry rendering ${JSON.stringify(entry.rendering)} is not server, hybrid, or client.`);
  } else if (record.architecture && entry.rendering !== record.architecture.mode) {
    block('rendering', `the proposed entry rendering ${JSON.stringify(entry.rendering)} disagrees with Runtime architecture mode ${JSON.stringify(record.architecture.mode)}.`);
  }
  const reuseFingerprint = validateReuseFingerprint(entry.reuseFingerprint, block);
  const realization = validateRealization(entry.realization, block);
  for (const key of ['project', 'source']) {
    if (!entry.provenance || !entry.provenance[key]) {
      block('provenance-incomplete', `the proposed entry has no provenance.${key}, which ui-design-library requires.`);
    }
  }

  const declared = Array.isArray(entry.tokens) ? entry.tokens : [];
  record.tokens.declared = declared;
  if (ctx.tokens) {
    record.tokens.undefined = declared.filter((t) => !ctx.tokens.has(t));
    for (const token of record.tokens.undefined) {
      ctx.warnings.add(
        'token-undefined',
        `${name} declares "${token}", which the library's semantic layer does not define — add the token during the rewrite rather than inlining a value.`,
      );
    }
  }

  // Key order matches ui-design-library's own component.json so the model can
  // paste it verbatim. `declienting` is left for the rewrite to fill: it records
  // what was actually removed, which only the rewrite knows.
  record.componentJson = {
    canonical,
    slug: expected,
    ...(variant !== null ? { variant } : {}),
    ...(isDefault && variant !== null ? { default: true } : {}),
    framework: entry.framework || 'react',
    styling: entry.styling || 'tailwind',
    slots: Array.isArray(entry.slots) ? entry.slots : [],
    variants: Array.isArray(entry.variants) ? entry.variants : [],
    exportName: typeof entry.exportName === 'string' ? entry.exportName : null,
    rendering: RENDERING_MODES.includes(entry.rendering) ? entry.rendering : null,
    reuseFingerprint,
    realization,
    tokens: declared,
    provenance: {
      project: entry.provenance?.project ?? null,
      run: entry.provenance?.run ?? null,
      source: entry.provenance?.source ?? null,
    },
    declienting: [],
    maturity: 'candidate',
  };
  record.stories = { title: isDefault ? canonical : `${canonical} / ${variantLabel}`, tag: 'maturity:candidate' };

  if (!isDefault) {
    const defaultRead = readJsonSafe(path.join(ctx.libraryDir, 'components', expected, 'component.json'));
    if (!defaultRead.ok) {
      block('default-companion-missing', `alternate ${componentKey} requires the bare default components/${expected}/component.json.`);
    } else if (defaultRead.value?.variant == null || defaultRead.value?.default !== true) {
      const companion = structural.companionDefault;
      if (!companion || typeof companion.variant !== 'string' || libraryKebab(companion.variant) !== companion.variant ||
        typeof companion.variantLabel !== 'string' || !companion.variantLabel.trim()) {
        block('default-companion-migration', 'the existing bare default has no structural identity; companionDefault requires kebab variant and variantLabel.');
      } else {
        record.companionWrites.push({
          componentPath: `components/${expected}`,
          componentJson: { variant: companion.variant, default: true },
          figmaRegistry: { variant: companion.variant, variantLabel: companion.variantLabel, default: true, familyPage: true },
        });
      }
    }
  }

  const library = inspectLibraryDir(ctx.libraryDir, componentKey, record.architecture);
  record.library = library;
  if (record.progress.status === 'code-complete' && !library.complete) {
    block(
      'progress-library-drift',
      `Progress claims code-complete, but components/${componentKey}/ is not a complete matching implementation.`,
    );
  }
  if (record.applied && !library.complete) {
    block(
      'applied-library-drift',
      `Applied claims landed, but components/${componentKey}/ is not a complete matching implementation.`,
    );
  }
  if (library.exists && library.complete) {
    // "Already applied" has to be decided on what the directory contains, not on
    // filenames alone: two projects capturing different canonicals that kebab to
    // the same slug would otherwise read as a no-op instead of a collision.
    const existing = readJsonSafe(path.join(ctx.libraryDir, 'components', componentKey, 'component.json'));
    if (!existing.ok) {
      block('library-partial', `components/${componentKey}/component.json exists but could not be parsed: ${existing.error}`);
    } else if (existing.value?.canonical !== canonical) {
      block(
        'slug-occupied',
        `components/${componentKey}/ already holds "${existing.value?.canonical}", not "${canonical}". Resolve the occupied structural key before capturing.`,
      );
    } else {
      const dir = path.join(ctx.libraryDir, 'components', componentKey);
      const drift = appliedMetadataIssues(dir, library.files, existing.value, record.componentJson, record.stories.title);
      if (drift.length > 0) {
        block(
          'library-drift',
          `components/${componentKey}/ has the planned files but does not match this capture: ${drift.join('; ')}.`,
        );
      }
    }
    // Already applied is a no-op rather than an error — but only when nothing
    // else blocks it. A mis-slugged capture that happens to point at an occupied
    // directory is still mis-slugged, and reporting it as "already applied"
    // would hide exactly the defect this script exists to catch.
    if (record.blockers.length === 0) {
      const registryRead = readJsonSafe(path.join(ctx.libraryDir, 'figma/library.json'));
      const registrations = registryRead.ok && Array.isArray(registryRead.value?.components)
        ? registryRead.value.components
        : [];
      const registration = registrations.find((candidate) =>
        candidate?.componentPath === `components/${componentKey}` &&
        candidate?.canonical === canonical &&
        (candidate?.variant ?? null) === variant,
      ) || null;
      const reviewPasses = registration?.figma?.review?.passes ?? [];
      const figmaComplete = Boolean(
        registration?.figma?.nodeId &&
        registration?.figma?.nodeKey &&
        registration?.figma?.review?.status === 'passed' &&
        reviewPasses.includes('adversarial') &&
        reviewPasses.includes('design'),
      );
      record.figma = registration
        ? {
            registrationId: registration.id ?? null,
            complete: figmaComplete,
            nodeId: registration.figma?.nodeId ?? null,
            nodeKey: registration.figma?.nodeKey ?? null,
          }
        : { registrationId: null, complete: false, nodeId: null, nodeKey: null };
      if (record.applied && (
        !figmaComplete ||
        record.applied.figma.nodeId !== record.figma.nodeId ||
        record.applied.figma.nodeKey !== record.figma.nodeKey
      )) {
        block(
          'applied-figma-drift',
          'Applied Figma nodeId/nodeKey must exactly match the reviewed governed registry entry.',
        );
      }
      if (record.blockers.length === 0) {
        record.status = record.deferred
          ? 'deferred'
          : !figmaComplete
            ? 'figma-pending'
            : !record.applied
              ? 'evidence-pending'
              : 'skipped';
      }
    }
    return record;
  }
  if (library.exists) {
    const problems = [
      !library.has.componentJson && 'component.json',
      !library.has.stories && 'a stories file',
      ...library.missingModules,
      ...library.unexpectedModules.map((modulePath) => `unexpected module ${modulePath}`),
      ...library.architectureIssues,
    ].filter(Boolean);
    block(
      'library-partial',
      `components/${componentKey}/ already exists but does not match the validated runtime architecture: ${problems.join(', ') || 'incomplete metadata'}. Finish or remove it before applying this capture.`,
    );
  }

  if (record.blockers.length === 0) record.status = record.deferred ? 'deferred' : 'ready';
  return record;
}

/**
 * Library components claiming a run this capture set covers, with no capture
 * behind them — a component that reached the library with no evidence.
 */
function findOrphanedByRun(libraryDir, records, warnings) {
  const runs = new Set(
    records.map((r) => r.componentJson?.provenance?.run).filter((run) => typeof run === 'string' && run),
  );
  // `provenance.run` is not a required field, so a capture set can legitimately
  // declare none. An empty result then means "not checked", not "nothing found" —
  // say so, or the handback reports a clean bill of health for a check that never ran.
  if (runs.size === 0) {
    if (records.length > 0) {
      warnings.add(
        'orphan-check-skipped',
        'No capture declares a provenance.run, so no library component could be checked for a run it claims without evidence. An empty orphanedByRun here means the check did not run.',
      );
    }
    return [];
  }

  const captured = new Set(records.map((r) => r.componentKey));
  const componentsDir = path.join(libraryDir, 'components');
  const orphans = [];

  for (const entry of listEntries(componentsDir).filter((e) => e.dir)) {
    const read = readJsonSafe(path.join(entry.path, 'component.json'));
    if (!read.ok) {
      warnings.add('component-unreadable', `components/${entry.name}/component.json could not be read.`);
      continue;
    }
    const provenance = read.value?.provenance;
    if (provenance && runs.has(provenance.run) && !captured.has(entry.name)) {
      orphans.push({ slug: entry.name, provenance });
    }
  }
  return orphans;
}

/**
 * Resolve the downstream Figma promotion contract before a capture starts.
 * The retrospective skill never invents this interface: the target library
 * owns the registry, checklist, and executable commands.
 */
function inspectFigmaPromotion(libraryDir) {
  const registry = 'figma/library.json';
  const checklist = 'figma/PROMOTION-CHECKLIST.md';
  const codeContractsCommand = 'pnpm contracts:code';
  const codeTestCommand = 'pnpm test:code';
  const coverageCommand = 'pnpm figma:coverage';
  const validationCommand = 'pnpm figma:validate';
  const issues = [];
  const codeConnectPattern = /@figma\/code-connect|figma[\s:_-]*connect|code[\s:_-]*connect/i;
  const findCodeConnectSurfaces = (value, location = registry) => {
    const surfaces = [];
    if (Array.isArray(value)) {
      value.forEach((entry, index) => surfaces.push(...findCodeConnectSurfaces(entry, `${location}[${index}]`)));
      return surfaces;
    }
    if (!value || typeof value !== 'object') {
      if (typeof value === 'string' && codeConnectPattern.test(value)) surfaces.push(location);
      return surfaces;
    }
    for (const [key, entry] of Object.entries(value)) {
      const child = `${location}.${key}`;
      if (codeConnectPattern.test(key)) surfaces.push(child);
      surfaces.push(...findCodeConnectSurfaces(entry, child));
    }
    return surfaces;
  };
  const findForbiddenCodeConnectFiles = () => {
    const matches = [];
    const ignored = new Set(['.git', 'node_modules', 'wiki', 'graphify-out']);
    const visit = (directory, relative = '') => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && ignored.has(entry.name)) continue;
        const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
        const child = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (childRelative === 'figma/components') matches.push(childRelative);
          else visit(child, childRelative);
        } else if (/\.figma\.[cm]?[jt]sx?$/i.test(entry.name) || /code[-_.]?connect/i.test(entry.name) ||
          /^figma\.config\./i.test(entry.name) || /^tsconfig\.figma(?:\.|$)/i.test(entry.name)) {
          matches.push(childRelative);
        }
      }
    };
    visit(libraryDir);
    return matches.sort();
  };

  if (!isFile(path.join(libraryDir, registry))) {
    issues.push(`${registry} is missing`);
  } else {
    const registryRead = readJsonSafe(path.join(libraryDir, registry));
    if (!registryRead.ok) issues.push(`${registry} could not be read: ${registryRead.error}`);
    else {
      const value = registryRead.value;
      if (value?.schemaVersion !== 1) issues.push(`${registry} schemaVersion must equal 1`);
      if (!Array.isArray(value?.components)) issues.push(`${registry} components must be an array`);
      if (value?.library?.publishing?.figmaLibrary !== 'explicit-maintainer-action') {
        issues.push(`${registry} must keep Figma publication as an explicit maintainer action`);
      }
      if (value?.library?.publishing?.ci !== 'read-only-validation') {
        issues.push(`${registry} must declare read-only CI validation`);
      }
      const pattern = value?.library?.promotionPattern ?? {};
      if (pattern.handoffTarget !== 'direct-canonical-instance' ||
        pattern.annotationPlacement !== 'outside-component-instance') {
        issues.push(`${registry} does not expose the direct-canonical documentation pattern`);
      }
      const widths = pattern.viewportWidths ?? {};
      if (widths.desktop !== 1440 || widths.tabletLarge !== 1024 || widths.tabletSmall !== 768 || widths.mobile !== 390) {
        issues.push(`${registry} does not expose the governed 1440/1024/768/390 breakpoints`);
      }
      const surfaces = findCodeConnectSurfaces(value);
      if (surfaces.length > 0) issues.push(`${registry} exposes Code Connect at ${surfaces.join(', ')}`);
      if ((value?.components ?? []).some((component) => component?.figma?.template !== undefined)) {
        issues.push(`${registry} contains forbidden template metadata`);
      }
    }
  }
  if (!isFile(path.join(libraryDir, checklist))) issues.push(`${checklist} is missing`);
  else {
    const source = fs.readFileSync(path.join(libraryDir, checklist), 'utf8');
    const requirements = [
      ['the 528px left documentation rail', /528px[\s\S]{0,160}(?:documentation rail|rail)/i],
      ['Button, Section header, and Alert as reference standards', /Button[\s,/]+Section header[\s,/]+(?:and\s+)?Alert/i],
      ['the 1440/1024/768/390 responsive widths', /1440[\s\S]{0,80}1024[\s\S]{0,80}768[\s\S]{0,80}390/],
      ['unpublished candidate status', /unpublished/i],
      ['both adversarial and design review passes', /adversarial[\s\S]{0,120}design review/i],
    ];
    for (const [label, pattern] of requirements) {
      if (!pattern.test(source)) issues.push(`${checklist} does not require ${label}`);
    }
  }

  const packageRead = readJsonSafe(path.join(libraryDir, 'package.json'));
  if (!packageRead.ok) {
    issues.push(`package.json could not be read: ${packageRead.error}`);
  } else {
    const packageSurfaces = findCodeConnectSurfaces(packageRead.value, 'package.json');
    if (packageSurfaces.length > 0) issues.push(`package.json exposes Code Connect at ${packageSurfaces.join(', ')}`);
    if (packageRead.value?.dependencies?.['@figma/code-connect'] ||
      packageRead.value?.devDependencies?.['@figma/code-connect']) {
      issues.push('package.json installs @figma/code-connect');
    }
    if (Object.entries(packageRead.value?.scripts ?? {}).some(
      ([name, command]) => codeConnectPattern.test(name) || codeConnectPattern.test(String(command)),
    )) {
      issues.push('package.json exposes a Code Connect script');
    }
    const requiredScripts = {
      'contracts:code': 'node scripts/check-contracts.cjs',
      'contracts:code:selftest': 'node scripts/check-contracts.selftest.cjs',
      'test:code': 'pnpm typecheck && pnpm lint && pnpm architecture && pnpm architecture:selftest && pnpm contracts:code && pnpm contracts:code:selftest && pnpm accessibility:report && pnpm release:preflight:selftest && pnpm exports:check && pnpm test:ssr && pnpm accessibility && pnpm test:a11y:webkit && pnpm test:a11y:modes && pnpm test:motion',
      'figma:coverage': 'node scripts/check-figma-coverage.cjs',
      'figma:contracts': 'node scripts/check-figma-contracts.cjs',
      'figma:live:if-token': 'node scripts/check-figma-live.cjs --if-token',
      'figma:validate': 'pnpm figma:coverage && pnpm figma:contracts && pnpm figma:live:if-token',
    };
    for (const [name, expected] of Object.entries(requiredScripts)) {
      const actual = packageRead.value?.scripts?.[name];
      if (!String(actual ?? '').trim()) issues.push(`package.json has no ${name} script`);
      else if (actual !== expected) issues.push(`package.json ${name} must equal "${expected}"`);
    }
  }
  const lockPath = path.join(libraryDir, 'pnpm-lock.yaml');
  if (isFile(lockPath) && codeConnectPattern.test(fs.readFileSync(lockPath, 'utf8'))) {
    issues.push('pnpm-lock.yaml must not retain Code Connect');
  }
  for (const forbidden of findForbiddenCodeConnectFiles()) {
    issues.push(`${forbidden} must not exist`);
  }

  return {
    required: true,
    ready: issues.length === 0,
    writeCapabilityRequired: true,
    publicationStatus: 'unpublished',
    reviewPasses: ['adversarial', 'design'],
    registry,
    checklist,
    codeContractsCommand,
    codeTestCommand,
    coverageCommand,
    validationCommand,
    issues,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    keys: ['captures', 'library', 'brain', 'manifest', 'out', 'proposals'],
    flags: ['pretty'],
  });
  const { values } = args;

  checkArgs(args, USAGE);
  if (!values.captures) usage('--captures is required', USAGE);
  if (!values.library) usage('--library is required', USAGE);

  const capturesDir = path.resolve(values.captures);
  if (!isDir(capturesDir)) fail(3, `--captures is not a directory: ${capturesDir}`);

  const libraryDir = path.resolve(values.library);
  // Shape test, not a version check: the two paths every capture writes against.
  if (!isDir(path.join(libraryDir, 'components')) || !isFile(path.join(libraryDir, 'src/tokens/semantic.css'))) {
    fail(4, `--library is not a ui-design-library checkout (needs components/ and src/tokens/semantic.css): ${libraryDir}`);
  }

  const warnings = new Warnings();
  const manifestPath = values.manifest
    ? path.resolve(values.manifest)
    : values.brain
      ? path.resolve(values.brain, MANIFEST_REL)
      : null;
  const manifest = loadManifest(manifestPath, warnings);
  const tokens = loadTokens(libraryDir, warnings);
  const proposalsDir = values.proposals
    ? path.resolve(values.proposals)
    : path.resolve(capturesDir, '..', 'proposals');
  // Deferral is only consulted inside `if (ctx.manifest)`, so skip the read entirely
  // when no catalog was given — nothing downstream would look at it. A missing
  // proposals/ sibling degrades silently to an empty set (most runs have none).
  const proposals = manifest ? loadProposals(proposalsDir, warnings) : [];

  const files = listEntries(capturesDir).filter((e) => !e.dir && e.name.endsWith('.md'));
  if (files.length === 0) {
    warnings.add('no-captures', `${capturesDir} contains no capture files — nothing to apply.`);
  }

  const ctx = { manifest, tokens, libraryDir, proposals, warnings };
  const components = files.map((file) => readCapture(file, ctx));
  const figmaPromotion = inspectFigmaPromotion(libraryDir);
  if (!figmaPromotion.ready) {
    const message = `The target library cannot complete governed Figma promotion: ${figmaPromotion.issues.join('; ')}.`;
    for (const component of components) {
      component.blockers.push({ code: 'figma-promotion-unavailable', message });
      component.status = 'blocked';
    }
  }
  const orphanedByRun = findOrphanedByRun(libraryDir, components, warnings);

  const counts = {
    captures: components.length,
    ready: components.filter((c) => c.status === 'ready').length,
    figmaPending: components.filter((c) => c.status === 'figma-pending').length,
    evidencePending: components.filter((c) => c.status === 'evidence-pending').length,
    blocked: components.filter((c) => c.status === 'blocked').length,
    skipped: components.filter((c) => c.status === 'skipped').length,
    deferred: components.filter((c) => c.status === 'deferred').length,
    orphanedByRun: orphanedByRun.length,
  };

  writeOut(
    {
      schemaVersion: 4,
      captures: capturesDir,
      library: libraryDir,
      figmaPromotion,
      manifest: manifest ? { path: manifestPath, entries: manifest.length } : null,
      components,
      orphanedByRun,
      counts,
      warnings: warnings.toJSON(),
    },
    values.out,
    values.pretty,
  );

  // A blocked capture is not something to shrug past, and a deferred one is not
  // executable yet: exit 0 means every capture in the set can be executed as-is.
  // Blocked dominates (exit 1); a set with only deferred captures exits 6 so a
  // naive executor keying on exit 0 stops and promotes the proposal first — the
  // library's contracts check the directory name, never the catalog, so nothing
  // downstream would otherwise catch a component keyed to an unpromoted canonical.
  //
  // `process.exitCode` rather than `process.exit()`: stdout is async on a pipe, and
  // exiting outright truncates it at the pipe buffer — a large plan would emit
  // syntactically broken JSON alongside a successful exit code.
  process.exitCode = counts.blocked > 0 ? 1 : counts.deferred > 0 ? 6 : 0;
}

try {
  main();
} catch (err) {
  process.stderr.write(`error: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
}
