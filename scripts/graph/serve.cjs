#!/usr/bin/env node
"use strict";

// Minimal zero-dependency static file server for the knowledge-graph viewer.
// The viewer fetch()es data/graph.json, and browsers block fetch over file://
// (CORS), so `pnpm graph:view` serves this folder over localhost instead. It
// serves only scripts/graph/ and nothing above it (path traversal is rejected).

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
// 4175, not 4173 or 4174: ui-design-brain's viewer owns 4173 and ui-design-evidence's
// owns 4174, and tracing a label from a retrospective run through to its catalog entry
// means having all three open at once.
const PORT = Number(process.env.GRAPH_PORT) || 4175;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function resolveSafe(urlPath) {
  let clean;
  try {
    clean = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null; // malformed percent-encoding → treat as a bad request
  }
  const relPath = clean === "/" ? "viewer/index.html" : clean.replace(/^\/+/, "");
  const abs = path.join(ROOT, relPath);
  // Reject anything that escapes ROOT.
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  return abs;
}

const server = http.createServer((req, res) => {
  const abs = resolveSafe(req.url);
  if (!abs) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  fs.readFile(abs, (err, buf) => {
    if (err) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(abs)] || "application/octet-stream" });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  if (!fs.existsSync(path.join(ROOT, "data", "graph.json"))) {
    console.log("Note: data/graph.json not found — run `pnpm graph:build` first.\n");
  }
  console.log(`Knowledge graph viewer → http://localhost:${PORT}`);
  console.log("Press Ctrl+C to stop.");
});
