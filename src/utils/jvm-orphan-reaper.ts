/**
 * Cross-platform reaper for orphan debuggee JVMs left behind by prior
 * mcp-debugger runs that crashed or were SIGKILLed.
 *
 * The Java adapter stamps every debuggee JVM with -D system properties that
 * identify it as ours and record the PID of the mcp-debugger process that
 * owned the session:
 *   -Dmcp.debugger.jvm=true
 *   -Dmcp.debugger.owner_pid=<pid>
 *   -Dmcp.debugger.session_tag=<uuid>
 *
 * On startup, this reaper enumerates running JVMs, finds the tagged ones whose
 * owner_pid is no longer alive, and SIGKILLs them. JVMs whose owner is still
 * alive (concurrent mcp-debugger instance) are left alone.
 *
 * Only listing tagged JVMs is platform-divergent. The kill path uses Node's
 * portable process.kill, which maps to TerminateProcess on Windows.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';

const execFileAsync = promisify(execFile);

const JVM_MARKER = '-Dmcp.debugger.jvm=true';
const OWNER_PID_PREFIX = '-Dmcp.debugger.owner_pid=';
const SESSION_TAG_PREFIX = '-Dmcp.debugger.session_tag=';

const LIST_TIMEOUT_MS = 5000;
const LIST_MAX_BUFFER = 10 * 1024 * 1024;

export interface TaggedJvm {
  pid: number;
  ownerPid: number;
  sessionTag: string;
}

export interface ReaperLogger {
  info?: (msg: string) => void;
  warn?: (msg: string) => void;
  error?: (msg: string) => void;
}

export interface ReapResult {
  scanned: number;
  killed: TaggedJvm[];
  skipped: TaggedJvm[];
  errors: string[];
}

export interface ReapOptions {
  selfPid: number;
  logger?: ReaperLogger;
  // Test seams: override platform calls without monkey-patching child_process.
  lister?: () => Promise<TaggedJvm[]>;
  isAlive?: (pid: number) => boolean;
  killer?: (pid: number) => boolean;
}

export async function reapOrphanJvms(opts: ReapOptions): Promise<ReapResult> {
  const lister = opts.lister ?? listTaggedJvms;
  const isAlive = opts.isAlive ?? isPidAlive;
  const killer = opts.killer ?? defaultKill;
  const log = opts.logger;

  const result: ReapResult = { scanned: 0, killed: [], skipped: [], errors: [] };

  let jvms: TaggedJvm[];
  try {
    jvms = await lister();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log?.warn?.(`[jvm-reaper] Failed to list JVMs: ${msg}`);
    result.errors.push(msg);
    return result;
  }

  result.scanned = jvms.length;

  for (const jvm of jvms) {
    // Don't touch JVMs owned by the current process or any live mcp-debugger.
    // selfPid guard also defends against the rare case where a recycled PID
    // happens to match the marker we'd stamp on our own children.
    if (jvm.ownerPid === opts.selfPid || isAlive(jvm.ownerPid)) {
      result.skipped.push(jvm);
      continue;
    }
    try {
      const ok = killer(jvm.pid);
      if (ok) {
        result.killed.push(jvm);
        log?.info?.(
          `[jvm-reaper] Killed orphan JVM pid=${jvm.pid} owner_pid=${jvm.ownerPid} tag=${jvm.sessionTag}`,
        );
      } else {
        // already gone, or permission denied; either way not actionable
        result.skipped.push(jvm);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log?.warn?.(`[jvm-reaper] Failed to kill pid=${jvm.pid}: ${msg}`);
      result.errors.push(msg);
    }
  }
  return result;
}

export async function listTaggedJvms(): Promise<TaggedJvm[]> {
  switch (process.platform) {
    case 'linux':
      return listLinux();
    case 'darwin':
      return listDarwin();
    case 'win32':
      return listWindows();
    default:
      return [];
  }
}

/** @internal Exposed for unit tests; not part of the public module API. */
export async function listLinux(): Promise<TaggedJvm[]> {
  let entries: string[];
  try {
    entries = await fs.readdir('/proc');
  } catch {
    return [];
  }
  const result: TaggedJvm[] = [];
  await Promise.all(
    entries.map(async (entry) => {
      if (!/^\d+$/.test(entry)) return;
      const pid = Number(entry);
      let raw: string;
      try {
        raw = await fs.readFile(`/proc/${entry}/cmdline`, 'utf8');
      } catch {
        return; // disappeared, or permission denied
      }
      const args = raw.split('\0').filter((s) => s.length > 0);
      const tagged = parseArgs(pid, args);
      if (tagged) result.push(tagged);
    }),
  );
  return result;
}

/** @internal Exposed for unit tests; not part of the public module API. */
export async function listDarwin(): Promise<TaggedJvm[]> {
  // -ww disables column truncation; otherwise long java cmdlines lose the
  // -D markers we depend on. -A lists all users' processes (we filter by
  // owner_pid liveness anyway).
  const { stdout } = await execFileAsync('ps', ['-ww', '-A', '-o', 'pid=,command='], {
    timeout: LIST_TIMEOUT_MS,
    maxBuffer: LIST_MAX_BUFFER,
  });
  const result: TaggedJvm[] = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.replace(/\s+$/, '');
    if (!trimmed) continue;
    const match = trimmed.match(/^\s*(\d+)\s+(.*)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const args = match[2].split(/\s+/).filter(Boolean);
    const tagged = parseArgs(pid, args);
    if (tagged) result.push(tagged);
  }
  return result;
}

/** @internal Exposed for unit tests; not part of the public module API. */
export async function listWindows(): Promise<TaggedJvm[]> {
  // Get-CimInstance is the modern path; wmic is deprecated and missing on
  // fresh Windows 11 installs. ConvertTo-Json -Compress keeps stdout small.
  // -NoProfile skips loading user profile scripts (faster, more deterministic).
  const ps = `Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress`;
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
  const result: TaggedJvm[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as { ProcessId?: number; CommandLine?: string | null };
    const pid = obj.ProcessId;
    const cmdline = obj.CommandLine;
    if (typeof pid !== 'number' || typeof cmdline !== 'string') continue;
    // -D args don't contain unescaped whitespace, so naive split is enough.
    const args = cmdline.split(/\s+/).filter(Boolean);
    const tagged = parseArgs(pid, args);
    if (tagged) result.push(tagged);
  }
  return result;
}

/** @internal Exposed for unit tests; not part of the public module API. */
export function parseArgs(pid: number, args: string[]): TaggedJvm | null {
  let hasMarker = false;
  let ownerPid = -1;
  let sessionTag = '';
  for (const a of args) {
    if (a === JVM_MARKER) {
      hasMarker = true;
    } else if (a.startsWith(OWNER_PID_PREFIX)) {
      const v = Number(a.slice(OWNER_PID_PREFIX.length));
      if (Number.isFinite(v) && v > 0) ownerPid = v;
    } else if (a.startsWith(SESSION_TAG_PREFIX)) {
      sessionTag = a.slice(SESSION_TAG_PREFIX.length);
    }
  }
  if (!hasMarker || ownerPid <= 0) return null;
  return { pid, ownerPid, sessionTag };
}

/** Sends a signal to a pid; injectable so tests never spy the global process.kill (issue #183). */
export type SignalFn = (pid: number, signal: NodeJS.Signals | number) => void;

const defaultSignal: SignalFn = (pid, signal) => process.kill(pid, signal);

export function isPidAlive(pid: number, signal: SignalFn = defaultSignal): boolean {
  if (pid <= 0) return false;
  try {
    signal(pid, 0);
    return true;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    // EPERM means the process exists but we lack permission to signal it —
    // count it as alive (it's not orphan-eligible from our perspective).
    if (code === 'EPERM') return true;
    return false; // ESRCH or anything else: treat as dead
  }
}

/** @internal Exposed for unit tests; not part of the public module API. */
export function defaultKill(pid: number, signal: SignalFn = defaultSignal): boolean {
  try {
    signal(pid, 'SIGKILL');
    return true;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') return false; // already gone — fine
    if (code === 'EPERM') return false; // owned by another user — leave alone
    throw e;
  }
}
