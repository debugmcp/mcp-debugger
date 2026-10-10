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

    // A proxy request that races the child's exit would otherwise land on a
    // dead pipe: drop it once the child has exited, and log (not throw) the
    // EPIPE that a write already in flight can still raise.
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

    netcoredbg.on('close', () => {
      childEnded = true;
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
        netcoredbg.kill();
      }
      server.close();
    });

    socket.on('error', () => {
      if (netcoredbg) {
        netcoredbg.stdin?.end();
        netcoredbg.kill();
      }
      server.close();
    });
  });

  server.listen(port, '127.0.0.1');

  server.on('error', (err) => {
    stderrStream.write(`Bridge server error: ${err.message}\n`);
  });

  const cleanup = () => {
    if (netcoredbg) netcoredbg.kill();
    if (client) client.destroy();
    server.close();
  };

  return { server, cleanup };
}
