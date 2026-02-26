#!/usr/bin/env node

/**
 * stdio-tcp-bridge: Bridges a stdio-only DAP adapter to a TCP port.
 *
 * kotlin-debug-adapter only supports stdio DAP transport. The mcp-debugger
 * proxy system (MinimalDapClient) connects via TCP. This bridge:
 *
 *   1. Listens on a TCP port for DAP connections
 *   2. Spawns kotlin-debug-adapter with stdio pipes
 *   3. Forwards DAP messages bidirectionally with Content-Length framing
 *
 * Usage:
 *   node stdio-tcp-bridge.js --port <port> --command <adapter-path> [--args ...]
 */

import * as net from 'net';
import { spawn, ChildProcess } from 'child_process';

const _DAP_HEADER_PATTERN = /Content-Length:\s*(\d+)\r\n\r\n/;

interface BridgeOptions {
  port: number;
  host: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Parse DAP messages from a raw byte stream using Content-Length framing.
 * Accumulates data and yields complete messages.
 */
class DapMessageParser {
  private buffer = Buffer.alloc(0);

  feed(data: Buffer): Buffer[] {
    this.buffer = Buffer.concat([this.buffer, data]);
    const messages: Buffer[] = [];

    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header = this.buffer.subarray(0, headerEnd).toString('ascii');
      const match = header.match(/Content-Length:\s*(\d+)/);
      if (!match) {
        // Malformed header — skip past it
        this.buffer = this.buffer.subarray(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;

      if (this.buffer.length < messageEnd) {
        // Incomplete message — wait for more data
        break;
      }

      messages.push(this.buffer.subarray(messageStart, messageEnd));
      this.buffer = this.buffer.subarray(messageEnd);
    }

    return messages;
  }
}

/**
 * Encode a DAP message body with Content-Length header.
 */
function encodeDapMessage(body: Buffer): Buffer {
  const header = `Content-Length: ${body.length}\r\n\r\n`;
  return Buffer.concat([Buffer.from(header, 'ascii'), body]);
}

/**
 * Start the stdio-tcp bridge.
 */
export function startBridge(options: BridgeOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    let adapterProcess: ChildProcess | null = null;
    let clientSocket: net.Socket | null = null;

    const server = net.createServer((socket) => {
      if (clientSocket) {
        // Only allow one connection at a time
        socket.destroy();
        return;
      }

      clientSocket = socket;

      // Spawn the adapter process
      adapterProcess = spawn(options.command, options.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: options.env || process.env as Record<string, string>,
      });

      const tcpParser = new DapMessageParser();
      const stdoutParser = new DapMessageParser();

      // TCP → adapter stdin (client sends DAP to adapter)
      socket.on('data', (data) => {
        const messages = tcpParser.feed(data);
        for (const msg of messages) {
          const encoded = encodeDapMessage(msg);
          adapterProcess?.stdin?.write(encoded);
        }
      });

      // adapter stdout → TCP (adapter sends DAP to client)
      adapterProcess.stdout?.on('data', (data: Buffer) => {
        const messages = stdoutParser.feed(data);
        for (const msg of messages) {
          const encoded = encodeDapMessage(msg);
          if (clientSocket && !clientSocket.destroyed) {
            clientSocket.write(encoded);
          }
        }
      });

      // Log adapter stderr for debugging
      adapterProcess.stderr?.on('data', (data: Buffer) => {
        process.stderr.write(`[KDA] ${data.toString()}`);
      });

      // Handle adapter exit
      adapterProcess.on('exit', (code) => {
        if (clientSocket && !clientSocket.destroyed) {
          clientSocket.end();
        }
        clientSocket = null;
        adapterProcess = null;
        // If adapter exits cleanly, shut down the bridge
        if (code === 0 || code === null) {
          server.close();
          resolve();
        }
      });

      adapterProcess.on('error', (err) => {
        process.stderr.write(`[KDA bridge] Adapter process error: ${err.message}\n`);
        if (clientSocket && !clientSocket.destroyed) {
          clientSocket.destroy();
        }
        clientSocket = null;
      });

      // Handle client disconnect
      socket.on('close', () => {
        clientSocket = null;
        if (adapterProcess && !adapterProcess.killed) {
          adapterProcess.kill('SIGTERM');
          // Force kill after timeout
          setTimeout(() => {
            if (adapterProcess && !adapterProcess.killed) {
              adapterProcess.kill('SIGKILL');
            }
          }, 3000);
        }
      });

      socket.on('error', (err) => {
        process.stderr.write(`[KDA bridge] Socket error: ${err.message}\n`);
        clientSocket = null;
      });
    });

    server.on('error', (err) => {
      reject(err);
    });

    server.listen(options.port, options.host, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        process.stderr.write(`[KDA bridge] Listening on ${addr.address}:${addr.port}\n`);
      }
    });

    // Handle process signals
    const cleanup = () => {
      if (adapterProcess && !adapterProcess.killed) {
        adapterProcess.kill('SIGTERM');
      }
      server.close();
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
  });
}

// CLI entry point
if (process.argv[1] && process.argv[1].includes('stdio-tcp-bridge')) {
  const args = process.argv.slice(2);
  let port = 0;
  let host = '127.0.0.1';
  let command = '';
  const adapterArgs: string[] = [];
  let collectingArgs = false;

  for (let i = 0; i < args.length; i++) {
    if (collectingArgs) {
      adapterArgs.push(args[i]);
      continue;
    }
    switch (args[i]) {
      case '--port':
        port = parseInt(args[++i], 10);
        break;
      case '--host':
        host = args[++i];
        break;
      case '--command':
        command = args[++i];
        break;
      case '--args':
        collectingArgs = true;
        break;
      default:
        process.stderr.write(`Unknown argument: ${args[i]}\n`);
        process.exit(1);
    }
  }

  if (!port || !command) {
    process.stderr.write('Usage: stdio-tcp-bridge --port <port> --command <adapter-path> [--args ...]\n');
    process.exit(1);
  }

  startBridge({ port, host, command, args: adapterArgs }).catch((err) => {
    process.stderr.write(`[KDA bridge] Fatal: ${err.message}\n`);
    process.exit(1);
  });
}
