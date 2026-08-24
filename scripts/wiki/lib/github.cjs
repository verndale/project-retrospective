"use strict";

// Canonical, offline GitHub evidence parsing shared by wiki reconciliation and
// the curated graph. Evidence remains metadata on the Markdown node that cites
// it; the graph never creates live or first-class GitHub nodes.

const REPOSITORY_RE = "[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+";
const URL_RE = new RegExp(
  `https?:\\/\\/(?:www\\.)?github\\.com\\/(${REPOSITORY_RE})\\/(pull|issues)\\/(\\d+)\\b`,
  "gi",
);

function normalizeRepository(repository) {
  const value = String(repository || "").trim().replace(/^github\.com\//i, "").replace(/\.git$/i, "").toLowerCase();
  return new RegExp(`^${REPOSITORY_RE}$`).test(value) ? value : null;
}

function canonicalRef({ kind, repository, number }) {
  const repo = normalizeRepository(repository);
  const n = Number(number);
  const normalizedKind = kind === "pull" || kind === "pr" ? "pull-request" : kind === "issues" ? "issue" : kind;
  if (!repo || !Number.isSafeInteger(n) || n <= 0 || !["pull-request", "issue"].includes(normalizedKind)) return null;
  const segment = normalizedKind === "pull-request" ? "pull" : "issues";
  return {
    kind: normalizedKind,
    repository: repo,
    number: n,
    url: `https://github.com/${repo}/${segment}/${n}`,
  };
}

function refKey(ref) {
  return `${ref.kind}\u0000${ref.repository}\u0000${ref.number}`;
}

function withoutFencedCode(text) {
  const kept = [];
  let fence = null;
  for (const line of String(text || "").split(/\r?\n/)) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      const kind = marker[1][0];
      if (!fence) fence = kind;
      else if (fence === kind) fence = null;
      continue;
    }
    if (!fence) kept.push(line);
  }
  return kept.join("\n");
}

function extractGithubRefs(text, { includeFencedCode = false } = {}) {
  const source = includeFencedCode ? String(text || "") : withoutFencedCode(text);
  const refs = [];
  const seen = new Set();
  URL_RE.lastIndex = 0;
  let match;
  while ((match = URL_RE.exec(source)) !== null) {
    const ref = canonicalRef({ repository: match[1], kind: match[2], number: match[3] });
    if (!ref || seen.has(refKey(ref))) continue;
    seen.add(refKey(ref));
    refs.push(ref);
  }
  return refs;
}

function parseGithubQuery(query) {
  const source = String(query || "").trim();
  if (!source || /^#\d+$/.test(source)) return null;

  const urls = extractGithubRefs(source, { includeFencedCode: true });
  if (urls.length === 1) return urls[0];

  let match = source.match(new RegExp(`^(${REPOSITORY_RE})\\s+(PR|pull(?:\\s+request)?|issue)\\s*#?(\\d+)$`, "i"));
  if (match) {
    return canonicalRef({
      repository: match[1],
      kind: /^issue$/i.test(match[2]) ? "issue" : "pull-request",
      number: match[3],
    });
  }

  match = source.match(new RegExp(`^(${REPOSITORY_RE})#(\\d+)$`, "i"));
  if (!match) return null;
  const repository = normalizeRepository(match[1]);
  const number = Number(match[2]);
  return repository && Number.isSafeInteger(number) && number > 0
    ? { kind: null, repository, number, url: null }
    : null;
}

function formatGithubRef(ref) {
  return `${ref.repository} ${ref.kind === "pull-request" ? "PR" : "issue"} #${ref.number}`;
}

function extractClosingIssues(body, defaultRepository) {
  const repository = normalizeRepository(defaultRepository);
  const source = withoutFencedCode(body);
  const refs = [];
  const seen = new Set();
  const issueToken = `(?:https?:\\/\\/(?:www\\.)?github\\.com\\/(?:${REPOSITORY_RE})\\/issues\\/\\d+|(?:${REPOSITORY_RE})#\\d+|#\\d+)`;
  const keyword = new RegExp(
    `\\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)\\s*:?\\s+(${issueToken}(?:\\s*(?:,|and)\\s*${issueToken})*)`,
    "gi",
  );
  let clause;
  while ((clause = keyword.exec(source)) !== null) {
    const tokenRe = new RegExp(
      `(?:https?:\\/\\/(?:www\\.)?github\\.com\\/(${REPOSITORY_RE})\\/issues\\/(\\d+)|(${REPOSITORY_RE})#(\\d+)|#(\\d+))`,
      "gi",
    );
    let token;
    while ((token = tokenRe.exec(clause[1])) !== null) {
      const ref = canonicalRef({
        kind: "issue",
        repository: token[1] || token[3] || repository,
        number: token[2] || token[4] || token[5],
      });
      if (!ref || seen.has(refKey(ref))) continue;
      seen.add(refKey(ref));
      refs.push(ref);
    }
  }
  return refs;
}

module.exports = {
  canonicalRef,
  extractClosingIssues,
  extractGithubRefs,
  formatGithubRef,
  normalizeRepository,
  parseGithubQuery,
  refKey,
  withoutFencedCode,
};
