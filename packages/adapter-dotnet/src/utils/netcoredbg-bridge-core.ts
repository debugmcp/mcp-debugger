/**
 * netcoredbg TCP-to-stdio bridge — testable core logic
 *
 * Extracted from netcoredbg-bridge.ts so the bridge behaviour can be
 * exercised in unit tests with mock spawn and mock sockets.
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

    // Forward: TCP → netcoredbg stdin
    socket.on('data', (data) => {
      if (netcoredbg?.stdin?.writable) {
        netcoredbg.stdin.write(data);
      }
    });

    // Forward: netcoredbg stdout → TCP
    netcoredbg.stdout!.on('data', (data: Buffer) => {
      if (!socket.destroyed) {
        socket.write(data);
      }
    });

    // Log stderr but don't forward (it's not DAP)
    netcoredbg.stderr!.on('data', (data: Buffer) => {
      stderrStream.write(data);
    });

    // Handle netcoredbg exit
    netcoredbg.on('exit', (_code) => {
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
