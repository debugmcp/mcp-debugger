/**
 * Attach by PID for JavaScript (issue #871): activate the V8 inspector of a
 * running Node.js process, then hand js-debug a port.
 *
 * js-debug's DAP server never reads `processId`. In VS Code the PID step
 * lives in the extension's process picker: send SIGUSR1 (POSIX) or call
 * `process._debugProcess(pid)` (Windows), then attach to the port the
 * inspector opens — 9229 unless the target was started with
 * `--inspect-port`. This module is that step.
 *
 * Whose inspector is on the port? Node uses the script path as the `/json/list`
 * title, so a title ending in `[<digits>]` can be a filename rather than a PID
 * (issue #1332). Ownership is therefore asked of the inspector itself first —
 * one bounded CDP session evaluating `process.pid` — and the title is read only
 * as a fallback when asking fails (e.g. a paused target or busy event loop),
 * never stated as a confirmed PID. When neither identifies the owner, an
 * inspector that opened right after our signal is taken as ours, while one that
 * was already open is refused.
 *
 * Safety: SIGUSR1's default disposition is *terminate*. On POSIX the target
 * is confirmed to be a Node.js executable before it is signalled, a PID that
 * cannot be identified is refused rather than signalled, and a target whose
 * command line or NODE_OPTIONS carries `--disable-sigusr1` (Node 22.14+:
 * no handler is installed, so the signal would kill it) is refused by name
 * where that can be seen. On Windows `process._debugProcess` fails
 * harmlessly on a non-Node target.
 */
import * as http from 'node:http';
import * as path from 'node:path';
import { readlink, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AdapterError, AdapterErrorCode, isLoopbackHost } from '@debugmcp/shared';

const execFileAsync = promisify(execFile);

/** Node's default inspector port, where SIGUSR1 / `_debugProcess` opens it. */
export const DEFAULT_INSPECTOR_PORT = 9229;

/** Bound on a single `/json/list` HTTP probe. */
export const DEFAULT_PROBE_TIMEOUT_MS = 1000;

/**
 * Bound on asking an inspector target for its `process.pid` over CDP (issue #1332).
 * A target paused at a breakpoint or stuck in a busy event loop does not answer
 * `Runtime.evaluate`, so asking times out here and falls back to the title.
 */
export const DEFAULT_PID_QUERY_TIMEOUT_MS = 1500;

export interface InspectorTarget {
  id?: string;
  title?: string;
  type?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
}

/** What answered on the port: nothing, a Node inspector, or something else. */
export type InspectorProbe =
  | { status: 'closed' }
  | { status: 'inspector'; targets: InspectorTarget[] }
  | { status: 'other'; detail: string };

export interface InspectorActivationOptions {
  /** The target's PID (a numeric string is accepted). */
  pid: number | string;
  /** Loopback only (default 127.0.0.1). */
  host?: string;
  /** Where the inspector is, or will open (default 9229). */
  port?: number;
  /** How long to wait for the inspector after signalling (default 5000 ms). */
  deadlineMs?: number;
  /** Probe interval while waiting (default 100 ms). */
  pollMs?: number;
  /** Injection points — defaults are the real thing. */
  platform?: NodeJS.Platform;
  container?: boolean;
  processExists?: (pid: number) => boolean;
  /** true / false, or undefined when the executable could not be identified. */
  isNodeProcess?: (pid: number) => Promise<boolean | undefined>;
  /** Was the target started with --disable-sigusr1? undefined when that cannot be seen. */
  inspectorSignalDisabled?: (pid: number) => Promise<boolean | undefined>;
  /** This server's own PID (default process.pid) — never a valid target. */
  selfPid?: number;
  signal?: (pid: number) => void;
  listTargets?: (host: string, port: number, timeoutMs?: number) => Promise<InspectorProbe>;
  /** Ask the inspector behind a target for its `process.pid`, or undefined when it did not answer. */
  pidOf?: (target: InspectorTarget, timeoutMs?: number) => Promise<number | undefined>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface InspectorActivationResult {
  host: string;
  port: number;
  /** The inspector was already open on the port (no signal was sent). */
  alreadyActive: boolean;
  /** The inspector target's title (script path or `<process title>[<pid>]`). */
  title: string;
  /** Present only when the inspector did not answer `process.pid` and ownership fell back to the title. */
  ownershipNote?: string;
}

// Loopback is decided by the shared `isLoopbackHost` (issue #903). A
// signal-opened inspector binds 127.0.0.1 only, so every accepted spelling
// is probed — and handed to js-debug — as 127.0.0.1.
const NODE_EXECUTABLE = /^node(?:js)?(?:\d+(?:\.\d+)*)?(?:\.exe)?$/i;
const DISABLE_SIGUSR1 = /(?:^|[\s\0=])--disable-sigusr1(?:$|[\s\0])/;

function invalid(message: string): AdapterError {
  return new AdapterError(`JavaScript attach: ${message}`, AdapterErrorCode.ENVIRONMENT_INVALID);
}

/**
 * An activation that failed after it had signalled the process (issue
 * #1261): its message says so, and the adapter reports what the attach left.
 */
export class SignalledActivationError extends AdapterError {
  constructor(message: string, readonly pid: number, readonly host: string, readonly port: number) {
    super(message, AdapterErrorCode.ENVIRONMENT_INVALID);
    this.name = 'SignalledActivationError';
  }
}

/** A target list entry is a Node inspector's when it names a Node target and its WebSocket address. */
function isNodeTarget(target: unknown): target is InspectorTarget {
  const t = target as InspectorTarget | null;
  return typeof t === 'object' && t !== null && t.type === 'node' &&
    typeof t.webSocketDebuggerUrl === 'string' && t.webSocketDebuggerUrl.length > 0;
}

function parsePid(raw: number | string): number {
  const text = String(raw).trim();
  const pid = typeof raw === 'number' ? raw : /^\d+$/.test(text) ? Number(text) : NaN;
  if (!Number.isInteger(pid) || pid <= 0) {
    throw invalid(`processId must be a positive integer (got ${JSON.stringify(raw)})`);
  }
  return pid;
}

function pidOfTitle(title: string | undefined): number | undefined {
  const match = /\[(\d+)\]\s*$/.exec(title ?? '');
  return match ? Number(match[1]) : undefined;
}

interface MinimalWebSocket {
  send(data: string): void;
  close(): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
}
type WebSocketConstructor = new (url: string) => MinimalWebSocket;

/**
 * Ask the inspector behind `webSocketDebuggerUrl` for its `process.pid` over
 * one short CDP session (Node 22+ ships a global WebSocket). `undefined` when
 * it cannot be told: no answer within `timeoutMs` (a paused target does not
 * evaluate), a refused connection, or no WebSocket in this runtime.
 */
export function pidViaInspector(
  webSocketDebuggerUrl: string,
  timeoutMs = DEFAULT_PID_QUERY_TIMEOUT_MS,
  abortSignal?: AbortSignal
): Promise<number | undefined> {
  if (timeoutMs <= 0 || abortSignal?.aborted) return Promise.resolve(undefined);
  const WebSocketImpl = (globalThis as { WebSocket?: WebSocketConstructor }).WebSocket;
  if (typeof WebSocketImpl !== 'function') return Promise.resolve(undefined);
  return new Promise((resolve) => {
    let socket: MinimalWebSocket | undefined;
    let settled = false;
    const onAbort = (): void => finish(undefined);
    const finish = (pid?: number): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      abortSignal?.removeEventListener('abort', onAbort);
      try { socket?.close(); } catch { /* already closed */ }
      resolve(pid);
    };
    const timer = setTimeout(() => finish(undefined), timeoutMs);
    abortSignal?.addEventListener('abort', onAbort, { once: true });
    try {
      socket = new WebSocketImpl(webSocketDebuggerUrl);
    } catch {
      finish(undefined);
      return;
    }
    socket.onopen = () => {
      try {
        socket!.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'process.pid', returnByValue: true } }));
      } catch {
        finish(undefined);
      }
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as { id?: number; result?: { result?: { value?: unknown } } };
        if (message.id !== 1) return;
        const value = message.result?.result?.value;
        finish(typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined);
      } catch {
        finish(undefined);
      }
    };
    socket.onerror = () => finish(undefined);
    socket.onclose = () => finish(undefined);
  });
}

/** Ask the inspector behind a target for its `process.pid` over CDP; never trusts the title. */
async function defaultPidOf(
  target: InspectorTarget,
  timeoutMs = DEFAULT_PID_QUERY_TIMEOUT_MS,
  abortSignal?: AbortSignal
): Promise<number | undefined> {
  if (typeof target.webSocketDebuggerUrl !== 'string') return undefined;
  return pidViaInspector(target.webSocketDebuggerUrl, timeoutMs, abortSignal);
}

function describeTargets(targets: InspectorTarget[]): string {
  const titles = targets.map((t) => t.title).filter((t): t is string => typeof t === 'string' && t.length > 0);
  return titles.length > 0 ? titles.join(', ') : 'an inspector with no target title';
}

function defaultProcessExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: the process exists but belongs to another user.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Is `pid` a Node.js process? Linux reads /proc/<pid>/exe (then cmdline
 * arg 0), darwin asks `ps`. `undefined` means it could not be told — the
 * caller refuses to signal in that case. Windows is never asked (see the
 * module comment).
 */
export async function isNodeProcessByPid(pid: number, platform: NodeJS.Platform = process.platform): Promise<boolean | undefined> {
  try {
    if (platform === 'linux') {
      let executable: string | undefined;
      try {
        executable = await readlink(`/proc/${pid}/exe`);
      } catch {
        const cmdline = await readFile(`/proc/${pid}/cmdline`, 'utf8');
        executable = cmdline.split('\0')[0];
      }
      if (!executable) return undefined;
      // A deleted-on-upgrade binary reads as "/usr/bin/node (deleted)".
      return NODE_EXECUTABLE.test(path.basename(executable).replace(/ \(deleted\)$/, ''));
    }
    if (platform === 'darwin') {
      const { stdout } = await execFileAsync('ps', ['-o', 'comm=', '-p', String(pid)], { windowsHide: true, timeout: 3000 });
      const executable = stdout.trim();
      if (!executable) return undefined;
      return NODE_EXECUTABLE.test(path.basename(executable));
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Was `pid` started with `--disable-sigusr1` (on its command line, or in
 * NODE_OPTIONS)? Node then installs no SIGUSR1 handler and the signal would
 * terminate it. Linux reads /proc/<pid>/cmdline and environ; darwin asks
 * `ps -E`. `undefined` when it cannot be seen (another user's process) — the
 * caller proceeds, and the docs name that residual case.
 */
export async function inspectorSignalDisabledByPid(pid: number, platform: NodeJS.Platform = process.platform): Promise<boolean | undefined> {
  try {
    if (platform === 'linux') {
      const cmdline = await readFile(`/proc/${pid}/cmdline`, 'utf8');
      if (DISABLE_SIGUSR1.test(cmdline)) return true;
      let environ: string;
      try {
        environ = await readFile(`/proc/${pid}/environ`, 'utf8');
      } catch {
        return undefined;
      }
      const nodeOptions = environ.split('\0').find((entry) => entry.startsWith('NODE_OPTIONS='));
      return nodeOptions !== undefined && DISABLE_SIGUSR1.test(nodeOptions);
    }
    if (platform === 'darwin') {
      // -E appends the environment to the command line (own processes only).
      const { stdout } = await execFileAsync('ps', ['-E', '-o', 'args=', '-p', String(pid)], { windowsHide: true, timeout: 3000 });
      if (!stdout.trim()) return undefined;
      return DISABLE_SIGUSR1.test(stdout);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function defaultSignal(pid: number, platform: NodeJS.Platform): void {
  if (platform === 'win32') {
    // Undocumented but stable since Node 0.x: it is what `node --inspect`'s
    // process picker and VS Code use to open the inspector of a running process.
    const debugProcess = (process as unknown as { _debugProcess?: (pid: number) => void })._debugProcess;
    if (typeof debugProcess !== 'function') {
      throw invalid('this Node.js build has no process._debugProcess, so a running process cannot be made debuggable from here; start the target with --inspect and pass port');
    }
    debugProcess(pid);
    return;
  }
  process.kill(pid, 'SIGUSR1');
}

/** A /json/list body larger than this is not an inspector's (a Node target list is well under 1 KiB). */
const PROBE_MAX_BODY_BYTES = 64 * 1024;

/**
 * GET http://host:port/json/list and classify what answered. `timeoutMs`
 * bounds the whole request (issue #1261): a responder that stays silent, or
 * keeps sending, is answered "other" when it passes and its connection is
 * destroyed; a body larger than any inspector's is answered "other" at once.
 */
export function probeInspector(
  host: string,
  port: number,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
  abortSignal?: AbortSignal
): Promise<InspectorProbe> {
  if (timeoutMs <= 0 || abortSignal?.aborted) {
    return Promise.resolve({ status: 'other', detail: `no answer from /json/list within ${Math.max(0, timeoutMs)} ms` });
  }
  return new Promise((resolve) => {
    let settled = false;
    const onAbort = (): void => finish({ status: 'other', detail: `no answer from /json/list within ${timeoutMs} ms` });
    const finish = (probe: InspectorProbe): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      abortSignal?.removeEventListener('abort', onAbort);
      request.destroy();
      resolve(probe);
    };
    const request = http.get({ host, port, path: '/json/list', agent: false }, (response) => {
      const chunks: Buffer[] = [];
      let received = 0;
      response.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received > PROBE_MAX_BODY_BYTES) {
          finish({ status: 'other', detail: `/json/list answered with more than ${PROBE_MAX_BODY_BYTES} bytes` });
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode !== 200) {
          finish({ status: 'other', detail: `HTTP ${response.statusCode} from /json/list` });
          return;
        }
        try {
          const parsed: unknown = JSON.parse(body);
          if (Array.isArray(parsed)) {
            // A Node inspector lists its target with a type and a WebSocket
            // address, even with a client attached (issue #1261): a bare JSON
            // array is some other HTTP server.
            const targets = parsed.filter(isNodeTarget);
            finish(targets.length > 0
              ? { status: 'inspector', targets }
              : { status: 'other', detail: `/json/list answered a list with no Node inspector target in it (${parsed.length} ${parsed.length === 1 ? 'entry' : 'entries'})` });
            return;
          }
        } catch {
          // not JSON — fall through
        }
        finish({ status: 'other', detail: `/json/list answered with something other than a target list` });
      });
      response.on('error', (err) => finish({ status: 'other', detail: err.message }));
    });
    const timer = setTimeout(() => finish({ status: 'other', detail: `no answer from /json/list within ${timeoutMs} ms` }), timeoutMs);
    abortSignal?.addEventListener('abort', onAbort, { once: true });
    request.on('error', (err: NodeJS.ErrnoException) => {
      finish(err.code === 'ECONNREFUSED' ? { status: 'closed' } : { status: 'other', detail: err.message });
    });
  });
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Make the inspector of `pid` reachable on `host:port` and say where it is.
 * Every failure is an AdapterError whose message names what to do instead.
 */
export async function activateInspector(options: InspectorActivationOptions): Promise<InspectorActivationResult> {
  const pid = parsePid(options.pid);
  const requestedHost = options.host ?? '127.0.0.1';
  const port = options.port ?? DEFAULT_INSPECTOR_PORT;
  const platform = options.platform ?? process.platform;
  const container = options.container ?? process.env.MCP_CONTAINER === 'true';
  const selfPid = options.selfPid ?? process.pid;
  const processExists = options.processExists ?? defaultProcessExists;
  const isNodeProcess = options.isNodeProcess ?? ((p: number) => isNodeProcessByPid(p, platform));
  const inspectorSignalDisabled = options.inspectorSignalDisabled ?? ((p: number) => inspectorSignalDisabledByPid(p, platform));
  const signal = options.signal ?? ((p: number) => defaultSignal(p, platform));
  const listTargets = options.listTargets;
  const pidOf = options.pidOf;
  const sleep = options.sleep ?? wait;
  const now = options.now ?? Date.now;
  const deadlineMs = options.deadlineMs ?? 5000;
  const pollMs = options.pollMs ?? 100;

  if (!isLoopbackHost(requestedHost)) {
    throw invalid(`attach by processId is local only (host ${requestedHost}); for a remote target start it with --inspect and pass host/port`);
  }
  const host = '127.0.0.1';
  const where = `${host}:${port}`;
  if (pid === selfPid) {
    throw invalid(`PID ${pid} is this mcp-debugger server itself; a debugger pausing its own driver would freeze the attach — pick the process you mean`);
  }
  if (!processExists(pid)) {
    throw invalid(
      `no process with PID ${pid}` +
        (container ? ' — the server runs in a container and can only reach PIDs in its own PID namespace' : '')
    );
  }

  // Ask the inspector for `process.pid` first; only fall back to a `[digits]`
  // title suffix when asking fails (issue #1332).
  type TargetOwner = { pid: number; source: 'inspector' | 'title' };
  const resolveOwner = async (
    target: InspectorTarget,
    queryTimeoutMs?: number,
    abortSignal?: AbortSignal
  ): Promise<TargetOwner | undefined> => {
    const answered = pidOf
      ? (queryTimeoutMs === undefined ? await pidOf(target) : await pidOf(target, queryTimeoutMs))
      : await defaultPidOf(target, queryTimeoutMs ?? DEFAULT_PID_QUERY_TIMEOUT_MS, abortSignal);
    if (answered !== undefined) return { pid: answered, source: 'inspector' };
    const fromTitle = pidOfTitle(target.title);
    return fromTitle !== undefined ? { pid: fromTitle, source: 'title' } : undefined;
  };

  // After our signal a transient probe failure (ECONNRESET or a read timeout
  // while the inspector's HTTP server comes up) is not a verdict — keep
  // polling and name it only if the deadline passes.
  let lastTransient: string | undefined;
  const classify = async (
    probe: InspectorProbe,
    afterSignal: boolean,
    remainingMs?: number,
    abortSignal?: AbortSignal
  ): Promise<InspectorActivationResult | undefined> => {
    if (probe.status === 'closed') return undefined;
    if (probe.status === 'other') {
      if (afterSignal) {
        lastTransient = probe.detail;
        return undefined;
      }
      throw invalid(`${where} is in use by something that is not a Node inspector (${probe.detail}); pass port if PID ${pid} listens elsewhere, or free the port`);
    }
    const queryTimeoutMs = remainingMs !== undefined ? Math.min(DEFAULT_PID_QUERY_TIMEOUT_MS, remainingMs) : undefined;
    const owners = await Promise.all(probe.targets.map((target) => resolveOwner(target, queryTimeoutMs, abortSignal)));

    const confirmedIndex = owners.findIndex((owner) => owner?.source === 'inspector' && owner.pid === pid);
    if (confirmedIndex >= 0) {
      return { host, port, alreadyActive: !afterSignal, title: probe.targets[confirmedIndex].title ?? '' };
    }
    const confirmedOther = owners.find((owner) => owner?.source === 'inspector' && owner.pid !== pid);
    if (confirmedOther !== undefined) {
      const held = `${where} is already held by a Node inspector for a different process (PID ${confirmedOther.pid}: ${describeTargets(probe.targets)})`;
      // After the signal, the failure says the signal was sent (below).
      throw afterSignal ? new Error(held) : invalid(`${held}; pass port if PID ${pid} listens elsewhere, or free the port`);
    }
    const titleIndex = owners.findIndex((owner) => owner?.source === 'title' && owner.pid === pid);
    if (titleIndex >= 0) {
      const matchedTitle = probe.targets[titleIndex].title ?? '';
      return {
        host,
        port,
        alreadyActive: !afterSignal,
        title: matchedTitle,
        ownershipNote: `the inspector on ${where} did not answer process.pid; target title ${matchedTitle} matched PID ${pid}, but ownership was not confirmed`
      };
    }
    const titleOther = owners.find((owner) => owner?.source === 'title' && owner.pid !== pid);
    if (titleOther !== undefined) {
      const held = `${where} is already held by a Node inspector (${describeTargets(probe.targets)}) that did not answer process.pid — its target title does not match PID ${pid}`;
      throw afterSignal
        ? new Error(held)
        : invalid(`${held}; if it is PID ${pid}'s, attach by port instead of processId, otherwise pass port if PID ${pid} listens elsewhere or free the port`);
    }
    if (afterSignal) {
      // Closed before our signal, open right after it: PID pid's, even though
      // it did not say so (a target paused at a breakpoint cannot answer).
      return { host, port, alreadyActive: false, title: probe.targets[0]?.title ?? '' };
    }
    throw invalid(
      `${where} is already held by a Node inspector (${describeTargets(probe.targets)}) that could not be confirmed to be PID ${pid}'s — ` +
        `most often another debugger is attached and holds the target paused; if it is PID ${pid}'s, attach by port instead of processId, otherwise free the port`
    );
  };

  const firstProbe = listTargets ? await listTargets(host, port) : await probeInspector(host, port);
  const before = await classify(firstProbe, false);
  if (before) return before;

  if (platform !== 'win32') {
    const isNode = await isNodeProcess(pid);
    if (isNode === false) {
      throw invalid(`PID ${pid} is not a Node.js process; only a Node.js process can open an inspector on request, and signalling anything else would terminate it — start the target with --inspect and pass port`);
    }
    if (isNode === undefined) {
      throw invalid(`could not confirm that PID ${pid} is a Node.js process, so it was not signalled (SIGUSR1 terminates a process that does not handle it) — start the target with --inspect and pass port`);
    }
    if (await inspectorSignalDisabled(pid) === true) {
      throw invalid(`PID ${pid} was started with --disable-sigusr1, so no signal can open its inspector (it would terminate the process instead) — start the target with --inspect and pass port`);
    }
  }

  try {
    signal(pid);
  } catch (err) {
    if (err instanceof AdapterError) throw err;
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EPERM') {
      throw invalid(`not permitted to signal PID ${pid} (EPERM) — is it running as another user?`);
    }
    if (code === 'ESRCH') {
      throw invalid(`no process with PID ${pid} (it exited before it could be signalled)`);
    }
    const detail = err instanceof Error ? err.message : String(err);
    const hint = platform === 'win32'
      ? ' — on Windows this is what a process that is not Node.js (or a Node.js started with --disable-sigusr1) answers; start the target with --inspect and pass port'
      : '';
    throw invalid(`could not activate the inspector of PID ${pid}: ${detail}${hint}`);
  }

  // From here the signal has been sent: every failure says so, and that an
  // inspector may now be open elsewhere, not looked for (issue #1310); this
  // server closes none (issue #1261).
  const signalled = (why: string): SignalledActivationError => new SignalledActivationError(
    `JavaScript attach: PID ${pid} was signalled to open its inspector, but ${why}; ` +
      `one may now be open on another port (a target started with --inspect-port=<n> opens it there), ` +
      `and this server does not close it (#1310). To attach to it, pass that port with processId`,
    pid, host, port
  );
  // Strict wait bound (issue #1339): every probe's timeout is capped by the
  // time remaining, no probe is started once nothing remains, and any probe or
  // ownership query still in flight when the deadline passes is cut off.
  const deadlineError = (): SignalledActivationError =>
    signalled(`none appeared on ${where} within ${deadlineMs} ms` + (lastTransient ? ` (last probe: ${lastTransient})` : ''));
  const deadline = now() + deadlineMs;
  if (deadlineMs <= 0) {
    throw deadlineError();
  }
  const abortController = new AbortController();
  let deadlineReached = false;
  const onDeadlineListeners: Array<() => void> = [];
  const deadlineTimer = setTimeout(() => {
    deadlineReached = true;
    abortController.abort();
    for (const notify of onDeadlineListeners.splice(0)) notify();
  }, deadlineMs);
  const raceDeadline = <T>(promise: Promise<T>): Promise<T> => new Promise<T>((resolve, reject) => {
    if (deadlineReached) {
      promise.catch(() => { /* discard late settlement after deadline */ });
      reject(deadlineError());
      return;
    }
    const onDeadline = (): void => reject(deadlineError());
    const detach = (): void => {
      const idx = onDeadlineListeners.indexOf(onDeadline);
      if (idx >= 0) onDeadlineListeners.splice(idx, 1);
    };
    onDeadlineListeners.push(onDeadline);
    promise.then(
      (value) => { detach(); resolve(value); },
      (err) => { detach(); reject(err); }
    );
  });
  try {
    for (;;) {
      const beforeSleep = deadline - now();
      if (beforeSleep <= 0) {
        throw deadlineError();
      }
      await raceDeadline(sleep(Math.min(pollMs, beforeSleep)));
      const remainingForProbe = deadline - now();
      if (remainingForProbe <= 0) {
        throw deadlineError();
      }
      const probeTimeout = Math.min(DEFAULT_PROBE_TIMEOUT_MS, remainingForProbe);
      const probe = await raceDeadline(
        listTargets
          ? listTargets(host, port, probeTimeout)
          : probeInspector(host, port, probeTimeout, abortController.signal)
      );
      if (probe.status === 'closed') {
        if (now() >= deadline) throw deadlineError();
        continue;
      }
      if (probe.status === 'other') {
        lastTransient = probe.detail;
        if (now() >= deadline) throw deadlineError();
        continue;
      }
      const remainingForClassify = deadline - now();
      if (remainingForClassify <= 0) {
        throw deadlineError();
      }
      const result = await raceDeadline(classify(probe, true, remainingForClassify, abortController.signal));
      if (result) return result;
      if (now() >= deadline) {
        throw deadlineError();
      }
    }
  } catch (err) {
    if (err instanceof SignalledActivationError) throw err;
    throw signalled(err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(deadlineTimer);
  }
}
