/**
 * Run the official MCP conformance suite's applicable server scenarios against a local
 * mcp-debugger `http` server and fail on any failed check.
 *
 * The suite (`@modelcontextprotocol/conformance`, pinned) is the protocol org's own client-side
 * check of a server; each scenario cites the spec clause it covers. It is built to test SDKs
 * against a reference "everything" server, so most of its scenarios drive that server's
 * fixtures (`test_simple_text`, `test://static-text`, `logging/setLevel`, …), which this server
 * does not have.
 *
 * Two lanes:
 *
 * - The 2025-11-25 lane (the default) runs the list below — the transport- and listing-level
 *   scenarios that apply to any server — one `--scenario` at a time on the 0.1 line, and reads
 *   each scenario's printed `Passed: n/m, k failed` summary. What the suite does NOT cover — the
 *   session-lifecycle clauses this server answers with its own code — is pinned by
 *   `tests/integration/cli/http-spec-contract.test.ts` instead.
 * - The 2026-07-28 lane (`--era 2026-07-28`; issue #1025, step 2) runs everything the revision
 *   requires of a server (`--requirements 2026-07-28`) on the suite's 0.2 line, which the SDKs
 *   themselves run, and lets the suite judge it: the suite reads the baseline
 *   (`scripts/conformance/expected-failures-2026-07-28.yaml`, the scenarios and checks that
 *   cannot be tested without its reference fixtures) with `--expected-failures`, fails on a
 *   failure or warning that is not listed and on a listed entry that passes, and its exit code
 *   is the verdict. This script adds no judging of its own.
 *
 * One exception to trusting an exit code, on both lanes: Node 23 to 24.19 and 26.0 to 26.6 abort
 * inside `process.exit` on Windows with a libuv assertion (nodejs/node#56645, fixed in 24.20.0
 * and 26.7.0), after the suite has printed everything. CI runs Linux and never sees it. On an
 * affected Windows Node the 2025 lane's printed summary already is the verdict, and the 2026
 * lane reads the suite's own closing line ("Baseline check passed: …") — only when that
 * assertion is in the output.
 *
 * Usage: node scripts/mcp-conformance.mjs [scenario ...]   (default: the list below)
 *        node scripts/mcp-conformance.mjs --era 2026-07-28 [--verbose]
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/is-main.mjs';

export const CONFORMANCE_CLI = '@modelcontextprotocol/conformance@0.1.16';
/** The 0.2 line, where the 2026-07-28 scenarios live; pinned to an exact prerelease. */
export const CONFORMANCE_CLI_2026 = '@modelcontextprotocol/conformance@0.2.0-alpha.12';
export const REQUIREMENTS_2026 = '2026-07-28';

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

/** The arguments of a `--requirements` run judged against the baseline; the path is relative to the repository root. */
export function requirementsArgs(revision, port) {
  return [
    'server',
    '--url', `http://127.0.0.1:${port}/mcp`,
    '--requirements', revision,
    '--expected-failures', `scripts/conformance/expected-failures-${revision}.yaml`,
  ];
}

/** The suite's closing line when every failure and warning is in the baseline and no entry is stale. */
const BASELINE_PASSED = 'Baseline check passed: all failures are expected.';
/** Node's abort inside process.exit on Windows (nodejs/node#56645; fixed in 24.20.0 and 26.7.0). */
const EXIT_ABORT = /Assertion failed: !\(handle->flags & UV_HANDLE_CLOSING\)/;

/**
 * What the suite said was wrong, in its own words: from its first finding list (stale entries,
 * unexpected failures) to the end, colour stripped; the tail of the output when it never got
 * that far.
 */
export function baselineReport(output) {
  // eslint-disable-next-line no-control-regex -- stripping the CLI's ANSI colour codes
  const text = output.replace(/\u001b\[[0-9;]*m/g, '');
  const at = text.search(/^(Stale baseline entries|Unexpected failures \(not in baseline\))/m);
  return (at >= 0 ? text.slice(at) : text.split(/\r?\n/).slice(-40).join('\n')).trim();
}

/**
 * The verdict of a `--requirements … --expected-failures` run: the suite's exit code. Only when
 * the process died of Node's Windows exit abort — after the suite printed everything — is the
 * suite's own closing line read instead.
 */
export function judgeBaselineRun({ code, output }) {
  const abortedAtExit = code !== 0 && EXIT_ABORT.test(output);
  const ok = code === 0 || (abortedAtExit && output.includes(BASELINE_PASSED));
  return { ok, abortedAtExit, report: ok ? '' : baselineReport(output) };
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

/** Every argument the CLI is given is one of ours (a package spec, a loopback URL, a scenario name, a repository-relative path). */
const SAFE_ARGUMENT = /^[A-Za-z0-9@./:_\\-]+$/;

function runCli(args, cwd, cli = CONFORMANCE_CLI) {
  return new Promise((resolve) => {
    const argv = ['--yes', cli, ...args];
    const unsafe = argv.find((arg) => !SAFE_ARGUMENT.test(arg));
    if (unsafe !== undefined) throw new Error(`refusing to pass "${unsafe}" to the conformance CLI`);
    // Windows: `npx` is a .cmd shim, which Node spawns only through a shell. The argv is checked
    // above, so one command string (no args array) keeps the shell out of DEP0190's warning.
    // No colour: the summary line is parsed, and FORCE_COLOR would wrap it in escapes.
    const env = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };
    const child = process.platform === 'win32'
      ? spawn(['npx', ...argv].join(' '), { cwd, env, shell: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      : spawn('npx', argv, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('close', (code) => resolve({ output, code }));
    child.on('error', (error) => resolve({ output: `${output}\n${error.message}`, code: null }));
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
      const { output } = await runCli(['server', '--url', `http://127.0.0.1:${port}/mcp`, '--scenario', name], root);
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

/**
 * The 2026-07-28 lane: one `--requirements` run of the 0.2 CLI against a local `http` server,
 * judged by the suite against the baseline. Answers `{ ok, abortedAtExit, report, output }`.
 */
export async function runRequirements(options = {}) {
  const root = options.root ?? fileURLToPath(new URL('../', import.meta.url));
  const entry = path.join(root, 'dist', 'index.js');
  if (!existsSync(entry)) throw new Error(`${entry} not found: run the build first`);
  const revision = options.revision ?? REQUIREMENTS_2026;
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
    // cwd is the repository root, so the baseline's relative path resolves and no temp or
    // home path — which may hold a space — ever reaches the shell.
    const { output, code } = await runCli(requirementsArgs(revision, port), root, CONFORMANCE_CLI_2026);
    const verdict = judgeBaselineRun({ code, output });
    if (options.verbose) log(output);
    else if (!verdict.ok) log(verdict.report);
    return { ...verdict, output };
  } finally {
    server.kill();
  }
}

if (isMain(import.meta.url)) {
  const verbose = process.argv.includes('--verbose');
  const eraIndex = process.argv.indexOf('--era');
  if (eraIndex !== -1) {
    const revision = process.argv[eraIndex + 1];
    runRequirements({ revision, verbose })
      .then(({ ok, abortedAtExit }) => {
        const how = abortedAtExit
          ? ' (read from the suite\'s closing line: this Node build aborts at exit on Windows — nodejs/node#56645, fixed in 24.20.0 and 26.7.0)'
          : '';
        if (ok) {
          console.log(`MCP conformance ${revision}: the suite's baseline check passed against ${CONFORMANCE_CLI_2026}${how}`);
        } else {
          console.error(`MCP conformance ${revision}: the suite's baseline check failed against ${CONFORMANCE_CLI_2026}${how}`);
          process.exitCode = 1;
        }
      })
      .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      });
  } else {
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
}
