"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");

const {
  extractClosingIssues,
  extractGithubRefs,
  parseGithubQuery,
} = require("../wiki/lib/github.cjs");
const { normalizeContext, run: reconcileMerge } = require("../wiki/on-merge-sync.cjs");
const { refresh } = require("../wiki/refresh-issue-state.cjs");
const { build } = require("../graph/build-graph.cjs");
const { formatRoute, policyProblems, route } = require("../graph/routing.cjs");
const { isGraphInput, normalize } = require("../graph/pre-commit.cjs");

const ROOT = path.resolve(__dirname, "..", "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

test("GitHub citations are canonical, repo-qualified, deduplicated, and outside code fences", () => {
  const refs = extractGithubRefs([
    "[PR](https://github.com/Verndale/Project-Retrospective/pull/83)",
    "https://www.github.com/verndale/project-retrospective/pull/83",
    "[issue](http://github.com/other/repo/issues/12)",
    "https://example.test/github.com/hostile/repo/issues/13",
    "https://evil.example/https://github.com/hostile/repo/issues/14",
    "```",
    "https://github.com/ignored/repo/pull/99",
    "```",
    "~~~md",
    "https://github.com/ignored/repo/issues/98",
    "~~~",
    "````md",
    "```js",
    "https://github.com/ignored/repo/issues/97",
    "```",
    "https://github.com/ignored/repo/issues/96",
    "````",
  ].join("\n"));
  assert.deepEqual(refs, [
    { kind: "pull-request", repository: "verndale/project-retrospective", number: 83, url: "https://github.com/verndale/project-retrospective/pull/83" },
    { kind: "issue", repository: "other/repo", number: 12, url: "https://github.com/other/repo/issues/12" },
  ]);
});

test("GitHub evidence queries require repository qualification", () => {
  assert.equal(parseGithubQuery("#83"), null);
  assert.deepEqual(parseGithubQuery("verndale/project-retrospective PR #83"), {
    kind: "pull-request",
    repository: "verndale/project-retrospective",
    number: 83,
    url: "https://github.com/verndale/project-retrospective/pull/83",
  });
  assert.deepEqual(parseGithubQuery("https://github.com/verndale/project-retrospective/pull/83?diff=split#discussion_r1"), {
    kind: "pull-request",
    repository: "verndale/project-retrospective",
    number: 83,
    url: "https://github.com/verndale/project-retrospective/pull/83",
  });
  assert.deepEqual(parseGithubQuery("verndale/project-retrospective#83"), {
    kind: null,
    repository: "verndale/project-retrospective",
    number: 83,
    url: null,
  });
});

test("all closing issues are extracted across same-repo, cross-repo, and URL forms", () => {
  const refs = extractClosingIssues(
    "Closes #9, #10, and Other/Repo#11. Fixes #13 & #14. Related #99 is not closing.\n~~~md\nFixes hidden/repo#98.\n~~~\nResolved https://github.com/third/repo/issues/12.",
    "verndale/project-retrospective",
  );
  assert.deepEqual(refs.map((ref) => ref.url), [
    "https://github.com/verndale/project-retrospective/issues/9",
    "https://github.com/verndale/project-retrospective/issues/10",
    "https://github.com/other/repo/issues/11",
    "https://github.com/verndale/project-retrospective/issues/13",
    "https://github.com/verndale/project-retrospective/issues/14",
    "https://github.com/third/repo/issues/12",
  ]);
});

test("merged-PR contexts normalize portable aliases without writing a durable snapshot", () => {
  assert.deepEqual(normalizeContext({
    number: "5",
    title: "Change",
    url: "https://github.com/verndale/project-retrospective/pull/5",
    merged_at: "2026-08-23T10:00:00Z",
    files: ["a.md"],
    commits: [{ sha: "abc", message: "feat: change\nbody" }],
  }), {
    schemaVersion: 1,
    repository: "verndale/project-retrospective",
    number: 5,
    title: "Change",
    body: "",
    url: "https://github.com/verndale/project-retrospective/pull/5",
    mergedAt: "2026-08-23T10:00:00Z",
    changedPaths: ["a.md"],
    commits: [{ hash: "abc", subject: "feat: change" }],
  });
  assert.throws(() => normalizeContext({
    repository: "verndale/project-retrospective",
    number: 5,
    url: "https://github.com/verndale/project-retrospective/pull/6",
  }), /must agree/);
  assert.throws(() => normalizeContext({
    repository: "verndale/project-retrospective",
    number: 5,
    url: "https://github.com/verndale/project-retrospective/pull/5",
    changedPaths: ["wiki/journal/../../outside.md"],
  }), /safe repo-relative paths/);
  assert.throws(() => normalizeContext({
    repository: "verndale/project-retrospective",
    number: 5,
    url: "https://github.com/verndale/project-retrospective/pull/5",
    changedPaths: "wiki/journal/change.md",
  }), /safe repo-relative paths/);
  assert.throws(() => normalizeContext({
    repository: "verndale/project-retrospective",
    number: 5,
    url: "https://github.com/verndale/project-retrospective/pull/5",
    title: 5,
  }), /title must be a string/);
  assert.throws(() => normalizeContext({
    repository: "verndale/project-retrospective",
    number: 5,
    url: "https://github.com/verndale/project-retrospective/pull/5",
    body: ["Fixes #5"],
  }), /body must be a string/);
  assert.throws(() => normalizeContext({
    repository: "verndale/project-retrospective",
    number: 5,
    url: "https://github.com/verndale/project-retrospective/pull/5",
    merged_at: 1_777_777_777,
  }), /mergedAt must be a string/);
  assert.throws(() => normalizeContext({
    repository: "verndale/project-retrospective",
    number: 5,
    url: "https://github.com/verndale/project-retrospective/pull/5",
    merged_at: "2026-02-31T00:00:00Z",
  }), /parseable ISO date/);
  assert.throws(() => normalizeContext({
    repository: "verndale/project-retrospective",
    number: 5,
    url: "https://github.com/verndale/project-retrospective/pull/5",
    merged_at: "2026",
  }), /parseable ISO date/);
  assert.throws(() => normalizeContext({
    repository: "verndale/project-retrospective",
    number: 5,
    url: "https://github.com/verndale/project-retrospective/pull/5",
    commits: [{ hash: "", subject: "missing hash" }],
  }), /string hash and subject/);
  assert.throws(() => normalizeContext({
    repository: "verndale/project-retrospective",
    number: 5,
    url: "https://github.com/verndale/project-retrospective/pull/5",
    commits: [{ hash: 123, subject: "change" }],
  }), /string hash and subject/);
});

test("manual replay merges closing issues into a journal that already cites the PR", async (t) => {
  const wiki = fs.mkdtempSync(path.join(os.tmpdir(), "retro-prefilled-pr-"));
  t.after(() => fs.rmSync(wiki, { recursive: true, force: true }));
  fs.mkdirSync(path.join(wiki, "journal"));
  const journal = path.join(wiki, "journal", "change.md");
  fs.writeFileSync(journal, "---\npr: https://github.com/verndale/project-retrospective/pull/83\nissue: pending\ntopics: []\n---\n# Change\n");
  const context = { schemaVersion: 1, repository: "verndale/project-retrospective", number: 83, title: "Change", body: "Closes #83 and other/repo#12.", url: "https://github.com/verndale/project-retrospective/pull/83", changedPaths: ["wiki/journal/change.md"], commits: [] };
  const first = await reconcileMerge(context, wiki);
  const text = fs.readFileSync(journal, "utf8");
  assert.match(text, /^issue: https:\/\/github\.com\/verndale\/project-retrospective\/issues\/83$/m);
  assert.match(text, /https:\/\/github\.com\/other\/repo\/issues\/12/);
  const second = await reconcileMerge(context, wiki);
  assert.ok(first.changes.length > 0);
  assert.equal(second.changes.length, 0);
});

test("curated graph adds githubRefs without removing legacy numbers or inventing GitHub nodes", () => {
  const graph = build();
  const node = graph.nodes.find((item) => item.id === "wiki/journal/2026-08-22-standardize-quality-and-graph-lifecycle.md");
  assert.ok(node);
  assert.ok(node.issues.includes("79"));
  assert.ok(node.githubRefs.some((ref) => ref.kind === "issue" && ref.repository === "verndale/project-retrospective" && ref.number === 79));
  assert.equal(graph.nodes.some((item) => item.type === "github-pr" || item.type === "github-issue"), false);
});

function graphNode(id, type, options = {}) {
  return {
    id,
    label: options.label || id,
    type,
    degree: options.degree || 1,
    topics: [],
    aliases: [],
    bytes: options.bytes || 100,
    githubRefs: options.githubRefs || [],
  };
}

const routingPolicy = {
  edgeCosts: { topic: 1 },
  hubPenalty: 0.5,
  bytePenaltyPerKiB: 0.05,
  excludedIntermediateTypes: ["wiki-index"],
  intents: {
    why: { preferredTargetTypes: ["wiki-topic"], preferredSourceTypes: ["wiki-journal", "wiki-topic"], allowSourceAsTarget: true },
    wiring: { preferredTargetTypes: ["wiki-topic"], preferredSourceTypes: ["wiki-topic"] },
    impact: { preferredTargetTypes: ["wiki-topic"], preferredSourceTypes: ["wiki-topic"] },
  },
};

test("repo-qualified evidence prefers journal authority and reports the itinerary byte budget", () => {
  const ref = { kind: "pull-request", repository: "verndale/project-retrospective", number: 83, url: "https://github.com/verndale/project-retrospective/pull/83" };
  const journal = graphNode("wiki/journal/change.md", "wiki-journal", { bytes: 180, githubRefs: [ref] });
  const topic = graphNode("wiki/topics/graph-wiki-subsystem.md", "wiki-topic", { bytes: 320, githubRefs: [ref] });
  const result = route({ nodes: [journal, topic], edges: [{ source: journal.id, target: topic.id, type: "topic" }] }, {
    intent: "why",
    query: "verndale/project-retrospective PR #83",
    policy: routingPolicy,
  });
  assert.equal(result.status, "ok");
  assert.equal(result.source.id, journal.id);
  assert.equal(result.itinerary[0].relation, "evidence citation");
  assert.equal(result.totalBytes, 500);
  assert.match(formatRoute(result), /500 B to read/);
  assert.match(formatRoute(result), /Authority: wiki\/journal\/change\.md → wiki\/topics\/graph-wiki-subsystem\.md/);
  assert.match(formatRoute(result), /included because it cites verndale\/project-retrospective PR #83/);
});

test("byte-weighted routing prefers the compact equal-hop itinerary", () => {
  const compactPolicy = {
    edgeCosts: { topic: 1 },
    hubPenalty: 0,
    bytePenaltyPerKiB: 0.05,
    excludedIntermediateTypes: [],
    intents: {
      why: { preferredSourceTypes: ["wiki-topic"], preferredTargetTypes: ["wiki-topic"] },
      wiring: { preferredSourceTypes: ["wiki-topic"], preferredTargetTypes: ["wiki-topic"] },
      impact: { preferredSourceTypes: ["wiki-topic"], preferredTargetTypes: ["wiki-topic"] },
    },
  };
  const graph = {
    nodes: [
      graphNode("source", "wiki-topic", { bytes: 10 }),
      graphNode("large", "wiki-topic", { bytes: 16384 }),
      graphNode("small", "wiki-topic", { bytes: 16 }),
      graphNode("target", "wiki-topic", { bytes: 10 }),
    ],
    edges: [
      { source: "source", target: "large", type: "topic" },
      { source: "large", target: "target", type: "topic" },
      { source: "source", target: "small", type: "topic" },
      { source: "small", target: "target", type: "topic" },
    ],
  };
  const result = route(graph, { intent: "wiring", from: "source", to: "target", policy: compactPolicy });
  assert.deepEqual(result.itinerary.map((item) => item.id), ["source", "small", "target"]);
  assert.equal(result.totalBytes, 36);
});

test("a bare number misses and compact evidence stays ambiguous when PR and issue collide", () => {
  const pr = graphNode("wiki/journal/pr.md", "wiki-journal", { githubRefs: [{ kind: "pull-request", repository: "verndale/repo", number: 7, url: "https://github.com/verndale/repo/pull/7" }] });
  const issue = graphNode("wiki/journal/issue.md", "wiki-journal", { githubRefs: [{ kind: "issue", repository: "verndale/repo", number: 7, url: "https://github.com/verndale/repo/issues/7" }] });
  assert.equal(route({ nodes: [pr, issue], edges: [] }, { intent: "why", query: "#7", policy: routingPolicy }).status, "missing-source");
  const ambiguous = route({ nodes: [pr, issue], edges: [] }, { intent: "why", query: "verndale/repo#7", policy: routingPolicy });
  assert.equal(ambiguous.status, "ambiguous-source");
  assert.deepEqual(ambiguous.candidates.map((item) => item.id), [issue.id, pr.id].sort());
});

test("viewer searches aliases and repo-qualified evidence and renders safe links", () => {
  const source = read("scripts/graph/viewer/viewer.js");
  assert.match(source, /node\.githubRefs \|\| \[\]/);
  assert.match(source, /\.\.\.\(node\.aliases \|\| \[\]\)/);
  assert.match(source, /link\.textContent = refLabel\(ref\)/);
  assert.match(source, /link\.rel = "noopener noreferrer"/);
  assert.doesNotMatch(source, /insertAdjacentHTML/);
  const browserSource = read("scripts/graph/viewer/routing.js");
  const browser = { window: {} };
  vm.runInNewContext(browserSource, browser);
  assert.equal(
    browser.window.KGRouting.normalizeEvidenceQuery("https://github.com/verndale/project-retrospective/pull/83?diff=split#discussion"),
    "https://github.com/verndale/project-retrospective/pull/83",
  );
  assert.equal(
    browser.window.KGRouting.normalizeEvidenceQuery("https://github.com/verndale/project-retrospective/pull/9007199254740992?diff=split"),
    "https://github.com/verndale/project-retrospective/pull/9007199254740992?diff=split",
  );
  assert.match(source, /normalizeEvidenceQuery\(e\.target\.value\)/);
  assert.match(source, /formatBytes\(route\.totalBytes\)/);
  assert.match(source, /authority:/);
  const graph = { nodes: [{ id: "a", bytes: 1, degree: 1 }, { id: "b", bytes: 1, degree: 1 }], edges: [{ source: "a", target: "b", type: "missing" }] };
  const intent = { preferredSourceTypes: ["wiki-topic"], preferredTargetTypes: ["wiki-topic"] };
  const safe = { edgeCosts: { topic: 1 }, hubPenalty: 0, bytePenaltyPerKiB: 0, excludedIntermediateTypes: [], intents: { why: intent, wiring: intent, impact: intent } };
  assert.equal(browser.window.KGRouting.hasSafeNumericPolicy({ ...safe, excludedIntermediateTypes: null }, graph), false);
  assert.equal(browser.window.KGRouting.hasSafeNumericPolicy({ ...safe, excludedIntermediateTypes: [null] }, graph), false);
  assert.equal(browser.window.KGRouting.hasSafeNumericPolicy({ ...safe, intents: { ...safe.intents, why: { ...intent, preferredSourceTypes: [null] } } }, graph), false);
  assert.match(policyProblems({ ...safe, excludedIntermediateTypes: [null] })[0], /string array/);
  assert.ok(policyProblems({ ...safe, intents: { ...safe.intents, why: { ...intent, preferredSourceTypes: [null] } } }).some((problem) => /string array/.test(problem)));
  assert.equal(browser.window.KGRouting.shortestPath(graph, "a", "b", safe), null);
});

test("the five workflow identities and focused check commands stay stable", () => {
  const quality = read(".github/workflows/quality.yml");
  const commitlint = read(".github/workflows/commitlint.yml");
  const wikiCheck = read(".github/workflows/wiki-check.yml");
  const wikiSync = read(".github/workflows/wiki-sync.yml");
  const issueSync = read(".github/workflows/wiki-issue-sync.yml");
  assert.match(quality, /^name: Quality$/m);
  assert.match(quality, /^ {2}quality:$/m);
  assert.match(commitlint, /^name: Commit message lint$/m);
  assert.match(commitlint, /^ {2}commitlint:$/m);
  assert.match(wikiCheck, /^name: Wiki integrity$/m);
  assert.match(wikiCheck, /^ {2}check:$/m);
  assert.match(wikiSync, /^name: Sync context wiki$/m);
  assert.match(wikiSync, /^ {2}sync:$/m);
  assert.match(issueSync, /^name: Sync wiki issue state$/m);
  assert.match(issueSync, /^ {2}sync:$/m);
  assert.match(quality, /pnpm run verify:ci/);
  assert.doesNotMatch(quality, /ci-journal-warn/);
  assert.equal((wikiCheck.match(/pnpm run wiki:check/g) || []).length, 1);
  assert.doesNotMatch(wikiCheck, /ci-journal-warn/);
  assert.match(wikiCheck, /pull_request:\n {4}branches: \[main\]/);
  assert.match(wikiCheck, /push:\n {4}branches: \[main\]/);
  assert.match(wikiCheck, /workflow_dispatch: \{\}/);
});

test("writer workflows enforce manual replay, pagination, bot guards, and review branches", () => {
  const merge = read(".github/workflows/wiki-sync.yml");
  const issue = read(".github/workflows/wiki-issue-sync.yml");
  const pr = read(".github/workflows/pr.yml");
  const collapsed = merge.replace(/\s*\\\n\s*/g, " ");
  assert.equal((merge.match(/--paginate --slurp/g) || []).length, 2);
  assert.doesNotMatch(merge, /--slurp --jq/);
  assert.match(merge, /workflow_dispatch:[\s\S]*pr_number:/);
  assert.match(merge, /\.merged == true and \.merged_at != null/);
  assert.match(merge, /schemaVersion: 1/);
  assert.match(merge, /\$RUNNER_TEMP\/wiki-files\.json/);
  assert.match(merge, /persist-credentials: false/);
  assert.match(merge, /gh auth setup-git/);
  assert.match(merge, /--force-with-lease/);
  assert.match(merge, /gh pr reopen/);
  assert.match(merge, /git fetch origin "\+refs\/heads\/\$\{branch\}:refs\/remotes\/origin\/\$\{branch\}"/);
  assert.match(merge, /bot\/wiki-sync\/\$\{PR_NUMBER\}/);
  assert.doesNotMatch(merge, /bot\/wiki-sync\/pr-/);
  assert.match(collapsed, /--slurp \| jq -c 'map\(\.\[\] \| \{hash: \.sha, subject:/);
  assert.match(issue, /cron: "30 11 \* \* \*" # Daily at 11:30 UTC/);
  assert.match(issue, /workflow_dispatch: \{\}/);
  assert.match(issue, /gh pr reopen/);
  assert.match(issue, /git fetch origin "\+refs\/heads\/\$\{branch\}:refs\/remotes\/origin\/\$\{branch\}"/);
  assert.match(merge, /GRAPHIFY_SKIP_HOOK: "1"/);
  assert.match(issue, /GRAPHIFY_SKIP_HOOK: "1"/);
  assert.match(pr, /"bot\/wiki-\*\*"/);
  assert.match(pr, /!startsWith\(github\.ref_name, 'bot\/wiki-'\)/);
  for (const source of [merge, issue]) {
    assert.doesNotMatch(source, /contents: write|pull-requests: write/);
    assert.match(source, /GH_TOKEN: \$\{\{ secrets\.PR_BOT_TOKEN \}\}/);
  }
});

test("all automation uses the pinned runtime and ai-commit is the sole direct provider", () => {
  const workflows = ["quality", "commitlint", "wiki-check", "wiki-sync", "wiki-issue-sync", "pr"]
    .map((name) => read(`.github/workflows/${name}.yml`));
  for (const source of workflows) {
    assert.match(source, /node-version: "24\.14\.0"/);
    assert.match(source, /corepack prepare pnpm@10\.33\.0 --activate/);
  }
  const commitlint = workflows[1];
  assert.equal((commitlint.match(/pnpm exec commitlint --config commitlint\.config\.cjs/g) || []).length, 2);
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.devDependencies["@verndale/ai-commit"], "2.7.0");
  assert.equal(pkg.devDependencies["@commitlint/cli"], undefined);
  assert.equal(read("commitlint.config.cjs"), 'module.exports = require("@verndale/ai-commit");\n');
  assert.equal(read("pnpm-workspace.yaml"), 'publicHoistPattern:\n  - "@commitlint/cli"\n');
  assert.equal(read(".husky/commit-msg"), '#!/usr/bin/env sh\npnpm exec ai-commit lint --edit "$1"\n');
  assert.equal(pkg.scripts["wiki:check"], "node --test scripts/tests/wiki-standard.test.cjs && pnpm run graph:check");
});

test("large multi-page file and commit fixtures flatten to one valid JSON value", () => {
  const pages = Array.from({ length: 3 }, (_, page) => Array.from({ length: 125 }, (_, index) => ({ filename: `p${page}-${index}.md` })));
  const files = spawnSync("jq", ["-c", "map(.[] | .filename)"], { input: JSON.stringify(pages), encoding: "utf8" });
  assert.equal(files.status, 0, files.stderr);
  const flat = JSON.parse(files.stdout);
  assert.equal(flat.length, 375);
  assert.equal(flat.at(-1), "p2-124.md");
  const commits = spawnSync("jq", ["-c", 'map(.[] | {hash: .sha, subject: (.commit.message | split("\\n")[0])})'], {
    input: '[[{"sha":"a1","commit":{"message":"first\\nbody"}}],[{"sha":"b2","commit":{"message":"second"}}]]',
    encoding: "utf8",
  });
  assert.equal(commits.status, 0, commits.stderr);
  assert.equal(commits.stdout.trim(), '[{"hash":"a1","subject":"first"},{"hash":"b2","subject":"second"}]');
});

test("issue refresh caches repeated repository-and-number lookups", () => {
  const topics = fs.mkdtempSync(path.join(os.tmpdir(), "retro-wiki-issue-cache-"));
  const url = "https://github.com/other/repo/issues/12";
  fs.writeFileSync(path.join(topics, "a.md"), `# A\n\n## Open threads\n\n- [other/repo issue #12](${url})\n`);
  fs.writeFileSync(path.join(topics, "b.md"), `# B\n\n## Open threads\n\n- [same evidence](${url})\n`);
  const calls = [];
  const changes = refresh(topics, (number, repository) => {
    calls.push(`${repository}#${number}`);
    return "closed";
  });
  assert.deepEqual(calls, ["other/repo#12"]);
  assert.equal(changes.length, 2);
  assert.match(fs.readFileSync(path.join(topics, "a.md"), "utf8"), /— closed/);
  assert.match(fs.readFileSync(path.join(topics, "b.md"), "utf8"), /— closed/);
});

test("issue refresh closes a line only after every cited issue is confirmed closed", () => {
  const topics = fs.mkdtempSync(path.join(os.tmpdir(), "retro-wiki-multi-issue-"));
  const first = "https://github.com/verndale/project-retrospective/issues/83";
  const second = "https://github.com/other/repo/issues/12";
  fs.writeFileSync(path.join(topics, "multi.md"), `# Multi\n\n## Open threads\n\n- [first](${first}) and [second](${second})\n`);
  const calls = [];
  const partial = refresh(topics, (number, repository) => {
    calls.push(`${repository}#${number}`);
    return number === "83" ? "closed" : null;
  });
  assert.deepEqual(calls, ["verndale/project-retrospective#83", "other/repo#12"]);
  assert.equal(partial.length, 0);
  assert.doesNotMatch(fs.readFileSync(path.join(topics, "multi.md"), "utf8"), /— closed/);
  assert.equal(refresh(topics, () => "closed").length, 1);
  assert.match(fs.readFileSync(path.join(topics, "multi.md"), "utf8"), /— closed/);
  const beforeUncertain = fs.readFileSync(path.join(topics, "multi.md"), "utf8");
  assert.equal(refresh(topics, (number) => number === "83" ? "open" : null).length, 0);
  assert.equal(fs.readFileSync(path.join(topics, "multi.md"), "utf8"), beforeUncertain);
});

test("issue refresh ignores fenced citations and headings", (t) => {
  const topics = fs.mkdtempSync(path.join(os.tmpdir(), "retro-wiki-fences-"));
  t.after(() => fs.rmSync(topics, { recursive: true, force: true }));
  const file = path.join(topics, "fences.md");
  fs.writeFileSync(file, "# T\n\n## Open threads\n\n```md\n## Decisions\n- [fenced](https://github.com/other/repo/issues/90)\n```\n~~~txt\n- [fenced too](https://github.com/other/repo/issues/91)\n~~~\n````md\n```js\n## Decisions\n```\n- [still fenced](https://github.com/other/repo/issues/94)\n````\n- [live](https://github.com/other/repo/issues/92)\n## Decisions\n- [outside](https://github.com/other/repo/issues/93)\n");
  const calls = [];
  assert.equal(refresh(topics, (number) => { calls.push(number); return "closed"; }).length, 1);
  assert.deepEqual(calls, ["92"]);
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), /issues\/(?:90|91|93|94)\) — closed/);
});

test("issue refresh refuses child and wiki-root symlinks", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "retro-wiki-symlink-"));
  const external = fs.mkdtempSync(path.join(os.tmpdir(), "retro-wiki-external-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  const topics = path.join(root, "wiki", "topics");
  const externalTopics = path.join(external, "topics");
  fs.mkdirSync(topics, { recursive: true });
  fs.mkdirSync(externalTopics, { recursive: true });
  const outside = path.join(externalTopics, "outside.md");
  fs.writeFileSync(outside, "# Outside\n\n## Open threads\n\n- [issue](https://github.com/other/repo/issues/99)\n");
  fs.symlinkSync(outside, path.join(topics, "linked.md"));
  fs.symlinkSync(external, path.join(root, "linked-wiki"));
  let calls = 0;
  assert.equal(refresh(topics, () => { calls++; return "closed"; }).length, 0);
  assert.equal(refresh(path.join(root, "linked-wiki", "topics"), () => { calls++; return "closed"; }).length, 0);
  assert.equal(calls, 0);
  assert.doesNotMatch(fs.readFileSync(outside, "utf8"), /— closed/);
});

test("pre-commit graph lifecycle is contamination-safe, skippable, and fail-open", () => {
  const helper = read("scripts/graph/pre-commit.cjs");
  const hook = read(".husky/pre-commit");
  assert.match(helper, /dirtyGraphInputs/);
  assert.match(helper, /\["ls-files", "--others", "--exclude-standard"\]/);
  assert.match(helper, /GRAPHIFY_SKIP_HOOK === "1"/);
  assert.match(helper, /catch \{/);
  assert.match(hook, /node scripts\/graph\/pre-commit\.cjs \|\|/);
  assert.equal(isGraphInput("wiki/topics/demo.md"), true);
  assert.equal(isGraphInput("scripts/tests/new.test.cjs"), true);
  assert.equal(isGraphInput("scripts/graph/data/graph.json"), false);
  assert.equal(isGraphInput("scripts/tests/fixtures/demo.md"), false);
  assert.equal(normalize(".\\scripts\\graph\\build-graph.cjs"), "scripts/graph/build-graph.cjs");
});

test("AGENTS routes single-topic history through the index and only cross-page questions through the navigator", () => {
  const guide = read("AGENTS.md");
  assert.match(guide, /Single-topic rationale or history:[\s\S]*wiki\/INDEX\.md/);
  assert.match(guide, /Cross-page questions only:[\s\S]*scripts\/wiki\/navigate\.cjs/);
  assert.match(guide, /Read only the returned byte-costed itinerary/);
  assert.match(guide, /Never bulk-load the wiki or `scripts\/graph\/data\/graph\.json`/);
  assert.match(guide, /ask one focused question/);
});
