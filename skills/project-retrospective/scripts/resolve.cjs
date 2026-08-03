#!/usr/bin/env node
/**
 * resolve.cjs — which built components does the catalog already name?
 *
 * Resolves every component label from an inventory against the ui-design-brain
 * patterns manifest, using the manifest's own resolution order: canonical name,
 * then plain alias, then context-scoped alias.
 *
 * Matching is EXACT after normalization (case, separators, camelCase boundaries).
 * There is no fuzzy matching and no nearest-match suggestion: a label that does
 * not match is novel. Guessing is the failure mode the catalog exists to prevent.
 *
 * A context-scoped alias owned by more than one canonical (the manifest's
 * deliberate ambiguity, e.g. "Banner" -> Alert or Hero) is reported as ambiguous
 * with its candidates. The script never picks; the caller confirms from usage
 * evidence or treats the label as novel.
 *
 * Usage:
 *   node resolve.cjs --inventory <file> (--brain <dir> | --manifest <file>)
 *                    [--out <file>] [--pretty]
 *
 * Exit codes:
 *   0  success
 *   1  unexpected failure
 *   2  invalid invocation
 *   3  --inventory is missing, unreadable, or has an unsupported schemaVersion
 *   4  the manifest is missing, unreadable, or structurally invalid
 */

'use strict';

const path = require('node:path');
const {
  parseArgs,
  checkArgs,
  readJsonSafe,
  isFile,
  normalizeLabel,
  Warnings,
  writeOut,
  usage,
} = require('./lib/util.cjs');

const USAGE = [
  'Usage: node resolve.cjs --inventory <file> (--brain <dir> | --manifest <file>) [--specs <file>] [--out <file>] [--pretty]',
  '',
  '  --inventory  inventory.json produced by inventory.cjs (required)',
  '  --brain      Path to a ui-design-brain checkout (resolves the manifest inside it)',
  '  --manifest   Path to patterns-manifest.json directly (alternative to --brain)',
  '  --specs      specs.json produced by normalize-specs.cjs (optional authored-spec evidence)',
  '  --out        Write JSON here instead of stdout',
  '  --pretty     Indent the JSON output',
];

const MANIFEST_REL = 'skills/ui-design-brain/patterns-manifest.json';
const SUPPORTED_SCHEMA = 1;

function fail(code, message) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(code);
}

function loadManifest(manifestPath) {
  if (!isFile(manifestPath)) {
    fail(4, `manifest not found: ${manifestPath}`);
  }
  const read = readJsonSafe(manifestPath);
  if (!read.ok) fail(4, `manifest could not be parsed: ${read.error}`);
  const entries = read.value;
  if (!Array.isArray(entries)) fail(4, 'manifest must be a top-level JSON array');

  entries.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') fail(4, `manifest entry ${i} is not an object`);
    for (const key of ['name', 'slug', 'file']) {
      if (typeof entry[key] !== 'string' || !entry[key]) {
        fail(4, `manifest entry ${i} ("${entry.name || '?'}") has no string "${key}"`);
      }
    }
    if (!Array.isArray(entry.aliases)) {
      fail(4, `manifest entry ${i} ("${entry.name}") has no aliases array`);
    }
  });

  return entries;
}

/**
 * Build the lookup tables the manifest's resolution order needs. A label may be a
 * canonical name, a plain alias, or a context-scoped alias; the last kind can be
 * owned by several canonicals at once.
 */
function buildLookups(entries, warnings) {
  const byName = new Map();
  const byPlainAlias = new Map();
  const byContextAlias = new Map();

  for (const entry of entries) {
    const nameKey = normalizeLabel(entry.name);
    if (byName.has(nameKey)) {
      warnings.add('duplicate-canonical', `Manifest has two canonicals normalizing to "${nameKey}".`);
    }
    byName.set(nameKey, entry);

    for (const alias of entry.aliases) {
      if (typeof alias === 'string') {
        const key = normalizeLabel(alias);
        if (!byPlainAlias.has(key)) byPlainAlias.set(key, []);
        byPlainAlias.get(key).push({ entry, alias });
        continue;
      }
      if (alias && typeof alias === 'object' && typeof alias.name === 'string') {
        const key = normalizeLabel(alias.name);
        if (!byContextAlias.has(key)) byContextAlias.set(key, []);
        byContextAlias.get(key).push({ entry, alias: alias.name, context: alias.context ?? null });
        continue;
      }
      warnings.add('unreadable-alias', `Entry "${entry.name}" has an alias that is neither a string nor { name, context }.`);
    }
  }

  return { byName, byPlainAlias, byContextAlias };
}

/** Resolve one label. Returns null when the label is novel. */
function resolveLabel(label, lookups) {
  const key = normalizeLabel(label);
  if (!key) return null;

  const named = lookups.byName.get(key);
  if (named) {
    return { canonical: named.name, slug: named.slug, via: 'name', ambiguous: false };
  }

  const plain = lookups.byPlainAlias.get(key);
  if (plain && plain.length === 1) {
    return { canonical: plain[0].entry.name, slug: plain[0].entry.slug, via: 'alias', alias: plain[0].alias, ambiguous: false };
  }
  if (plain && plain.length > 1) {
    // A plain alias owned by several canonicals is a manifest defect, not a
    // context split — surface it rather than picking one.
    return {
      canonical: null,
      slug: null,
      via: 'alias',
      alias: plain[0].alias,
      ambiguous: true,
      candidates: plain.map((p) => ({ canonical: p.entry.name, slug: p.entry.slug, context: null })),
    };
  }

  const scoped = lookups.byContextAlias.get(key);
  if (scoped && scoped.length > 0) {
    // Ambiguity means more than one CANONICAL claims the label. The same canonical
    // listing it under two contexts still resolves unambiguously.
    const owners = [...new Map(scoped.map((s) => [s.entry.slug, s])).values()];
    if (owners.length === 1) {
      return {
        canonical: owners[0].entry.name,
        slug: owners[0].entry.slug,
        via: 'context-alias',
        alias: owners[0].alias,
        contexts: scoped.map((s) => s.context),
        ambiguous: false,
      };
    }
    return {
      canonical: null,
      slug: null,
      via: 'context-alias',
      alias: scoped[0].alias,
      ambiguous: true,
      candidates: owners.map((s) => ({ canonical: s.entry.name, slug: s.entry.slug, context: s.context })),
    };
  }

  return null;
}

/**
 * Cross-reference an approved-spec pack against the inventory resolution.
 *
 * A ba-spec-writer spec is authored-intent evidence: an approved spec is a second,
 * independent source for a label the as-built inventory also shows. This appends
 * `spec` to a matched novel label's sources, and returns a per-spec join — the
 * spec's own brain resolution beside the as-built resolution — so triage can act on
 * corroboration, spec-only intent, and the novel elements the spec flagged. It never
 * changes the resolved/unresolved shape beyond that one appended source.
 */
function crossReferenceSpecs(pack, { resolved, unresolved, lookups }) {
  const approved = (Array.isArray(pack.specs) ? pack.specs : []).filter(
    (s) => s && String(s.documentStatus || '').toUpperCase() === 'APPROVED',
  );
  const byNorm = new Set(approved.map((s) => s.normalized || normalizeLabel(s.label || '')).filter(Boolean));

  // A novel label with an approved spec behind it gains `spec` as a second source.
  for (const u of unresolved) {
    if (byNorm.has(u.normalized) && !u.sources.includes('spec')) {
      u.sources = [...u.sources, 'spec'].sort();
    }
  }

  const entries = approved.map((s) => {
    const norm = s.normalized || normalizeLabel(s.label || '');
    const own = resolveLabel(s.label || '', lookups);
    const invResolved = resolved.find((r) => normalizeLabel(r.label) === norm) || null;
    const invUnresolved = unresolved.find((u) => u.normalized === norm) || null;
    const matchedResolution = invResolved
      ? invResolved.ambiguous
        ? 'ambiguous'
        : invResolved.canonical
      : invUnresolved
        ? 'novel'
        : null;
    return {
      label: s.label,
      normalized: norm,
      documentStatus: s.documentStatus || null,
      novelLabels: Array.isArray(s.novelLabels) ? s.novelLabels : [],
      resolution: own ? { canonical: own.canonical, slug: own.slug, via: own.via, ambiguous: own.ambiguous } : null,
      inventoryMatch: invResolved
        ? invResolved.component
        : invUnresolved
          ? invUnresolved.locations[0]?.component ?? null
          : null,
      matchedResolution,
      specOnly: !invResolved && !invUnresolved,
    };
  });

  return {
    entries,
    counts: {
      total: entries.length,
      matched: entries.filter((e) => !e.specOnly).length,
      specOnly: entries.filter((e) => e.specOnly).length,
      novel: entries.filter((e) => e.resolution === null).length,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    keys: ['inventory', 'brain', 'manifest', 'specs', 'out'],
    flags: ['pretty'],
  });
  const { values } = args;

  checkArgs(args, USAGE);
  if (!values.inventory) usage('--inventory is required', USAGE);
  if (!values.brain && !values.manifest) usage('one of --brain or --manifest is required', USAGE);

  const inventoryPath = path.resolve(values.inventory);
  if (!isFile(inventoryPath)) fail(3, `inventory not found: ${inventoryPath}`);
  const inventoryRead = readJsonSafe(inventoryPath);
  if (!inventoryRead.ok) fail(3, `inventory could not be parsed: ${inventoryRead.error}`);
  const inventory = inventoryRead.value;
  if (inventory?.schemaVersion !== SUPPORTED_SCHEMA) {
    fail(3, `inventory schemaVersion ${inventory?.schemaVersion} is not supported (expected ${SUPPORTED_SCHEMA})`);
  }
  if (!Array.isArray(inventory.components)) fail(3, 'inventory has no components array');

  const manifestPath = values.manifest
    ? path.resolve(values.manifest)
    : path.resolve(values.brain, MANIFEST_REL);

  const warnings = new Warnings();
  const entries = loadManifest(manifestPath);
  const lookups = buildLookups(entries, warnings);

  const resolved = [];
  const unresolvedByKey = new Map();
  let skipped = 0;

  for (const [index, component] of inventory.components.entries()) {
    if (!component || typeof component !== 'object' || Array.isArray(component)) {
      skipped += 1;
      continue;
    }
    // Try the display name first, then the folder slug — a project may carry the
    // catalog label in either.
    const attempts = [component.name, component.folder].filter((v) => typeof v === 'string' && v);
    let hit = null;
    let usedLabel = attempts[0] || '';

    for (const label of attempts) {
      const result = resolveLabel(label, lookups);
      if (result) {
        hit = result;
        usedLabel = label;
        break;
      }
    }

    if (hit) {
      resolved.push({ label: usedLabel, component: component.folder || component.name, ...hit });
      continue;
    }

    const normalized = normalizeLabel(usedLabel);
    // A label that normalizes to nothing (punctuation or characters the
    // normalizer strips) must not merge with every other such label — key it on
    // the component instead so each stays visible in the report.
    const key = normalized || ` unnormalizable:${index}`;
    if (!normalized) {
      warnings.add(
        'unnormalizable-label',
        `Component "${component.folder || component.name || `#${index}`}" has a label that normalizes to an empty string; it is reported on its own.`,
      );
    }
    if (!unresolvedByKey.has(key)) {
      unresolvedByKey.set(key, {
        label: usedLabel,
        normalized,
        occurrences: 0,
        locations: [],
        sources: new Set(),
      });
    }
    const record = unresolvedByKey.get(key);
    record.occurrences += 1;
    record.locations.push({
      component: component.folder || component.name,
      path: typeof component.path === 'string' ? component.path : null,
      bucket: typeof component.bucket === 'string' ? component.bucket : null,
      domain: typeof component.domain === 'string' ? component.domain : null,
    });
    for (const source of Array.isArray(component.sources) ? component.sources : []) {
      record.sources.add(source);
    }
  }

  if (skipped > 0) {
    warnings.add('unreadable-inventory-entry', `${skipped} inventory component entr(ies) were not objects and were skipped.`);
  }

  const unresolved = [...unresolvedByKey.values()]
    .map((r) => ({
      label: r.label,
      normalized: r.normalized,
      occurrences: r.occurrences,
      locations: r.locations,
      sources: [...r.sources].sort(),
    }))
    .sort(
      (a, b) =>
        b.occurrences - a.occurrences ||
        (a.normalized < b.normalized ? -1 : a.normalized > b.normalized ? 1 : 0) ||
        (a.label < b.label ? -1 : a.label > b.label ? 1 : 0),
    );

  const ambiguous = resolved.filter((r) => r.ambiguous).length;

  // Optional authored-spec evidence. Absent --specs leaves the output byte-identical
  // to a spec-unaware run; a malformed pack degrades to a warning, never a failure.
  let specsBlock = null;
  if (values.specs) {
    const specsPath = path.resolve(values.specs);
    const specsRead = readJsonSafe(specsPath);
    if (!specsRead.ok) {
      warnings.add('specs-unreadable', `--specs could not be parsed: ${specsRead.error} — spec evidence skipped.`);
    } else if (!specsRead.value || specsRead.value.schemaVersion !== SUPPORTED_SCHEMA || !Array.isArray(specsRead.value.specs)) {
      warnings.add('specs-unreadable', '--specs is not a schemaVersion 1 spec pack — spec evidence skipped.');
    } else {
      const crossRef = crossReferenceSpecs(specsRead.value, { resolved, unresolved, lookups });
      specsBlock = { path: specsPath, entries: crossRef.entries, counts: crossRef.counts };
    }
  }

  writeOut(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      inventory: inventoryPath,
      manifest: { path: manifestPath, entries: entries.length },
      resolved,
      unresolved,
      counts: {
        components: inventory.components.length,
        skipped,
        resolved: resolved.length - ambiguous,
        ambiguous,
        unresolved: unresolved.reduce((sum, u) => sum + u.occurrences, 0),
        unresolvedLabels: unresolved.length,
      },
      ...(specsBlock ? { specs: specsBlock } : {}),
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
