/**
 * netcoredbg TCP-to-stdio bridge
 *
 * netcoredbg's `--server=PORT` mode has a bug on Windows where the TCP
 * connection drops after the DAP initialize sequence. As a workaround,
 * this bridge:
 *
 * 1. Listens on a TCP port (for the proxy to connect)
 * 2. Spawns netcoredbg in stdio mode (`--interpreter=vscode`)
 * 3. Forwards DAP messages bidirectionally between TCP ↔ stdio
 *
 * This is a pure byte-level forwarder — no DAP parsing or modification.
 *
 * Usage (spawned by adapter/proxy):
 *   node netcoredbg-bridge.js <netcoredbg-path> <port>
 */
import net from 'net';
import { spawn, ChildProcess } from 'child_process';

const [netcoredbgPath, portStr] = process.argv.slice(2);
const port = parseInt(portStr, 10);

if (!netcoredbgPath || !port) {
  process.stderr.write(`Usage: node netcoredbg-bridge.js <netcoredbg-path> <port>\n`);
  process.exit(1);
}

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
  netcoredbg = spawn(netcoredbgPath, ['--interpreter=vscode'], {
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
  netcoredbg.stdout!.on('data', (data) => {
    if (!socket.destroyed) {
      socket.write(data);
    }
  });

  // Log stderr but don't forward (it's not DAP)
  netcoredbg.stderr!.on('data', (data) => {
    process.stderr.write(data);
  });

  // Handle netcoredbg exit
  netcoredbg.on('exit', (code) => {
    if (!socket.destroyed) {
      socket.end();
    }
    server.close();
    process.exit(code ?? 0);
  });

  netcoredbg.on('error', (err) => {
    process.stderr.write(`netcoredbg error: ${err.message}\n`);
    if (!socket.destroyed) {
      socket.destroy();
    }
    server.close();
    process.exit(1);
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

server.listen(port, '127.0.0.1', () => {
  // Signal ready (proxy may look for this)
});

server.on('error', (err) => {
  process.stderr.write(`Bridge server error: ${err.message}\n`);
  process.exit(1);
});

// Clean up on process exit
process.on('SIGTERM', () => {
  if (netcoredbg) netcoredbg.kill();
  if (client) client.destroy();
  server.close();
});
