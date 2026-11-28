/**
 * Breakpoint content addressing on live debugpy attach sessions (issue #1326):
 *
 * - Local attach (`host: "127.0.0.1"` -> `attachLocality: 'loopback'`):
 *   both `line` + `expectedContent` and `statement` check/resolve against the
 *   host file and bind on debugpy.
 * - Remote attach (`host: "localhost."` -> `isLoopbackHost("localhost.") === false`
 *   so `attachLocality: 'remote'`, while OS loopback resolution connects to the
 *   local `127.0.0.1` listener on one machine; skipped if the runner's resolver
 *   does not map `localhost.` to IPv4 loopback):
 *   1. `line` + `expectedContent` requests the breakpoint at `file:line` in one
 *      call with debugpy's own verdict and a `warning` disclosing that
 *      `expectedContent` was not checked and why.
 *   2. `statement` (no `line` to fall back on) answers `{success: false, error,
 *      state}` naming `file` and `line`, not a JSON-RPC protocol error.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import dns from 'node:dns';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';
import { isLoopbackHost } from '@debugmcp/shared';
import { attachLocalityOf } from '../../../../src/session/attach/attach-addressing.js';
import { ensurePythonOnPath } from './env-utils.js';

const currentDirName = path.dirname(fileURLToPath(import.meta.url));
const serviceScript = path.resolve(currentDirName, '../../../fixtures/python/attach_service.py');
/** `total = sum(prices)` in attach_service.py. */
const TOTAL_LINE = 12;
/** `doubled = total * 2` in attach_service.py. */
const DOUBLED_LINE = 13;
const PYTHON =
  process.env.PYTHON_PATH ??
  process.env.PYTHON_EXECUTABLE ??
  (process.platform === 'win32' ? 'python' : 'python3');

/**
 * Pick an available loopback port in 5900..5959 first, falling back to an
 * OS-assigned ephemeral port only if all 60 ports are occupied concurrently.
 */
async function tryBindPort(port: number): Promise<number | null> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(null));
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const bound = typeof address === 'object' && address ? address.port : null;
      server.close(() => resolve(bound));
    });
  });
}

let nextCandidatePort = 5900;

async function getAttachPort(): Promise<number> {
  for (let offset = 0; offset < 60; offset++) {
    const candidate = 5900 + ((nextCandidatePort - 5900 + offset) % 60);
    const bound = await tryBindPort(candidate);
    if (bound !== null) {
      nextCandidatePort = 5900 + ((candidate - 5900 + 1) % 60);
      return bound;
    }
  }
  const fallback = await tryBindPort(0);
  if (fallback === null) {
    throw new Error('Could not bind any loopback port');
  }
  return fallback;
}

interface Target {
  proc: ChildProcess;
  port: number;
  exited: Promise<number | null>;
}

const PORT_IN_USE_PATTERN = /Address already in use|EADDRINUSE|10048/i;

async function resolveIpv4Loopback(hostname: string): Promise<{ ok: true; address: string } | { ok: false; reason: string }> {
  try {
    const result = await dns.promises.lookup(hostname, { family: 4 });
    if (result.family === 4 && isLoopbackHost(result.address)) {
      return { ok: true, address: result.address };
    }
    return { ok: false, reason: `resolved to ${result.address} (family ${result.family})` };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

describe('Python attach breakpoint addressing — local vs remote locality (#1326) @requires-python', () => {
  let client: Client | null = null;
  let targets: Target[] = [];

  async function stopAllTargets(): Promise<void> {
    const toStop = targets;
    targets = [];
    for (const target of toStop) {
      if (target.proc.pid !== undefined && target.proc.exitCode === null) {
        try {
          process.kill(target.proc.pid);
        } catch {
          // already exited
        }
      }
      const exited = await Promise.race([
        target.exited.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000))
      ]);
      if (!exited && target.proc.pid !== undefined && target.proc.exitCode === null) {
        try {
          target.proc.kill('SIGKILL');
        } catch {
          // already exited
        }
        await Promise.race([
          target.exited,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))
        ]);
      }
    }
  }

  beforeAll(async () => {
    const serverScriptPath = path.resolve(currentDirName, '../../../../dist/index.js');
    client = new Client({ name: 'mcp-attach-bp-test', version: '0.1.0' }, { capabilities: {} });

    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) env[key] = value;
    }
    ensurePythonOnPath(env);

    const logFilePath = path.join(os.tmpdir(), `mcp-debugger-1326-${process.pid}.log`);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverScriptPath, '--log-level', 'info', '--log-file', logFilePath],
      env
    });
    await client.connect(transport);
  }, 30000);

  afterEach(async () => {
    await stopAllTargets();
  });

  afterAll(async () => {
    await stopAllTargets();
    if (client) {
      try {
        await client.close();
      } catch {
        // best effort
      }
      client = null;
    }
  });

  async function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!client) throw new Error('MCP client not initialized');
    const raw = await client.callTool({ name, arguments: args });
    const content = raw.content as Array<{ type: string; text?: string }>;
    if (!content?.[0] || content[0].type !== 'text' || typeof content[0].text !== 'string') {
      throw new Error(`Unexpected tool result: ${JSON.stringify(raw)}`);
    }
    return JSON.parse(content[0].text) as Record<string, unknown>;
  }

  async function stopOneTarget(target: Target): Promise<void> {
    if (target.proc.pid !== undefined && target.proc.exitCode === null) {
      try {
        process.kill(target.proc.pid);
      } catch {
        // already exited
      }
    }
    await Promise.race([
      target.exited,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
    ]);
  }

  async function startTargetOnce(): Promise<Target> {
    const port = await getAttachPort();
    const proc = spawn(
      PYTHON,
      ['-m', 'debugpy', '--listen', `127.0.0.1:${port}`, serviceScript],
      {
        cwd: path.dirname(serviceScript),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );
    let buffer = '';
    const exited = new Promise<number | null>((resolve) => proc.on('close', (code) => resolve(code)));
    const target: Target = { proc, port, exited };
    // Register before awaiting readiness so afterEach/afterAll always cleans it up.
    targets.push(target);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`debugpy service not ready on 127.0.0.1:${port}: ${buffer}`)),
        20000
      );
      const onData = (chunk: Buffer) => {
        buffer += chunk.toString();
        if (buffer.includes('ATTACH_SERVICE_READY')) {
          clearTimeout(timer);
          resolve();
        }
      };
      proc.stdout!.on('data', onData);
      proc.stderr!.on('data', onData);
      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      proc.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`debugpy service exited (${code}) before ready: ${buffer}`));
      });
    });

    return target;
  }

  async function startTarget(): Promise<Target> {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        return await startTargetOnce();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt < 4 && PORT_IN_USE_PATTERN.test(message)) {
          const failed = targets.pop();
          if (failed) {
            await stopOneTarget(failed);
          }
          continue;
        }
        throw error;
      }
    }
    throw new Error('unreachable');
  }

  it('checks content on a local attach (127.0.0.1) for both line+expectedContent and statement', async () => {
    const target = await startTarget();
    expect(attachLocalityOf({ host: '127.0.0.1', port: target.port })).toBe('loopback');

    const created = await call('create_debug_session', {
      language: 'python',
      name: 'local-attach-1326',
      host: '127.0.0.1',
      port: target.port
    });
    expect(created.success, JSON.stringify(created)).toBe(true);
    const sessionId = String(created.sessionId);

    try {
      if (created.pending === true) {
        await call('wait_for_stop', { sessionId, timeout: 10000 });
      }

      const lineWithExpected = await call('set_breakpoint', {
        sessionId,
        file: serviceScript,
        line: TOTAL_LINE,
        expectedContent: 'total = sum(prices)'
      });
      expect(lineWithExpected.success).toBe(true);
      expect(lineWithExpected.line).toBe(TOTAL_LINE);
      expect(lineWithExpected.verified).toBe(true);
      expect(lineWithExpected.warning).toBeUndefined();
      expect(lineWithExpected.content).toBe('    total = sum(prices)');

      const withStatement = await call('set_breakpoint', {
        sessionId,
        file: serviceScript,
        statement: 'doubled = total * 2'
      });
      expect(withStatement.success).toBe(true);
      expect(withStatement.line).toBe(DOUBLED_LINE);
      expect(withStatement.verified).toBe(true);
      expect(withStatement.anchor).toEqual({ statement: 'doubled = total * 2' });
    } finally {
      await call('close_debug_session', { sessionId });
    }
  }, 60000);

  it('requests line+expectedContent with warning and refuses statement as a tool answer on a remote attach (#1326)', async (ctx) => {
    const remoteHost = 'localhost.';
    const resolution = await resolveIpv4Loopback(remoteHost);
    if (!resolution.ok) {
      ctx.skip(
        `Skipping remote-locality loopback attach: "${remoteHost}" did not resolve to IPv4 loopback (${resolution.reason})`
      );
      return;
    }

    const target = await startTarget();
    expect(isLoopbackHost(remoteHost)).toBe(false);
    expect(attachLocalityOf({ host: remoteHost, port: target.port })).toBe('remote');

    const created = await call('create_debug_session', {
      language: 'python',
      name: 'remote-attach-1326',
      host: remoteHost,
      port: target.port
    });
    expect(created.success, JSON.stringify(created)).toBe(true);
    const sessionId = String(created.sessionId);

    try {
      if (created.pending === true) {
        await call('wait_for_stop', { sessionId, timeout: 10000 });
      }

      const lineWithExpected = await call('set_breakpoint', {
        sessionId,
        file: serviceScript,
        line: TOTAL_LINE,
        expectedContent: 'total = sum(prices)'
      });
      expect(lineWithExpected.success).toBe(true);
      expect(lineWithExpected.line).toBe(TOTAL_LINE);
      expect(lineWithExpected.verified).toBe(true);
      expect(lineWithExpected.content).toBeUndefined();
      expect(lineWithExpected.context).toBeUndefined();
      expect(lineWithExpected.warning).toBe(
        "expectedContent was not checked: this is a remote attach, and the file on this host may differ from the target's source. " +
        `The breakpoint was requested at ${serviceScript}:${TOTAL_LINE} by line addressing; ` +
        'verified, line, boundFile, boundLine and message say whether and where it is bound.'
      );
      expect(lineWithExpected.note).toBe(
        "content and context omitted: the target of this attach is not on the mcp-debugger host, so the host file is not the debuggee's source"
      );

      const withStatement = await call('set_breakpoint', {
        sessionId,
        file: serviceScript,
        statement: 'doubled = total * 2'
      });
      expect(withStatement).toEqual({
        success: false,
        error:
          "statement addressing is not supported for a remote attach session " +
          "(the debuggee's loaded source may differ from the file on the mcp-debugger host); " +
          'use line addressing (file and line, without statement) instead.',
        state: 'paused'
      });

      // Confirm the plain-line breakpoint requested on the first call actually hits.
      const resumed = await call('continue_execution', { sessionId });
      expect(resumed.success, JSON.stringify(resumed)).toBe(true);
      const hit = await call('wait_for_stop', { sessionId, timeout: 10000 });
      expect(hit.state, JSON.stringify(hit)).toBe('paused');
      expect((hit.location as { line?: number } | undefined)?.line).toBe(TOTAL_LINE);
    } finally {
      await call('close_debug_session', { sessionId });
    }
  }, 60000);
});
