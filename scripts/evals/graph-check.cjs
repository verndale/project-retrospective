#!/usr/bin/env node
"use strict";

// Freshness + integrity check for the committed knowledge graph artifacts
// (scripts/graph/data/graph.json plus the connections pages — wiki/connections.md and the
// per-section files under wiki/connections/, all written by scripts/graph/build-graph.cjs).
//
//  - Freshness: a rebuild serializes byte-identically to each committed file, so none
//    drifts from current repo state. Fails with the fix command if stale.
//  - Determinism: two rebuilds are byte-identical (no timestamp / ordering drift).
//  - Integrity: every edge endpoint resolves to a node.
//  - No orphans: every wiki/connections/*.md on disk is still produced by the render.
//
// The pre-commit hook auto-rebuilds + stages all of them; this is the CI backstop for
// commits made with --no-verify or edits that landed out of band.

const fs = require("fs");
const path = require("path");
const { build, render, renderConnections, danglingEdges, OUT_FILE, REPO_ROOT, CONNECTIONS_DIR_ID } = require("../graph/build-graph.cjs");
const { loadPolicy, policyProblems } = require("../graph/routing.cjs");

function run() {
  const results = [];
  const check = (label, ok, details = []) => results.push({ label, ok, details });

  const exists = fs.existsSync(OUT_FILE);
  check("committed graph.json exists", exists, exists ? [] : ["run `pnpm graph:build` and commit scripts/graph/data/graph.json"]);

  if (exists) {
    const committed = fs.readFileSync(OUT_FILE, "utf8");
    const fresh = render(build());
    check(
      "committed graph.json matches a fresh rebuild (no drift)",
      committed === fresh,
      committed === fresh ? [] : ["graph.json is stale — run `pnpm graph:build` and commit the result"],
    );
    check("two rebuilds are byte-identical (deterministic)", fresh === render(build()));

    // Connections pages: the index (wiki/connections.md) + the section files under
    // wiki/connections/. renderConnections() returns a { relPath: content } map.
    const freshConn = renderConnections(build());
    const relPaths = Object.keys(freshConn).sort();
    for (const relPath of relPaths) {
      const abs = path.join(REPO_ROOT, relPath);
      const connExists = fs.existsSync(abs);
      check(`committed ${relPath} exists`, connExists, connExists ? [] : [`run \`pnpm graph:build\` and commit ${relPath}`]);
      if (connExists) {
        const committedConn = fs.readFileSync(abs, "utf8");
        check(
          `committed ${relPath} matches a fresh rebuild (no drift)`,
          committedConn === freshConn[relPath],
          committedConn === freshConn[relPath] ? [] : [`${relPath} is stale — run \`pnpm graph:build\` and commit the result`],
        );
      }
    }
    check(
      "two connections renders are byte-identical (deterministic)",
      JSON.stringify(freshConn) === JSON.stringify(renderConnections(build())),
    );

    // No orphans: a section file left on disk that the render no longer produces.
    const connDir = path.join(REPO_ROOT, CONNECTIONS_DIR_ID);
    const onDisk = fs.existsSync(connDir)
      ? fs.readdirSync(connDir).filter((f) => f.endsWith(".md")).map((f) => `${CONNECTIONS_DIR_ID}/${f}`)
      : [];
    const generated = new Set(relPaths);
    const orphans = onDisk.filter((p) => !generated.has(p));
    check(
      "no orphan connections section files",
      orphans.length === 0,
      orphans.map((p) => `${p} is no longer produced by the render — delete it, then run \`pnpm graph:build\``),
    );

    const graph = build();
    let policy;
    try {
      policy = loadPolicy();
      check("routing policy covers the graph's edge and node types", policyProblems(policy, graph).length === 0, policyProblems(policy, graph));
    } catch (error) {
      check("routing policy parses", false, [error.message]);
    }
    const dangling = danglingEdges(graph);
    check(
      "no edges with unresolved endpoints",
      dangling.length === 0,
      dangling.slice(0, 5).map((d) => `${d.type} ${d.source} -> ${d.target}`),
    );
  }

  console.log("Knowledge graph freshness check");
  for (const r of results) {
    if (r.ok) console.log(`PASS ${r.label}`);
    else {
      console.log(`FAIL ${r.label}`);
      for (const line of r.details) console.log(`  - ${line}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`\nFAIL Knowledge graph freshness check (${failed.length}/${results.length}).`);
    process.exit(1);
  }
  console.log(`\nPASS Knowledge graph freshness check (${results.length} cases).`);
}

// Guarded: this module both runs the check and is requireable. Without the guard, a test
// that requires it would execute six graph builds at import time and could process.exit(1)
// mid-suite, reporting a failure nowhere near its cause.
if (require.main === module) run();

module.exports = { run };
