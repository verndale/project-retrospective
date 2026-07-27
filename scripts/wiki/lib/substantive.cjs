#!/usr/bin/env node
"use strict";

// Classifies a set of changed repo paths for the wiki automation: is the change
// "substantive" (worth a journal entry), and which wiki topic slug(s) does it
// touch? Both are deliberately best-effort heuristics — a missed topic is a
// small cost, and the journal warn is non-blocking. Topic slugs match the pages
// under wiki/topics/.

// A path is substantive when it changes what the repo ships or how it is built:
// the skill (SKILL.md, its references, its scripts), the authoring spec that governs
// them, the tests that are the skill's fourth surface, or the graph/wiki tooling
// (graph builder, collectors, freshness gate, workflows, hooks).
//
// scripts/tests/ counts here where it did not in the donor repo: AGENTS.md makes the
// test one of the four surfaces that move together, so a test-only change is worth a
// journal entry.
const SUBSTANTIVE_RE = [
  /^skills\//,
  /^scripts\/(?:graph|wiki|evals|tests)\//,
  /^\.github\/workflows\//,
  /^\.husky\//,
];

// wiki/ edits are never substantive — this is what stops a wiki-sync bot PR from
// triggering another round of capture.
//
// scripts/graph/data/ is never substantive either, and that exclusion is load-bearing:
// .husky/pre-commit rebuilds and stages graph.json on every commit, so without this the
// generated artifact would match SUBSTANTIVE_RE above and every single PR would be
// flagged as needing a journal entry.
const NEVER_RE = [/^wiki\//, /^scripts\/graph\/data\//];

// Ordered path → topic-slug guesses. First match wins per path; a path may be
// substantive without matching any topic (topics is best-effort). Every slug named here
// must have a wiki/topics/<slug>.md page — on-merge-sync.cjs writes these straight into
// a journal entry's `topics:` frontmatter, and the graph's topic edge resolves them.
const TOPIC_RE = [
  [/^skills\/project-retrospective\/references\/brain-integrity-checklist\.md$/, "brain-promotion"],
  [/^skills\/project-retrospective\//, "retrospective-workflow"],
  [/^skills\/_meta\//, "skill-authoring"],
  [/^scripts\/tests\//, "retrospective-workflow"],
  [/^scripts\/(?:graph|wiki|evals)\//, "graph-wiki-subsystem"],
  [/^\.github\/workflows\/(?:wiki|test)/, "graph-wiki-subsystem"],
  [/^\.husky\//, "graph-wiki-subsystem"],
];

function classify(paths) {
  const changed = (paths || []).map((p) => String(p).trim()).filter(Boolean);
  const relevant = changed.filter((p) => !NEVER_RE.some((re) => re.test(p)));
  const substantivePaths = relevant.filter((p) => SUBSTANTIVE_RE.some((re) => re.test(p)));
  const topics = [];
  for (const p of substantivePaths) {
    for (const [re, slug] of TOPIC_RE) {
      if (re.test(p)) {
        if (!topics.includes(slug)) topics.push(slug);
        break;
      }
    }
  }
  return { substantive: substantivePaths.length > 0, substantivePaths, topics };
}

module.exports = { classify, SUBSTANTIVE_RE, NEVER_RE, TOPIC_RE };
