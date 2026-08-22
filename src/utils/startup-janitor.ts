/**
 * Startup janitor (issue #399): best-effort cleanup of debris from prior
 * crashed runs, invoked fire-and-forget from the server-starting CLI commands
 * (stdio/http/sse) — never from --version/--help, and never blocking the
 * transport from coming up.
 *
 * Covers:
 * - Orphan debuggee JVMs and proxy workers, via ONE shared process scan
 *   feeding both reapers' matchers (previously two independent walks).
 *   `MCP_SKIP_ORPHAN_REAPERS=1` skips this part for PID-namespaced containers
 *   where orphans are impossible.
 * - Stale per-session run logs (proxy-<id>.log / dap-trace-<id>.ndjson) under
 *   the session log base dir (deferred here from issue #403 — the flat
 *   logger.ts sweeper can't reach these nested dirs).
 *
 * Safe to run concurrently with a live server: the reapers only kill
 * processes whose recorded owner pid is dead, and the sweep only removes run
 * dirs whose mtime is older than the age cap (a live session keeps writing).
 */
import * as fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanProcessArgs, type ProcessScanOptions, type ScannedProcess } from './process-scan.js';
import { reapOrphanJvms, parseArgs, type ReapResult as JvmReapResult, type ReapOptions as JvmReapOptions } from './jvm-orphan-reaper.js';
import { reapOrphanProxies, parseProxyArgs, type ReapResult as ProxyReapResult, type ReapOptions as ProxyReapOptions } from './proxy-orphan-reaper.js';

export interface JanitorLogger {
  info?: (msg: string) => void;
  warn?: (msg: string) => void;
  error?: (msg: string) => void;
  debug?: (msg: string) => void;
}

export interface StartupJanitorOptions {
  logger: JanitorLogger;
  selfPid?: number;
  env?: NodeJS.ProcessEnv;
  // Test seams
  scan?: (options: ProcessScanOptions) => Promise<ScannedProcess[]>;
  reapJvms?: (opts: JvmReapOptions) => Promise<JvmReapResult>;
  reapProxies?: (opts: ProxyReapOptions) => Promise<ProxyReapResult>;
  sweep?: (opts: SweepOptions) => Promise<SweepResult>;
}

export async function runStartupJanitor(opts: StartupJanitorOptions): Promise<void> {
  const log = opts.logger;
  const env = opts.env ?? process.env;
  const selfPid = opts.selfPid ?? process.pid;

  const skipFlag = (env.MCP_SKIP_ORPHAN_REAPERS ?? '').toLowerCase();
  if (skipFlag === '1' || skipFlag === 'true') {
    log.debug?.('[startup-janitor] Orphan reapers skipped (MCP_SKIP_ORPHAN_REAPERS)');
  } else {
    await runOrphanReapers(opts, selfPid);
  }

  try {
    const sweep = opts.sweep ?? sweepStaleSessionRuns;
    const swept = await sweep({ logger: log });
    if (swept.removedRuns > 0) {
      log.info?.(`[startup-janitor] Removed ${swept.removedRuns} stale session run dir(s)`);
    }
  } catch (e) {
    log.warn?.(`[startup-janitor] Session log sweep failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function runOrphanReapers(opts: StartupJanitorOptions, selfPid: number): Promise<void> {
  const log = opts.logger;
  const scan = opts.scan ?? scanProcessArgs;

  let processes: ScannedProcess[] = [];
  try {
    processes = await scan({ windowsProcessNames: ['java.exe', 'node.exe'] });
  } catch (e) {
    log.warn?.(`[startup-janitor] Process scan failed: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  // Matchers are marker-based, so feeding every row to both is harmless —
  // JVM -D markers only appear in java cmdlines and vice versa.
  const jvmLister = async () =>
    processes.map((p) => parseArgs(p.pid, p.args)).filter((t): t is NonNullable<typeof t> => t !== null);
  const proxyLister = async () =>
    processes.map((p) => parseProxyArgs(p.pid, p.args)).filter((t): t is NonNullable<typeof t> => t !== null);

  const [jvmOutcome, proxyOutcome] = await Promise.allSettled([
    (opts.reapJvms ?? reapOrphanJvms)({ selfPid, logger: log, lister: jvmLister }),
    (opts.reapProxies ?? reapOrphanProxies)({ selfPid, logger: log, lister: proxyLister }),
  ]);

  if (jvmOutcome.status === 'fulfilled') {
    if (jvmOutcome.value.killed.length > 0) {
      log.info?.(`[startup-janitor] Reaped ${jvmOutcome.value.killed.length} orphan JVM(s) from prior runs`);
    }
  } else {
    log.warn?.(`[startup-janitor] Orphan JVM reaper failed: ${(jvmOutcome.reason as Error)?.message ?? String(jvmOutcome.reason)}`);
  }
  if (proxyOutcome.status === 'fulfilled') {
    if (proxyOutcome.value.killed.length > 0) {
      log.info?.(`[startup-janitor] Reaped ${proxyOutcome.value.killed.length} orphan proxy worker(s) from prior runs`);
    }
  } else {
    log.warn?.(`[startup-janitor] Orphan proxy reaper failed: ${(proxyOutcome.reason as Error)?.message ?? String(proxyOutcome.reason)}`);
  }
}

/** Delete stale per-session run log dirs after this long (matches logger.ts). */
const STALE_RUN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface SweepOptions {
  logger?: JanitorLogger;
  /** Session log base dir; defaults to SessionManagerCore's default. */
  baseDir?: string;
  maxAgeMs?: number;
  now?: number;
}

export interface SweepResult {
  removedRuns: number;
}

/**
 * Remove `run-<ts>` dirs (holding proxy-<id>.log / dap-trace-<id>.ndjson)
 * whose mtime is older than the age cap, then remove session dirs left empty.
 * Best-effort throughout: a live session's run dir has a fresh mtime (the
 * proxy logger writes to it), and rmdir on a non-empty dir simply fails.
 */
export async function sweepStaleSessionRuns(opts: SweepOptions = {}): Promise<SweepResult> {
  const baseDir = opts.baseDir ?? path.join(os.tmpdir(), 'debug-mcp-server', 'sessions');
  const maxAgeMs = opts.maxAgeMs ?? STALE_RUN_MAX_AGE_MS;
  const now = opts.now ?? Date.now();
  const result: SweepResult = { removedRuns: 0 };

  let sessionDirs: string[];
  try {
    sessionDirs = await fsp.readdir(baseDir);
  } catch {
    return result;
  }

  for (const sessionName of sessionDirs) {
    const sessionPath = path.join(baseDir, sessionName);
    let runNames: string[];
    try {
      runNames = await fsp.readdir(sessionPath);
    } catch {
      continue; // not a directory, or vanished
    }
    for (const runName of runNames) {
      if (!runName.startsWith('run-')) continue;
      const runPath = path.join(sessionPath, runName);
      try {
        const stat = await fsp.stat(runPath);
        if (!stat.isDirectory() || now - stat.mtimeMs < maxAgeMs) continue;
        await fsp.rm(runPath, { recursive: true, force: true });
        result.removedRuns++;
      } catch {
        // vanished or locked (e.g. Windows open handle) — leave it
      }
    }
    try {
      await fsp.rmdir(sessionPath); // only succeeds when empty
    } catch {
      // still has fresh runs or non-run entries — fine
    }
  }
  return result;
}
