/**
 * Shared helpers for the project-retrospective scripts.
 *
 * Zero dependencies, CommonJS, no network. These scripts are installed with the
 * skill and run under plain `node` in the operator's environment, which may have
 * no node_modules at all.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Minimal argv parser. Accepts `--key value` and `--key=value`; a key declared in
 * `flags` takes no value and becomes boolean true.
 *
 * Returns { values, unknown, positional }. Unknown keys are reported rather than
 * ignored so a typo'd flag fails loudly instead of silently doing the wrong thing.
 */
function parseArgs(argv, { keys = [], flags = [] } = {}) {
  const values = {};
  const unknown = [];
  const missing = [];
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);

    if (flags.includes(key)) {
      values[key] = true;
      continue;
    }
    if (!keys.includes(key)) {
      unknown.push(key);
      continue;
    }
    if (eq !== -1) {
      values[key] = arg.slice(eq + 1);
      continue;
    }
    // An option whose value is absent or is itself an option is a mistake, not an
    // empty string — an unset shell variable must fail loudly rather than silently
    // change where output goes.
    const next = argv[i + 1];
    if (next === undefined || next === '' || next.startsWith('--')) {
      missing.push(key);
      continue;
    }
    values[key] = next;
    i += 1;
  }

  return { values, unknown, missing, positional };
}

/** Read + parse JSON without throwing. Returns { ok, value, error }. */
function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return { ok: true, value: JSON.parse(raw), error: null };
  } catch (err) {
    return { ok: false, value: null, error: err.message };
  }
}

/**
 * Read a text file without throwing. Returns null when unreadable.
 *
 * Callers that need to tell "unreadable" from "skipped because it is huge" pass a
 * Warnings collector — silently dropping a large file would make the evidence
 * summary claim a source it never actually read.
 */
function readTextSafe(filePath, maxBytes = 2 * 1024 * 1024, warnings = null) {
  try {
    const stat = fs.statSync(filePath);
    // Cap the read so a stray large file in an artifacts dir cannot stall a run.
    if (stat.size > maxBytes) {
      if (warnings) {
        warnings.add(
          'file-too-large',
          `${filePath} is ${Math.round(stat.size / 1024)} KB, above the ${Math.round(maxBytes / 1024)} KB read cap — its contents were not used as evidence.`,
        );
      }
      return null;
    }
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * Directory entries as { name, path, dir } records. Returns [] when unreadable.
 *
 * Dirent.isDirectory() does not follow symlinks, but monorepos and shared
 * component libraries routinely symlink directories — treating those as files
 * would make a whole project inventory as empty.
 */
function listEntries(dirPath) {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .map((entry) => {
        const full = path.join(dirPath, entry.name);
        return {
          name: entry.name,
          path: full,
          dir: entry.isDirectory() || (entry.isSymbolicLink() && isDir(full)),
        };
      })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  } catch {
    return [];
  }
}

/**
 * Normalize a design label for exact matching: case, word separators, and
 * camelCase boundaries only.
 *
 * Deliberately NOT normalized: plurals, stems, synonyms, punctuation-as-meaning.
 * The catalog exists to stop agents guessing; a label that does not match exactly
 * is novel, not "probably X".
 *
 *   'StatusChip' -> 'status-chip'   'Status Chip' -> 'status-chip'
 *   'CTAButton'  -> 'cta-button'    'cards' -/-> 'card'
 */
function normalizeLabel(input) {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    // Decompose accents so "Café" folds to "cafe" rather than losing the letter
    // and colliding with unrelated labels.
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    // Any remaining separator or non-ASCII character becomes a boundary, never a
    // deletion — deleting it would silently merge distinct labels.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

/** kebab-case a canonical name, e.g. 'Progress indicator' -> 'progress-indicator'. */
function kebab(input) {
  return normalizeLabel(input);
}

/**
 * Split markdown into { heading, body } blocks at the given heading level.
 *
 * Fence-aware: a proposal's pattern draft is a fenced block whose content is
 * itself markdown with `##` headings, and those must not split the section that
 * contains them.
 */
function sections(markdown, level) {
  const marker = `${'#'.repeat(level)} `;
  const lines = markdown.split('\n');
  const out = [];
  let current = null;
  let fence = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (fenceMatch) {
      const [, ticks, rest] = fenceMatch;
      if (fence === null) {
        fence = ticks;
      } else if (ticks[0] === fence[0] && ticks.length >= fence.length && rest.trim() === '') {
        fence = null;
      }
    } else if (fence === null && line.startsWith(marker)) {
      if (current) out.push(current);
      current = { heading: line.slice(marker.length).trim(), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) out.push(current);
  return out.map((s) => ({ heading: s.heading, body: s.body.join('\n') }));
}

/**
 * The canonical name and slug a capture declares, e.g. "**Badge** (`badge`)".
 *
 * Anchored to the section's first non-blank line, not searched across the whole
 * body. A capture whose canonical line is unbolded but whose alias is bolded —
 * "Modal (`modal`) — resolved via alias **Dialog** (`dialog`)" — would otherwise
 * report the alias, sending the author to fix the wrong thing.
 *
 * Returns null when the line is absent or malformed; both callers treat that as a
 * missing canonical rather than guessing.
 */
function parseCanonicalLine(body) {
  const first = body.split('\n').map((line) => line.trim()).find(Boolean);
  if (!first) return null;
  const match = first.match(/^\*\*([^*]+)\*\*\s*\(`([^`]+)`\)/);
  return match ? { canonical: match[1].trim(), slug: match[2].trim() } : null;
}

/**
 * First fenced code block in `body`, optionally filtered by info string.
 *
 * Uses the same fence rules as `sections()` rather than a regex: tilde fences,
 * indented fences, and longer fences wrapping shorter ones all appear in these
 * templates, and a regex that mishandles them produces confident-but-wrong
 * "missing block" failures.
 */
function fencedBlock(body, lang) {
  const lines = body.split('\n');
  let open = null;
  let indent = 0;
  const collected = [];

  for (const line of lines) {
    const match = line.match(/^(\s*)(`{3,}|~{3,})\s*(\S*)/);
    if (match) {
      const [, lead, ticks, info] = match;
      if (open === null) {
        if (lang && info.toLowerCase() !== lang.toLowerCase()) continue;
        open = ticks;
        indent = lead.length;
        continue;
      }
      if (ticks[0] === open[0] && ticks.length >= open.length && !info) {
        return collected.join('\n');
      }
    }
    if (open !== null) {
      // Strip only the opening fence's indentation so an indented block keeps its
      // own internal structure.
      collected.push(line.slice(0, indent).trim() === '' ? line.slice(indent) : line);
    }
  }

  // An unclosed fence is malformed; report it as absent rather than guessing.
  return null;
}

/** Collects { code, message } warnings so scripts degrade instead of crashing. */
class Warnings {
  constructor() {
    this.items = [];
  }

  add(code, message) {
    this.items.push({ code, message });
  }

  toJSON() {
    return this.items;
  }
}

/**
 * Write JSON to `outPath`, or to stdout when `outPath` is omitted.
 *
 * A write failure exits 2 rather than throwing: the analysis already succeeded, so
 * the caller needs the reason, not a stack trace.
 */
function writeOut(obj, outPath, pretty) {
  const json = JSON.stringify(obj, null, pretty ? 2 : 0);
  if (!outPath) {
    process.stdout.write(`${json}\n`);
    return;
  }
  const resolved = path.resolve(outPath);
  try {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, `${json}\n`, 'utf8');
  } catch (err) {
    process.stderr.write(`error: could not write ${resolved}: ${err.message}\n`);
    process.exit(2);
  }
}

/** Fail with a usage message on exit code 2. */
function usage(message, lines) {
  process.stderr.write(`error: ${message}\n\n${lines.join('\n')}\n`);
  process.exit(2);
}

/** Shared argv validation: unknown options and options missing their value. */
function checkArgs({ unknown, missing }, usageLines) {
  if (unknown.length) {
    usage(`unknown option(s): ${unknown.map((u) => `--${u}`).join(', ')}`, usageLines);
  }
  if (missing.length) {
    usage(`option(s) missing a value: ${missing.map((m) => `--${m}`).join(', ')}`, usageLines);
  }
}

module.exports = {
  parseArgs,
  checkArgs,
  readJsonSafe,
  readTextSafe,
  isDir,
  isFile,
  listEntries,
  normalizeLabel,
  kebab,
  sections,
  fencedBlock,
  parseCanonicalLine,
  Warnings,
  writeOut,
  usage,
};
