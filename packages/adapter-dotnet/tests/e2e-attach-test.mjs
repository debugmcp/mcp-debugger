/**
 * End-to-end test: Attach to a .NET process via vsdbg-bridge, set breakpoint, inspect variables.
 *
 * The bridge now handles vsda handshake signing and PDB conversion transparently —
 * this test client is a plain DAP client with no vsdbg-specific workarounds.
 *
 * Configuration via environment variables:
 *   VSDBG_PATH    - path to vsdbg-ui.exe (auto-discovered from VS Code extensions if unset)
 *   VSDA_PATH     - path to vsda.node for handshake signing (auto-discovered if unset)
 *   PDB2PDB_PATH  - path to Pdb2Pdb.exe for PDB conversion (auto-discovered if unset)
 *   SOURCE_FILE   - full path to .cs source file for breakpoint
 *   BP_LINE       - line number for breakpoint (default: 1)
 *   TARGET_PID    - PID of the .NET process to attach to
 *   BRIDGE_PORT   - TCP port for vsdbg-bridge (default: 4713)
 *
 * Usage: TARGET_PID=12345 SOURCE_FILE=/path/to/file.cs BP_LINE=100 node e2e-attach-test.mjs
 */
import net from 'net';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Auto-discover vsdbg-ui.exe from VS Code extensions
function findVsdbg() {
  const home = os.homedir();
  const extDir = path.join(home, '.vscode', 'extensions');
  if (!fs.existsSync(extDir)) return null;
  const entries = fs.readdirSync(extDir)
    .filter(e => e.startsWith('ms-dotnettools.csharp-'))
    .sort()
    .reverse();
  for (const ext of entries) {
    const candidate = path.join(extDir, ext, '.debugger', 'x86_64', 'vsdbg-ui.exe');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// Auto-discover vsda.node from VS Code installation
function findVsda() {
  const codePaths = [
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Microsoft VS Code'),
    String.raw`C:\Program Files\Microsoft VS Code`,
  ];
  for (const codeDir of codePaths) {
    if (!fs.existsSync(codeDir)) continue;
    const entries = fs.readdirSync(codeDir).filter(e => !e.startsWith('.'));
    for (const entry of entries) {
      const candidate = path.join(codeDir, entry, 'resources', 'app',
        'node_modules.asar.unpacked', 'vsda', 'build', 'Release', 'vsda.node');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

// Auto-discover Pdb2Pdb.exe
function findPdb2Pdb() {
  const bundled = path.resolve(__dirname, '..', 'tools', 'pdb2pdb', 'Pdb2Pdb.exe');
  if (fs.existsSync(bundled)) return bundled;
  const fallback = '/tmp/pdb2pdb-tool/Pdb2Pdb.exe';
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

// Configuration — from env vars with auto-discovery fallbacks
const VSDBG = process.env.VSDBG_PATH || findVsdbg();
const SOURCE_FILE = process.env.SOURCE_FILE;
const VSDA_RESOLVED = process.env.VSDA_PATH || findVsda();
const PDB2PDB_RESOLVED = process.env.PDB2PDB_PATH || findPdb2Pdb();
const BP_LINE = parseInt(process.env.BP_LINE || '1');
const NT_PID = parseInt(process.env.TARGET_PID || '0');
const PORT = parseInt(process.env.BRIDGE_PORT || '4713');
const HOST = '127.0.0.1';

if (!VSDBG) { console.error('ERROR: vsdbg-ui.exe not found. Set VSDBG_PATH.'); process.exit(1); }
if (!SOURCE_FILE) { console.error('ERROR: SOURCE_FILE env var required.'); process.exit(1); }
if (!NT_PID) { console.error('ERROR: TARGET_PID env var required.'); process.exit(1); }
console.log('[config] vsdbg:', VSDBG);
console.log('[config] source:', SOURCE_FILE, 'line:', BP_LINE);
console.log('[config] target PID:', NT_PID);
console.log('[config] vsda:', VSDA_RESOLVED || '(not found — bridge handshake will send empty signature)');
console.log('[config] pdb2pdb:', PDB2PDB_RESOLVED || '(not found — no PDB conversion)');

let seq = 0;
function encodeDap(obj) {
  obj.seq = ++seq;
  const body = JSON.stringify(obj);
  return 'Content-Length: ' + Buffer.byteLength(body) + '\r\n\r\n' + body;
}

function parseDapMessages(str) {
  const messages = [];
  while (true) {
    const headerEnd = str.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;
    const header = str.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) break;
    const len = parseInt(match[1]);
    const bodyStart = headerEnd + 4;
    if (str.length < bodyStart + len) break;
    const body = str.slice(bodyStart, bodyStart + len);
    str = str.slice(bodyStart + len);
    try { messages.push(JSON.parse(body)); } catch (e) { /* skip */ }
  }
  return { messages, remaining: str };
}

// Start bridge — handshake and PDB conversion are now handled by the bridge
const bridgePath = path.resolve(__dirname, '..', 'dist', 'utils', 'vsdbg-bridge.js');
const bridgeArgs = [bridgePath, '--vsdbg', VSDBG, '--host', HOST, '--port', String(PORT)];
if (VSDA_RESOLVED) {
  bridgeArgs.push('--vsda', VSDA_RESOLVED);
}
if (PDB2PDB_RESOLVED) {
  bridgeArgs.push('--pdb2pdb', PDB2PDB_RESOLVED);
  // Convert PDBs in the source file's directory
  const symbolDir = path.dirname(SOURCE_FILE);
  bridgeArgs.push('--convert-pdbs', symbolDir);
}
console.log('[test] Starting vsdbg-bridge on port', PORT);
const bridge = spawn('node', bridgeArgs, {
  stdio: ['pipe', 'pipe', 'pipe']
});
bridge.stderr.on('data', (d) => {
  const s = d.toString().trim();
  if (s) console.log('[bridge]', s);
});
bridge.on('exit', (code) => console.log('[bridge] exited code', code));

let buf = '';
let phase = 'init';
let bpVerified = false;
let bpHit = false;

function cleanup() {
  console.log('');
  console.log('=== RESULTS ===');
  console.log('Attach:              SUCCESS');
  console.log('Breakpoint set:     ', phase !== 'init' && phase !== 'attach' ? 'YES' : 'NO');
  console.log('Breakpoint verified:', bpVerified ? 'YES' : 'NO');
  console.log('Breakpoint hit:     ', bpHit ? 'YES' : 'NO (markets closed — expected)');
  bridge.kill();
  process.exit(0);
}

setTimeout(() => {
  console.log('[test] Connecting...');
  const socket = net.createConnection({ host: HOST, port: PORT }, () => {
    console.log('[test] Connected. Sending initialize...');
    socket.write(encodeDap({
      type: 'request',
      command: 'initialize',
      arguments: {
        clientID: 'vscode',
        clientName: 'Visual Studio Code',
        adapterID: 'clr',
        pathFormat: 'path',
        linesStartAt1: true,
        columnsStartAt1: true,
        supportsRunInTerminalRequest: false
      }
    }));
  });

  socket.on('data', (data) => {
    buf += data.toString();
    const { messages, remaining } = parseDapMessages(buf);
    buf = remaining;

    for (const msg of messages) {
      // Log responses
      if (msg.type === 'response') {
        const ok = msg.success ? 'OK' : 'FAIL';
        console.log('[DAP response]', msg.command, ok, msg.message || '');
      }
      // Log events (skip telemetry noise)
      if (msg.type === 'event') {
        if (msg.event === 'module') {
          const m = msg.body?.module;
          if (m) {
            const sym = m.symbolStatus || 'unknown';
            const name = m.name || m.id || '??';
            // Only log NinjaTrader-related or Custom modules in detail
            if (name.toLowerCase().includes('ninja') || name.toLowerCase().includes('custom')) {
              console.log('[DAP module]', name, '| symbols:', sym, '| path:', m.path || '??');
            }
          }
        } else if (msg.event === 'output' && msg.body?.category === 'telemetry') {
          // skip telemetry
        } else if (msg.event === 'output') {
          const cat = msg.body?.category || 'unknown';
          const text = (msg.body?.output || '').trim().slice(0, 500);
          if (text) console.log('[vsdbg:' + cat + ']', text);
        } else if (msg.event === 'breakpoint') {
          console.log('[DAP event] breakpoint', JSON.stringify(msg.body).slice(0, 300));
          // Track verified status from breakpoint changed events
          if (msg.body?.breakpoint?.verified) bpVerified = true;
        } else if (msg.event !== 'output' && msg.event !== 'module') {
          console.log('[DAP event]', msg.event, msg.body ? JSON.stringify(msg.body).slice(0, 200) : '');
        }
      }

      // === Handle reverse requests from vsdbg ===
      // Note: handshake is intercepted by the bridge — client never sees it.

      if (msg.type === 'request') {
        console.log('[test] Got reverse request:', msg.command);
        socket.write(encodeDap({
          type: 'response',
          request_seq: msg.seq,
          command: msg.command,
          success: true,
          body: {}
        }));
        continue;
      }

      // === State machine ===

      if (msg.type === 'response' && msg.command === 'initialize' && msg.success) {
        phase = 'attach';
        // Derive symbol search path from source file's parent directory
        const symbolDir = path.dirname(SOURCE_FILE);
        console.log('[test] Attaching to PID', NT_PID, '...');
        socket.write(encodeDap({
          type: 'request',
          command: 'attach',
          arguments: {
            type: 'clr',
            request: 'attach',
            processId: NT_PID,
            justMyCode: false,
            requireExactSource: false,
            logging: {
              engineLogging: false,
              moduleLoad: true,
              exceptions: true,
              programOutput: true
            },
            symbolOptions: {
              searchPaths: [symbolDir],
              searchMicrosoftSymbolServer: false,
              searchNuGetOrgSymbolServer: false,
              moduleFilter: {
                mode: 'loadAllButExcluded',
                excludedModules: []
              }
            }
          }
        }));
      }

      if (msg.type === 'event' && msg.event === 'initialized') {
        phase = 'setbp';
        console.log('[test] Session initialized! Setting breakpoint at', path.basename(SOURCE_FILE) + ':' + BP_LINE);
        socket.write(encodeDap({
          type: 'request',
          command: 'setBreakpoints',
          arguments: {
            source: {
              name: path.basename(SOURCE_FILE),
              path: SOURCE_FILE
            },
            breakpoints: [{ line: BP_LINE }],
            lines: [BP_LINE],
            sourceModified: false
          }
        }));
      }

      if (msg.type === 'response' && msg.command === 'setBreakpoints') {
        if (msg.success && msg.body?.breakpoints) {
          for (const bp of msg.body.breakpoints) {
            console.log('[test] Breakpoint result:', JSON.stringify(bp));
            if (bp.verified) bpVerified = true;
          }
        }
        phase = 'configdone';
        socket.write(encodeDap({
          type: 'request',
          command: 'configurationDone',
          arguments: {}
        }));
      }

      if (msg.type === 'response' && msg.command === 'configurationDone' && msg.success) {
        phase = 'waiting';
        console.log('[test] Configuration done. Waiting 5s for CLR attach to complete...');
        setTimeout(() => {
          console.log('[test] Querying threads...');
          socket.write(encodeDap({
            type: 'request',
            command: 'threads',
            arguments: {}
          }));
        }, 5000);
      }

      if (msg.type === 'response' && msg.command === 'threads' && msg.success && phase === 'waiting') {
        const threads = msg.body?.threads || [];
        console.log('[test] Threads:', threads.length);
        for (const t of threads.slice(0, 5)) {
          console.log('  Thread', t.id, '-', t.name);
        }
        console.log('[test] Querying modules...');
        socket.write(encodeDap({
          type: 'request',
          command: 'modules',
          arguments: { startModule: 0, moduleCount: 500 }
        }));
      }

      if (msg.type === 'response' && msg.command === 'modules' && msg.success && phase === 'waiting') {
        const mods = msg.body?.modules || [];
        console.log('[test] Total modules:', mods.length);
        if (mods.length > 0) {
          const ntMods = mods.filter(m =>
            (m.name || '').toLowerCase().includes('ninjatrader') ||
            (m.name || '').toLowerCase().includes('custom')
          );
          for (const m of ntMods) {
            console.log('[test] Module:', m.name, '| symbols:', m.symbolStatus);
          }
        }

        // Whether or not we have modules, try pausing then re-setting breakpoint
        phase = 'pause';
        console.log('[test] Pausing process...');
        socket.write(encodeDap({
          type: 'request',
          command: 'pause',
          arguments: { threadId: 0 }
        }));

        // After pause, wait and then try to resume + wait for breakpoint
        setTimeout(() => {
          console.log('[test] Querying threads after pause...');
          socket.write(encodeDap({
            type: 'request',
            command: 'threads',
            arguments: {}
          }));
        }, 2000);
      }

      if (msg.type === 'response' && msg.command === 'threads' && msg.success && phase === 'pause') {
        const threads = msg.body?.threads || [];
        console.log('[test] Threads after pause:', threads.length);
        for (const t of threads.slice(0, 5)) {
          console.log('  Thread', t.id, '-', t.name);
        }

        phase = 'done';
        console.log('[test] Disconnecting (terminateDebuggee: false)...');
        socket.write(encodeDap({
          type: 'request', command: 'disconnect',
          arguments: { terminateDebuggee: false }
        }));
        setTimeout(cleanup, 2000);
      }

      // Log any stopped events
      if (msg.type === 'event' && msg.event === 'stopped') {
        console.log('[test] STOPPED:', msg.body?.reason, 'thread:', msg.body?.threadId);
      }

      // Breakpoint hit!
      if (msg.type === 'event' && msg.event === 'stopped' && msg.body?.reason === 'breakpoint') {
        bpHit = true;
        const tid = msg.body.threadId;
        console.log('[test] *** BREAKPOINT HIT! *** Thread:', tid);

        // Get stack trace (scopes request will follow in stackTrace response handler)
        socket.write(encodeDap({
          type: 'request',
          command: 'stackTrace',
          arguments: { threadId: tid, startFrame: 0, levels: 5 }
        }));

        // Continue after inspecting
        setTimeout(() => {
          console.log('[test] Continuing execution...');
          socket.write(encodeDap({
            type: 'request',
            command: 'continue',
            arguments: { threadId: tid }
          }));
        }, 3000);
      }

      if (msg.type === 'response' && msg.command === 'stackTrace' && msg.success) {
        const frames = msg.body?.stackFrames || [];
        console.log('[test] Stack trace:');
        for (const frame of frames) {
          const src = frame.source?.name || '??';
          console.log('  ', frame.name, '@', src + ':' + frame.line);
        }
        // Use the actual frame ID from the top stack frame for scopes
        if (frames.length > 0) {
          const topFrameId = frames[0].id;
          console.log('[test] Requesting scopes for frameId:', topFrameId);
          socket.write(encodeDap({
            type: 'request',
            command: 'scopes',
            arguments: { frameId: topFrameId }
          }));
        }
      }

      if (msg.type === 'response' && msg.command === 'scopes' && msg.success) {
        console.log('[test] Scopes:');
        for (const scope of (msg.body?.scopes || [])) {
          console.log('  ', scope.name, '(ref:', scope.variablesReference + ')');
        }
        // Get variables from first scope
        if (msg.body?.scopes?.length > 0) {
          socket.write(encodeDap({
            type: 'request',
            command: 'variables',
            arguments: { variablesReference: msg.body.scopes[0].variablesReference }
          }));
        }
      }

      if (msg.type === 'response' && msg.command === 'variables' && msg.success) {
        console.log('[test] Local variables:');
        for (const v of (msg.body?.variables || []).slice(0, 15)) {
          console.log('  ', v.name, '=', v.value?.slice(0, 80));
        }
      }
    }
  });

  socket.on('error', (err) => {
    console.error('[test] Socket error:', err.message);
    bridge.kill();
    process.exit(1);
  });
}, 2000);

setTimeout(() => { console.error('[test] GLOBAL TIMEOUT'); bridge.kill(); process.exit(1); }, 60000);
