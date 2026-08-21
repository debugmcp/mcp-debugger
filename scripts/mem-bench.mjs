/**
 * Memory-footprint benchmark — measures the RSS of a freshly started
 * mcp-debugger server at fixed lifecycle checkpoints, across repeatable
 * environments, so footprint decisions are driven by data instead of chance
 * (born out of PR #395's startup-reaper findings).
 *
 * Each trial spawns a fresh server, connects a real MCP client over stdio, and
 * samples RSS externally at checkpoints. A successful MCP `initialize` is a
 * guaranteed synchronization barrier proving the startup orphan-reaper scans
 * have completed: src/index.ts awaits both reapers at the top of main(),
 * before argv parsing, so the stdio transport cannot answer until they are
 * done. Peak metrics (VmHWM on Linux, PeakWorkingSet64 on Windows) prove a
 * spike was *prevented*, not merely released after the fact — V8 does not
 * return grown arenas to the OS, so a transient peak normally scars RSS for
 * the process lifetime.
 *
 * Scenarios (checkpoints in one server lifecycle, not separate harnesses):
 *   idle       stdio startup floor after `initialize` (includes reaper cost)
 *   tools      after the first tools/list — on the dist target this
 *              dynamically imports every adapter package (adapter-loader
 *              availability probe), so the delta vs `idle` prices that in
 *   cycle      M x (create_debug_session mock -> close); reports a
 *              per-session RSS delta as a retention signal
 *   busy-proc  docker only: the PR #395 scenario. Each trial runs the
 *              lifecycle twice — 0 sleepers (quiet) and N sleepers (busy) —
 *              inside the container, so the within-trial delta isolates the
 *              /proc-scan cost from the base image footprint
 *
 * Usage:
 *     node scripts/mem-bench.mjs [options]
 *     node scripts/mem-bench.mjs compare <a.json> <b.json>
 *
 * Options:
 *   --target <dist|bundle|docker>  dist = node dist/index.js (default)
 *                                  bundle = packages/mcp-debugger/dist/cli.mjs
 *                                  docker = mcp-debugger:local image
 *   --scenario <list|all>          comma list of idle,tools,cycle,busy-proc
 *                                  (default idle,tools,cycle; busy-proc needs
 *                                  --target docker; all = everything valid)
 *   --trials <n>                   default 5            (env MEM_BENCH_TRIALS)
 *   --sleepers <n>                 default 1500         (env MEM_BENCH_SLEEPERS)
 *   --sessions <m>                 cycle iterations, default 10
 *   --json <path>                  default bench-results/mem-<target>-<ts>.json
 *   --label <name>                 stored in JSON; default current git branch.
 *                                  NOTE: the stored git info describes the
 *                                  bench-runner checkout — when benchmarking a
 *                                  docker image built from a different commit
 *                                  (DOCKER_IMAGE_NAME + MEM_BENCH_SKIP_DOCKER_BUILD),
 *                                  use --label to record the image's provenance
 *   --settle-timeout <ms>          settle cap per checkpoint, default 15000
 *
 * The docker image is (re)built via scripts/docker-build-if-needed.js, which
 * honors DOCKER_IMAGE_NAME and DOCKER_FORCE_REBUILD. Set
 * MEM_BENCH_SKIP_DOCKER_BUILD=true to benchmark the existing image as-is
 * (e.g. when the working tree has bench-only changes that would needlessly
 * invalidate the image staleness hash).
 *
 * Exit codes: 0 success, 1 target/harness failure, 2 bad usage.
 */
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN_ID = Date.now().toString(36);
const CONTAINER_PREFIX = 'mcp-membench-';

const VALID_TARGETS = ['dist', 'bundle', 'docker'];
const VALID_SCENARIOS = ['idle', 'tools', 'cycle', 'busy-proc'];

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function usage(exitCode) {
  const header = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  console.log(header.slice(0, header.indexOf('*/') + 2));
  process.exit(exitCode);
}

function parseArgs(argv) {
  if (argv[0] === 'compare') {
    if (argv.length !== 3) {
      console.error('[mem-bench] compare needs exactly two JSON files');
      process.exit(2);
    }
    return { mode: 'compare', a: argv[1], b: argv[2] };
  }
  const cfg = {
    mode: 'run',
    target: 'dist',
    scenarios: null,
    trials: Number(process.env.MEM_BENCH_TRIALS ?? 5),
    sleepers: Number(process.env.MEM_BENCH_SLEEPERS ?? 1500),
    sessions: 10,
    json: null,
    label: null,
    settleTimeoutMs: 15000
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      i++;
      if (i >= argv.length) {
        console.error(`[mem-bench] ${arg} needs a value`);
        process.exit(2);
      }
      return argv[i];
    };
    switch (arg) {
      case '--target': cfg.target = next(); break;
      case '--scenario': cfg.scenarios = next().split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--trials': cfg.trials = Number(next()); break;
      case '--sleepers': cfg.sleepers = Number(next()); break;
      case '--sessions': cfg.sessions = Number(next()); break;
      case '--json': cfg.json = next(); break;
      case '--label': cfg.label = next(); break;
      case '--settle-timeout': cfg.settleTimeoutMs = Number(next()); break;
      case '--help': case '-h': usage(0); break;
      default:
        console.error(`[mem-bench] Unknown argument: ${arg}`);
        process.exit(2);
    }
  }
  if (!VALID_TARGETS.includes(cfg.target)) {
    console.error(`[mem-bench] Invalid --target ${cfg.target} (expected ${VALID_TARGETS.join('|')})`);
    process.exit(2);
  }
  const validHere = cfg.target === 'docker' ? VALID_SCENARIOS : VALID_SCENARIOS.filter((s) => s !== 'busy-proc');
  if (cfg.scenarios === null) cfg.scenarios = ['idle', 'tools', 'cycle'];
  else if (cfg.scenarios.length === 1 && cfg.scenarios[0] === 'all') cfg.scenarios = validHere;
  for (const s of cfg.scenarios) {
    if (!VALID_SCENARIOS.includes(s)) {
      console.error(`[mem-bench] Invalid scenario: ${s}`);
      process.exit(2);
    }
    if (!validHere.includes(s)) {
      console.error(`[mem-bench] Scenario ${s} requires --target docker`);
      process.exit(2);
    }
  }
  for (const [key, min] of [['trials', 1], ['sleepers', 0], ['sessions', 2], ['settleTimeoutMs', 1000]]) {
    if (!Number.isInteger(cfg[key]) || cfg[key] < min) {
      console.error(`[mem-bench] Invalid ${key}: ${cfg[key]} (integer >= ${min})`);
      process.exit(2);
    }
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// RSS samplers — each returns { rssKB, peakKB|null, privateKB|null }
// ---------------------------------------------------------------------------

function parseProcStatus(text) {
  const grab = (field) => {
    const m = text.match(new RegExp(`^${field}:\\s+(\\d+)\\s+kB`, 'm'));
    return m ? Number(m[1]) : null;
  };
  const rssKB = grab('VmRSS');
  if (rssKB === null) throw new Error('VmRSS not found in /proc status');
  return { rssKB, peakKB: grab('VmHWM'), privateKB: null };
}

async function sampleHost(pid) {
  if (process.platform === 'linux') {
    return parseProcStatus(fs.readFileSync(`/proc/${pid}/status`, 'utf8'));
  }
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile', '-Command',
      `Get-Process -Id ${pid} | Select-Object WorkingSet64,PrivateMemorySize64,PeakWorkingSet64 | ConvertTo-Json`
    ]);
    const info = JSON.parse(stdout);
    return {
      rssKB: Math.round(info.WorkingSet64 / 1024),
      peakKB: Math.round(info.PeakWorkingSet64 / 1024),
      privateKB: Math.round(info.PrivateMemorySize64 / 1024)
    };
  }
  // darwin (and other POSIX): ps reports KB, no peak available
  const { stdout } = await execFileAsync('ps', ['-o', 'rss=', '-p', String(pid)]);
  return { rssKB: Number(stdout.trim()), peakKB: null, privateKB: null };
}

// The server is PID 1 inside the container (the bench overrides the
// entrypoint and entry.sh exec's node). Never sample transport.pid for the
// docker target — that is the docker CLI process on the host.
async function sampleDocker(containerName) {
  const { stdout } = await execFileAsync('docker', ['exec', containerName, 'cat', '/proc/1/status']);
  return parseProcStatus(stdout);
}

/**
 * Poll until three consecutive samples agree within max(2%, 2 MB), or the
 * timeout elapses. Returns the last sample either way, flagged `settled`.
 */
async function settleRss(sampler, settleTimeoutMs) {
  const intervalMs = process.platform === 'win32' ? 1000 : 500; // PowerShell spawns cost ~300-500ms
  const started = Date.now();
  const window = [];
  let last = null;
  for (;;) {
    last = await sampler();
    window.push(last.rssKB);
    if (window.length > 3) window.shift();
    if (window.length === 3) {
      const lo = Math.min(...window);
      const hi = Math.max(...window);
      if (hi - lo <= Math.max(lo * 0.02, 2048)) {
        return { sample: last, settled: true, settleMs: Date.now() - started };
      }
    }
    if (Date.now() - started >= settleTimeoutMs) {
      return { sample: last, settled: false, settleMs: Date.now() - started };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// ---------------------------------------------------------------------------
// Target launchers
// ---------------------------------------------------------------------------

function cleanChildEnv() {
  const env = { ...process.env };
  delete env.NODE_OPTIONS; // a host --max-old-space-size etc. would skew every number
  for (const key of Object.keys(env)) {
    if (key.startsWith('DEBUG_MCP_') || key.startsWith('MCP_')) delete env[key];
  }
  return env;
}

const SERVER_ARGS = ['stdio', '--log-level', 'error'];

function buildLaunch(target, containerName, sleepers) {
  if (target === 'dist') {
    return { command: process.execPath, args: [path.join(ROOT, 'dist', 'index.js'), ...SERVER_ARGS] };
  }
  if (target === 'bundle') {
    return { command: process.execPath, args: [path.join(ROOT, 'packages', 'mcp-debugger', 'dist', 'cli.mjs'), ...SERVER_ARGS] };
  }
  // docker: same sh wrapper for every variant (identical wrapper cost); the
  // sleeper loop finishes BEFORE exec, so exactly N sleepers exist in /proc
  // when main()'s reapers run, and after the double exec node is PID 1.
  const script =
    `i=0; while [ $i -lt ${sleepers} ]; do sleep infinity & i=$((i+1)); done; ` +
    `exec /app/entry.sh ${SERVER_ARGS.join(' ')}`;
  return {
    command: 'docker',
    args: ['run', '--rm', '-i', '--name', containerName, '--entrypoint', '/bin/sh', dockerImage(), '-c', script]
  };
}

function dockerImage() {
  return process.env.DOCKER_IMAGE_NAME || 'mcp-debugger:local';
}

function ensureDockerImage() {
  if (process.env.MEM_BENCH_SKIP_DOCKER_BUILD === 'true') {
    console.log(`[mem-bench] MEM_BENCH_SKIP_DOCKER_BUILD=true — using ${dockerImage()} as-is`);
    return;
  }
  console.log(`[mem-bench] ensuring docker image ${dockerImage()} is current (docker-build-if-needed)...`);
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'docker-build-if-needed.js')], {
    cwd: ROOT, stdio: 'inherit'
  });
  if (result.status !== 0) {
    console.error('[mem-bench] docker image build failed');
    process.exit(1);
  }
}

async function countProcEntries(containerName) {
  try {
    const { stdout } = await execFileAsync('docker', ['exec', containerName, 'sh', '-c', 'ls /proc | grep -c "^[0-9]"']);
    return Number(stdout.trim());
  } catch {
    return null;
  }
}

// -- container cleanup ------------------------------------------------------

const liveContainers = new Set();

function removeContainer(name) {
  liveContainers.delete(name);
  spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
}

function sweepStrayContainers() {
  const result = spawnSync('docker', ['ps', '-aq', '--filter', `name=${CONTAINER_PREFIX}`], { encoding: 'utf8' });
  const ids = (result.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (ids.length > 0) {
    console.log(`[mem-bench] removing ${ids.length} stray ${CONTAINER_PREFIX}* container(s)`);
    spawnSync('docker', ['rm', '-f', ...ids], { stdio: 'ignore' });
  }
}

function installCleanupHandlers() {
  const cleanup = () => {
    for (const name of [...liveContainers]) removeContainer(name);
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });
}

// ---------------------------------------------------------------------------
// Trial lifecycle
// ---------------------------------------------------------------------------

function parseToolResult(res) {
  const text = res?.content?.find((c) => c.type === 'text')?.text;
  return text ? JSON.parse(text) : {};
}

/**
 * One fresh server process; checkpoints gated by the selected scenarios.
 * Returns { checkpoints: {name: {rssKB, peakKB, privateKB, settled, settleMs}},
 *           perSessionDeltaKB|null, procEntryCount|null, stderrTail }
 */
async function runLifecycleTrial(cfg, { sleepers, wantTools, wantCycle }) {
  const containerName = cfg.target === 'docker'
    ? `${CONTAINER_PREFIX}${RUN_ID}-${Math.random().toString(36).slice(2, 8)}`
    : null;
  const { command, args } = buildLaunch(cfg.target, containerName, sleepers);
  if (containerName) liveContainers.add(containerName);

  const transport = new StdioClientTransport({ command, args, env: cleanChildEnv(), cwd: ROOT, stderr: 'pipe' });
  const stderrTail = [];
  const client = new Client({ name: 'mem-bench', version: '1.0.0' });
  const out = { checkpoints: {}, perSessionDeltaKB: null, procEntryCount: null, stderrTail };

  try {
    await client.connect(transport); // MCP initialize == reaper-completion barrier
    transport.stderr?.on('data', (chunk) => {
      for (const line of String(chunk).split('\n')) {
        if (line.trim()) stderrTail.push(line);
      }
      while (stderrTail.length > 40) stderrTail.shift();
    });

    const sampler = containerName
      ? () => sampleDocker(containerName)
      : (() => {
          const pid = transport.pid;
          if (!pid) throw new Error('StdioClientTransport.pid unavailable — SDK too old?');
          return () => sampleHost(pid);
        })();

    if (containerName) out.procEntryCount = await countProcEntries(containerName);

    const checkpoint = async (name) => {
      const { sample, settled, settleMs } = await settleRss(sampler, cfg.settleTimeoutMs);
      out.checkpoints[name] = { ...sample, settled, settleMs };
    };

    await checkpoint('after-initialize');

    if (wantTools) {
      await client.listTools();
      await checkpoint('after-tools-list');
    }

    if (wantCycle) {
      let rssAfterFirst = null;
      let rssAfterLast = null;
      for (let m = 1; m <= cfg.sessions; m++) {
        const created = parseToolResult(await client.callTool({
          name: 'create_debug_session',
          arguments: { language: 'mock', name: `mem-bench-${m}` }
        }));
        if (!created.sessionId) throw new Error('create_debug_session returned no sessionId');
        await client.callTool({ name: 'close_debug_session', arguments: { sessionId: created.sessionId } });
        if (m === 1) rssAfterFirst = (await sampler()).rssKB;
        if (m === cfg.sessions) rssAfterLast = (await sampler()).rssKB;
      }
      out.perSessionDeltaKB = (rssAfterLast - rssAfterFirst) / (cfg.sessions - 1);
      await checkpoint('after-session-cycle');
    }
  } finally {
    try {
      await client.close();
    } catch {
      /* child may already be gone */
    }
    if (containerName) removeContainer(containerName);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stats + result assembly
// ---------------------------------------------------------------------------

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const round = (v) => Math.round(v * 10) / 10;
  return { median: round(median), min: round(sorted[0]), max: round(sorted[sorted.length - 1]), mean: round(mean) };
}

const toMB = (kb) => Math.round((kb / 1024) * 10) / 10;

class ResultCollector {
  constructor() {
    this.map = new Map();
  }

  add(scenario, variant, checkpointName, metric, unit, value, meta) {
    if (value === null || value === undefined || Number.isNaN(value)) return;
    const key = `${scenario}|${variant}|${checkpointName}|${metric}`;
    if (!this.map.has(key)) {
      this.map.set(key, { scenario, variant, checkpoint: checkpointName, metric, unit, samples: [], meta: {} });
    }
    const row = this.map.get(key);
    row.samples.push(value);
    if (meta) {
      for (const [k, v] of Object.entries(meta)) {
        (row.meta[k] ??= []).push(v);
      }
    }
  }

  rows() {
    return [...this.map.values()].map((row) => ({ ...row, stats: stats(row.samples) }));
  }
}

function gitInfo() {
  const run = (args) => {
    const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
  };
  return {
    branch: run(['rev-parse', '--abbrev-ref', 'HEAD']),
    commit: run(['rev-parse', '--short', 'HEAD']),
    dirty: (run(['status', '--porcelain']) || '') !== ''
  };
}

function hostInfo(target) {
  const info = {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    cpus: os.cpus().length,
    totalMemGB: Math.round(os.totalmem() / 1024 ** 3)
  };
  if (target === 'docker') {
    const r = spawnSync('docker', ['--version'], { encoding: 'utf8' });
    info.docker = r.status === 0 ? r.stdout.trim() : 'unavailable';
  }
  return info;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function pad(value, width) {
  return String(value).padEnd(width);
}

function printTable(rows) {
  // group metrics per (scenario, variant, checkpoint) line for readability
  const lines = new Map();
  for (const row of rows) {
    const key = `${row.scenario}|${row.variant}|${row.checkpoint}`;
    if (!lines.has(key)) lines.set(key, { scenario: row.scenario, variant: row.variant, checkpoint: row.checkpoint, metrics: {} });
    lines.get(key).metrics[row.metric] = row;
  }
  console.log(`\n${pad('scenario', 11)}${pad('variant', 9)}${pad('checkpoint', 20)}${pad('rss med', 9)}${pad('min..max', 15)}${pad('peak med', 10)}${pad('extra', 24)}settled`);
  for (const line of lines.values()) {
    const rss = line.metrics.rss;
    const peak = line.metrics.peak;
    const extras = [];
    if (line.metrics.private) extras.push(`priv ${line.metrics.private.stats.median}MB`);
    if (line.metrics.perSessionDelta) extras.push(`Δ/session ${line.metrics.perSessionDelta.stats.median}KB`);
    if (rss?.meta.procEntryCount) extras.push(`procs ~${Math.round(stats(rss.meta.procEntryCount).median)}`);
    const settled = rss ? `${rss.meta.settled.filter(Boolean).length}/${rss.meta.settled.length}` : '-';
    console.log(
      pad(line.scenario, 11) + pad(line.variant, 9) + pad(line.checkpoint, 20) +
      pad(rss ? rss.stats.median : '-', 9) +
      pad(rss ? `${rss.stats.min}..${rss.stats.max}` : '-', 15) +
      pad(peak ? peak.stats.median : '-', 10) +
      pad(extras.join(' '), 24) + settled
    );
  }
  console.log('');
}

function defaultJsonPath(target) {
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  return path.join(ROOT, 'bench-results', `mem-${target}-${ts}.json`);
}

// ---------------------------------------------------------------------------
// compare subcommand
// ---------------------------------------------------------------------------

function compare(fileA, fileB) {
  const load = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
  const a = load(fileA);
  const b = load(fileB);
  for (const field of ['config.target', 'host.platform']) {
    const get = (obj) => field.split('.').reduce((acc, k) => acc?.[k], obj);
    if (get(a) !== get(b)) {
      console.warn(`[mem-bench] ⚠️  ${field} differs: ${get(a)} vs ${get(b)} — deltas may not be meaningful`);
    }
  }
  const key = (row) => `${row.scenario}|${row.variant}|${row.checkpoint}|${row.metric}`;
  const bRows = new Map(b.rows.map((row) => [key(row), row]));
  console.log(`\n[mem-bench] compare  A=${a.label ?? fileA} (${a.git?.commit})  B=${b.label ?? fileB} (${b.git?.commit})`);
  console.log(`${pad('scenario', 11)}${pad('variant', 9)}${pad('checkpoint', 20)}${pad('metric', 16)}${pad('A med', 9)}${pad('B med', 9)}${pad('Δ', 9)}${pad('Δ%', 8)}sig`);
  for (const rowA of a.rows) {
    const rowB = bRows.get(key(rowA));
    if (!rowB) continue;
    const delta = Math.round((rowB.stats.median - rowA.stats.median) * 10) / 10;
    const pct = rowA.stats.median !== 0 ? Math.round((delta / rowA.stats.median) * 1000) / 10 : 0;
    const spreadA = rowA.stats.max - rowA.stats.min;
    const spreadB = rowB.stats.max - rowB.stats.min;
    // crude but honest non-overlap test for small n: only call it significant
    // when the median shift exceeds both runs' full spreads
    const significant = Math.abs(delta) > Math.max(spreadA, spreadB);
    const marker = !significant ? '·' : delta < 0 ? '✅↓' : '❌↑';
    console.log(
      pad(rowA.scenario, 11) + pad(rowA.variant, 9) + pad(rowA.checkpoint, 20) +
      pad(`${rowA.metric} ${rowA.unit}`, 16) +
      pad(rowA.stats.median, 9) + pad(rowB.stats.median, 9) +
      pad(delta > 0 ? `+${delta}` : delta, 9) + pad(`${pct > 0 ? '+' : ''}${pct}%`, 8) + marker
    );
  }
  console.log('\n[mem-bench] sig: ✅↓/❌↑ = |Δ medians| exceeds both runs\' min..max spreads; · = within noise');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  if (cfg.mode === 'compare') {
    compare(cfg.a, cfg.b);
    return;
  }

  const freeGB = os.freemem() / 1024 ** 3;
  if (freeGB < 4) {
    console.warn(`[mem-bench] ⚠️  only ${freeGB.toFixed(1)} GB host memory free — numbers may be skewed by memory pressure`);
  }

  const entry = cfg.target === 'bundle'
    ? path.join(ROOT, 'packages', 'mcp-debugger', 'dist', 'cli.mjs')
    : path.join(ROOT, 'dist', 'index.js');
  if (cfg.target !== 'docker' && !fs.existsSync(entry)) {
    console.error(`[mem-bench] ${path.relative(ROOT, entry)} not found — run the build first`);
    process.exit(1);
  }
  if (cfg.target === 'docker') {
    installCleanupHandlers();
    ensureDockerImage();
    sweepStrayContainers();
  }

  const label = cfg.label ?? gitInfo().branch ?? 'unknown';
  const lifecycleScenarios = cfg.scenarios.filter((s) => s !== 'busy-proc');
  const wantTools = lifecycleScenarios.includes('tools');
  const wantCycle = lifecycleScenarios.includes('cycle');
  const collector = new ResultCollector();
  console.log(`[mem-bench] target=${cfg.target}  trials=${cfg.trials}  scenarios=${cfg.scenarios.join(',')}  label=${label}`);

  const record = (trial, variant) => {
    // one lifecycle feeds every selected scenario's rows
    if (lifecycleScenarios.includes('idle') || variant !== '-') {
      const scenario = variant === '-' ? 'idle' : 'busy-proc';
      collector.add(scenario, variant, 'after-initialize', 'rss', 'MB', toMB(trial.checkpoints['after-initialize'].rssKB), {
        settled: trial.checkpoints['after-initialize'].settled,
        settleMs: trial.checkpoints['after-initialize'].settleMs,
        ...(trial.procEntryCount !== null ? { procEntryCount: trial.procEntryCount } : {})
      });
      const cp = trial.checkpoints['after-initialize'];
      if (cp.peakKB !== null) collector.add(scenario, variant, 'after-initialize', 'peak', 'MB', toMB(cp.peakKB));
      if (cp.privateKB !== null) collector.add(scenario, variant, 'after-initialize', 'private', 'MB', toMB(cp.privateKB));
    }
    if (variant === '-') {
      const named = { 'after-tools-list': 'tools', 'after-session-cycle': 'cycle' };
      for (const [cpName, scenario] of Object.entries(named)) {
        const cp = trial.checkpoints[cpName];
        if (!cp) continue;
        collector.add(scenario, variant, cpName, 'rss', 'MB', toMB(cp.rssKB), { settled: cp.settled, settleMs: cp.settleMs });
        if (cp.peakKB !== null) collector.add(scenario, variant, cpName, 'peak', 'MB', toMB(cp.peakKB));
        if (cp.privateKB !== null) collector.add(scenario, variant, cpName, 'private', 'MB', toMB(cp.privateKB));
      }
      if (trial.perSessionDeltaKB !== null) {
        collector.add('cycle', variant, 'session-cycle', 'perSessionDelta', 'KB', Math.round(trial.perSessionDeltaKB));
      }
    }
  };

  let failures = 0;
  for (let t = 1; t <= cfg.trials; t++) {
    if (lifecycleScenarios.length > 0) {
      process.stdout.write(`[mem-bench] trial ${t}/${cfg.trials} lifecycle (${lifecycleScenarios.join(',')})... `);
      try {
        const trial = await runLifecycleTrial(cfg, { sleepers: 0, wantTools, wantCycle });
        record(trial, '-');
        console.log(`rss ${toMB(trial.checkpoints['after-initialize'].rssKB)} MB`);
      } catch (err) {
        failures++;
        console.log('FAILED');
        console.error(`[mem-bench]   ${err instanceof Error ? err.message : err}`);
      }
    }
    if (cfg.scenarios.includes('busy-proc')) {
      for (const [variant, sleepers] of [['quiet', 0], ['busy', cfg.sleepers]]) {
        process.stdout.write(`[mem-bench] trial ${t}/${cfg.trials} busy-proc/${variant} (${sleepers} sleepers)... `);
        try {
          const trial = await runLifecycleTrial(cfg, { sleepers, wantTools: false, wantCycle: false });
          record(trial, variant);
          console.log(`rss ${toMB(trial.checkpoints['after-initialize'].rssKB)} MB (procs ${trial.procEntryCount ?? '?'})`);
        } catch (err) {
          failures++;
          console.log('FAILED');
          console.error(`[mem-bench]   ${err instanceof Error ? err.message : err}`);
        }
      }
    }
  }

  const rows = collector.rows();
  if (rows.length === 0) {
    console.error('[mem-bench] no successful trials — nothing to report');
    process.exit(1);
  }
  printTable(rows);

  const jsonPath = cfg.json ? path.resolve(cfg.json) : defaultJsonPath(cfg.target);
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify({
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    label,
    git: gitInfo(),
    host: hostInfo(cfg.target),
    config: { target: cfg.target, scenarios: cfg.scenarios, trials: cfg.trials, sleepers: cfg.sleepers, sessions: cfg.sessions },
    rows
  }, null, 2));
  console.log(`[mem-bench] results written to ${path.relative(ROOT, jsonPath)}`);
  if (failures > 0) {
    console.error(`[mem-bench] ${failures} trial run(s) failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[mem-bench] fatal:', err);
  process.exit(1);
});
