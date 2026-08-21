/**
 * Cross-platform reaper for orphan proxy worker chains left behind by prior
 * mcp-debugger runs that crashed or were SIGKILLed (issue #343, the residual
 * gap from #337).
 *
 * ProxyProcessLauncherImpl tags every proxy worker with argv markers that
 * identify it as ours and record the PID of the mcp-debugger process that
 * owned the session:
 *   node --trace-uncaught --trace-exit <...>/proxy-bootstrap.js \
 *        --mcp-owner-pid=<pid> --mcp-session-id=<uuid>
 * (proxy-bootstrap.js reads no argv, so the markers are inert at runtime.)
 *
 * On startup, this reaper enumerates running node processes, finds the tagged
 * workers whose owner pid is no longer alive, and tears them down. Workers
 * whose owner is still alive (concurrent mcp-debugger instance) are left
 * alone, as are untagged pre-upgrade workers.
 *
 * Kill strategy diverges by platform, dictated by the #339 shutdown cascade:
 * - POSIX: SIGTERM first so the worker's own signal handler runs its shutdown
 *   (graceful DAP disconnect + adapter process-group/tree kill), then poll for
 *   exit and SIGKILL-escalate only if the worker is wedged past the cap. The
 *   cap must exceed the ~2s worst-case cascade or escalation would re-orphan
 *   the adapter chain.
 * - win32: Node's cross-process 'SIGTERM' is TerminateProcess — the worker's
 *   JS signal handler never runs, so the graceful cascade is impossible.
 *   `taskkill /PID <pid> /T /F` sweeps the whole child tree directly instead
 *   (the same approach the worker itself uses for adapters).
 *
 * Known limitation (accepted, in issue scope): a worker that was itself
 * already SIGKILLed leaves untagged adapter descendants this reaper cannot
 * find; Java debuggees are covered separately by the JVM orphan reaper.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import { isPidAlive, SignalFn } from './jvm-orphan-reaper.js';
import { forEachBounded } from './bounded-concurrency.js';
import { PROC_SCAN_CONCURRENCY } from './proc-scan-concurrency.js';

const execFileAsync = promisify(execFile);

/** Substring of the worker's script-path argv token used as the identity marker. */
export const PROXY_BOOTSTRAP_MARKER = 'proxy-bootstrap';
export const OWNER_PID_ARG_PREFIX = '--mcp-owner-pid=';
export const SESSION_ID_ARG_PREFIX = '--mcp-session-id=';

const LIST_TIMEOUT_MS = 5000;
const LIST_MAX_BUFFER = 10 * 1024 * 1024;
/** How often the POSIX escalation path polls for the SIGTERM cascade to finish. */
const TERM_POLL_MS = 200;
/** Bounded wait before SIGKILL escalation; must exceed the ~2s #339 cascade. */
const TERM_WAIT_CAP_MS = 3000;

export interface TaggedProxy {
  pid: number;
  ownerPid: number;
  sessionId: string;
}

export interface ReaperLogger {
  info?: (msg: string) => void;
  warn?: (msg: string) => void;
  error?: (msg: string) => void;
}

export interface ReapResult {
  scanned: number;
  killed: TaggedProxy[];
  skipped: TaggedProxy[];
  errors: string[];
}

export interface ReapOptions {
  selfPid: number;
  logger?: ReaperLogger;
  // Test seams: override platform calls without monkey-patching child_process.
  lister?: () => Promise<TaggedProxy[]>;
  isAlive?: (pid: number) => boolean;
  /** Async: encapsulates the full SIGTERM→wait→SIGKILL (or taskkill) sequence.
   * Resolves true when the worker was killed, false when it was already gone
   * or not ours to kill. */
  killer?: (pid: number) => Promise<boolean>;
}

export async function reapOrphanProxies(opts: ReapOptions): Promise<ReapResult> {
  const lister = opts.lister ?? listTaggedProxies;
  const isAlive = opts.isAlive ?? isPidAlive;
  const killer = opts.killer ?? defaultKillProxy;
  const log = opts.logger;

  const result: ReapResult = { scanned: 0, killed: [], skipped: [], errors: [] };

  let proxies: TaggedProxy[];
  try {
    proxies = await lister();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log?.warn?.(`[proxy-reaper] Failed to list proxy workers: ${msg}`);
    result.errors.push(msg);
    return result;
  }

  result.scanned = proxies.length;

  const eligible: TaggedProxy[] = [];
  for (const proxy of proxies) {
    // Don't touch workers owned by the current process or any live
    // mcp-debugger. The selfPid guard also defends against the rare case
    // where a recycled PID happens to match our own.
    if (proxy.ownerPid === opts.selfPid || isAlive(proxy.ownerPid)) {
      result.skipped.push(proxy);
      continue;
    }
    eligible.push(proxy);
  }

  // Kill concurrently: each killer may block up to TERM_WAIT_CAP_MS waiting
  // for the shutdown cascade, so serial kills would stack that wait per orphan.
  const outcomes = await Promise.all(
    eligible.map(async (proxy) => {
      try {
        return { proxy, ok: await killer(proxy.pid), error: undefined as string | undefined };
      } catch (e) {
        return { proxy, ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  for (const outcome of outcomes) {
    if (outcome.error !== undefined) {
      log?.warn?.(`[proxy-reaper] Failed to kill pid=${outcome.proxy.pid}: ${outcome.error}`);
      result.errors.push(outcome.error);
    } else if (outcome.ok) {
      result.killed.push(outcome.proxy);
      log?.info?.(
        `[proxy-reaper] Killed orphan proxy worker pid=${outcome.proxy.pid} owner_pid=${outcome.proxy.ownerPid} session=${outcome.proxy.sessionId}`,
      );
    } else {
      // already gone, or permission denied; either way not actionable
      result.skipped.push(outcome.proxy);
    }
  }
  return result;
}

export async function listTaggedProxies(): Promise<TaggedProxy[]> {
  switch (process.platform) {
    case 'linux':
      return listLinuxProxies();
    case 'darwin':
      return listDarwinProxies();
    case 'win32':
      return listWindowsProxies();
    default:
      return [];
  }
}

/** @internal Exposed for unit tests; not part of the public module API. */
export async function listLinuxProxies(): Promise<TaggedProxy[]> {
  let entries: string[];
  try {
    entries = await fs.readdir('/proc');
  } catch {
    return [];
  }
  const result: TaggedProxy[] = [];
  await forEachBounded(entries, PROC_SCAN_CONCURRENCY, async (entry) => {
    if (!/^\d+$/.test(entry)) return;
    const pid = Number(entry);
    let raw: string;
    try {
      raw = await fs.readFile(`/proc/${entry}/cmdline`, 'utf8');
    } catch {
      return; // disappeared, or permission denied
    }
    const args = raw.split('\0').filter((s) => s.length > 0);
    const tagged = parseProxyArgs(pid, args);
    if (tagged) result.push(tagged);
  });
  return result;
}

/** @internal Exposed for unit tests; not part of the public module API. */
export async function listDarwinProxies(): Promise<TaggedProxy[]> {
  // -ww disables column truncation; otherwise long node cmdlines lose the
  // markers we depend on. -A lists all users' processes (we filter by
  // owner_pid liveness anyway).
  const { stdout } = await execFileAsync('ps', ['-ww', '-A', '-o', 'pid=,command='], {
    timeout: LIST_TIMEOUT_MS,
    maxBuffer: LIST_MAX_BUFFER,
  });
  const result: TaggedProxy[] = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.replace(/\s+$/, '');
    if (!trimmed) continue;
    const match = trimmed.match(/^\s*(\d+)\s+(.*)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const args = match[2].split(/\s+/).filter(Boolean);
    const tagged = parseProxyArgs(pid, args);
    if (tagged) result.push(tagged);
  }
  return result;
}

/** @internal Exposed for unit tests; not part of the public module API. */
export async function listWindowsProxies(): Promise<TaggedProxy[]> {
  // Get-CimInstance is the modern path; wmic is deprecated and missing on
  // fresh Windows 11 installs. ConvertTo-Json -Compress keeps stdout small.
  // -NoProfile skips loading user profile scripts (faster, more deterministic).
  const ps = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress`;
  let stdout: string;
  try {
    const r = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', ps], {
      timeout: LIST_TIMEOUT_MS,
      maxBuffer: LIST_MAX_BUFFER,
      windowsHide: true,
    });
    stdout = r.stdout;
  } catch {
    return [];
  }
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  const result: TaggedProxy[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as { ProcessId?: number; CommandLine?: string | null };
    const pid = obj.ProcessId;
    const cmdline = obj.CommandLine;
    if (typeof pid !== 'number' || typeof cmdline !== 'string') continue;
    // Naive whitespace split is enough: a path containing spaces fragments,
    // but the fragment holding 'proxy-bootstrap.js' survives intact, and the
    // --mcp-* marker args never contain whitespace.
    const args = cmdline.split(/\s+/).filter(Boolean);
    const tagged = parseProxyArgs(pid, args);
    if (tagged) result.push(tagged);
  }
  return result;
}

/**
 * Two-factor identification: a token containing the proxy-bootstrap script
 * name AND a valid --mcp-owner-pid marker. Untagged bootstrap processes
 * (pre-upgrade workers) and malformed tags are ignored, never killed.
 *
 * @internal Exposed for unit tests; not part of the public module API.
 */
export function parseProxyArgs(pid: number, args: string[]): TaggedProxy | null {
  let hasMarker = false;
  let ownerPid = -1;
  let sessionId = '';
  for (const a of args) {
    if (a.includes(PROXY_BOOTSTRAP_MARKER)) {
      hasMarker = true;
    } else if (a.startsWith(OWNER_PID_ARG_PREFIX)) {
      const v = Number(a.slice(OWNER_PID_ARG_PREFIX.length));
      if (Number.isFinite(v) && v > 0) ownerPid = v;
    } else if (a.startsWith(SESSION_ID_ARG_PREFIX)) {
      sessionId = a.slice(SESSION_ID_ARG_PREFIX.length);
    }
  }
  if (!hasMarker || ownerPid <= 0) return null;
  return { pid, ownerPid, sessionId };
}

const defaultSignal: SignalFn = (pid, signal) => process.kill(pid, signal);

/** Injectable so escalation tests run instantly instead of really sleeping. */
export type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @internal Exposed for unit tests; not part of the public module API. */
export function defaultKillProxy(pid: number): Promise<boolean> {
  return process.platform === 'win32' ? killWindows(pid) : killPosixWithEscalation(pid);
}

/**
 * SIGTERM the worker so its own shutdown handler cascades the adapter
 * group/tree kill, poll for exit, and SIGKILL only a wedged survivor.
 *
 * @internal Exposed for unit tests; not part of the public module API.
 */
export async function killPosixWithEscalation(
  pid: number,
  signal: SignalFn = defaultSignal,
  isAlive: (pid: number) => boolean = isPidAlive,
  sleep: SleepFn = defaultSleep,
  pollMs: number = TERM_POLL_MS,
  capMs: number = TERM_WAIT_CAP_MS,
): Promise<boolean> {
  try {
    signal(pid, 'SIGTERM');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') return false; // already gone — fine
    if (code === 'EPERM') return false; // owned by another user — leave alone
    throw e;
  }
  for (let waited = 0; waited < capMs; waited += pollMs) {
    await sleep(pollMs);
    if (!isAlive(pid)) {
      return true; // shutdown cascade completed on its own — no SIGKILL needed
    }
  }
  // Wedged past the cap: escalate. The cascade window has passed, so any
  // adapter descendants the worker failed to clean are already lost to us.
  try {
    signal(pid, 'SIGKILL');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    // Died between the last poll and the escalation — still a successful reap.
    if (code !== 'ESRCH') throw e;
  }
  return true;
}

/**
 * taskkill /T sweeps the worker's whole child tree; /F is required because
 * Windows has no graceful cross-process signal to trigger the JS handler.
 *
 * @internal Exposed for unit tests; not part of the public module API.
 */
export async function killWindows(pid: number): Promise<boolean> {
  try {
    await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      timeout: LIST_TIMEOUT_MS,
      windowsHide: true,
    });
    return true;
  } catch (e) {
    const code = (e as { code?: number | string }).code;
    if (code === 128) return false; // process not found — already gone
    if (code === 1) return false; // access denied — not ours to kill
    throw e;
  }
}
