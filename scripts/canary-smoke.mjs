#!/usr/bin/env node
/**
 * canary-smoke.mjs — dependency-free MCP debug smoke cycle for the canary
 * workflow (issue #425).
 *
 * Speaks raw newline-delimited JSON-RPC over stdio to an arbitrary MCP server
 * command (a published npm install, an npx invocation, or a `docker run -i`),
 * so it deliberately needs NO workspace install: it tests the artifact the
 * user runs, not the repo build.
 *
 * Cycle (mirrors tests/e2e/docker/docker-smoke-rust.test.ts sequencing):
 *   list_supported_languages  -> assert --lang is installed
 *   create_debug_session
 *   set_breakpoint            -> --break-file (default: --program) at --line
 *   start_debugging           -> stopOnEntry: true; response state is 'paused'
 *   continue_execution        -> returns on dispatch; stop lands async
 *   poll list_debug_sessions  -> until state === 'paused'
 *   poll get_stack_trace      -> frame at --line (only with --expect-line)
 *   get_local_variables       -> assert each --expect-var present
 *   continue_execution        -> poll until the session completes
 *   close_debug_session
 *
 * Exit codes: 0 pass, 1 cycle/assertion failure, 2 usage or spawn error.
 *
 * The server command comes after `--` (so its own flags pass through), e.g.:
 *   node scripts/canary-smoke.mjs \
 *     --lang python --program examples/python/simple_test.py --line 11 \
 *     --expect-line --expect-var a --expect-var b --transcript /tmp/python.jsonl \
 *     -- node /prefix/node_modules/@debugmcp/mcp-debugger/dist/cli.mjs stdio
 *
 * Docker channel (paths are workspace-relative inside the container):
 *   node scripts/canary-smoke.mjs --lang mock --program examples/python/simple_test.py --line 11 \
 *     -- docker run -i --rm -v "$PWD:/workspace" debugmcp/mcp-debugger:latest stdio
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { parseArgs } from 'util';

const POLL_INTERVAL_MS = 250;
const REQUEST_TIMEOUT_MS = 30000;
const KILL_GRACE_MS = 5000;
const FAILURE_TAIL_LINES = 40;
// A breakpoint on a line whose code spans multiple address ranges (e.g. a
// rust format! line on win32) stops once per location, so one continue does
// not guarantee completion. Bound the re-continue loop instead.
const MAX_CONTINUES = 5;

function usage(message) {
  if (message) console.error(`[canary] ${message}`);
  console.error(
    'Usage: canary-smoke.mjs --lang <language>\n' +
    '  [--program <path>] [--break-file <path>] [--line <n>]\n' +
    '  [--adapter-config <json>] [--expect-var <name>]... [--expect-line]\n' +
    '  [--list-only] [--timeout <ms>] [--transcript <file>]\n' +
    '  -- <server command> [server args...]'
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
      program: { type: 'string' },
      'break-file': { type: 'string' },
      line: { type: 'string' },
      'adapter-config': { type: 'string' },
      'expect-var': { type: 'string', multiple: true },
      'expect-line': { type: 'boolean' },
      'list-only': { type: 'boolean' },
      timeout: { type: 'string' },
      transcript: { type: 'string' }
    }
  });
  options = parsed.values;
  serverCommand = parsed.positionals;
} catch (err) {
  usage(err.message);
}

if (!serverCommand || serverCommand.length === 0) usage('server command after -- is required');
if (!options.lang) usage('--lang is required');
if (!options['list-only']) {
  if (!options.program) usage('--program is required (unless --list-only)');
  if (!options.line) usage('--line is required (unless --list-only)');
}
const overallTimeoutMs = options.timeout ? Number(options.timeout) : 120000;
if (!Number.isFinite(overallTimeoutMs) || overallTimeoutMs <= 0) usage('--timeout must be a positive number');
const bpLine = options.line ? Number(options.line) : undefined;
if (options.line && !Number.isInteger(bpLine)) usage('--line must be an integer');
let adapterLaunchConfig;
if (options['adapter-config']) {
  try {
    adapterLaunchConfig = JSON.parse(options['adapter-config']);
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

/* ---------- raw stdio MCP client ---------- */

class McpStdioClient {
  constructor(command, args) {
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

  async initialize() {
    const spawnErr = await this.spawnError;
    if (spawnErr) throw Object.assign(new Error(`failed to spawn server: ${spawnErr.message}`), { usageError: true });
    const result = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'canary-smoke', version: '1.0.0' }
    });
    this.notify('notifications/initialized');
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

/* ---------- cycle steps ---------- */

const startedAt = Date.now();
function remainingBudgetMs() {
  return overallTimeoutMs - (Date.now() - startedAt);
}

function step(name, detail = '') {
  console.log(`[canary] ${name}${detail ? `: ${detail}` : ''}`);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pollUntil(description, probe) {
  for (;;) {
    if (remainingBudgetMs() <= 0) {
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

async function runCycle(client) {
  const lang = options.lang;

  const languages = await client.callTool('list_supported_languages', {});
  const installed = languages.installed ?? [];
  if (!installed.includes(lang)) {
    throw new Error(`language '${lang}' not in installed list: ${JSON.stringify(installed)}`);
  }
  step('list_supported_languages ok', `${installed.length} installed, '${lang}' present`);
  if (options['list-only']) return;

  const created = await client.callTool('create_debug_session', { language: lang, name: 'canary' });
  const sessionId = created.sessionId;
  if (!sessionId) throw new Error('create_debug_session returned no sessionId');
  step('create_debug_session ok', sessionId);

  try {
    const breakFile = options['break-file'] ?? options.program;
    await client.callTool('set_breakpoint', { sessionId, file: breakFile, line: bpLine });
    step('set_breakpoint ok', `${breakFile}:${bpLine}`);

    const started = await client.callTool('start_debugging', {
      sessionId,
      scriptPath: options.program,
      args: [],
      dapLaunchArgs: { stopOnEntry: true },
      ...(adapterLaunchConfig ? { adapterLaunchConfig } : {})
    });
    if (!String(started.state ?? '').includes('paused')) {
      throw new Error(`start_debugging (stopOnEntry) did not pause: state=${started.state}`);
    }
    step('start_debugging ok', 'paused on entry');

    await client.callTool('continue_execution', { sessionId });
    await pollUntil('breakpoint pause', async () => {
      const session = await findSession(client, sessionId);
      return session?.state === 'paused' ? true : undefined;
    });
    step('continue_execution ok', 'paused at breakpoint');

    if (options['expect-line']) {
      await pollUntil(`stack frame at line ${bpLine}`, async () => {
        const stack = await client.callTool('get_stack_trace', { sessionId }, { tolerateFailure: true });
        if (stack.__failed) return undefined;
        const frames = stack.stackFrames ?? [];
        return frames.some((f) => f.line === bpLine) ? true : undefined;
      });
      step('get_stack_trace ok', `frame at line ${bpLine}`);
    }

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

    // Continue to completion. A multi-location breakpoint (verified: the
    // rust format! line on win32) re-stops on the same line, so allow a
    // bounded number of re-continues before calling it a hang.
    let completed = false;
    for (let attempt = 1; attempt <= MAX_CONTINUES && !completed; attempt++) {
      // Snapshot the current stop so a stale 'paused' (poll racing the
      // resume) is not mistaken for a re-stop.
      const before = await findSession(client, sessionId);
      const prevStopTs = before?.lastStop?.timestamp;
      await client.callTool('continue_execution', { sessionId });
      const outcome = await pollUntil(`completion or re-pause (continue #${attempt})`, async () => {
        const session = await findSession(client, sessionId);
        if (!session || session.state === 'stopped') return 'completed';
        if (session.state === 'error') throw new Error('session entered error state after continue');
        if (session.state === 'paused' && session.lastStop?.timestamp !== prevStopTs) return 'paused';
        return undefined;
      });
      if (outcome === 'completed') {
        completed = true;
      } else {
        transcribe('note', `re-paused after continue #${attempt} (multi-location breakpoint?)`);
      }
    }
    if (!completed) {
      throw new Error(`program did not complete after ${MAX_CONTINUES} continues`);
    }
    step('continue_execution ok', 'program completed');
  } finally {
    // Best-effort close even after a failed step so the server tears down.
    await client.callTool('close_debug_session', { sessionId }, { tolerateFailure: true }).catch(() => {});
  }
  step('close_debug_session ok');
}

/* ---------- main ---------- */

async function main() {
  const client = new McpStdioClient(serverCommand[0], serverCommand.slice(1));
  const watchdog = setTimeout(() => {
    console.error(`[canary] FAIL: overall timeout of ${overallTimeoutMs}ms exceeded`);
    printFailureTail();
    client.dispose().finally(() => process.exit(1));
  }, overallTimeoutMs);

  try {
    await client.initialize();
    step('initialize ok');
    await runCycle(client);
    console.log(`[canary] PASS (${options.lang}, ${Date.now() - startedAt}ms)`);
  } catch (err) {
    console.error(`[canary] FAIL: ${err.message}`);
    printFailureTail();
    process.exitCode = err.usageError ? 2 : 1;
  } finally {
    clearTimeout(watchdog);
    await client.dispose();
    if (transcriptStream) await new Promise((resolve) => transcriptStream.end(resolve));
  }
}

function printFailureTail() {
  console.error(`[canary] last ${transcriptTail.length} transcript entries:`);
  for (const line of transcriptTail) console.error(`  ${line}`);
}

main().catch((err) => {
  console.error(`[canary] unexpected error: ${err.stack ?? err}`);
  process.exit(2);
});
