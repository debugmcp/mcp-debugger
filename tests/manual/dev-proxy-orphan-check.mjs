#!/usr/bin/env node
/**
 * Manual verification for issue #122 (PR-1): dev-proxy must exit — and kill its
 * backend child — when its MCP client disappears (stdin EOF).
 *
 * For each backend transport mode this script:
 *   1. Spawns tools/dev-proxy/dev-proxy.mjs with piped stdio (like Claude Code does)
 *   2. Waits for "Backend running (PID=...)" on the proxy's stderr
 *   3. Closes the proxy's stdin — simulating the MCP client dying
 *   4. Asserts the proxy exits (code 0) within PROXY_EXIT_BUDGET_MS
 *   5. Asserts the backend PID is gone within BACKEND_EXIT_BUDGET_MS
 *
 * Usage (requires a built dist/ — run `npm run build` first):
 *   node tests/manual/dev-proxy-orphan-check.mjs           # both modes
 *   node tests/manual/dev-proxy-orphan-check.mjs http
 *   node tests/manual/dev-proxy-orphan-check.mjs stdio
 *
 * Uses port 3947 (not the default 3001) so a developer's real dev-proxy backend
 * is never touched — dev-proxy's _ensurePortFree() kills whatever node process
 * holds its configured port.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DEV_PROXY = path.join(ROOT, 'tools', 'dev-proxy', 'dev-proxy.mjs');

const TEST_PORT = '3947';
const STARTUP_BUDGET_MS = 60000;
const PROXY_EXIT_BUDGET_MS = 15000;
const BACKEND_EXIT_BUDGET_MS = 15000;
const POLL_INTERVAL_MS = 100;

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runMode(mode) {
  console.log(`\n=== Mode: ${mode} ===`);

  const child = spawn(process.execPath, [DEV_PROXY], {
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DEV_PROXY_BACKEND_TRANSPORT: mode,
      DEV_PROXY_PORT: TEST_PORT,
      DEV_PROXY_ROOT: ROOT,
    },
  });

  let stderrBuf = '';
  child.stderr.on('data', (d) => {
    stderrBuf += d.toString();
  });
  child.stdout.on('data', () => {}); // drain; MCP JSON-RPC channel is unused here

  const exitInfo = new Promise((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal, at: Date.now() }));
  });

  // 1. Wait for the backend to come up and capture its PID
  let backendPid = null;
  const startupDeadline = Date.now() + STARTUP_BUDGET_MS;
  while (Date.now() < startupDeadline) {
    const match = stderrBuf.match(/Backend running \(PID=(\d+)/);
    if (match) {
      backendPid = parseInt(match[1], 10);
      break;
    }
    if (child.exitCode !== null) break;
    await sleep(POLL_INTERVAL_MS);
  }

  if (!backendPid) {
    console.error(`FAIL(${mode}): backend never came up. Proxy stderr:\n${stderrBuf}`);
    try {
      child.kill();
    } catch {
      /* already gone */
    }
    return false;
  }
  console.log(`Backend up (PID=${backendPid}); proxy PID=${child.pid}`);

  // 2. Simulate the MCP client (Claude Code) dying: close the proxy's stdin
  const t0 = Date.now();
  child.stdin.end();

  // 3. Proxy must exit within budget
  const proxyResult = await Promise.race([
    exitInfo,
    sleep(PROXY_EXIT_BUDGET_MS).then(() => null),
  ]);
  if (!proxyResult) {
    console.error(`FAIL(${mode}): proxy still alive ${PROXY_EXIT_BUDGET_MS}ms after stdin close`);
    console.error(`Proxy stderr:\n${stderrBuf}`);
    try {
      child.kill();
    } catch {
      /* already gone */
    }
    if (pidAlive(backendPid)) process.kill(backendPid);
    return false;
  }
  const proxyExitMs = proxyResult.at - t0;
  console.log(
    `Proxy exited in ${proxyExitMs}ms (code=${proxyResult.code}, signal=${proxyResult.signal})`
  );

  // 4. Backend must be gone within budget
  let backendExitMs = null;
  const backendDeadline = t0 + BACKEND_EXIT_BUDGET_MS;
  while (Date.now() < backendDeadline) {
    if (!pidAlive(backendPid)) {
      backendExitMs = Date.now() - t0;
      break;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  if (backendExitMs === null) {
    console.error(
      `FAIL(${mode}): backend PID ${backendPid} still alive ${BACKEND_EXIT_BUDGET_MS}ms after stdin close`
    );
    process.kill(backendPid);
    return false;
  }
  console.log(`Backend gone within ${backendExitMs}ms of stdin close`);

  const codeOk = proxyResult.code === 0;
  if (!codeOk) {
    console.error(`FAIL(${mode}): proxy exit code was ${proxyResult.code}, expected 0`);
    return false;
  }

  console.log(`PASS(${mode}): proxy exit ${proxyExitMs}ms, backend reaped ${backendExitMs}ms`);
  return true;
}

const arg = process.argv[2];
const modes = arg ? [arg] : ['http', 'stdio'];
let allPassed = true;
for (const mode of modes) {
  if (!(await runMode(mode))) allPassed = false;
}
console.log(allPassed ? '\nALL PASSED' : '\nFAILURES — see above');
process.exit(allPassed ? 0 : 1);
