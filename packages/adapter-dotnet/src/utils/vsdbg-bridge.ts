/**
 * TCP-to-stdio bridge for vsdbg.
 *
 * vsdbg only communicates via stdio (stdin/stdout) with --interpreter=vscode,
 * but the mcp-debugger proxy communicates with DAP backends via TCP.
 *
 * This bridge:
 * 1. Optionally converts Windows PDBs to Portable PDBs (vsdbg requirement)
 * 2. Listens on the TCP port specified by ProxyManager
 * 3. Spawns vsdbg as a child process with stdio pipes
 * 4. Intercepts the vsda handshake challenge from vsdbg and signs it
 * 5. Pipes all other DAP traffic transparently between TCP and vsdbg
 *
 * Usage: node vsdbg-bridge.js --vsdbg <path> --host <host> --port <port>
 *          [--vsda <path>] [--pdb2pdb <path>] [--convert-pdbs <dir1,dir2,...>]
 */
import { spawn, spawnSync } from 'child_process';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { isPortablePdb } from './dotnet-utils.js';

// ===== Types =====

interface BridgeArgs {
  vsdbg: string;
  host: string;
  port: number;
  vsdaPath: string | null;
  pdb2pdbPath: string | null;
  convertPdbDirs: string[];
}

interface PdbBackup {
  original: string;
  backup: string;
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

// ===== PDB Conversion =====

/**
 * Encode a DAP message with Content-Length header.
 */
function encodeDapFrame(body: Buffer): Buffer {
  const header = `Content-Length: ${body.length}\r\n\r\n`;
  return Buffer.concat([Buffer.from(header, 'ascii'), body]);
}

/**
 * Convert Windows-format PDBs to Portable PDBs in the given directories.
 *
 * @param dirs Directories to scan for .pdb files
 * @param pdb2pdbPath Path to Pdb2Pdb.exe
 * @returns Array of backup records for restoration on cleanup
 */
export function convertPdbs(dirs: string[], pdb2pdbPath: string): PdbBackup[] {
  const backups: PdbBackup[] = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      process.stderr.write(`[vsdbg-bridge] PDB scan dir not found: ${dir}\n`);
      continue;
    }

    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }

    const pdbFiles = entries.filter(e => e.toLowerCase().endsWith('.pdb'));

    for (const pdbFile of pdbFiles) {
      const pdbPath = path.join(dir, pdbFile);

      // Skip if already portable
      if (isPortablePdb(pdbPath)) {
        process.stderr.write(`[vsdbg-bridge] Already portable: ${pdbPath}\n`);
        continue;
      }

      // Find matching DLL
      const baseName = pdbFile.replace(/\.pdb$/i, '');
      const dllPath = path.join(dir, baseName + '.dll');
      if (!fs.existsSync(dllPath)) {
        process.stderr.write(`[vsdbg-bridge] No matching DLL for ${pdbFile}, skipping\n`);
        continue;
      }

      // Create backup
      const backupPath = pdbPath + '.backup';
      try {
        fs.copyFileSync(pdbPath, backupPath);
        backups.push({ original: pdbPath, backup: backupPath });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[vsdbg-bridge] WARNING: Failed to backup ${pdbPath}: ${message}\n`);
        continue;
      }

      // Convert: Pdb2Pdb.exe <dll> /pdb <original.pdb> /out <original.pdb>
      try {
        const result = spawnSync(pdb2pdbPath, [dllPath, '/pdb', pdbPath, '/out', pdbPath], {
          timeout: 30000,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        if (result.status === 0) {
          process.stderr.write(`[vsdbg-bridge] Converted ${pdbPath} to Portable PDB\n`);
        } else {
          const stderr = result.stderr ? result.stderr.toString().trim() : '';
          process.stderr.write(`[vsdbg-bridge] WARNING: Pdb2Pdb failed for ${pdbPath}: exit ${result.status} ${stderr}\n`);
          // Restore from backup since conversion failed
          try {
            fs.copyFileSync(backupPath, pdbPath);
          } catch { /* best effort */ }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[vsdbg-bridge] WARNING: Pdb2Pdb spawn failed for ${pdbPath}: ${message}\n`);
        // Restore from backup since conversion failed
        try {
          fs.copyFileSync(backupPath, pdbPath);
        } catch { /* best effort */ }
      }
    }
  }

  return backups;
}

/**
 * Restore original PDB files from backups.
 */
export function restorePdbBackups(backups: PdbBackup[]): void {
  for (const { original, backup } of backups) {
    try {
      if (fs.existsSync(backup)) {
        fs.copyFileSync(backup, original);
        fs.unlinkSync(backup);
        process.stderr.write(`[vsdbg-bridge] Restored ${original}\n`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[vsdbg-bridge] WARNING: Failed to restore ${original}: ${message}\n`);
    }
  }
}

// ===== Argument Parsing =====

function parseArgs(argv: string[]): BridgeArgs {
  let vsdbg = '';
  let host = '127.0.0.1';
  let port = 0;
  let vsdaPath: string | null = null;
  let pdb2pdbPath: string | null = null;
  let convertPdbDirs: string[] = [];

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
      case '--pdb2pdb':
        pdb2pdbPath = argv[++i] || null;
        break;
      case '--convert-pdbs':
        convertPdbDirs = (argv[++i] || '').split(',').filter(Boolean);
        break;
    }
  }

  if (!vsdbg || !port) {
    console.error('Usage: node vsdbg-bridge.js --vsdbg <path> --host <host> --port <port> [--vsda <path>] [--pdb2pdb <path>] [--convert-pdbs <dir1,dir2,...>]');
    process.exit(1);
  }

  return { vsdbg, host, port, vsdaPath, pdb2pdbPath, convertPdbDirs };
}

// ===== Main =====

function main(): void {
  const args = parseArgs(process.argv);

  // --- PDB conversion (before spawning vsdbg) ---
  let pdbBackups: PdbBackup[] = [];
  if (args.pdb2pdbPath && args.convertPdbDirs.length > 0) {
    process.stderr.write(`[vsdbg-bridge] Converting PDBs in: ${args.convertPdbDirs.join(', ')}\n`);
    pdbBackups = convertPdbs(args.convertPdbDirs, args.pdb2pdbPath);
    process.stderr.write(`[vsdbg-bridge] PDB conversion complete (${pdbBackups.length} files backed up)\n`);
  }

  // Register cleanup for PDB restoration
  let pdbsRestored = false;
  const doRestore = () => {
    if (!pdbsRestored && pdbBackups.length > 0) {
      pdbsRestored = true;
      restorePdbBackups(pdbBackups);
    }
  };
  process.on('exit', doRestore);

  // --- TCP server ---
  const server = net.createServer((socket) => {
    // Spawn vsdbg with DAP interpreter mode
    const child = spawn(args.vsdbg, ['--interpreter=vscode'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Register additional cleanup triggers
    child.on('exit', doRestore);
    socket.on('close', doRestore);

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
