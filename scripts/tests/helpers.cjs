'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const SKILL_DIR = path.join(REPO_ROOT, 'skills/project-retrospective');
const SCRIPTS = path.join(SKILL_DIR, 'scripts');
const FIXTURES = path.join(__dirname, 'fixtures');

/** Run a skill script through the real CLI so exit codes are exercised. */
function run(script, args = []) {
  const result = spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], {
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

/** Run a script that writes JSON to stdout and parse it. */
function runJson(script, args = []) {
  const result = run(script, args);
  let json = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    /* leave null — the test asserts on status or reports the raw output */
  }
  return { ...result, json };
}

/** Copy a golden fixture tree into a temp dir so a test can mutate it. */
function tempFixture(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-test-'));
  fs.cpSync(path.join(FIXTURES, name), dir, { recursive: true });
  return dir;
}

/** Copy the golden output fixture into a temp dir so a test can mutate it. */
function tempOutput() {
  return tempFixture('fake-output');
}

function readFile(dir, rel) {
  return fs.readFileSync(path.join(dir, rel), 'utf8');
}

function writeFile(dir, rel, contents) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), contents, 'utf8');
}

module.exports = {
  REPO_ROOT,
  SKILL_DIR,
  SCRIPTS,
  FIXTURES,
  run,
  runJson,
  tempFixture,
  tempOutput,
  readFile,
  writeFile,
  fixture: (...parts) => path.join(FIXTURES, ...parts),
};
