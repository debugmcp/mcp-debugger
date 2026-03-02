/**
 * TCP-to-stdio bridge for vsdbg.
 *
 * ## Why a bridge is needed
 *
 * mcp-debugger's proxy worker communicates with DAP adapters over TCP: it
 * connects to a port and exchanges DAP JSON messages. Most adapters (debugpy,
 * js-debug, CodeLLDB, Delve) natively support a TCP or socket transport.
 *
 * vsdbg is different -- it only speaks DAP via stdio (stdin/stdout) when
 * launched with `--interpreter=vscode`. There is no built-in TCP mode.
 *
 * This bridge process solves the mismatch:
 * 1. Listens on a TCP port (assigned by ProxyManager)
 * 2. Spawns vsdbg as a child process with stdio pipes
 * 3. Pipes DAP messages bidirectionally between TCP and vsdbg's stdio
 *
 * ## vsda Handshake
 *
 * vsdbg implements a proprietary authentication mechanism. Before processing
 * any DAP requests, it sends a `handshake` reverse request containing a
 * random challenge value. The host must sign this challenge using vsda.node
 * (a native Node.js addon bundled with the VS Code C# extension) and return
 * the signature. Without a valid signature, vsdbg refuses to proceed.
 *
 * The bridge intercepts this handshake transparently: it detects the
 * `handshake` request in vsdbg's stdout, loads vsda.node via createRequire,
 * calls `vsda.createNewKeyPair()` and `signer.sign(challenge)`, and sends
 * the signed response back to vsdbg's stdin. The DAP client on the TCP side
 * never sees the handshake -- it's fully handled by the bridge.
 *
 * ## Console Window Suppression
 *
 * On Windows, vsdbg is spawned with `windowsHide: true` to prevent a visible
 * console window from appearing on the desktop.
 *
 * Usage: node vsdbg-bridge.js --vsdbg <path> --host <host> --port <port>
 *          [--vsda <path>]
 */
import { spawn } from 'child_process';
import { createRequire } from 'module';
import * as net from 'net';
import { fileURLToPath } from 'url';

// ===== Types =====

interface BridgeArgs {
  vsdbg: string;
  host: string;
  port: number;
  vsdaPath: string | null;
}

// ===== DAP Frame Parser =====

/**
 * Minimal DAP frame parser for Content-Length delimited messages.
 *
 * Buffers incoming data and extracts complete DAP messages
 * (Content-Length: N\r\n\r\n<body>).
 */
export class DapFrameParser {
  private buffer: Buffer = Buffer.alloc(0);

  /**
   * Feed new data into the parser.
   * @returns Array of complete message bodies (as Buffers)
   */
  feed(data: Buffer): Buffer[] {
    this.buffer = Buffer.concat([this.buffer, data]);
    const frames: Buffer[] = [];

    while (true) {
      // Look for header terminator
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      // Parse Content-Length from header
      const header = this.buffer.subarray(0, headerEnd).toString('ascii');
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        // Malformed header — skip past the \r\n\r\n and try again
        this.buffer = this.buffer.subarray(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      const frameEnd = bodyStart + contentLength;

      // Not enough data yet for the full body
      if (this.buffer.length < frameEnd) break;

      frames.push(this.buffer.subarray(bodyStart, frameEnd));
      this.buffer = this.buffer.subarray(frameEnd);
    }

    return frames;
  }

  /**
   * Get any unparsed buffered data.
   */
  getRemainder(): Buffer {
    return this.buffer;
  }

  /**
   * Check if there is any buffered data.
   */
  hasData(): boolean {
    return this.buffer.length > 0;
  }
}

// ===== Handshake =====

/**
 * Sign a vsdbg handshake challenge using VS Code's vsda.node native module.
 *
 * @param challenge The challenge string from vsdbg
 * @param vsdaPath Path to vsda.node, or null if unavailable
 * @returns The signature string, or '' on failure
 */
export function signHandshake(challenge: string, vsdaPath: string | null): string {
  if (!vsdaPath) {
    process.stderr.write('[vsdbg-bridge] WARNING: vsda.node path not provided — handshake will send empty signature\n');
    return '';
  }

  try {
    const require = createRequire(import.meta.url);
    const vsda = require(vsdaPath) as { signer: new () => { sign(challenge: string): string } };
    const signer = new vsda.signer();
    const signature = signer.sign(challenge);
    process.stderr.write('[vsdbg-bridge] Handshake signed successfully\n');
    return signature;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[vsdbg-bridge] WARNING: Failed to sign handshake: ${message}\n`);
    return '';
  }
}

/**
 * Encode a DAP message with Content-Length header.
 */
function encodeDapFrame(body: Buffer): Buffer {
  const header = `Content-Length: ${body.length}\r\n\r\n`;
  return Buffer.concat([Buffer.from(header, 'ascii'), body]);
}

// ===== Argument Parsing =====

function parseArgs(argv: string[]): BridgeArgs {
  let vsdbg = '';
  let host = '127.0.0.1';
  let port = 0;
  let vsdaPath: string | null = null;

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
      case '--vsda':
        vsdaPath = argv[++i] || null;
        break;
    }
  }

  if (!vsdbg || !port) {
    console.error('Usage: node vsdbg-bridge.js --vsdbg <path> --host <host> --port <port> [--vsda <path>]');
    process.exit(1);
  }

  return { vsdbg, host, port, vsdaPath };
}

// ===== Main =====

function main(): void {
  const args = parseArgs(process.argv);

  // --- TCP server ---
  const server = net.createServer((socket) => {
    // Spawn vsdbg with DAP interpreter mode
    const child = spawn(args.vsdbg, ['--interpreter=vscode'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    // --- Handshake interception on vsdbg stdout ---
    let handshakeHandled = false;
    const parser = new DapFrameParser();

    child.stdout!.on('data', (data: Buffer) => {
      // After handshake is done, raw passthrough (no parsing overhead)
      if (handshakeHandled) {
        socket.write(data);
        return;
      }

      // Parse DAP frames looking for the handshake request
      const frames = parser.feed(data);

      for (const frameBody of frames) {
        let msg: { type?: string; command?: string; arguments?: { value?: string }; seq?: number };
        try {
          msg = JSON.parse(frameBody.toString('utf8'));
        } catch {
          // Not valid JSON — forward as-is
          socket.write(encodeDapFrame(frameBody));
          continue;
        }

        if (msg.type === 'request' && msg.command === 'handshake') {
          // Sign the handshake challenge
          const challenge = msg.arguments?.value || '';
          process.stderr.write(`[vsdbg-bridge] Received handshake challenge\n`);
          const signature = signHandshake(challenge, args.vsdaPath);

          // Send response directly to vsdbg stdin (don't forward to client)
          const response = JSON.stringify({
            type: 'response',
            request_seq: msg.seq,
            command: 'handshake',
            success: true,
            body: { signature }
          });
          child.stdin!.write(encodeDapFrame(Buffer.from(response, 'utf8')));

          // Mark handshake as handled — switch to raw passthrough
          handshakeHandled = true;

          // Flush any remaining buffered data from the parser
          const remainder = parser.getRemainder();
          if (remainder.length > 0) {
            socket.write(remainder);
          }
          continue;
        }

        // Non-handshake frame before handshake completed — forward to client
        socket.write(encodeDapFrame(frameBody));
      }
    });

    // Pipe: TCP socket → vsdbg stdin (unchanged — client sends DAP directly)
    socket.pipe(child.stdin!);

    // Forward vsdbg stderr to our stderr for diagnostics
    child.stderr?.on('data', (data: Buffer) => {
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

  server.listen(args.port, args.host, () => {
    // Signal to ProxyManager that we're ready
    process.stderr.write(`[vsdbg-bridge] Listening on ${args.host}:${args.port}\n`);
  });

  server.on('error', (err) => {
    process.stderr.write(`[vsdbg-bridge] Server error: ${err.message}\n`);
    process.exit(1);
  });
}

// Only run main() when this file is the entry point (not when imported for testing)
const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] === thisFile || process.argv[1]?.endsWith('vsdbg-bridge.js')) {
  main();
}
