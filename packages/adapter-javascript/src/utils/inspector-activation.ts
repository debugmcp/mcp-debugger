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
 * Whose inspector is on the port? The `/json/list` title ends in `[<pid>]`
 * only for a script-less process (`node -e`); for `node script.js` it is the
 * script path. So ownership is asked of the inspector itself — one short CDP
 * session evaluating `process.pid` — and when that cannot be told either (a
 * paused target does not answer), an inspector that opened right after our
 * signal is taken as ours, while one that was already open is refused.
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
import { AdapterError, AdapterErrorCode } from '@debugmcp/shared';

const execFileAsync = promisify(execFile);

/** Node's default inspector port, where SIGUSR1 / `_debugProcess` opens it. */
export const DEFAULT_INSPECTOR_PORT = 9229;

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
  listTargets?: (host: string, port: number) => Promise<InspectorProbe>;
  /** The PID behind an inspector target, or undefined when it cannot be told. */
  pidOf?: (target: InspectorTarget) => Promise<number | undefined>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface InspectorActivationResult {
  host: string;
  port: number;
  /** The inspector was already open on the port (no signal was sent). */
  alreadyActive: boolean;
  /** The inspector target's title, `<process title>[<pid>]`. */
  title: string;
}

/**
 * The spellings of "this host" a caller may pass. A signal-opened inspector
 * binds 127.0.0.1 only, so every one of them is probed — and handed to
 * js-debug — as 127.0.0.1.
 */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const NODE_EXECUTABLE = /^node(?:js)?(?:\d+(?:\.\d+)*)?(?:\.exe)?$/i;
const DISABLE_SIGUSR1 = /(?:^|[\s\0=])--disable-sigusr1(?:$|[\s\0])/;

function invalid(message: string): AdapterError {
  return new AdapterError(`JavaScript attach: ${message}`, AdapterErrorCode.ENVIRONMENT_INVALID);
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
export function pidViaInspector(webSocketDebuggerUrl: string, timeoutMs = 1500): Promise<number | undefined> {
  const WebSocketImpl = (globalThis as { WebSocket?: WebSocketConstructor }).WebSocket;
  if (typeof WebSocketImpl !== 'function') return Promise.resolve(undefined);
  return new Promise((resolve) => {
    let socket: MinimalWebSocket | undefined;
    let settled = false;
    const finish = (pid?: number): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket?.close(); } catch { /* already closed */ }
      resolve(pid);
    };
    const timer = setTimeout(() => finish(undefined), timeoutMs);
    try {
      socket = new WebSocketImpl(webSocketDebuggerUrl);
    } catch {
      finish(undefined);
      return;
    }
    socket.onopen = () => {
      socket!.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'process.pid', returnByValue: true } }));
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as { id?: number; result?: { result?: { value?: unknown } } };
        if (message.id !== 1) return;
        const value = message.result?.result?.value;
        finish(typeof value === 'number' ? value : undefined);
      } catch {
        finish(undefined);
      }
    };
    socket.onerror = () => finish(undefined);
    socket.onclose = () => finish(undefined);
  });
}

/** The PID behind a target: the title's `[pid]` suffix when present, else the inspector's own answer. */
async function defaultPidOf(target: InspectorTarget): Promise<number | undefined> {
  const fromTitle = pidOfTitle(target.title);
  if (fromTitle !== undefined) return fromTitle;
  if (typeof target.webSocketDebuggerUrl !== 'string') return undefined;
  return pidViaInspector(target.webSocketDebuggerUrl);
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

/** GET http://host:port/json/list and classify what answered. */
export function probeInspector(host: string, port: number, timeoutMs = 1000): Promise<InspectorProbe> {
  return new Promise((resolve) => {
    const request = http.get({ host, port, path: '/json/list', timeout: timeoutMs }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode !== 200) {
          resolve({ status: 'other', detail: `HTTP ${response.statusCode} from /json/list` });
          return;
        }
        try {
          const parsed: unknown = JSON.parse(body);
          if (Array.isArray(parsed)) {
            resolve({ status: 'inspector', targets: parsed as InspectorTarget[] });
            return;
          }
        } catch {
          // not JSON — fall through
        }
        resolve({ status: 'other', detail: `/json/list answered with something other than a target list` });
      });
      response.on('error', (err) => resolve({ status: 'other', detail: err.message }));
    });
    request.on('timeout', () => {
      request.destroy();
      resolve({ status: 'other', detail: `no answer from /json/list within ${timeoutMs} ms` });
    });
    request.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED') {
        resolve({ status: 'closed' });
      } else {
        resolve({ status: 'other', detail: err.message });
      }
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
  const listTargets = options.listTargets ?? ((h: string, p: number) => probeInspector(h, p));
  const pidOf = options.pidOf ?? defaultPidOf;
  const sleep = options.sleep ?? wait;
  const now = options.now ?? Date.now;
  const deadlineMs = options.deadlineMs ?? 5000;
  const pollMs = options.pollMs ?? 100;

  if (!LOOPBACK_HOSTS.has(requestedHost)) {
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

  // After our signal a transient probe failure (ECONNRESET or a read timeout
  // while the inspector's HTTP server comes up) is not a verdict — keep
  // polling and name it only if the deadline passes.
  let lastTransient: string | undefined;
  const classify = async (probe: InspectorProbe, afterSignal: boolean): Promise<InspectorActivationResult | undefined> => {
    if (probe.status === 'closed') return undefined;
    if (probe.status === 'other') {
      if (afterSignal) {
        lastTransient = probe.detail;
        return undefined;
      }
      throw invalid(`${where} is in use by something that is not a Node inspector (${probe.detail}); pass port if PID ${pid} listens elsewhere, or free the port`);
    }
    const owners = await Promise.all(probe.targets.map((target) => pidOf(target)));
    const index = owners.indexOf(pid);
    if (index >= 0) {
      return { host, port, alreadyActive: !afterSignal, title: probe.targets[index].title ?? '' };
    }
    const other = owners.find((owner) => owner !== undefined && owner !== pid);
    if (other !== undefined) {
      throw invalid(`${where} is already held by a Node inspector for a different process (PID ${other}: ${describeTargets(probe.targets)}); pass port if PID ${pid} listens elsewhere, or free the port`);
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

  const before = await classify(await listTargets(host, port), false);
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

  const deadline = now() + deadlineMs;
  for (;;) {
    await sleep(pollMs);
    const result = await classify(await listTargets(host, port), true);
    if (result) return result;
    if (now() >= deadline) {
      throw invalid(
        `PID ${pid} did not open an inspector on ${where} within ${deadlineMs} ms of being signalled` +
          (lastTransient ? ` (last probe: ${lastTransient})` : '') +
          ` — a target started with --inspect-port=<n> (or NODE_OPTIONS=--inspect-port=<n>) opens it there: pass that port; ` +
          `otherwise check that PID ${pid} is a Node.js process and that ${where} is free`
      );
    }
  }
}
