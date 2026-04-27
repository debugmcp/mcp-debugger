#!/usr/bin/env node

/**
 * Builds the @debugmcp/mcp-debugger npm package and writes it to a stable
 * path (`dist-tarball/mcp-debugger-latest.tgz`) so MCP server configs can
 * reference the tarball without version hardcoding.
 *
 * Pipeline: pnpm install -> npm run build -> npm run build:packages ->
 *           npm pack into dist-tarball/ -> rename newest .tgz to
 *           mcp-debugger-latest.tgz.
 *
 * Invoked as the `DEV_PROXY_BUILD_CMD` for mcp-debugger-npx and
 * mcp-debugger-npx-stdio, so it runs under dev-proxy's 120 s build timeout.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TARBALL_DIR = path.join(REPO_ROOT, 'dist-tarball');
const STABLE_NAME = 'mcp-debugger-latest.tgz';
const PKG_DIR = path.join(REPO_ROOT, 'packages', 'mcp-debugger');

function run(cmd, args, opts = {}) {
  process.stderr.write(`[build-npx-tarball] ${cmd} ${args.join(' ')}\n`);
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd: REPO_ROOT,
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(typeof result.status === 'number' ? result.status : 1);
  }
}

fs.mkdirSync(TARBALL_DIR, { recursive: true });

run('pnpm', ['install', '--frozen-lockfile=false']);
run('npm', ['run', 'build']);
run('npm', ['run', 'build:packages']);
run('npm', ['pack', '--pack-destination', TARBALL_DIR], { cwd: PKG_DIR });

const candidates = fs
  .readdirSync(TARBALL_DIR)
  .filter((f) => f.startsWith('debugmcp-mcp-debugger-') && f.endsWith('.tgz'))
  .map((f) => ({ f, mtime: fs.statSync(path.join(TARBALL_DIR, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

if (candidates.length === 0) {
  process.stderr.write('[build-npx-tarball] no tarball produced by npm pack\n');
  process.exit(1);
}

const newest = candidates[0].f;
const src = path.join(TARBALL_DIR, newest);
const dst = path.join(TARBALL_DIR, STABLE_NAME);

fs.copyFileSync(src, dst);

for (const { f } of candidates) {
  if (f !== STABLE_NAME) {
    fs.unlinkSync(path.join(TARBALL_DIR, f));
  }
}

// Extract for direct node invocation (avoids npx TTY detection issues in dev-proxy)
const extractDir = path.join(TARBALL_DIR, 'extracted');
if (fs.existsSync(extractDir)) {
  fs.rmSync(extractDir, { recursive: true });
}
fs.mkdirSync(extractDir, { recursive: true });
run('tar', ['-xzf', path.join('..', STABLE_NAME)], { cwd: extractDir });

process.stdout.write(`${dst}\n`);
