/**
 * Run the official MCP conformance suite's applicable server scenarios against a local
 * mcp-debugger `http` server and fail on any failed check.
 *
 * The suite (`@modelcontextprotocol/conformance`, pinned) is the protocol org's own client-side
 * check of a server; each scenario cites the spec clause it covers. Most of its scenarios drive
 * the reference "everything" server's fixtures (`test_simple_text`, `test://static-text`,
 * `logging/setLevel`, …) that this server does not have, so they are not run: the list below is
 * the transport- and listing-level set that applies to any server. What the suite does NOT
 * cover — the session-lifecycle clauses this server answers with its own code — is pinned by
 * `tests/integration/cli/http-spec-contract.test.ts` instead.
 *
 * The CLI's exit code is not trusted: on Windows it aborts at exit with a libuv assertion even
 * when every check passed, so the printed `Passed: n/m, k failed` summary is what counts.
 *
 * Usage: node scripts/mcp-conformance.mjs [scenario ...]   (default: the list below)
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/is-main.mjs';

export const CONFORMANCE_CLI = '@modelcontextprotocol/conformance@0.1.16';

/** The scenarios that apply to a server without the reference fixtures (measured 2026-10-27: all pass). */
export const APPLICABLE_SCENARIOS = [
  'server-initialize',
  'ping',
  'tools-list',
  'resources-list',
  'prompts-list',
  'server-sse-multiple-streams',
  'dns-rebinding-protection',
];

/** Parse the CLI's summary line into counts; undefined when the output has none. */
export function parseSummary(output) {
  const match = /Passed:\s*(\d+)\/(\d+),\s*(\d+)\s+failed/.exec(output);
  if (!match) return undefined;
  return { passed: Number(match[1]), total: Number(match[2]), failed: Number(match[3]) };
}

/** A scenario's verdict from its output: pass needs a summary with at least one check and none failed. */
export function judgeScenario(name, output) {
  const summary = parseSummary(output);
  if (!summary) return { name, ok: false, reason: 'no summary line in the CLI output' };
  if (summary.failed > 0) return { name, ok: false, reason: `${summary.failed} failed check(s)`, summary };
  if (summary.total === 0) return { name, ok: false, reason: 'the scenario ran no checks', summary };
  return { name, ok: true, summary };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return true;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

/** Every argument the CLI is given is one of ours (a package spec, a loopback URL, a scenario name). */
const SAFE_ARGUMENT = /^[A-Za-z0-9@./:_-]+$/;

function runCli(args, cwd) {
  return new Promise((resolve) => {
    const argv = ['--yes', CONFORMANCE_CLI, ...args];
    const unsafe = argv.find((arg) => !SAFE_ARGUMENT.test(arg));
    if (unsafe !== undefined) throw new Error(`refusing to pass "${unsafe}" to the conformance CLI`);
    // Windows: `npx` is a .cmd shim, which Node spawns only through a shell. The argv is checked
    // above, so one command string (no args array) keeps the shell out of DEP0190's warning.
    const child = process.platform === 'win32'
      ? spawn(['npx', ...argv].join(' '), { cwd, shell: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      : spawn('npx', argv, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('close', () => resolve(output));
    child.on('error', (error) => resolve(`${output}\n${error.message}`));
  });
}

export async function runConformance(options = {}) {
  const root = options.root ?? fileURLToPath(new URL('../', import.meta.url));
  const entry = path.join(root, 'dist', 'index.js');
  if (!existsSync(entry)) throw new Error(`${entry} not found: run the build first`);
  const scenarios = options.scenarios?.length ? options.scenarios : APPLICABLE_SCENARIOS;
  const log = options.log ?? console.log;

  const port = await freePort();
  const server = spawn(process.execPath, [entry, 'http', '-p', String(port)], {
    cwd: root,
    env: { ...process.env, MCP_SKIP_ORPHAN_REAPERS: '1' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverOutput = '';
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

  try {
    if (!(await waitForHealth(port, 20_000))) {
      throw new Error(`the server never answered /health on port ${port}:\n${serverOutput}`);
    }
    const verdicts = [];
    for (const name of scenarios) {
      const output = await runCli(['server', '--url', `http://127.0.0.1:${port}/mcp`, '--scenario', name], root);
      const verdict = judgeScenario(name, output);
      verdicts.push(verdict);
      const counts = verdict.summary ? `${verdict.summary.passed}/${verdict.summary.total}` : '-';
      log(`${verdict.ok ? 'ok  ' : 'FAIL'} ${name.padEnd(30)} ${counts}${verdict.ok ? '' : `  (${verdict.reason})`}`);
      if (!verdict.ok && options.verbose) log(output);
    }
    return verdicts;
  } finally {
    server.kill();
  }
}

if (isMain(import.meta.url)) {
  const verbose = process.argv.includes('--verbose');
  const scenarios = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  runConformance({ scenarios, verbose })
    .then((verdicts) => {
      const failed = verdicts.filter((verdict) => !verdict.ok);
      if (failed.length) {
        console.error(`MCP conformance: ${failed.length} of ${verdicts.length} scenario(s) failed`);
        process.exitCode = 1;
      } else {
        console.log(`MCP conformance: ${verdicts.length} scenario(s) passed against ${CONFORMANCE_CLI}`);
      }
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
