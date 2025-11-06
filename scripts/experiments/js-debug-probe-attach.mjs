#!/usr/bin/env node
/**
 * Standalone js-debug DAP probe (attach-only flow)
 *
 * Strategy:
 *  - Spawn vendored js-debug server (vsDebugServer.cjs) on a random TCP port
 *  - Spawn the target Node program separately with --inspect-brk on a free port
 *  - Connect to js-debug via DAP over TCP
 *  - Handshake: initialize -> wait 'initialized' -> setExceptionBreakpoints -> setBreakpoints -> configurationDone
 *  - Attach to the target by inspector port
 *  - Wait for 'stopped' or fall back to threads+pause
 *  - Verify stackTrace -> scopes -> variables -> evaluate
 *
 * Usage:
 *   node scripts/experiments/js-debug-probe-attach.mjs
 *   node scripts/experiments/js-debug-probe-attach.mjs --program tests/fixtures/javascript-e2e/simple.js --line 8
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '../../'); // repo root
const VENDOR_JS_DEBUG = path.resolve(ROOT, 'packages/adapter-javascript/vendor/js-debug/vsDebugServer.cjs');
const DEFAULT_PROGRAM = path.resolve(ROOT, 'tests/fixtures/javascript-e2e/simple.js');
const DEFAULT_CWD = path.dirname(DEFAULT_PROGRAM);
const LOG_DIR = path.resolve(ROOT, 'logs');
const TRACE_FILE = path.join(LOG_DIR, `dap-probe-attach-${Date.now()}.ndjson`);

function logInfo(...args) { console.log('[probe-attach]', ...args); }
function logWarn(...args) { console.warn('[probe-attach][warn]', ...args); }
function logErr(...args) { console.error('[probe-attach][error]', ...args); }

function parseArgs() {
  const out = { program: DEFAULT_PROGRAM, cwd: DEFAULT_CWD, line: 8 };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--program' && i + 1 < process.argv.length) {
      out.program = path.resolve(process.argv[++i]);
      out.cwd = path.dirname(out.program);
      continue;
    }
    if (a === '--cwd' && i + 1 < process.argv.length) {
      out.cwd = path.resolve(process.argv[++i]);
      continue;
    }
    if (a === '--line' && i + 1 < process.argv.length) {
      out.line = Number(process.argv[++i]) || 8;
      continue;
    }
  }
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

async function isPortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, host, () => {
      srv.close(() => resolve(true));
    });
  });
}

class DapClient {
  constructor(host, port, traceFile) {
    this.host = host;
    this.port = port;
    this.traceFile = traceFile;
    this.socket = null;
    this.seq = 1;
    this.raw = Buffer.alloc(0);
    this.contentLength = -1;
    this.pending = new Map();
    this.events = [];
    this.listeners = new Map();
    this.closed = false;
    this.lastStartDebugging = null;
  }

  async connect(timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    const candidates = Array.from(new Set([this.host, 'localhost', '::1', '127.0.0.1'])).filter(Boolean);
    let lastErr = null;
    for (const host of candidates) {
      try {
        await new Promise((resolve, reject) => {
          const remaining = Math.max(1, deadline - Date.now());
          const sock = net.createConnection({ host, port: this.port }, () => resolve());
          this.socket = sock;
          sock.on('data', (data) => this.#onData(data));
          sock.on('error', (err) => { lastErr = err; reject(err); });
          sock.on('close', () => { this.closed = true; this.#emit('close', undefined); });
          setTimeout(() => reject(new Error(`connect timeout ${remaining}ms`)), remaining);
        });
        logInfo(`Connected to js-debug at ${host}:${this.port}`);
        return;
      } catch (e) {
        // try next
      }
    }
    throw lastErr || new Error(`connect timeout ${timeoutMs}ms`);
  }

  #appendTrace(direction, payload) {
    if (!this.traceFile) return;
    try {
      fs.appendFileSync(this.traceFile, JSON.stringify({ ts: new Date().toISOString(), direction, payload }) + '\n', 'utf8');
    } catch {}
  }

  #emit(eventName, payload) {
    if (this.listeners.has(eventName)) {
      for (const cb of this.listeners.get(eventName)) {
        try { cb(payload); } catch {}
      }
    }
    if (eventName === 'dapEvent') {
      const evt = payload;
      if (evt && typeof evt.event === 'string') {
        if (this.listeners.has('event')) {
          for (const cb of this.listeners.get('event')) {
            try { cb(evt); } catch {}
          }
        }
      }
    }
  }

  on(eventName, cb) {
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
    this.listeners.get(eventName).add(cb);
  }
  off(eventName, cb) {
    if (this.listeners.has(eventName)) this.listeners.get(eventName).delete(cb);
  }

  getLastStartDebugging() {
    return this.lastStartDebugging;
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
              logErr('JSON parse error:', e);
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
        if (message.success) pending.resolve(message);
        else pending.reject(new Error(message.message || 'DAP request failed'));
      } else {
        logWarn(`Response for unknown request_seq=${message.request_seq}`);
      }
    } else if (message.type === 'event') {
      this.events.push(message);
      this.#emit('dapEvent', message);
      if (message.event === 'initialized') this.#emit('initialized', message.body);
    } else if (message.type === 'request') {
      if (message.command === 'runInTerminal') {
        const resp = { type: 'response', seq: this.seq++, request_seq: message.seq, command: message.command, success: true, body: {} };
        this.#writeMessage(resp);
      } else if (message.command === 'startDebugging') {
        // Capture pending target id for child adoption
        try {
          const cfg = (message && message.arguments && message.arguments.configuration) || {};
          const pendingTargetId = cfg.__pendingTargetId || null;
          this.lastStartDebugging = { pendingTargetId, configuration: cfg };
          // Emit to any listeners
          this.#emit('dapEvent', { type: 'event', event: 'startDebugging', body: { pendingTargetId, configuration: cfg } });
        } catch {}
        const resp = { type: 'response', seq: this.seq++, request_seq: message.seq, command: message.command, success: true, body: {} };
        this.#writeMessage(resp);
      } else {
        const resp = { type: 'response', seq: this.seq++, request_seq: message.seq, command: message.command, success: true, body: {} };
        this.#writeMessage(resp);
      }
    }
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
    if (!this.socket || this.socket.destroyed) throw new Error('Socket not connected/destroyed');
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

  async waitForEvent(eventName, timeoutMs = 15000, predicate) {
    for (const e of this.events) {
      if (e.event === eventName && (!predicate || predicate(e))) return e;
    }
    return new Promise((resolve, reject) => {
      let done = false;
      const onEvt = (evt) => {
        if (done) return;
        if (evt.event === eventName && (!predicate || predicate(evt))) {
          done = true;
          clearTimeout(timer);
          this.off('event', onEvt);
          resolve(evt);
        }
      };
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        this.off('event', onEvt);
        reject(new Error(`Timeout waiting for event '${eventName}'`));
      }, timeoutMs);
      this.on('event', onEvt);
    });
  }

  async threads() {
    const resp = await this.sendRequest('threads', {});
    return resp?.body?.threads || [];
  }

  async pause(threadId) {
    return this.sendRequest('pause', { threadId });
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

function addMaxOldSpace(existing) {
  const flag = '--max-old-space-size=4096';
  if (!existing) return flag;
  if (existing.includes('--max-old-space-size')) return existing;
  return `${existing} ${flag}`.trim();
}

async function spawnJsDebug(port, waitMs = 12000) {
  await fsp.access(VENDOR_JS_DEBUG, fs.constants.R_OK);
  const child = spawn(process.execPath, [VENDOR_JS_DEBUG, String(port)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_OPTIONS: addMaxOldSpace(process.env.NODE_OPTIONS) },
    windowsHide: true
  });

  let boundHost = null;
  let boundPort = null;
  let resolved = false;

  const listeningPromise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ child, host: null, port });
      }
    }, waitMs);

    const parseListening = (buf) => {
      try {
        const s = String(buf);
        const m = s.match(/Debug server listening at\s+(.+):(\d+)\s*$/m);
        if (m) {
          boundHost = m[1].trim();
          boundPort = Number(m[2]);
          if (!Number.isNaN(boundPort)) {
            clearTimeout(timer);
            if (!resolved) {
              resolved = true;
              resolve({ child, host: boundHost, port: boundPort });
            }
          }
        }
      } catch {}
    };

    child.stdout.on('data', (d) => { process.stdout.write(`[js-debug] ${d}`); parseListening(d); });
    child.stderr.on('data', (d) => { process.stderr.write(`[js-debug] ${d}`); parseListening(d); });
  });

  child.on('exit', (code, signal) => {
    logInfo(`js-debug exited code=${code} signal=${signal}`);
  });

  return listeningPromise;
}

async function spawnNodeTarget(program, cwd, inspectorPort) {
  const args = [`--inspect-brk=${inspectorPort}`, program];
  const child = spawn(process.execPath, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    windowsHide: true
  });
  child.stdout.on('data', (d) => process.stdout.write(`[target] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[target] ${d}`));
  return child;
}

async function probe() {
  const { program, cwd, line } = parseArgs();

  await ensureDir(LOG_DIR);
  fs.writeFileSync(TRACE_FILE, '', 'utf8');
  logInfo('Trace file:', TRACE_FILE);

  try { await fsp.access(program, fs.constants.R_OK); }
  catch { throw new Error(`Program not found/readable: ${program}`); }

  const adapterPort = await findFreePort();
  logInfo('Spawning js-debug on port', adapterPort);
  const { child: adapterProc, host: boundHost, port: boundPort } = await spawnJsDebug(adapterPort);

  const connectHost = boundHost && typeof boundHost === 'string' ? boundHost : '127.0.0.1';
  const connectPort = typeof boundPort === 'number' ? boundPort : adapterPort;

  // Prepare inspector port and spawn target process
  let inspectorPort = 9229;
  if (!(await isPortAvailable(inspectorPort))) {
    inspectorPort = await findFreePort();
    logWarn(`Port 9229 busy, using ${inspectorPort} for inspector`);
  }
  logInfo('Spawning target with --inspect-brk on port', inspectorPort);
  const targetProc = await spawnNodeTarget(program, cwd, inspectorPort);

  const killAll = async () => {
    try {
      if (targetProc && !targetProc.killed) {
        try { targetProc.kill('SIGTERM'); } catch {}
        setTimeout(() => { try { targetProc.kill('SIGKILL'); } catch {} }, 300);
      }
    } catch {}
    try {
      if (adapterProc && !adapterProc.killed) {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/PID', String(adapterProc.pid), '/T', '/F'], { stdio: 'ignore' }).on('error', () => {});
        } else {
          try { adapterProc.kill('SIGTERM'); } catch {}
          setTimeout(() => { try { adapterProc.kill('SIGKILL'); } catch {} }, 300);
        }
      }
    } catch {}
  };
  process.once('exit', killAll);
  process.once('SIGINT', () => { killAll().finally(() => process.exit(130)); });
  process.once('SIGTERM', () => { killAll().finally(() => process.exit(143)); });

  const dap = new DapClient(connectHost, connectPort, TRACE_FILE);

  try {
    await dap.connect(10000);
    logInfo('Connected to js-debug');

    // 1) initialize
    await dap.sendRequest('initialize', {
      clientID: 'probe-attach',
      adapterID: 'pwa-node',
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true
    });
    logInfo('initialize -> ok');

    // wait for initialized
    await dap.waitForEvent('initialized', 10000);
    logInfo('initialized event received');

    // 2) setExceptionBreakpoints
    await dap.sendRequest('setExceptionBreakpoints', { filters: [] });
    logInfo('setExceptionBreakpoints -> ok');

    // 3) setBreakpoints (absolute path)
    const bpResp = await dap.sendRequest('setBreakpoints', {
      source: { path: program },
      breakpoints: [{ line }]
    });
    const bpInfo = bpResp?.body?.breakpoints || [];
    logInfo('setBreakpoints ->', bpInfo);

    // 4) configurationDone
    await dap.sendRequest('configurationDone', {});
    logInfo('configurationDone -> ok');

    // 5) attach to inspector port
    const attachArgs = {
      type: 'pwa-node',
      request: 'attach',
      address: '127.0.0.1',
      port: inspectorPort,
      continueOnAttach: false,
      attachExistingChildren: true,
      // attachSimplePort can help js-debug route correctly
      attachSimplePort: inspectorPort
    };
    await dap.sendRequest('attach', attachArgs, 20000);
    logInfo('attach -> ok');

    // 6) js-debug will reverse-request startDebugging with a __pendingTargetId; adopt via child session
    const waitStartDebugging = async (timeoutMs = 12000) => {
      // quick check of cached value
      const cached = dap.getLastStartDebugging?.();
      if (cached && cached.pendingTargetId) return cached;
      return new Promise((resolve) => {
        let done = false;
        const onEvt = (evt) => {
          if (done) return;
          try {
            if (evt && evt.event === 'startDebugging') {
              done = true;
              dap.off?.('event', onEvt);
              resolve(evt.body);
            }
          } catch {}
        };
        dap.on?.('event', onEvt);
        setTimeout(() => {
          if (done) return;
          done = true;
          dap.off?.('event', onEvt);
          resolve(dap.getLastStartDebugging?.() || null);
        }, timeoutMs);
      });
    };

    let stoppedEvt = null;
    let childClient = null;
    const startPayload = await waitStartDebugging(12000);
    if (startPayload && typeof startPayload.pendingTargetId === 'string') {
      const pendingId = startPayload.pendingTargetId;
      // Create a child session and follow strict DAP order for child adoption:
      // initialize -> wait 'initialized' -> send configs -> configurationDone -> attach(__pendingTargetId)
      try {
        const child = new DapClient(connectHost, connectPort, TRACE_FILE);
        await child.connect(10000);
        await child.sendRequest('initialize', {
          clientID: 'probe-attach-child',
          adapterID: 'pwa-node',
          pathFormat: 'path',
          linesStartAt1: true,
          columnsStartAt1: true
        }, 20000);
        // Wait for child 'initialized' BEFORE sending configs
        try { await child.waitForEvent('initialized', 12000); } catch {}
        // Send configuration requests
        try { await child.sendRequest('setExceptionBreakpoints', { filters: [] }); } catch {}
        try {
          await child.sendRequest('setBreakpoints', {
            source: { path: program },
            breakpoints: [{ line }]
          }, 20000);
        } catch {}
        try { await child.sendRequest('configurationDone', {}, 20000); } catch {}
        // Now adopt target in CHILD via attach(__pendingTargetId)
        let adopted = false;
        for (let i = 0; i < 20 && !adopted; i++) {
          try {
            await child.sendRequest('attach', {
              type: 'pwa-node',
              request: 'attach',
              __pendingTargetId: pendingId,
              continueOnAttach: false
            }, 20000);
            adopted = true;
            break;
          } catch {
            await new Promise((r) => setTimeout(r, 200));
          }
        }
        // Fallback: attach by inspector port in CHILD if pendingId adoption failed
        if (!adopted) {
          await child.sendRequest('attach', {
            type: 'pwa-node',
            request: 'attach',
            address: '127.0.0.1',
            port: inspectorPort,
            continueOnAttach: false,
            attachExistingChildren: true
          }, 20000);
        }
        // Wait for child stopped; fallback to threads+pause
        try {
          stoppedEvt = await child.waitForEvent('stopped', 15000);
          logInfo('stopped (child via attach adoption):', stoppedEvt?.body || {});
        } catch {
          let tid = null;
          for (let i = 0; i < 150; i++) {
            const th = await child.sendRequest('threads', {}, 10000).catch(() => null);
            const arr = th?.body?.threads || [];
            if (Array.isArray(arr) && arr.length) { tid = arr[0].id; break; }
            await new Promise((r) => setTimeout(r, 100));
          }
          if (typeof tid === 'number') {
            await child.sendRequest('pause', { threadId: tid }, 10000).catch(() => {});
            try {
              stoppedEvt = await child.waitForEvent('stopped', 10000);
              logInfo('stopped after pause (child via attach):', stoppedEvt?.body || {});
            } catch {}
          }
        }
        childClient = child;
      } catch (e) {
        logWarn('Child attach adoption failed in attach-probe:', e?.message || e);
      }
    }

    // If still no stop, fallback to threads+pause on parent session
    if (!stoppedEvt) {
      let tid = null;
      for (let i = 0; i < 150; i++) {
        const threads = await dap.threads().catch(() => []);
        if (Array.isArray(threads) && threads.length) { tid = threads[0].id; break; }
        await new Promise((r) => setTimeout(r, 100));
      }
      if (typeof tid === 'number') {
        await dap.pause(tid).catch(() => {});
        try {
          stoppedEvt = await dap.waitForEvent('stopped', 10000);
          logInfo('stopped after pause (parent):', stoppedEvt?.body || {});
        } catch {}
      }
    }
    if (!stoppedEvt) throw new Error('Failed to observe a stopped event');

    const threadId = stoppedEvt?.body?.threadId;
    let useTid = threadId;
    if (typeof useTid !== 'number') {
      const clientForThreads = childClient || dap;
      const threads = await clientForThreads.threads().catch(() => []);
      if (Array.isArray(threads) && threads.length) useTid = threads[0].id;
    }
    if (typeof useTid !== 'number') throw new Error('No threadId available after stopped');

    const clientForOps = childClient || dap;
    const stackResp = await clientForOps.sendRequest('stackTrace', { threadId: useTid, startFrame: 0, levels: 20 });
    const frame = stackResp?.body?.stackFrames?.[0];
    if (!frame) throw new Error('No stack frame in stackTrace');

    const scopesResp = await clientForOps.sendRequest('scopes', { frameId: frame.id });
    const scope = scopesResp?.body?.scopes?.[0];
    if (!scope) throw new Error('No scope returned');

    const varsResp = await clientForOps.sendRequest('variables', { variablesReference: scope.variablesReference });

    const evalResp = await clientForOps.sendRequest('evaluate', {
      expression: '1+1',
      frameId: frame.id,
      context: 'repl'
    });

    const hasVars = Array.isArray(varsResp?.body?.variables) && varsResp.body.variables.length > 0;
    const evalOk = typeof evalResp?.body?.result === 'string' ? evalResp.body.result.includes('2') : false;

    const summary = {
      program,
      line,
      stopped: true,
      breakpointVerified: (bpResp?.body?.breakpoints || []).some(b => b.verified === true),
      variablesCount: (varsResp?.body?.variables || []).length,
      eval1plus1: evalResp?.body?.result
    };
    logInfo('SUMMARY:', summary);

    const success = hasVars && evalOk;
    if (!success) {
      logWarn('Probe (attach) did not meet all criteria (variables && evalOk). See trace for details:', TRACE_FILE);
      process.exitCode = 2;
    } else {
      logInfo('Probe (attach) success. Paused, variables accessible, evaluate ok. Trace:', TRACE_FILE);
      process.exitCode = 0;
    }
  } catch (e) {
    logErr('Probe (attach) failed:', e?.message || e);
    logErr('Trace file:', TRACE_FILE);
    process.exitCode = 1;
  } finally {
    await new Promise((r) => setTimeout(r, 150));
    try { await killAll(); } catch {}
  }
}

(async () => {
  try { await probe(); }
  catch (e) { logErr('Fatal:', e?.message || e); process.exitCode = 1; }
})();
