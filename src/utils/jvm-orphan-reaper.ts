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
import { scanLinux, scanDarwin, scanWindows, scanProcessArgs, type ScannedProcess } from './process-scan.js';

const JVM_MARKER = '-Dmcp.debugger.jvm=true';
const OWNER_PID_PREFIX = '-Dmcp.debugger.owner_pid=';
const SESSION_TAG_PREFIX = '-Dmcp.debugger.session_tag=';

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

// The platform walks live in process-scan.ts (issue #399: shared with the
// proxy reaper); these wrappers apply the JVM matcher over the scan rows.
function matchTaggedJvms(processes: ScannedProcess[]): TaggedJvm[] {
  const result: TaggedJvm[] = [];
  for (const p of processes) {
    const tagged = parseArgs(p.pid, p.args);
    if (tagged) result.push(tagged);
  }
  return result;
}

export async function listTaggedJvms(): Promise<TaggedJvm[]> {
  return matchTaggedJvms(await scanProcessArgs({ windowsProcessNames: ['java.exe'] }));
}

/** @internal Exposed for unit tests; not part of the public module API. */
export async function listLinux(): Promise<TaggedJvm[]> {
  return matchTaggedJvms(await scanLinux());
}

/** @internal Exposed for unit tests; not part of the public module API. */
export async function listDarwin(): Promise<TaggedJvm[]> {
  return matchTaggedJvms(await scanDarwin());
}

/** @internal Exposed for unit tests; not part of the public module API. */
export async function listWindows(): Promise<TaggedJvm[]> {
  return matchTaggedJvms(await scanWindows(['java.exe']));
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
