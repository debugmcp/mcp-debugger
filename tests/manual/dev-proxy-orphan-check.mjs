#!/usr/bin/env node
/**
 * Manual verification for issue #122: no tier of the dev-proxy process tree
 * may outlive its parent.
 *
 * Two scenarios per backend transport mode:
 *
 * Scenario "eof" (PR-1 — clean client disconnect):
 *   1. Spawn tools/dev-proxy/dev-proxy.mjs with piped stdio (like Claude Code does)
 *   2. Wait for "Backend running (PID=...)" on the proxy's stderr
 *   3. Close the proxy's stdin — simulating the MCP client dying
 *   4. Assert the proxy exits (code 0) within PROXY_EXIT_BUDGET_MS
 *   5. Assert the backend PID is gone within BACKEND_EXIT_BUDGET_MS
 *
 * Scenario "kill" (PR-3 — supervisor hard-killed, orphan self-defense):
 *   1-2. As above
 *   3. SIGKILL the dev-proxy itself (TerminateProcess on Windows ≈ taskkill /F)
 *   4. Assert the backend notices its dead parent (stdin pipe EOF) and
 *      self-exits within BACKEND_EXIT_BUDGET_MS
 *
 * Usage (requires a built dist/ — run `npm run build` first):
 *   node tests/manual/dev-proxy-orphan-check.mjs                    # all modes+scenarios
 *   node tests/manual/dev-proxy-orphan-check.mjs http               # one mode, both scenarios
 *   node tests/manual/dev-proxy-orphan-check.mjs stdio kill         # one mode, one scenario
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

async function runScenario(mode, scenario) {
  console.log(`\n=== Mode: ${mode}, scenario: ${scenario} ===`);

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

  const fail = (msg, backendPid = null) => {
    console.error(`FAIL(${mode}/${scenario}): ${msg}`);
    console.error(`Proxy stderr:\n${stderrBuf}`);
    try {
      child.kill('SIGKILL');
    } catch {
      /* already gone */
    }
    if (backendPid && pidAlive(backendPid)) {
      try {
        process.kill(backendPid);
      } catch {
        /* already gone */
      }
    }
    return false;
  };

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
    return fail('backend never came up');
  }
  console.log(`Backend up (PID=${backendPid}); proxy PID=${child.pid}`);

  // 2. Trigger the scenario
  const t0 = Date.now();
  if (scenario === 'eof') {
    child.stdin.end(); // MCP client disconnected cleanly
  } else {
    child.kill('SIGKILL'); // supervisor hard-killed (TerminateProcess on Windows)
  }

  // 3. eof only: the proxy itself must exit promptly with code 0
  if (scenario === 'eof') {
    const proxyResult = await Promise.race([
      exitInfo,
      sleep(PROXY_EXIT_BUDGET_MS).then(() => null),
    ]);
    if (!proxyResult) {
      return fail(`proxy still alive ${PROXY_EXIT_BUDGET_MS}ms after stdin close`, backendPid);
    }
    if (proxyResult.code !== 0) {
      return fail(`proxy exit code was ${proxyResult.code}, expected 0`, backendPid);
    }
    console.log(
      `Proxy exited in ${proxyResult.at - t0}ms (code=${proxyResult.code}, signal=${proxyResult.signal})`
    );
  } else {
    await exitInfo; // killed — just wait for the OS to reap it
    console.log('Proxy hard-killed');
  }

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
      `FAIL(${mode}/${scenario}): backend PID ${backendPid} still alive ${BACKEND_EXIT_BUDGET_MS}ms after trigger`
    );
    try {
      process.kill(backendPid);
    } catch {
      /* already gone */
    }
    return false;
  }
  console.log(`Backend gone within ${backendExitMs}ms of trigger`);
  console.log(`PASS(${mode}/${scenario}): backend reaped in ${backendExitMs}ms`);
  return true;
}

const modeArg = process.argv[2];
const scenarioArg = process.argv[3];
const modes = modeArg ? [modeArg] : ['http', 'stdio'];
const scenarios = scenarioArg ? [scenarioArg] : ['eof', 'kill'];

let allPassed = true;
for (const mode of modes) {
  for (const scenario of scenarios) {
    if (!(await runScenario(mode, scenario))) allPassed = false;
  }
}
console.log(allPassed ? '\nALL PASSED' : '\nFAILURES — see above');
process.exit(allPassed ? 0 : 1);
