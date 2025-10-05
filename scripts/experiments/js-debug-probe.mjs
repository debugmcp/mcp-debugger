#!/usr/bin/env node
/**
 * Standalone js-debug DAP probe (no MCP/proxy)
 * - Spawns vendored js-debug server (vsDebugServer.cjs) on a random TCP port
 * - Connects via DAP over TCP and drives a minimal sequence to stop at a breakpoint
 * - Verifies we can inspect variables (scopes/variables/evaluate)
 *
 * Usage:
 *   node scripts/experiments/js-debug-probe.mjs
 *   node scripts/experiments/js-debug-probe.mjs --program tests/fixtures/javascript-e2e/simple.js --line 8
 *
 * This script implements Option A (single-session inspector adoption):
 *   initialize -> initialized -> setExceptionBreakpoints -> setBreakpoints -> configurationDone ->
 *   launch { runtimeArgs: ["--inspect-brk=9229"], attachSimplePort: 9229 } ->
 *   adopt child via startDebugging (__pendingTargetId) OR attach to inspector port ->
 *   wait stopped | threads+pause -> stackTrace -> scopes -> variables -> evaluate
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '../../'); // repo root
const VENDOR_JS_DEBUG = path.resolve(ROOT, 'packages/adapter-javascript/vendor/js-debug/vsDebugServer.cjs');
const DEFAULT_PROGRAM = path.resolve(ROOT, 'tests/fixtures/javascript-e2e/simple.js');
const DEFAULT_CWD = path.dirname(DEFAULT_PROGRAM);
const LOG_DIR = path.resolve(ROOT, 'logs');
const TRACE_FILE = path.join(LOG_DIR, `dap-probe-${Date.now()}.ndjson`);

function logInfo(...args) {
  console.log('[probe]', ...args);
}
function logWarn(...args) {
  console.warn('[probe][warn]', ...args);
}
function logErr(...args) {
  console.error('[probe][error]', ...args);
}

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
    this.pending = new Map(); // request_seq -> { resolve, reject, timer }
    this.events = [];
    this.listeners = new Map(); // eventName -> Set(callback)
    this.closed = false;
    this.lastStartDebugging = null;
  }

  async connect(timeoutMs = 8000) {
    // Try multiple loopback variants to handle adapters that bind IPv6 (::1) by default on Windows
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
          sock.on('error', (err) => {
            lastErr = err;
            // Reject so we can try the next candidate host
            reject(err);
          });
          sock.on('close', () => {
            this.closed = true;
            this.#emit('close', undefined);
          });

          setTimeout(() => reject(new Error(`connect timeout ${remaining}ms`)), remaining);
        });
        logInfo(`Connected to js-debug at ${host}:${this.port}`);
        return;
      } catch (e) {
        // Try next host
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
    // generic 'event' stream when payload is a DAP event
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
      // For this probe, just ack runInTerminal if asked.
      if (message.command === 'runInTerminal') {
        const resp = {
          type: 'response',
          seq: this.seq++,
          request_seq: message.seq,
          command: message.command,
          success: true,
          body: {}
        };
        this.#writeMessage(resp);
      } else if (message.command === 'startDebugging') {
        // Reverse-start flow: capture pending target id and emit a custom event for adoption
        try {
          // message.arguments?.configuration?.__pendingTargetId
          const cfg = (message && message.arguments && message.arguments.configuration) || {};
          const pendingTargetId = cfg.__pendingTargetId || null;
          try { logInfo('Adapter requested startDebugging; __pendingTargetId:', pendingTargetId); } catch {}
          this.lastStartDebugging = { pendingTargetId, configuration: cfg };
          this.#emit('startDebugging', { pendingTargetId, configuration: cfg });
        } catch {
          // ignore parse errors
        }
        const resp = {
          type: 'response',
          seq: this.seq++,
          request_seq: message.seq,
          command: message.command,
          success: true,
          body: {}
        };
        this.#writeMessage(resp);
      } else {
        const resp = {
          type: 'response',
          seq: this.seq++,
          request_seq: message.seq,
          command: message.command,
          success: true,
          body: {}
        };
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

  sendRequest(command, args = {}, timeoutMs = 15000) {
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

  async waitForEvent(eventName, timeoutMs = 10000, predicate) {
    // check existing buffered events first
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

async function spawnJsDebug(port, waitMs = 12000) {
  // Validate vendor file exists
  await fsp.access(VENDOR_JS_DEBUG, fs.constants.R_OK);

  const child = spawn(process.execPath, [VENDOR_JS_DEBUG, String(port)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_OPTIONS: addMaxOldSpace(process.env.NODE_OPTIONS)
    },
    windowsHide: true
  });

  let boundHost = null;
  let boundPort = null;
  let resolved = false;

  const listeningPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ child, host: null, port }); // fall back to null host (caller will try candidates)
      }
    }, waitMs);

    const parseListening = (buf) => {
      try {
        const s = String(buf);
        // Example: "Debug server listening at ::1:57982"
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
      } catch {
        // no-op
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

function addMaxOldSpace(existing) {
  const flag = '--max-old-space-size=4096';
  if (!existing) return flag;
  if (existing.includes('--max-old-space-size')) return existing;
  return `${existing} ${flag}`.trim();
}

async function probe() {
  const { program, cwd, line } = parseArgs();

  await ensureDir(LOG_DIR);
  fs.writeFileSync(TRACE_FILE, '', 'utf8');
  logInfo('Trace file:', TRACE_FILE);

  // Pre-flight checks
  try {
    await fsp.access(program, fs.constants.R_OK);
  } catch {
    throw new Error(`Program not found/readable: ${program}`);
  }

  const adapterPort = await findFreePort();
  logInfo('Spawning js-debug on port', adapterPort);
  const { child: adapterProc, host: boundHost, port: boundPort } = await spawnJsDebug(adapterPort);

  // Choose connection host: prefer the adapter's advertised host, else try loopback variants in DapClient
  const connectHost = boundHost && typeof boundHost === 'string' ? boundHost : '127.0.0.1';
  const connectPort = typeof boundPort === 'number' ? boundPort : adapterPort;

  // Ensure we reap child on process exit or after probe completes/fails
  const killAdapter = async () => {
    try {
      if (adapterProc && !adapterProc.killed) {
        if (process.platform === 'win32') {
          // best-effort kill the process; ignore errors
          spawn('taskkill', ['/PID', String(adapterProc.pid), '/T', '/F'], { stdio: 'ignore' }).on('error', () => {});
        } else {
          adapterProc.kill('SIGTERM');
          setTimeout(() => { try { adapterProc.kill('SIGKILL'); } catch {} }, 500);
        }
      }
    } catch {
      // ignore
    }
  };
  let killed = false;
  const onExit = async () => {
    if (!killed) {
      killed = true;
      await killAdapter();
    }
  };
  process.once('exit', onExit);
  process.once('SIGINT', () => { onExit().finally(() => process.exit(130)); });
  process.once('SIGTERM', () => { onExit().finally(() => process.exit(143)); });

  const dap = new DapClient(connectHost, connectPort, TRACE_FILE);

  try {
    // Give the adapter a brief grace period if it only just announced binding
    await new Promise((r) => setTimeout(r, 50));
    await dap.connect(8000);
    logInfo('Connected to js-debug');

    // 1) initialize
    const initArgs = {
      clientID: 'probe',
      adapterID: 'pwa-node',
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true
    };
    await dap.sendRequest('initialize', initArgs);
    logInfo('initialize -> ok');

    // wait for initialized
    await dap.waitForEvent('initialized', 8000);
    logInfo('initialized event received');

    // 2) setExceptionBreakpoints
    await dap.sendRequest('setExceptionBreakpoints', { filters: [] });
    logInfo('setExceptionBreakpoints -> ok');

    // 3) setBreakpoints
    const bpResp = await dap.sendRequest('setBreakpoints', {
      source: { path: program },
      breakpoints: [{ line }]
    });
    const bpInfo = bpResp?.body?.breakpoints || [];
    logInfo('setBreakpoints ->', bpInfo);

    // 4) configurationDone
    await dap.sendRequest('configurationDone', {});
    logInfo('configurationDone -> ok');

    // 5) launch (hybrid: provide explicit inspector port for reliability, still allow startDebugging adoption)
    // Prefer 9229 if free; otherwise pick a free port
    let inspectorPort = 9229;
    if (!(await isPortAvailable(inspectorPort))) {
      inspectorPort = await findFreePort();
      logWarn(`Port 9229 busy, using ${inspectorPort} for inspector`);
    }
    const launchArgs = {
      type: 'pwa-node',
      request: 'launch',
      name: 'Debug JavaScript/TypeScript',
      program,
      cwd,
      args: [],
      stopOnEntry: true,
      justMyCode: true,
      smartStep: true,
      skipFiles: ['<node_internals>/**', '**/node_modules/**'],
      console: 'internalConsole',
      outputCapture: 'std',
      autoAttachChildProcesses: false,
      env: {}, // keep minimal, avoid leaking runner env
      sourceMaps: false,
      runtimeExecutable: 'node',
      // Provide inspector port so js-debug doesn't fall back to 9229 implicitly
      runtimeArgs: [`--inspect-brk=${inspectorPort}`],
      // Also provide attachSimplePort to enable same-session adoption when supported
      attachSimplePort: inspectorPort
    };
    // When attachSimplePort is present, prefer single-session adoption and ignore reverse startDebugging in parent
    const singleSession = true;
    await dap.sendRequest('launch', launchArgs);
    logInfo('launch -> ok (requested)');
    // Wait for actual inspector port from adapter output (more reliable than our planned port)
    const listeningPort = await new Promise((resolve) => {
      let done = false;
      const handler = (evt) => {
        try {
          if (done) return;
          if (evt && evt.event === 'output') {
            const out = (evt.body && evt.body.output) || '';
            const m = typeof out === 'string' && out.match(/Debugger listening on ws:\/\/(?:127\.0\.0\.1|localhost):(\d+)\//);
            if (m) {
              done = true;
              try { dap.off('event', handler); } catch {}
              resolve(Number(m[1]));
            }
          }
        } catch {
          // ignore
        }
      };
      dap.on('event', handler);
      // safety timeout
      setTimeout(() => {
        if (done) return;
        done = true;
        try { dap.off('event', handler); } catch {}
        resolve(inspectorPort); // fall back to requested port
      }, 6000);
    });
    // Observed inspector port available in `listeningPort`; parent will not attach here to avoid double-session conflicts.

    // 6) Adoption or first stop detection (race startDebugging vs stopped)
    let stoppedEvt = null;
    let adopted = false;
    let childClient = null;
    let childBpResp = null;

    // Prepare a one-shot wait for startDebugging
    const startDebuggingOnce = () =>
      new Promise((resolve) => {
        // Resolve immediately if adapter already requested startDebugging (race-safe)
        try {
          const cached = typeof dap.getLastStartDebugging === 'function' ? dap.getLastStartDebugging() : null;
          if (cached) return resolve(cached);
        } catch {}
        const handler = (payload) => {
          try { dap.off('startDebugging', handler); } catch {}
          resolve(payload);
        };
        dap.on('startDebugging', handler);
        // Also auto-timeout after a short window; resolve with cached or null
        setTimeout(() => {
          try { dap.off('startDebugging', handler); } catch {}
          try {
            const cached2 = typeof dap.getLastStartDebugging === 'function' ? dap.getLastStartDebugging() : null;
            resolve(cached2 || null);
          } catch {
            resolve(null);
          }
        }, 12000);
      });

    // Race: stopped vs startDebugging
    const first = await Promise.race([
      dap.waitForEvent('stopped', 12000).catch(() => null),
      startDebuggingOnce()
    ]);

    if (first && typeof first === 'object' && first.event === 'stopped') {
      stoppedEvt = first;
      logInfo('stopped event received:', stoppedEvt?.body || {});
    } else if (first && typeof first === 'object' && !('event' in first)) {
      // startDebugging path
      const pendingTargetId = first?.pendingTargetId || null;
      if (pendingTargetId && typeof pendingTargetId === 'string') {
        if (singleSession) {
          // Create a child DAP session and adopt pending target there (mirrors VS Code behavior)
          logInfo('startDebugging received; creating child DAP session for adoption.');
          try {
            const child = new DapClient(connectHost, connectPort, TRACE_FILE);
            await child.connect(8000);
            await child.sendRequest('initialize', {
              clientID: 'probe-child',
              adapterID: 'pwa-node',
              pathFormat: 'path',
              linesStartAt1: true,
              columnsStartAt1: true
            });
            try { await child.waitForEvent('initialized', 3000); } catch {}
            // Prefer attach-based adoption per js-debug expectations
            let adoptedOk = false;
            for (let i = 0; i < 20 && !adoptedOk; i++) {
              try {
                await child.sendRequest('attach', {
                  type: 'pwa-node',
                  request: 'attach',
                  __pendingTargetId: pendingTargetId,
                  continueOnAttach: false
                }, 15000);
                adoptedOk = true;
                break;
              } catch {
                await new Promise((r) => setTimeout(r, 250));
              }
            }
            if (!adoptedOk) {
              // Final fallback: attach by inspector port
              for (let i = 0; i < 10 && !adoptedOk; i++) {
                try {
                  await child.sendRequest('attach', {
                    type: 'pwa-node',
                    request: 'attach',
                    address: '127.0.0.1',
                    port: listeningPort || inspectorPort,
                    continueOnAttach: false,
                    attachExistingChildren: true
                  }, 15000);
                  adoptedOk = true;
                  logInfo('child adoption: attached via inspector port fallback:', listeningPort || inspectorPort);
                  break;
                } catch {
                  await new Promise((r) => setTimeout(r, 250));
                }
              }
            }
            if (!adoptedOk) {
              throw new Error('child adoption failed');
            }
            // js-debug will send initialized after launch; attach path may or may not. Wait briefly, then configure.
            try { await child.waitForEvent('initialized', 8000); } catch {}
            try { await child.sendRequest('setExceptionBreakpoints', { filters: [] }); } catch {}
            try {
              childBpResp = await child.sendRequest('setBreakpoints', {
                source: { path: program },
                breakpoints: [{ line }]
              });
            } catch {}
            try { await child.sendRequest('configurationDone', {}); } catch {}
            try {
              stoppedEvt = await child.waitForEvent('stopped', 12000);
              logInfo('stopped event (child session):', stoppedEvt?.body || {});
            } catch {
              // Try threads+pause against child
              try {
                let firstChildThread = null;
                for (let i = 0; i < 120; i++) {
                  const arr = await child.threads().catch(() => []);
                  if (Array.isArray(arr) && arr.length) {
                    firstChildThread = arr[0].id;
                    break;
                  }
                  await new Promise((r) => setTimeout(r, 100));
                }
                if (typeof firstChildThread === 'number') {
                  await child.pause(firstChildThread).catch(() => {});
                  stoppedEvt = await child.waitForEvent('stopped', 8000);
                  logInfo('stopped after pause (child session):', stoppedEvt?.body || {});
                }
              } catch {
                // continue to parent threads+pause below
              }
            }
            adopted = true;
            childClient = child;
          } catch (e) {
            logWarn('child adoption failed:', e?.message || e);
          }
        } else {
          logInfo('startDebugging received, adopting pending target id in parent:', pendingTargetId);
          // Retry attach a few times to tolerate target not-yet-listening
          let attachedOk = false;
          let lastErr = null;
          for (let i = 0; i < 8 && !attachedOk; i++) {
            try {
              await dap.sendRequest('attach', {
                type: 'pwa-node',
                request: 'attach',
                __pendingTargetId: pendingTargetId,
                continueOnAttach: false
              });
              attachedOk = true;
              break;
            } catch (e) {
              lastErr = e;
              await new Promise((r) => setTimeout(r, 250));
            }
          }
          if (!attachedOk) {
            logWarn('attach via __pendingTargetId failed:', lastErr?.message || lastErr);
          } else {
            adopted = true;
            // After adoption, re-apply breakpoints and config to ensure binding
            try {
              await dap.sendRequest('setExceptionBreakpoints', { filters: [] });
            } catch { /* ignore */ }
            try {
              await dap.sendRequest('setBreakpoints', {
                source: { path: program },
                breakpoints: [{ line }]
              });
            } catch { /* ignore */ }
            try {
              await dap.sendRequest('configurationDone', {});
            } catch { /* ignore */ }
            // Give adapter a brief moment to surface stopped
            try {
              stoppedEvt = await dap.waitForEvent('stopped', 8000);
              logInfo('stopped event after adoption:', stoppedEvt?.body || {});
            } catch {
              // will fall back to threads+pause below
            }
          }
        }
      }
    } else {
      // Check cached startDebugging and adopt in a child session if present; otherwise fallback to port attach.
      try {
        const cached = typeof dap.getLastStartDebugging === 'function' ? dap.getLastStartDebugging() : null;
        const pendingTargetId = cached && typeof cached.pendingTargetId === 'string' ? cached.pendingTargetId : null;
        if (pendingTargetId) {
          logInfo('Using cached startDebugging pendingTargetId for child adoption:', pendingTargetId);
          const child = new DapClient(connectHost, connectPort, TRACE_FILE);
          await child.connect(8000);
          await child.sendRequest('initialize', {
            clientID: 'probe-child-cached',
            adapterID: 'pwa-node',
            pathFormat: 'path',
            linesStartAt1: true,
            columnsStartAt1: true
          });
          try { await child.waitForEvent('initialized', 3000); } catch {}
          // Per js-debug child flow (cached path): launch child session with __pendingTargetId, then wait for initialized
          {
            let adoptedOk = false;
            // Prefer attach-based adoption for cached flow as well
            for (let i = 0; i < 20 && !adoptedOk; i++) {
              try {
                await child.sendRequest('attach', {
                  type: 'pwa-node',
                  request: 'attach',
                  __pendingTargetId: pendingTargetId,
                  continueOnAttach: false
                }, 15000);
                adoptedOk = true;
                break;
              } catch {
                await new Promise((r) => setTimeout(r, 250));
              }
            }
            if (!adoptedOk) {
              for (let i = 0; i < 10 && !adoptedOk; i++) {
                try {
                  await child.sendRequest('attach', {
                    type: 'pwa-node',
                    request: 'attach',
                    address: '127.0.0.1',
                    port: listeningPort || inspectorPort,
                    continueOnAttach: false,
                    attachExistingChildren: true
                  }, 15000);
                  adoptedOk = true;
                  logInfo('child adoption (cached): attached via inspector port fallback:', listeningPort || inspectorPort);
                  break;
                } catch {
                  await new Promise((r) => setTimeout(r, 250));
                }
              }
            }
            try { await child.waitForEvent('initialized', 8000); } catch {}
          }
          // Configure child after adoption/initialized
          try { await child.sendRequest('setExceptionBreakpoints', { filters: [] }); } catch {}
          try {
            childBpResp = await child.sendRequest('setBreakpoints', {
              source: { path: program },
              breakpoints: [{ line }]
            });
          } catch {}
          try { await child.sendRequest('configurationDone', {}); } catch {}
          try {
            stoppedEvt = await child.waitForEvent('stopped', 12000);
            logInfo('stopped event (child cached adoption):', stoppedEvt?.body || {});
          } catch {}
          childClient = child;
          adopted = true;
        } else {
          // Neither stopped nor startDebugging surfaced; create a child and attach by inspector port.
          logInfo('No stopped/startDebugging detected promptly; trying child attach via inspector port', listeningPort || inspectorPort);
          const child = new DapClient(connectHost, connectPort, TRACE_FILE);
          await child.connect(8000);
          await child.sendRequest('initialize', {
            clientID: 'probe-child-fallback',
            adapterID: 'pwa-node',
            pathFormat: 'path',
            linesStartAt1: true,
            columnsStartAt1: true
          });
          try { await child.waitForEvent('initialized', 3000); } catch {}
          await child.sendRequest('attach', {
            type: 'pwa-node',
            request: 'attach',
            address: '127.0.0.1',
            port: listeningPort || inspectorPort,
            continueOnAttach: false,
            attachExistingChildren: true
          });
          try { await child.sendRequest('setExceptionBreakpoints', { filters: [] }); } catch {}
          try {
            childBpResp = await child.sendRequest('setBreakpoints', {
              source: { path: program },
              breakpoints: [{ line }]
            });
          } catch {}
          try { await child.sendRequest('configurationDone', {}); } catch {}
          try {
            stoppedEvt = await child.waitForEvent('stopped', 12000);
            logInfo('stopped event (child fallback):', stoppedEvt?.body || {});
          } catch {}
          childClient = child;
          adopted = true;
        }
      } catch (e) {
        logWarn('Child adoption/attach failed:', e?.message || e);
      }
    }

    if (!stoppedEvt) {
      logWarn('No immediate stopped; trying threads+pause fallback...');
      // poll threads using whichever client is active
      const activeClient = childClient || dap;
      let firstThreadId = null;
      for (let i = 0; i < 60; i++) {
        const threads = await activeClient.threads().catch(() => []);
        if (Array.isArray(threads) && threads.length) {
          firstThreadId = threads[0].id;
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      if (typeof firstThreadId === 'number') {
        await activeClient.pause(firstThreadId).catch(() => {});
        // wait for stopped after pause
        try {
          stoppedEvt = await activeClient.waitForEvent('stopped', 5000);
          logInfo('stopped after pause:', stoppedEvt?.body || {});
        } catch {
          // fall through; handled by outer check
        }
      }
    }

    if (!stoppedEvt) {
      throw new Error('Failed to observe a stopped event');
    }

    const threadId = stoppedEvt?.body?.threadId;
    if (typeof threadId !== 'number') {
      logWarn('stopped had no threadId; trying threads() to find one...');
    }
    const client = childClient || dap;
    const useThreadId = typeof threadId === 'number'
      ? threadId
      : ((await client.threads())[0]?.id);

    if (typeof useThreadId !== 'number') {
      throw new Error('No threadId available after stopped');
    }

    // Stack, scopes, variables, evaluate
    const stackResp = await client.sendRequest('stackTrace', {
      threadId: useThreadId,
      startFrame: 0,
      levels: 20
    });
    const frame = stackResp?.body?.stackFrames?.[0];
    if (!frame) throw new Error('No stack frame in stackTrace');

    const scopesResp = await client.sendRequest('scopes', { frameId: frame.id });
    const scope = scopesResp?.body?.scopes?.[0];
    if (!scope) throw new Error('No scope returned');
    const varsResp = await client.sendRequest('variables', { variablesReference: scope.variablesReference });

    // Evaluate a simple expression (adapter-agnostic)
    const evalResp = await client.sendRequest('evaluate', {
      expression: '1+1',
      frameId: frame.id,
      context: 'repl'
    });

    // Summarize
    const parentVerified = Array.isArray(bpResp?.body?.breakpoints) && bpResp.body.breakpoints.some(b => b.verified === true);
    const childVerified = Array.isArray(childBpResp?.body?.breakpoints) && childBpResp.body.breakpoints.some(b => b.verified === true);
    const bpVerified = parentVerified || childVerified || (stoppedEvt?.body?.reason === 'breakpoint');
    const hasVars = Array.isArray(varsResp?.body?.variables) && varsResp.body.variables.length > 0;
    const evalOk = typeof evalResp?.body?.result === 'string' ? evalResp.body.result.includes('2') : false;

    const summary = {
      program,
      line,
      stopped: true,
      breakpointVerified: bpVerified,
      variablesCount: (varsResp?.body?.variables || []).length,
      eval1plus1: evalResp?.body?.result,
      adopted
    };
    logInfo('SUMMARY:', summary);

    // Exit code based on success
    const success = hasVars && evalOk; // do not require verified due to provisional timing; we did stop and can inspect
    if (!success) {
      logWarn('Probe did not meet all criteria (variables && evalOk). See trace for details:', TRACE_FILE);
      process.exitCode = 2;
    } else {
      logInfo('Probe success. Paused, variables accessible, evaluate ok. Trace:', TRACE_FILE);
      process.exitCode = 0;
    }
  } catch (e) {
    logErr('Probe failed:', e?.message || e);
    logErr('Trace file:', TRACE_FILE);
    process.exitCode = 1;
  } finally {
    try { await dap.close(); } catch {}
    // Let js-debug exit when socket closes; if it lingers, kill after grace period
    await new Promise((r) => setTimeout(r, 150));
    await onExit();
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
