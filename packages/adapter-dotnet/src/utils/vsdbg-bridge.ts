/**
 * TCP-to-stdio bridge for vsdbg.
 *
 * vsdbg only communicates via stdio (stdin/stdout) with --interpreter=vscode,
 * but the mcp-debugger proxy communicates with DAP backends via TCP.
 *
 * This bridge:
 * 1. Listens on the TCP port specified by ProxyManager
 * 2. Spawns vsdbg as a child process with stdio pipes
 * 3. Pipes raw bytes between the TCP socket and vsdbg's stdin/stdout
 *
 * DAP framing (Content-Length headers) is handled by vsdbg itself —
 * this bridge is just a transparent byte pipe.
 *
 * Usage: node vsdbg-bridge.js --vsdbg <path> --host <host> --port <port>
 */
import { spawn } from 'child_process';
import * as net from 'net';

function parseArgs(argv: string[]): { vsdbg: string; host: string; port: number } {
  let vsdbg = '';
  let host = '127.0.0.1';
  let port = 0;

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--vsdbg':
        vsdbg = argv[++i];
        break;
      case '--host':
        host = argv[++i];
        break;
      case '--port':
        port = parseInt(argv[++i], 10);
        break;
    }
  }

  if (!vsdbg || !port) {
    console.error('Usage: node vsdbg-bridge.js --vsdbg <path> --host <host> --port <port>');
    process.exit(1);
  }

  return { vsdbg, host, port };
}

function main(): void {
  const { vsdbg, host, port } = parseArgs(process.argv);

  const server = net.createServer((socket) => {
    // Spawn vsdbg with DAP interpreter mode
    const child = spawn(vsdbg, ['--interpreter=vscode'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Pipe: TCP socket → vsdbg stdin
    socket.pipe(child.stdin!);

    // Pipe: vsdbg stdout → TCP socket
    child.stdout!.pipe(socket);

    // Forward vsdbg stderr to our stderr for diagnostics
    child.stderr?.on('data', (data) => {
      process.stderr.write(data);
    });

    // Cleanup on vsdbg exit
    child.on('exit', (code) => {
      if (code !== 0) {
        process.stderr.write(`[vsdbg-bridge] vsdbg exited with code ${code}\n`);
      }
      socket.end();
    });

    child.on('error', (err) => {
      process.stderr.write(`[vsdbg-bridge] vsdbg spawn error: ${err.message}\n`);
      socket.end();
    });

    // Cleanup on socket close
    socket.on('close', () => {
      child.kill();
    });

    socket.on('error', (err) => {
      process.stderr.write(`[vsdbg-bridge] Socket error: ${err.message}\n`);
      child.kill();
    });
  });

  server.listen(port, host, () => {
    // Signal to ProxyManager that we're ready
    process.stderr.write(`[vsdbg-bridge] Listening on ${host}:${port}\n`);
  });

  server.on('error', (err) => {
    process.stderr.write(`[vsdbg-bridge] Server error: ${err.message}\n`);
    process.exit(1);
  });
}

main();
