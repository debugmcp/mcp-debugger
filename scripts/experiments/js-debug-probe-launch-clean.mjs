#!/usr/bin/env node
/**
 * Clean js-debug DAP probe - LAUNCH mode with proper multi-session handling
 * 
 * Based on research findings:
 * - Must declare supportsStartDebuggingRequest: true
 * - Must handle startDebugging reverse request
 * - Must create child session for actual debugging
 * 
 * Usage:
 *   node scripts/experiments/js-debug-probe-launch-clean.mjs
 *   node scripts/experiments/js-debug-probe-launch-clean.mjs --program tests/fixtures/javascript-e2e/simple.js --line 8
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '../../');
const VENDOR_JS_DEBUG = path.resolve(ROOT, 'packages/adapter-javascript/vendor/js-debug/vsDebugServer.cjs');
const DEFAULT_PROGRAM = path.resolve(ROOT, 'tests/fixtures/javascript-e2e/simple.js');
const LOG_DIR = path.resolve(ROOT, 'logs');
const TRACE_FILE = path.join(LOG_DIR, `dap-probe-launch-clean-${Date.now()}.ndjson`);

function logInfo(...args) { console.log('[probe-launch-clean]', ...args); }
function logWarn(...args) { console.warn('[probe-launch-clean][warn]', ...args); }
function logErr(...args) { console.error('[probe-launch-clean][error]', ...args); }

function parseArgs() {
  const out = { 
    program: DEFAULT_PROGRAM, 
    line: 8 
  };
  
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--program' && i + 1 < process.argv.length) {
      out.program = path.resolve(process.argv[++i]);
      continue;
    }
    if (a === '--line' && i + 1 < process.argv.length) {
      out.line = Number(process.argv[++i]) || 8;
      continue;
    }
  }
  
  out.cwd = path.dirname(out.program);
  return out;
}

async function ensureDir(p) {
  try { await fsp.mkdir(p, { recursive: true }); } catch {}
}

async function findFreePort(host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, host, () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

class DapClient extends EventEmitter {
  constructor(host, port, traceFile, name = 'parent') {
    super();
    this.host = host;
    this.port = port;
    this.traceFile = traceFile;
    this.name = name;
    this.socket = null;
    this.seq = 1;
    this.raw = Buffer.alloc(0);
    this.contentLength = -1;
    this.pending = new Map();
    this.events = [];
    this.closed = false;
    
    // For capturing startDebugging request
    this.startDebuggingRequest = null;
    this.childSession = null;
  }

  async connect(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ host: this.host, port: this.port }, () => {
        logInfo(`[${this.name}] Connected to js-debug at ${this.host}:${this.port}`);
        resolve();
      });
      
      this.socket = sock;
      sock.on('data', (data) => this.#onData(data));
      sock.on('error', (err) => reject(err));
      sock.on('close', () => { this.closed = true; });
      
      setTimeout(() => reject(new Error(`connect timeout ${timeoutMs}ms`)), timeoutMs);
    });
  }

  #appendTrace(direction, payload) {
    if (!this.traceFile) return;
    try {
      fs.appendFileSync(
        this.traceFile, 
        JSON.stringify({ 
          ts: new Date().toISOString(), 
          session: this.name,
          direction, 
          payload 
        }) + '\n', 
        'utf8'
      );
    } catch {}
  }

  #onData(data) {
    this.raw = Buffer.concat([this.raw, data]);
    const TWO_CRLF = '\r\n\r\n';
    
    while (true) {
      if (this.contentLength >= 0) {
        if (this.raw.length >= this.contentLength) {
          const body = this.raw.toString('utf8', 0, this.contentLength);
          this.raw = this.raw.slice(this.contentLength);
          this.contentLength = -1;
          
          if (body.length > 0) {
            try {
              const msg = JSON.parse(body);
              this.#handleMessage(msg);
            } catch (e) {
              logErr(`[${this.name}] JSON parse error:`, e);
            }
          }
          continue;
        }
      }
      
      const idx = this.raw.indexOf(TWO_CRLF);
      if (idx === -1) break;
      
      const header = this.raw.toString('utf8', 0, idx);
      const lines = header.split('\r\n');
      
      for (const line of lines) {
        const m = line.match(/Content-Length:\s*(\d+)/i);
        if (m) this.contentLength = parseInt(m[1], 10);
      }
      
      this.raw = this.raw.slice(idx + TWO_CRLF.length);
    }
  }

  #handleMessage(message) {
    this.#appendTrace('in', message);
    
    if (message.type === 'response') {
      const pending = this.pending.get(message.request_seq);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(message.request_seq);
        
        if (message.success) {
          pending.resolve(message);
        } else {
          pending.reject(new Error(message.message || 'DAP request failed'));
        }
      }
    } else if (message.type === 'event') {
      logInfo(`[${this.name}] Event: ${message.event}`);
      this.events.push(message);
      
      if (message.event === 'initialized') {
        logInfo(`[${this.name}] Received 'initialized' event`);
      } else if (message.event === 'stopped') {
        logInfo(`[${this.name}] Received 'stopped' event:`, message.body);
      }
      
      // Emit the event for promise-based waiting
      this.emit(message.event, message);
    } else if (message.type === 'request') {
      // Handle reverse requests from adapter
      logInfo(`[${this.name}] Reverse request: ${message.command}`);
      
      if (message.command === 'runInTerminal') {
        // Acknowledge without spawning terminal
        this.#sendResponse(message.seq, message.command, true, {});
      } else if (message.command === 'startDebugging') {
        // CRITICAL: This is where js-debug asks us to create a child session
        logInfo(`[${this.name}] *** RECEIVED startDebugging REQUEST ***`);
        const config = message.arguments?.configuration || {};
        const pendingTargetId = config.__pendingTargetId;
        
        if (pendingTargetId) {
          logInfo(`[${this.name}] Got __pendingTargetId: ${pendingTargetId}`);
          this.startDebuggingRequest = {
            seq: message.seq,
            pendingTargetId,
            configuration: config
          };
          
          // Emit event for promise-based waiting
          this.emit('startDebugging', {
            pendingTargetId,
            configuration: config
          });
        }
        
        // Acknowledge the request
        this.#sendResponse(message.seq, message.command, true, {});
      } else {
        // Unknown reverse request - acknowledge anyway
        this.#sendResponse(message.seq, message.command, true, {});
      }
    }
  }

  #sendResponse(requestSeq, command, success, body) {
    const response = {
      type: 'response',
      seq: this.seq++,
      request_seq: requestSeq,
      command: command,
      success: success,
      body: body || {}
    };
    this.#writeMessage(response);
  }

  #writeMessage(message) {
    this.#appendTrace('out', message);
    const json = JSON.stringify(message);
    const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
    
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(payload);
    }
  }

  sendRequest(command, args = {}, timeoutMs = 20000) {
    if (!this.socket || this.socket.destroyed) {
      throw new Error('Socket not connected/destroyed');
    }
    
    const seq = this.seq++;
    const req = { seq, type: 'request', command, arguments: args };
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error(`DAP request '${command}' timed out`));
      }, timeoutMs);
      
      this.pending.set(seq, { resolve, reject, timer });
      this.#writeMessage(req);
    });
  }

  async waitForEvent(eventName, timeoutMs = 10000, predicate) {
    // Check existing events
    for (const e of this.events) {
      if (e.event === eventName && (!predicate || predicate(e))) {
        return e;
      }
    }
    
    // Wait for new event
    return new Promise((resolve, reject) => {
      let done = false;
      const startTime = Date.now();
      
      const checkEvents = () => {
        if (done) return;
        
        for (const e of this.events) {
          if (e.event === eventName && (!predicate || predicate(e))) {
            done = true;
            clearInterval(interval);
            resolve(e);
            return;
          }
        }
        
        if (Date.now() - startTime > timeoutMs) {
          done = true;
          clearInterval(interval);
          reject(new Error(`Timeout waiting for event '${eventName}'`));
        }
      };
      
      const interval = setInterval(checkEvents, 100);
    });
  }

  async close() {
    try {
      for (const [, p] of this.pending) clearTimeout(p.timer);
      this.pending.clear();
      
      if (this.socket && !this.socket.destroyed) {
        this.socket.end();
        this.socket.destroy();
      }
    } catch {}
  }
}

async function spawnJsDebug(port) {
  await fsp.access(VENDOR_JS_DEBUG, fs.constants.R_OK);
  
  const child = spawn(process.execPath, [VENDOR_JS_DEBUG, String(port)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
    windowsHide: true
  });

  let resolved = false;
  const listeningPromise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ child, port });
      }
    }, 5000);

    const parseListening = (buf) => {
      const s = String(buf);
      const m = s.match(/Debug server listening at\s+(.+):(\d+)/);
      if (m) {
        clearTimeout(timer);
        if (!resolved) {
          resolved = true;
          resolve({ child, host: m[1].trim(), port: Number(m[2]) });
        }
      }
    };

    child.stdout.on('data', (d) => {
      process.stdout.write(`[js-debug] ${d}`);
      parseListening(d);
    });
    
    child.stderr.on('data', (d) => {
      process.stderr.write(`[js-debug] ${d}`);
      parseListening(d);
    });
  });

  child.on('exit', (code, signal) => {
    logInfo(`js-debug exited code=${code} signal=${signal}`);
  });

  return listeningPromise;
}

async function probe() {
  const { program, line, cwd } = parseArgs();
  
  await ensureDir(LOG_DIR);
  fs.writeFileSync(TRACE_FILE, '', 'utf8');
  logInfo('Trace file:', TRACE_FILE);
  logInfo('Program:', program);
  logInfo('Breakpoint line:', line);
  
  // Verify program exists
  try {
    await fsp.access(program, fs.constants.R_OK);
  } catch {
    throw new Error(`Program not found: ${program}`);
  }
  
  // Start js-debug adapter
  const adapterPort = await findFreePort();
  logInfo('Starting js-debug on port', adapterPort);
  const { child: adapterProc, host: boundHost, port: boundPort } = await spawnJsDebug(adapterPort);
  
  const connectHost = boundHost || '127.0.0.1';
  const connectPort = boundPort || adapterPort;
  
  // Clean up on exit
  const killAll = async () => {
    try {
      if (adapterProc && !adapterProc.killed) {
        adapterProc.kill('SIGTERM');
      }
    } catch {}
  };
  
  process.once('exit', killAll);
  process.once('SIGINT', () => { killAll().finally(() => process.exit(130)); });
  process.once('SIGTERM', () => { killAll().finally(() => process.exit(143)); });
  
  // Create parent DAP client
  const parentClient = new DapClient(connectHost, connectPort, TRACE_FILE, 'parent');
  
  try {
    await parentClient.connect();
    
    // CRITICAL: Declare support for multi-session
    logInfo('[parent] Sending initialize WITH supportsStartDebuggingRequest: true');
    const initResp = await parentClient.sendRequest('initialize', {
      clientID: 'probe-launch-clean',
      adapterID: 'pwa-node',
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      // CRITICAL: This tells js-debug we can handle multi-session!
      supportsStartDebuggingRequest: true
    });
    logInfo('[parent] Initialize response:', initResp.body?.supportsConfigurationDoneRequest ? 'OK' : 'MISSING CAPABILITY');
    
    // Send LAUNCH request - don't wait for response, js-debug processes it async
    logInfo('[parent] Sending launch request');
    parentClient.sendRequest('launch', {
      type: 'pwa-node',
      request: 'launch',
      name: 'Debug probe',
      program: program,
      cwd: cwd,
      stopOnEntry: false,
      args: [],
      console: 'internalConsole',
      outputCapture: 'std'
    }).catch(err => {
      logWarn('[parent] Launch request error (may be normal):', err.message);
    });
    
    // Wait for initialized event - js-debug sends this when ready for breakpoints
    logInfo('[parent] Waiting for initialized event...');
    await parentClient.waitForEvent('initialized', 10000);
    logInfo('[parent] Got initialized event - ready to set breakpoints');
    
    // Set breakpoints in PARENT session (will be mirrored to child)
    logInfo(`[parent] Setting breakpoint at ${program}:${line}`);
    const bpResp = await parentClient.sendRequest('setBreakpoints', {
      source: { path: program },
      breakpoints: [{ line }]
    });
    const bpInfo = bpResp?.body?.breakpoints || [];
    logInfo('[parent] Breakpoints response:', bpInfo);
    
    // Set exception breakpoints
    await parentClient.sendRequest('setExceptionBreakpoints', { filters: [] });
    
    // Set up promise for startDebugging BEFORE sending configurationDone
    logInfo('[parent] Setting up listener for startDebugging request...');
    const startDebuggingPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for startDebugging request'));
      }, 5000);
      
      parentClient.once('startDebugging', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });
    
    // Configuration done - this triggers js-debug to send startDebugging
    logInfo('[parent] Sending configurationDone');
    await parentClient.sendRequest('configurationDone', {});
    
    // Wait for startDebugging event (should arrive immediately)
    logInfo('[parent] Waiting for startDebugging request...');
    let startDebuggingData;
    try {
      startDebuggingData = await startDebuggingPromise;
      logInfo('[parent] Received startDebugging data:', startDebuggingData);
    } catch (err) {
      logErr('[parent] Failed to receive startDebugging:', err.message);
      throw err;
    }
    
    if (startDebuggingData) {
      const { pendingTargetId, configuration } = startDebuggingData;
      logInfo(`[parent] Creating CHILD session for pendingTargetId: ${pendingTargetId}`);
      
      // Create child session
      const childClient = new DapClient(connectHost, connectPort, TRACE_FILE, 'child');
      await childClient.connect();
      
      // Initialize child session
      logInfo('[child] Sending initialize');
      await childClient.sendRequest('initialize', {
        clientID: 'probe-launch-clean-child',
        adapterID: 'pwa-node',
        pathFormat: 'path',
        linesStartAt1: true,
        columnsStartAt1: true
      });
      
      // Wait for child initialized
      await childClient.waitForEvent('initialized', 5000);
      logInfo('[child] Got initialized event');
      
      // Set breakpoints in child
      logInfo('[child] Setting breakpoints');
      await childClient.sendRequest('setBreakpoints', {
        source: { path: program },
        breakpoints: [{ line }]
      });
      
      await childClient.sendRequest('setExceptionBreakpoints', { filters: [] });
      
      // Configuration done for child
      await childClient.sendRequest('configurationDone', {});
      
      // Attach child to the pending target
      logInfo(`[child] Attaching to __pendingTargetId: ${pendingTargetId}`);
      await childClient.sendRequest('attach', {
        type: 'pwa-node',
        request: 'attach',
        __pendingTargetId: pendingTargetId,
        continueOnAttach: true  // Auto-continue after attach
      });
      
      // Wait for stopped event IN CHILD SESSION
      logInfo('[child] Waiting for stopped event at breakpoint...');
      const stoppedEvt = await childClient.waitForEvent('stopped', 5000);
      
      if (stoppedEvt) {
        logInfo('*** SUCCESS! Stopped at breakpoint ***');
        logInfo('Stopped details:', stoppedEvt.body);
        
        // Verify we can get stack trace
        const threadId = stoppedEvt.body?.threadId || 1;
        const stackResp = await childClient.sendRequest('stackTrace', {
          threadId,
          startFrame: 0,
          levels: 20
        });
        
        const frames = stackResp?.body?.stackFrames || [];
        logInfo('Stack frames:', frames.length);
        if (frames.length > 0) {
          logInfo('Top frame:', frames[0]);
        }
        
        // Success!
        logInfo('✅ PROBE SUCCESS - Clean LAUNCH mode with multi-session works!');
        logInfo('✅ No timeouts, no fallbacks, breakpoint hit immediately');
        process.exitCode = 0;
      } else {
        logWarn('No stopped event received');
        process.exitCode = 1;
      }
      
      await childClient.close();
    } else {
      logErr('❌ PROBE FAILED - No startDebugging request received');
      logErr('This means js-debug did not send the multi-session request');
      process.exitCode = 1;
    }
    
    await parentClient.close();
  } catch (e) {
    logErr('Probe failed:', e?.message || e);
    process.exitCode = 1;
  } finally {
    await killAll();
  }
}

(async () => {
  try {
    await probe();
  } catch (e) {
    logErr('Fatal:', e?.message || e);
    process.exitCode = 1;
  }
})();
