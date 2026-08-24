#!/usr/bin/env node
/**
 * k8s-smoke.mjs — dependency-free MCP attach smoke cycle for the weekly
 * Kubernetes recipe job (issue #451). Sibling of canary-smoke.mjs (launch
 * cycles over stdio); this driver covers what that one deliberately does not:
 * attach sessions (network attach and attach-by-PID), function breakpoints,
 * and the Streamable HTTP transport of a `kubectl debug` sidecar.
 *
 * The assertion contract is examples/kubernetes/attach-presets.md — a cycle
 * that deviates from the presets is a finding, not a driver bug.
 *
 * Transports (exactly one):
 *   -- <server command...>   raw newline-delimited JSON-RPC over stdio
 *   --url <http://.../mcp>   Streamable HTTP (POST JSON, parse JSON or SSE
 *                            response bodies, echo mcp-session-id)
 *
 * Cycle:
 *   list_supported_languages  -> assert --lang is installed
 *   create_debug_session
 *   attach_to_process         -> host/port (pattern A) or PID (pattern B)
 *   set_breakpoint            -> --break-file/--line or --break-function
 *   continue_execution        -> attach pauses the target; resume it
 *   poll list_debug_sessions  -> fresh 'paused' within --hit-timeout
 *   get_stack_trace           -> --expect-frame / --expect-file+--expect-line
 *   get_local_variables       -> assert each --expect-var present
 *   detach_from_process       -> terminateProcess: false (target keeps running)
 *   close_debug_session
 *
 * Exit codes: 0 pass, 1 cycle/assertion failure, 2 usage or spawn error.
 *
 * Pattern A (python via kubectl port-forward, local server over stdio):
 *   node scripts/k8s-smoke.mjs --lang python \
 *     --attach-host 127.0.0.1 --attach-port 5678 --break-on-exceptions uncaught \
 *     --break-file /app/app.py --line 6 \
 *     --expect-frame tick --expect-file /app/app.py --expect-line 6 \
 *     --expect-var counter --expect-var label \
 *     -- node /prefix/node_modules/@debugmcp/mcp-debugger/dist/cli.mjs stdio
 *
 * Pattern B (cpp via kubectl debug sidecar, Streamable HTTP):
 *   node scripts/k8s-smoke.mjs --lang cpp --url http://127.0.0.1:3001/mcp \
 *     --attach-pid 1 --stop-on-entry \
 *     --adapter-config '{"program":"/proc/1/root/shared/app"}' \
 *     --break-function tick --expect-bp-verified --expect-frame tick
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { parseArgs } from 'util';

const POLL_INTERVAL_MS = 250;
const REQUEST_TIMEOUT_MS = 30000;
const KILL_GRACE_MS = 5000;
const FAILURE_TAIL_LINES = 40;
// Function breakpoints normally verify synchronously here (stop-on-entry has
// already loaded symbols), but adapters may verify async — bound a short poll.
const BP_VERIFY_TIMEOUT_MS = 5000;

function usage(message) {
  if (message) console.error(`[k8s-smoke] ${message}`);
  console.error(
    'Usage: k8s-smoke.mjs --lang <language>\n' +
    '  (--attach-host <host> --attach-port <n> | --attach-pid <n>)\n' +
    '  (--break-file <path> --line <n> | --break-function <name>)\n' +
    '  [--stop-on-entry] [--break-on-exceptions <uncaught|all|none>]\n' +
    '  [--adapter-config <json>] [--expect-bp-verified]\n' +
    '  [--expect-frame <substring>] [--expect-file <path> --expect-line <n>]\n' +
    '  [--expect-var <name>]... [--hit-timeout <ms>] [--timeout <ms>]\n' +
    '  [--transcript <file>]\n' +
    '  (--url <http://host:port/mcp> | -- <server command> [server args...])'
  );
  process.exit(2);
}

let options;
let serverCommand;
try {
  const parsed = parseArgs({
    allowPositionals: true,
    options: {
      lang: { type: 'string' },
      url: { type: 'string' },
      'attach-host': { type: 'string' },
      'attach-port': { type: 'string' },
      'attach-pid': { type: 'string' },
      'stop-on-entry': { type: 'boolean' },
      'break-on-exceptions': { type: 'string' },
      'adapter-config': { type: 'string' },
      'break-file': { type: 'string' },
      line: { type: 'string' },
      'break-function': { type: 'string' },
      'expect-bp-verified': { type: 'boolean' },
      'expect-frame': { type: 'string' },
      'expect-file': { type: 'string' },
      'expect-line': { type: 'string' },
      'expect-var': { type: 'string', multiple: true },
      'hit-timeout': { type: 'string' },
      timeout: { type: 'string' },
      transcript: { type: 'string' }
    }
  });
  options = parsed.values;
  serverCommand = parsed.positionals;
} catch (err) {
  usage(err.message);
}

if (!options.lang) usage('--lang is required');
const useHttp = options.url !== undefined;
if (useHttp && serverCommand.length > 0) usage('--url and a server command after -- are mutually exclusive');
if (!useHttp && serverCommand.length === 0) usage('either --url or a server command after -- is required');

const netAttach = options['attach-host'] !== undefined || options['attach-port'] !== undefined;
const pidAttach = options['attach-pid'] !== undefined;
if (netAttach === pidAttach) usage('exactly one of --attach-host/--attach-port or --attach-pid is required');
if (netAttach && (options['attach-host'] === undefined || options['attach-port'] === undefined)) {
  usage('--attach-host and --attach-port must be given together');
}
const attachPort = options['attach-port'] !== undefined ? Number(options['attach-port']) : undefined;
if (attachPort !== undefined && !Number.isInteger(attachPort)) usage('--attach-port must be an integer');
const attachPid = options['attach-pid'] !== undefined ? Number(options['attach-pid']) : undefined;
if (attachPid !== undefined && !Number.isInteger(attachPid)) usage('--attach-pid must be an integer');

const lineBp = options['break-file'] !== undefined || options.line !== undefined;
const functionBp = options['break-function'] !== undefined;
if (lineBp === functionBp) usage('exactly one of --break-file/--line or --break-function is required');
if (lineBp && (options['break-file'] === undefined || options.line === undefined)) {
  usage('--break-file and --line must be given together');
}
const bpLine = options.line !== undefined ? Number(options.line) : undefined;
if (bpLine !== undefined && !Number.isInteger(bpLine)) usage('--line must be an integer');

if ((options['expect-file'] !== undefined) !== (options['expect-line'] !== undefined)) {
  usage('--expect-file and --expect-line must be given together');
}
const expectLine = options['expect-line'] !== undefined ? Number(options['expect-line']) : undefined;
if (expectLine !== undefined && !Number.isInteger(expectLine)) usage('--expect-line must be an integer');

const overallTimeoutMs = options.timeout ? Number(options.timeout) : 120000;
if (!Number.isFinite(overallTimeoutMs) || overallTimeoutMs <= 0) usage('--timeout must be a positive number');
const hitTimeoutMs = options['hit-timeout'] ? Number(options['hit-timeout']) : 10000;
if (!Number.isFinite(hitTimeoutMs) || hitTimeoutMs <= 0) usage('--hit-timeout must be a positive number');

let adapterConfig;
if (options['adapter-config']) {
  try {
    adapterConfig = JSON.parse(options['adapter-config']);
  } catch (err) {
    usage(`--adapter-config is not valid JSON: ${err.message}`);
  }
}

/* ---------- transcript ---------- */

const transcriptTail = [];
let transcriptStream = null;
if (options.transcript) {
  fs.mkdirSync(path.dirname(path.resolve(options.transcript)), { recursive: true });
  transcriptStream = fs.createWriteStream(options.transcript, { flags: 'w' });
}

function transcribe(dir, data) {
  const line = JSON.stringify({ t: new Date().toISOString(), dir, data });
  transcriptTail.push(line);
  if (transcriptTail.length > FAILURE_TAIL_LINES) transcriptTail.shift();
  if (transcriptStream) transcriptStream.write(line + '\n');
}

/* ---------- shared client surface ---------- */

class McpClientBase {
  async initialize() {
    const result = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'k8s-smoke', version: '1.0.0' }
    });
    await this.notify('notifications/initialized');
    return result;
  }

  /**
   * Call an MCP tool and parse the conventional JSON payload out of
   * content[0].text. Throws on isError or an explicit success:false unless
   * { tolerateFailure } — polling steps probe states that are legal to reject
   * (e.g. get_stack_trace while running).
   */
  async callTool(name, args, { tolerateFailure = false } = {}) {
    const result = await this.request('tools/call', { name, arguments: args });
    const text = Array.isArray(result?.content) && result.content[0]?.type === 'text'
      ? result.content[0].text
      : undefined;
    let payload = {};
    if (text !== undefined) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { rawText: text };
      }
    }
    const failed = result?.isError === true || payload.success === false;
    if (failed && !tolerateFailure) {
      throw new Error(`tool '${name}' failed: ${payload.message ?? payload.error ?? text ?? 'unknown error'}`);
    }
    payload.__failed = failed;
    return payload;
  }
}

/* ---------- raw stdio MCP client (as canary-smoke.mjs) ---------- */

class McpStdioClient extends McpClientBase {
  constructor(command, args) {
    super();
    this.nextId = 1;
    this.pending = new Map(); // id -> { resolve, reject, timer }
    this.exited = false;
    this.disposed = false;
    this.spawnFailed = false;
    this.child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    this.spawnError = new Promise((resolve) => {
      this.child.once('error', (err) => {
        this.spawnFailed = true;
        resolve(err);
      });
      this.child.once('spawn', () => resolve(null));
    });

    // stdin can hit EPIPE/write-after-end when the server dies or the
    // watchdog disposes mid-request — surface it via the transcript, not an
    // unhandled 'error' event.
    this.child.stdin.on('error', (err) => transcribe('note', `stdin error: ${err.message}`));

    let stdoutBuffer = '';
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk;
      let newline;
      while ((newline = stdoutBuffer.indexOf('\n')) !== -1) {
        const line = stdoutBuffer.slice(0, newline).trim();
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        if (line) this.handleLine(line);
      }
    });
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk) => transcribe('stderr', chunk.trimEnd()));
    this.child.on('exit', (code, signal) => {
      this.exited = true;
      transcribe('note', `server exited (code=${code} signal=${signal})`);
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(new Error(`server exited (code=${code} signal=${signal}) before responding`));
      }
      this.pending.clear();
    });
  }

  handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      transcribe('recv-unparseable', line);
      return;
    }
    transcribe('recv', message);
    if (message.id !== undefined && this.pending.has(message.id)) {
      const { resolve, reject, timer } = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(timer);
      if (message.error) {
        reject(new Error(`JSON-RPC error ${message.error.code}: ${message.error.message}`));
      } else {
        resolve(message.result);
      }
    }
    // Notifications and unsolicited messages are transcribed above and ignored.
  }

  send(message) {
    if (this.disposed || !this.child.stdin.writable) {
      throw new Error('cannot send: server stdin is closed');
    }
    transcribe('send', message);
    this.child.stdin.write(JSON.stringify(message) + '\n');
  }

  request(method, params, timeoutMs = REQUEST_TIMEOUT_MS) {
    if (this.exited || this.disposed) return Promise.reject(new Error('server already exited'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`request '${method}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify(method, params) {
    this.send({ jsonrpc: '2.0', method, ...(params ? { params } : {}) });
  }

  async start() {
    const spawnErr = await this.spawnError;
    if (spawnErr) throw Object.assign(new Error(`failed to spawn server: ${spawnErr.message}`), { usageError: true });
  }

  async dispose() {
    this.disposed = true;
    try { this.child.stdin.end(); } catch { /* already closed */ }
    // A child that never spawned emits no 'exit' — don't wait for one.
    if (this.exited || this.spawnFailed) return;
    const exited = new Promise((resolve) => this.child.once('exit', resolve));
    this.child.kill('SIGTERM');
    const timer = setTimeout(() => this.child.kill('SIGKILL'), KILL_GRACE_MS);
    await exited;
    clearTimeout(timer);
  }
}

/* ---------- Streamable HTTP MCP client ---------- */

class McpHttpClient extends McpClientBase {
  constructor(url) {
    super();
    this.url = url;
    this.nextId = 1;
    this.sessionId = null;
  }

  headers() {
    return {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2024-11-05',
      ...(this.sessionId ? { 'mcp-session-id': this.sessionId } : {})
    };
  }

  async post(message, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(message),
        signal: controller.signal
      });
      // The server assigns the session id on the initialize response; echo it
      // on every request after that.
      const sid = res.headers.get('mcp-session-id');
      if (sid) this.sessionId = sid;
      return res;
    } catch (err) {
      throw new Error(`POST ${this.url} failed: ${err.cause?.message ?? err.message}`, { cause: err });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * The Streamable HTTP server answers request-POSTs on the POST body itself,
   * either as application/json or as an SSE stream that closes after the
   * response (no standing GET stream needed for this driver).
   */
  parseBody(contentType, bodyText, id) {
    const messages = [];
    if (contentType.includes('text/event-stream')) {
      for (const event of bodyText.split(/\r?\n\r?\n/)) {
        const data = event
          .split(/\r?\n/)
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trimStart())
          .join('\n');
        if (!data) continue;
        try {
          messages.push(JSON.parse(data));
        } catch {
          transcribe('recv-unparseable', data);
        }
      }
    } else if (bodyText.trim()) {
      try {
        const parsed = JSON.parse(bodyText);
        messages.push(...(Array.isArray(parsed) ? parsed : [parsed]));
      } catch {
        transcribe('recv-unparseable', bodyText);
      }
    }
    let response;
    for (const message of messages) {
      transcribe('recv', message);
      if (message.id === id) response = message;
      // Server-initiated notifications on the stream are transcribed and ignored.
    }
    return response;
  }

  async request(method, params, timeoutMs = REQUEST_TIMEOUT_MS) {
    const id = this.nextId++;
    const message = { jsonrpc: '2.0', id, method, params };
    transcribe('send', message);
    const res = await this.post(message, timeoutMs);
    const bodyText = await res.text();
    if (!res.ok) {
      throw new Error(`request '${method}' failed: HTTP ${res.status} ${bodyText.slice(0, 500)}`);
    }
    const response = this.parseBody(res.headers.get('content-type') ?? '', bodyText, id);
    if (!response) throw new Error(`request '${method}': no response with id ${id} in HTTP body`);
    if (response.error) {
      throw new Error(`JSON-RPC error ${response.error.code}: ${response.error.message}`);
    }
    return response.result;
  }

  async notify(method, params) {
    const message = { jsonrpc: '2.0', method, ...(params ? { params } : {}) };
    transcribe('send', message);
    const res = await this.post(message, REQUEST_TIMEOUT_MS);
    // Notifications are acknowledged with 202 Accepted and an empty body.
    if (!res.ok) {
      throw new Error(`notification '${method}' failed: HTTP ${res.status}`);
    }
  }

  async start() {
    // Connectivity is proven by the initialize POST itself.
  }

  async dispose() {
    if (!this.sessionId) return;
    try {
      // Best-effort session teardown so the sidecar releases its ptrace claim
      // promptly instead of waiting for the stale-session reaper.
      await fetch(this.url, { method: 'DELETE', headers: this.headers() });
      transcribe('note', 'DELETE /mcp sent');
    } catch (err) {
      transcribe('note', `DELETE /mcp failed: ${err.message}`);
    }
  }
}

/* ---------- cycle steps ---------- */

const startedAt = Date.now();
function remainingBudgetMs() {
  return overallTimeoutMs - (Date.now() - startedAt);
}

function step(name, detail = '') {
  console.log(`[k8s-smoke] ${name}${detail ? `: ${detail}` : ''}`);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pollUntil(description, probe, deadlineMs = null) {
  for (;;) {
    if (remainingBudgetMs() <= 0 || (deadlineMs !== null && Date.now() > deadlineMs)) {
      throw new Error(`timed out waiting for ${description}`);
    }
    const value = await probe();
    if (value !== undefined) return value;
    await wait(POLL_INTERVAL_MS);
  }
}

async function findSession(client, sessionId) {
  const payload = await client.callTool('list_debug_sessions', {}, { tolerateFailure: true });
  return (payload.sessions ?? []).find((s) => s.id === sessionId);
}

async function runAttachCycle(client) {
  const lang = options.lang;

  const languages = await client.callTool('list_supported_languages', {});
  const installed = languages.installed ?? [];
  if (!installed.includes(lang)) {
    throw new Error(`language '${lang}' not in installed list: ${JSON.stringify(installed)}`);
  }
  step('list_supported_languages ok', `${installed.length} installed, '${lang}' present`);

  const created = await client.callTool('create_debug_session', { language: lang, name: 'k8s-smoke' });
  const sessionId = created.sessionId;
  if (!sessionId) throw new Error('create_debug_session returned no sessionId');
  step('create_debug_session ok', sessionId);

  try {
    const attachArgs = {
      sessionId,
      ...(netAttach ? { host: options['attach-host'], port: attachPort } : { processId: attachPid }),
      ...(options['stop-on-entry'] ? { stopOnEntry: true } : {}),
      ...(options['break-on-exceptions'] ? { breakOnExceptions: options['break-on-exceptions'] } : {}),
      ...(adapterConfig ? { adapterConfig } : {})
    };
    const attached = await client.callTool('attach_to_process', attachArgs);
    if (attached.warning) transcribe('note', `attach warning: ${attached.warning}`);
    step('attach_to_process ok', netAttach
      ? `${options['attach-host']}:${attachPort} (state=${attached.state})`
      : `pid ${attachPid} (state=${attached.state})`);

    if (functionBp) {
      const bp = await client.callTool('set_breakpoint', { sessionId, function: options['break-function'] });
      step('set_breakpoint ok', `function '${options['break-function']}' (verified=${bp.verified})`);
      if (options['expect-bp-verified'] && bp.verified !== true) {
        // Symbols normally resolve synchronously here (stop-on-entry already
        // loaded them); give an async-verifying adapter a short grace window.
        await pollUntil(`function breakpoint '${options['break-function']}' verified`, async () => {
          const listed = await client.callTool('list_breakpoints', { sessionId }, { tolerateFailure: true });
          const match = (listed.functionBreakpoints ?? [])
            .find((b) => b.functionName === options['break-function'] && b.verified === true);
          return match ? true : undefined;
        }, Date.now() + BP_VERIFY_TIMEOUT_MS);
        step('list_breakpoints ok', 'function breakpoint verified');
      }
    } else {
      // Remote-target paths (attach-presets.md ground rule): the file exists
      // in the debuggee, not here — verification is the target's call, so the
      // hit below is the real assertion.
      const bp = await client.callTool('set_breakpoint', { sessionId, file: options['break-file'], line: bpLine });
      step('set_breakpoint ok', `${options['break-file']}:${bpLine} (verified=${bp.verified})`);
      if (options['expect-bp-verified'] && bp.verified !== true) {
        throw new Error(`expected line breakpoint verified=true, got ${bp.verified}`);
      }
    }

    // Attach pauses the target (attach-presets.md); resume it and wait for a
    // stop that is provably new — lastStop.timestamp must move, so a stale
    // 'paused' from the attach itself is not mistaken for the hit.
    const before = await findSession(client, sessionId);
    const prevStopTs = before?.lastStop?.timestamp;
    if (before?.state === 'paused') {
      await client.callTool('continue_execution', { sessionId });
      step('continue_execution ok', 'target resumed with breakpoint armed');
    } else {
      transcribe('note', `session state after attach is '${before?.state}' — waiting for breakpoint without continue`);
    }
    await pollUntil('breakpoint hit', async () => {
      const session = await findSession(client, sessionId);
      if (session?.state === 'error') throw new Error('session entered error state while waiting for the breakpoint');
      return session?.state === 'paused' && session.lastStop?.timestamp !== prevStopTs ? true : undefined;
    }, Date.now() + hitTimeoutMs);
    step('breakpoint hit', `within ${hitTimeoutMs}ms budget`);

    const stack = await client.callTool('get_stack_trace', { sessionId });
    const frames = stack.stackFrames ?? [];
    if (options['expect-frame']) {
      const match = frames.find((f) => String(f.name ?? '').includes(options['expect-frame']));
      if (!match) {
        throw new Error(`no stack frame matching '${options['expect-frame']}'; got: ${frames.map((f) => f.name).join(', ') || '(none)'}`);
      }
      transcribe('note', `frame '${match.name}' at ${match.file}:${match.line}`);
    }
    if (options['expect-file'] !== undefined) {
      const match = frames.find((f) => f.file === options['expect-file'] && f.line === expectLine);
      if (!match) {
        throw new Error(`no stack frame at ${options['expect-file']}:${expectLine}; got: ${frames.map((f) => `${f.file}:${f.line}`).join(', ') || '(none)'}`);
      }
    }
    step('get_stack_trace ok', `${frames.length} frames`);

    const locals = await client.callTool('get_local_variables', { sessionId });
    const variables = locals.variables ?? [];
    for (const name of options['expect-var'] ?? []) {
      const found = variables.find((v) => v.name === name);
      if (!found) {
        throw new Error(`expected local '${name}' not found; got: ${variables.map((v) => v.name).join(', ') || '(none)'}`);
      }
      transcribe('note', `local ${name} = ${found.value}`);
    }
    step('get_local_variables ok', `${variables.length} variables${(options['expect-var'] ?? []).length ? `, expected present: ${options['expect-var'].join(', ')}` : ''}`);

    const detached = await client.callTool('detach_from_process', { sessionId, terminateProcess: false });
    step('detach_from_process ok', `state=${detached.state} (target left running)`);
  } finally {
    // Best-effort close even after a failed step so the server tears down.
    await client.callTool('close_debug_session', { sessionId }, { tolerateFailure: true }).catch(() => {});
  }
  step('close_debug_session ok');
}

/* ---------- main ---------- */

async function main() {
  const client = useHttp
    ? new McpHttpClient(options.url)
    : new McpStdioClient(serverCommand[0], serverCommand.slice(1));
  const watchdog = setTimeout(() => {
    console.error(`[k8s-smoke] FAIL: overall timeout of ${overallTimeoutMs}ms exceeded`);
    printFailureTail();
    client.dispose().finally(() => process.exit(1));
  }, overallTimeoutMs);

  try {
    await client.start();
    await client.initialize();
    step('initialize ok', useHttp ? options.url : 'stdio');
    await runAttachCycle(client);
    console.log(`[k8s-smoke] PASS (${options.lang}, ${Date.now() - startedAt}ms)`);
  } catch (err) {
    console.error(`[k8s-smoke] FAIL: ${err.message}`);
    printFailureTail();
    process.exitCode = err.usageError ? 2 : 1;
  } finally {
    clearTimeout(watchdog);
    await client.dispose();
    if (transcriptStream) await new Promise((resolve) => transcriptStream.end(resolve));
  }
}

function printFailureTail() {
  console.error(`[k8s-smoke] last ${transcriptTail.length} transcript entries:`);
  for (const line of transcriptTail) console.error(`  ${line}`);
}

main().catch((err) => {
  console.error(`[k8s-smoke] unexpected error: ${err.stack ?? err}`);
  process.exit(2);
});
