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
 * The 2026-07-28 era (issue #1025, step 2) is a second lane on the suite's 0.2 line, which the
 * SDKs themselves run: `--era 2026-07-28` runs `--requirements 2026-07-28` — everything the
 * revision requires of a server — under an expected-failures baseline
 * (`scripts/conformance/expected-failures-2026-07-28.yaml`) that names each scenario, or
 * scenario:check, that needs one of the suite's reference fixtures. An unlisted failure fails the
 * lane; so does a listed entry that passes (a stale baseline), so the baseline only shrinks
 * honestly. The verdict is read from the CLI's own per-scenario summary lines and the
 * `checks.json` it writes per scenario (`--output-dir`), never from its exit code, and the two
 * are reconciled: a scenario's failed count must equal the FAILURE rows its checks.json names, a
 * summary line the parser cannot read is a failure, and the header's scenario count must match
 * the lines reported. Measured 2026-11-10 against 0.2.0-alpha.12: the alpha's `tools-list`
 * (on the v1 SDK) runs its four checks against this server's 2026-07-28 leg and passes them.
 *
 * Usage: node scripts/mcp-conformance.mjs [scenario ...]   (default: the list below)
 *        node scripts/mcp-conformance.mjs --era 2026-07-28 [--verbose]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
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

/**
 * The per-scenario verdict lines of a `--requirements` run (`✓ name: n passed, m failed`), and
 * the scenarios the revision lists as not scored (the CLI prints them after the total; they do
 * not affect conformance). Undefined when the output has no summary.
 */
export function parseRequirementsSummary(output) {
  const scenarios = [];
  // A verdict line the parser cannot read is kept, not dropped: the judge fails on it.
  const unparsed = [];
  const verdict = /^[✓✗]\s+([^\s:]+):\s+(\d+)\s+passed,\s+(\d+)\s+failed\s*$/;
  // The summary block runs from the banner to the Total line; the not-scored list after it is indented.
  const lines = output.split(/\r?\n/);
  const banner = lines.findIndex((text) => /^=== SUMMARY ===/.test(text));
  for (const raw of lines.slice(banner === -1 ? 0 : banner + 1)) {
    if (/^Total:/.test(raw)) break;
    if (!/^[✓✗]/.test(raw)) continue;
    const match = verdict.exec(raw);
    if (match) scenarios.push({ name: match[1], passed: Number(match[2]), failed: Number(match[3]) });
    else unparsed.push(raw.trimEnd());
  }
  if (scenarios.length === 0 && unparsed.length === 0) return undefined;
  // `Running requirements 2026-07-28 (50 scenarios) against …`: what the run set out to report.
  const announcedMatch = /^Running requirements \S+ \((\d+) scenarios?\)/m.exec(output);
  const announced = announcedMatch ? Number(announcedMatch[1]) : undefined;
  const notScored = new Set();
  const notScoredBlock = output.split(/^Not scored for [^\n]*$/m)[1];
  if (notScoredBlock) {
    for (const match of notScoredBlock.matchAll(/^\s+[✓✗]\s+([A-Za-z0-9-]+)\s+\(/gm)) {
      notScored.add(match[1]);
    }
  }
  return { scenarios, notScored, announced, unparsed };
}

/**
 * The expected-failures file: `server:` entries of `<scenario>` (the whole scenario is expected to
 * fail) or `<scenario>:<check>` (that check is). Comments and blank lines are ignored. Deliberately
 * a tiny reader for this one shape rather than a YAML dependency.
 */
export function parseBaseline(text) {
  const expected = new Map();
  let inServer = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '').replace(/^#.*$/, '').trimEnd();
    if (!line.trim()) continue;
    if (/^[A-Za-z]+:\s*$/.test(line)) {
      inServer = line.trim() === 'server:';
      continue;
    }
    const entry = /^\s*-\s*['"]?([A-Za-z0-9:_-]+)['"]?\s*$/.exec(line);
    if (!entry || !inServer) continue;
    const [scenario, check] = entry[1].split(':');
    const current = expected.get(scenario);
    if (check === undefined) {
      expected.set(scenario, 'all');
    } else if (current !== 'all') {
      expected.set(scenario, new Set([...(current ?? []), check]));
    }
  }
  return expected;
}

/** The names of the failing checks in one scenario's `checks.json` (an array, or an object holding `checks`). */
export function failingChecks(checksJson) {
  const checks = Array.isArray(checksJson) ? checksJson : Array.isArray(checksJson?.checks) ? checksJson.checks : [];
  return checks.filter((check) => check?.status === 'FAILURE').map((check) => String(check.name));
}

/**
 * The lane's verdict for a requirements run: every scored scenario either passes, or fails only
 * in ways the baseline expects — and every baseline entry still fails (otherwise it is stale).
 * `failingChecksOf(name)` answers the failing check names of a scenario, read from its checks.json.
 */
export function judgeRequirements(summary, baseline, failingChecksOf) {
  const problems = [];
  const seen = new Set();
  // The lane's one promise — an unlisted failure fails it — holds only if every scenario the run
  // set out to report was read: a line the parser could not read, or a count short of the header's.
  for (const line of summary.unparsed ?? []) problems.push(`could not read a summary line: ${line}`);
  if (summary.announced !== undefined && summary.announced !== summary.scenarios.length) {
    problems.push(`the run announced ${summary.announced} scenario(s) but the summary reported ${summary.scenarios.length}`);
  }
  for (const { name, failed } of summary.scenarios) {
    if (summary.notScored.has(name)) continue;
    seen.add(name);
    const expected = baseline.get(name);
    if (failed === 0) {
      if (expected !== undefined) problems.push(`${name}: listed as an expected failure but it passed — remove it from the baseline`);
      continue;
    }
    if (expected === 'all') continue;
    const failing = failingChecksOf(name);
    if (failing.length === 0) {
      // The summary says it failed but no checks.json named the checks: nothing to compare the
      // per-check entries against, and nothing to call passed.
      problems.push(expected === undefined
        ? `${name}: ${failed} failed check(s) not in the baseline`
        : `${name}: ${failed} failed check(s) but no checks.json was written for it — the per-check baseline entries cannot be judged`);
      continue;
    }
    // Nothing may go unaccounted: every failure the summary counts must be a FAILURE row that
    // checks.json names (a scenario-level failure with no row, or a truncated file, would otherwise
    // pass under a baseline that lists the rows it does have).
    if (failing.length !== failed) {
      problems.push(`${name}: the summary counts ${failed} failed check(s) but checks.json names ${failing.length} (${failing.join(', ')})`);
    }
    const unexpected = failing.filter((check) => !(expected?.has(check)));
    if (unexpected.length > 0) {
      problems.push(`${name}: ${failed} failed check(s) not in the baseline (${unexpected.join(', ')})`);
    }
    for (const check of expected ?? []) {
      if (!failing.includes(check)) problems.push(`${name}:${check}: listed as an expected failure but it passed — remove it from the baseline`);
    }
  }
  for (const name of baseline.keys()) {
    if (summary.notScored.has(name)) {
      problems.push(`${name}: listed in the baseline but not scored for this revision — remove it`);
    } else if (!seen.has(name)) {
      problems.push(`${name}: in the baseline but the requirements run did not report it`);
    }
  }
  return problems;
}

/**
 * Every `checks.json` the CLI wrote under `dir`, keyed by scenario. The CLI names the folder
 * `server-<scenario>-<ISO timestamp>` with the timestamp's colons and dots turned into dashes
 * (`server-server-stateless-2026-11-10T02-36-40-817Z`, measured against 0.2.0-alpha.12).
 */
export function collectChecks(dir) {
  const byScenario = new Map();
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry === 'checks.json') {
        const folder = path.basename(path.dirname(full));
        const match = /^(?:server-)?(.+)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.exec(folder);
        if (match) {
          byScenario.set(match[1], failingChecks(JSON.parse(readFileSync(full, 'utf8'))));
        }
      }
    }
  };
  if (existsSync(dir)) walk(dir);
  return byScenario;
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

/** Every argument the CLI is given is one of ours (a package spec, a loopback URL, a scenario name, a path). */
const SAFE_ARGUMENT = /^[A-Za-z0-9@./:_\\-]+$/;

function runCli(args, cwd, cli = CONFORMANCE_CLI) {
  return new Promise((resolve) => {
    const argv = ['--yes', cli, ...args];
    const unsafe = argv.find((arg) => !SAFE_ARGUMENT.test(arg));
    if (unsafe !== undefined) throw new Error(`refusing to pass "${unsafe}" to the conformance CLI`);
    // Windows: `npx` is a .cmd shim, which Node spawns only through a shell. The argv is checked
    // above, so one command string (no args array) keeps the shell out of DEP0190's warning.
    // No colour: the per-scenario summary lines are parsed, and FORCE_COLOR would wrap them in escapes.
    const env = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };
    const child = process.platform === 'win32'
      ? spawn(['npx', ...argv].join(' '), { cwd, env, shell: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      : spawn('npx', argv, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
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

/**
 * The 2026-07-28 lane: one `--requirements` run of the 0.2 CLI against a local `http` server,
 * judged against the baseline. Answers `{ problems, summary }`; an empty `problems` is a pass.
 */
export async function runRequirements(options = {}) {
  const root = options.root ?? fileURLToPath(new URL('../', import.meta.url));
  const entry = path.join(root, 'dist', 'index.js');
  if (!existsSync(entry)) throw new Error(`${entry} not found: run the build first`);
  const revision = options.revision ?? REQUIREMENTS_2026;
  const baselinePath = options.baselinePath ?? path.join(root, 'scripts', 'conformance', `expected-failures-${revision}.yaml`);
  const baseline = parseBaseline(readFileSync(baselinePath, 'utf8'));
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
  const outputDir = mkdtempSync(path.join(os.tmpdir(), 'mcp-conformance-2026-'));

  try {
    if (!(await waitForHealth(port, 20_000))) {
      throw new Error(`the server never answered /health on port ${port}:\n${serverOutput}`);
    }
    const output = await runCli(
      ['server', '--url', `http://127.0.0.1:${port}/mcp`, '--requirements', revision, '--output-dir', outputDir],
      root,
      CONFORMANCE_CLI_2026
    );
    const summary = parseRequirementsSummary(output);
    if (!summary) {
      throw new Error(`no per-scenario summary in the conformance CLI output:\n${output}`);
    }
    const checks = collectChecks(outputDir);
    const problems = judgeRequirements(summary, baseline, (name) => checks.get(name) ?? []);
    for (const { name, passed, failed } of summary.scenarios) {
      const scored = !summary.notScored.has(name);
      const expected = baseline.get(name);
      const tag = !scored ? 'skip' : failed === 0 ? 'ok  ' : expected ? 'base' : 'FAIL';
      log(`${tag} ${name.padEnd(48)} ${passed}/${passed + failed}${!scored ? '  (not scored)' : expected ? '  (expected: fixture)' : ''}`);
    }
    if (problems.length && options.verbose) log(output);
    return { problems, summary };
  } finally {
    server.kill();
    rmSync(outputDir, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url)) {
  const verbose = process.argv.includes('--verbose');
  const eraIndex = process.argv.indexOf('--era');
  if (eraIndex !== -1) {
    const revision = process.argv[eraIndex + 1];
    runRequirements({ revision, verbose })
      .then(({ problems, summary }) => {
        const scored = summary.scenarios.filter((scenario) => !summary.notScored.has(scenario.name));
        if (problems.length) {
          for (const problem of problems) console.error(`MCP conformance ${revision}: ${problem}`);
          process.exitCode = 1;
        } else {
          console.log(`MCP conformance ${revision}: ${scored.length} scored scenario(s) conform under the baseline against ${CONFORMANCE_CLI_2026}`);
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
