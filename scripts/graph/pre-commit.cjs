#!/usr/bin/env node
"use strict";

// Keep the curated graph in sync without letting unstaged or untracked inputs
// leak into a commit. The lifecycle is fail-open; graph:check is the blocking,
// non-mutating freshness backstop.

const { execFileSync } = require("node:child_process");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const GENERATED = new Set([
  "scripts/graph/data/graph.json",
  "wiki/connections.md",
]);
const ROOT_DOCS = new Set(["AGENTS.md", "CLAUDE.md", "CONTRIBUTING.md", "README.md"]);

function normalize(file) {
  return file.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isGraphInput(file) {
  const value = normalize(file);
  if (!value || GENERATED.has(value) || value.startsWith("wiki/connections/")) return false;
  if (ROOT_DOCS.has(value)) return true;
  if (value.startsWith("wiki/") && value.endsWith(".md")) return true;
  if (value.startsWith("skills/") && /\.(?:cjs|md)$/.test(value)) return true;
  return value.startsWith("scripts/") &&
    !value.startsWith("scripts/tests/fixtures/") &&
    /\.(?:cjs|md)$/.test(value);
}

function gitPaths(args, exec = execFileSync) {
  const output = exec("git", [...args, "-z"], {
    cwd: REPO_ROOT,
    encoding: "buffer",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return output.toString("utf8").split("\0").filter(Boolean);
}

function dirtyGraphInputs(exec = execFileSync) {
  const unstaged = gitPaths(["diff", "--name-only", "--diff-filter=ACMRD"], exec);
  const untracked = gitPaths(["ls-files", "--others", "--exclude-standard"], exec);
  return [...new Set([...unstaged, ...untracked].map(normalize).filter(isGraphInput))].sort();
}

function main() {
  if (process.env.CI || process.env.GRAPHIFY_SKIP_HOOK === "1") return 0;
  try {
    const dirty = dirtyGraphInputs();
    if (dirty.length) {
      console.warn(
        "warning: knowledge graph rebuild skipped because graph inputs have unstaged or untracked changes:\n" +
        dirty.slice(0, 8).map((file) => `  - ${file}`).join("\n") +
        (dirty.length > 8 ? `\n  - … ${dirty.length - 8} more` : "") +
        "\nStage or stash those inputs, then run pnpm graph:build.",
      );
      return 0;
    }
    execFileSync("node", ["scripts/graph/build-graph.cjs"], { cwd: REPO_ROOT, stdio: "ignore" });
    execFileSync("git", ["add", "--", "scripts/graph/data/graph.json", "wiki/connections.md", "wiki/connections"], {
      cwd: REPO_ROOT,
      stdio: "ignore",
    });
  } catch {
    console.warn("warning: knowledge graph rebuild failed; committed graph may be stale (run pnpm graph:build)");
  }
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = { dirtyGraphInputs, isGraphInput, main, normalize };
