/**
 * netcoredbg TCP-to-stdio bridge — testable core logic
 *
 * Extracted from netcoredbg-bridge.ts so the bridge behaviour can be
 * exercised in unit tests with mock spawn and mock sockets.
 *
 * Lifecycle rule: the socket is ended on the child's `close` event, never on
 * `exit` — Node fires `exit` when the process ends and `close` once its stdio
 * streams have drained, and netcoredbg's last DAP frames (`output`, `exited`,
 * `terminated`) can still be in the stdout pipe at `exit` (issue #878).
 */
import net from 'net';
import { spawn, ChildProcess, type SpawnOptions } from 'child_process';

export interface BridgeOptions {
  /** Override `child_process.spawn` (for testing) */
  spawnFn?: (cmd: string, args: string[], opts: SpawnOptions) => ChildProcess;
  /** Writable stream for netcoredbg stderr (defaults to `process.stderr`) */
  stderr?: NodeJS.WritableStream;
  /** Injected for tests; defaults to `process.platform`. */
  platform?: NodeJS.Platform;
  /** Ends a process with everything below it (Windows only); defaults to `taskkill /T /F`. Injected for tests. */
  killTree?: (pid: number) => void;
}

/** How long the Windows tree kill gets before the plain kill follows it up. */
const TREE_KILL_GRACE_MS = 300;

/** The default Windows tree kill: fire-and-forget `taskkill`, the proxy worker's own idiom. */
function taskkillTree(pid: number): void {
  const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  killer.on('error', () => { /* no taskkill: the plain kill follows after the grace */ });
}

/** Children a tree kill has already been issued for, so the socket paths and cleanup() do not repeat it. */
const treeKillIssued = new WeakSet<ChildProcess>();

/**
 * End the child. On Windows `cp.kill()` is TerminateProcess on netcoredbg alone, and the debuggee
 * it launched sits below it, re-parented and left running by a single-process kill (issue #937).
 * So the tree goes first — `taskkill /T /F`, the proxy worker's own idiom — and the plain kill
 * follows only if the child is still here after a short grace, or at once when taskkill could not
 * be started. POSIX keeps `cp.kill()`: the proxy's process-group kill covers the tree there. A child
 * that has already exited is never touched — its pid may be someone else's by now. (Mirrored in the
 * Dart bridge; both are dependency-free by design, so no shared helper.)
 */
function endChild(cp: ChildProcess, platform: NodeJS.Platform, killTree: (pid: number) => void): void {
  if ((cp.exitCode ?? null) !== null || cp.killed) return;
  const plainKill = (): void => {
    if ((cp.exitCode ?? null) === null && !cp.killed) {
      try { cp.kill(); } catch { /* already gone */ }
    }
  };
  if (platform !== 'win32' || cp.pid === undefined) {
    plainKill();
    return;
  }
  if (treeKillIssued.has(cp)) return;
  treeKillIssued.add(cp);
  try {
    killTree(cp.pid);
  } catch {
    plainKill();
    return;
  }
  const fallback = setTimeout(plainKill, TREE_KILL_GRACE_MS);
  fallback.unref?.();
  cp.once('exit', () => clearTimeout(fallback));
}

export interface BridgeHandle {
  /** The TCP server accepting the proxy connection */
  server: net.Server;
  /** Tear everything down (kills netcoredbg, destroys client, closes server) */
  cleanup: () => void;
}

/**
 * Create a TCP↔stdio bridge for netcoredbg.
 *
 * 1. Listens on `port` at 127.0.0.1
 * 2. On first connection, spawns netcoredbg in stdio mode
 * 3. Forwards bytes bidirectionally (TCP ↔ stdio)
 * 4. Rejects any additional connections (single-client)
 */
export function createBridge(
  netcoredbgPath: string,
  port: number,
  options: BridgeOptions = {}
): BridgeHandle {
  const spawnFn = options.spawnFn ?? spawn;
  const stderrStream = options.stderr ?? process.stderr;
  const platform = options.platform ?? process.platform;
  const killTree = options.killTree ?? taskkillTree;

  let netcoredbg: ChildProcess | null = null;
  let client: net.Socket | null = null;

  const server = net.createServer((socket) => {
    // Only accept one connection (same as netcoredbg --server)
    if (client) {
      socket.destroy();
      return;
    }
    client = socket;

    // Spawn netcoredbg in stdio mode
    netcoredbg = spawnFn(netcoredbgPath, ['--interpreter=vscode'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    // A proxy request that races the child's exit lands on a dead pipe. The
    // `error` listener is what protects that race in production (an EPIPE
    // raised by a write already in flight is logged, not thrown — before it
    // there was no listener, so it would have crashed the bridge); the
    // `childEnded` flag is belt and braces, since Node destroys the child's
    // stdin before it emits `exit`.
    let childEnded = false;
    netcoredbg.stdin?.on('error', (err: NodeJS.ErrnoException) => {
      stderrStream.write(`netcoredbg stdin: ${err.message}\n`);
    });

    // Forward: TCP → netcoredbg stdin
    socket.on('data', (data) => {
      const stdin = netcoredbg?.stdin;
      if (!childEnded && stdin && !stdin.destroyed && stdin.writable) {
        stdin.write(data);
      }
    });

    // Forward: netcoredbg stdout → TCP
    netcoredbg.stdout!.on('data', (data: Buffer) => {
      if (!socket.destroyed) {
        socket.write(data);
      }
    });

    // Log stderr but don't forward (it's not DAP).
    // Deliberately verbatim: this bridge runs standalone in the NPX bundle
    // (copied as a dependency-free .js — it must NOT import
    // @debugmcp/shared), and its own stderr is consumed upstream by
    // GenericAdapterManager, which line-buffers and sanitizes it
    // (issue #153).
    netcoredbg.stderr!.on('data', (data: Buffer) => {
      stderrStream.write(data);
    });

    // `exit` only marks the child gone; the socket is ended on `close`, when
    // its stdout has drained — ending it at `exit` closed the proxy's side
    // before the last DAP frames were forwarded (issue #878).
    netcoredbg.on('exit', () => {
      childEnded = true;
    });

    netcoredbg.on('close', (code, signal) => {
      childEnded = true;
      stderrStream.write(`netcoredbg closed (code=${code}, signal=${signal})\n`);
      if (!socket.destroyed) {
        socket.end();
      }
      server.close();
    });

    netcoredbg.on('error', (err) => {
      stderrStream.write(`netcoredbg error: ${err.message}\n`);
      if (!socket.destroyed) {
        socket.destroy();
      }
      server.close();
    });

    // Handle client disconnect
    socket.on('close', () => {
      if (netcoredbg) {
        netcoredbg.stdin?.end();
        endChild(netcoredbg, platform, killTree);
      }
      server.close();
    });

    socket.on('error', (err) => {
      stderrStream.write(`bridge socket error: ${err.message}\n`);
      if (netcoredbg) {
        netcoredbg.stdin?.end();
        endChild(netcoredbg, platform, killTree);
      }
      server.close();
    });
  });

  server.listen(port, '127.0.0.1');

  server.on('error', (err) => {
    stderrStream.write(`Bridge server error: ${err.message}\n`);
  });

  const cleanup = () => {
    if (netcoredbg) endChild(netcoredbg, platform, killTree);
    if (client) client.destroy();
    server.close();
  };

  return { server, cleanup };
}
