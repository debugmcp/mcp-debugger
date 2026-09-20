/** CI-run real js-debug coverage for #705/#730/#758/#762. */
import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const entry = path.join(root, 'dist/index.js');
const scrubbed = new Set([
  'DEBUG_MCP_SKIP_AUTO_START', 'MCP_HTTP_BIND', 'DEBUG', 'NODE_OPTIONS',
  'MCP_DEBUGGER_EXITCODE_FILE', 'MCP_DEBUGGER_EXITCODE_CLAIMED', 'DAP_TRACE_FILE'
]);

interface Frame { id: number; name: string; file: string; line: number }
interface Session { id: string; state: string }
interface ToolResult { success: boolean; state?: string; result?: string }

let outer: Client | undefined;
let nested: Client | undefined;
let outerId: string | undefined;
let innerId: string | undefined;
let target: ChildProcess | undefined;
let targetOutput = '';

function environment(): Record<string, string> {
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined && !scrubbed.has(entry[0].toUpperCase())
    )),
    MCP_SKIP_ORPHAN_REAPERS: '1',
    MCP_EXIT_ON_STDIN_CLOSE: '0'
  };
}

async function call<T extends ToolResult = ToolResult>(client: Client, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const raw = await client.callTool({ name, arguments: args }, undefined, { timeout: 30_000 });
  expect(raw.isError, JSON.stringify(raw)).not.toBe(true);
  const content = raw.content as Array<{ type: string; text?: string }>;
  const text = content.find(item => item.type === 'text')?.text;
  expect(text).toBeDefined();
  const result = JSON.parse(text!) as T;
  expect(result.success, JSON.stringify(result)).toBe(true);
  return result;
}

async function createSession(client: Client, name: string): Promise<string> {
  return (await call<ToolResult & { sessionId: string }>(client, 'create_debug_session', { language: 'javascript', name })).sessionId;
}

async function startOuter(): Promise<void> {
  outer = new Client({ name: 'self-debug-integration', version: '1' });
  const transport = new StdioClientTransport({
    command: process.execPath, args: [entry, 'stdio'], cwd: root, env: environment(), stderr: 'pipe'
  });
  transport.stderr?.on('data', () => {});
  await outer.connect(transport);
  outerId = await createSession(outer, 'debug-the-debugger');
}

function sourceLine(file: string, statement: string): number {
  const line = readFileSync(file, 'utf8').split('\n').findIndex(text => text.includes(statement)) + 1;
  expect(line, `Missing source statement: ${statement}`).toBeGreaterThan(0);
  return line;
}

async function spawnInspected(script: string, args: string[] = []): Promise<number> {
  targetOutput = '';
  target = spawn(process.execPath, ['--inspect=127.0.0.1:0', script, ...args], {
    cwd: root, env: environment(), stdio: ['ignore', 'pipe', 'pipe']
  });
  target.stdout!.on('data', chunk => { targetOutput += chunk.toString(); });
  target.stderr!.on('data', chunk => { targetOutput += chunk.toString(); });
  await expect.poll(() => targetOutput.match(/ws:\/\/127\.0\.0\.1:(\d+)\//)?.[1], { timeout: 15_000 }).toBeDefined();
  return Number(targetOutput.match(/ws:\/\/127\.0\.0\.1:(\d+)\//)![1]);
}

function endpointFrom(output: string): string | undefined {
  return output.match(/MCP endpoint available at (http:\/\/[^/\s]+\/mcp)/)?.[1];
}

async function launchNested(): Promise<string> {
  const result = await call(outer!, 'start_debugging', {
    sessionId: outerId, scriptPath: entry, args: ['http', '--port', '0'],
    dapLaunchArgs: { stopOnEntry: false, env: { MCP_EXIT_ON_STDIN_CLOSE: '0' } }
  });
  expect(result.state).toBe('running');
  let output = '';
  let since = 0;
  await expect.poll(async () => {
    for (;;) {
      const page = await call<ToolResult & {
        entries: Array<{ output: string }>; nextSince: number; hasMore: boolean;
      }>(outer!, 'get_output', { sessionId: outerId, since, limit: 1000 });
      output += page.entries.map(entry => entry.output).join('');
      since = page.nextSince;
      if (!page.hasMore) break;
    }
    return endpointFrom(output);
  }, { timeout: 15_000 }).toBeDefined();
  return endpointFrom(output)!;
}

async function connectNested(endpoint: string): Promise<void> {
  nested = new Client({ name: 'inspected-debugger-client', version: '1' });
  await nested.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
}

async function paused(client: Client, sessionId: string): Promise<void> {
  await expect.poll(async () => {
    const result = await call<ToolResult & { sessions: Session[] }>(client, 'list_debug_sessions');
    return result.sessions.find(session => session.id === sessionId)?.state;
  }, { timeout: 15_000, interval: 50 }).toBe('paused');
}

/** A failed teardown step must not skip cleanup of the remaining processes. */
async function cleanupStep(action: () => Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      action().catch(() => {}),
      new Promise<void>(resolve => { timer = setTimeout(resolve, 3000); })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

afterEach(async () => {
  // Resume the inspected debugger before asking it to clean up its target.
  if (outer && outerId) {
    await cleanupStep(() => outer!.callTool({ name: 'clear_breakpoints', arguments: { sessionId: outerId } }));
    await cleanupStep(() => outer!.callTool({ name: 'continue_execution', arguments: { sessionId: outerId } }));
  }
  if (nested && innerId) {
    await cleanupStep(() => nested!.callTool({ name: 'close_debug_session', arguments: { sessionId: innerId } }));
  }
  await cleanupStep(async () => { await nested?.close(); });
  if (outer && outerId) {
    await cleanupStep(() => outer!.callTool({ name: 'close_debug_session', arguments: { sessionId: outerId } }));
  }
  await cleanupStep(async () => { await outer?.close(); });
  if (target && target.exitCode === null && target.signalCode === null) {
    const exited = new Promise<void>(resolve => target!.once('exit', () => resolve()));
    target.kill('SIGTERM');
    await cleanupStep(() => exited);
    if (target.exitCode === null && target.signalCode === null) {
      target.kill('SIGKILL');
      await cleanupStep(() => exited);
    }
  }
  outer = nested = undefined;
  outerId = innerId = undefined;
  target = undefined;
}, 30_000);

describe('mcp-debugger self-debugging readiness', () => {
  it.each(['launch', 'attach'] as const)('catches the first matching MCP request after %s returns', async mode => {
    await startOuter();
    const file = path.join(root, 'src/cli/http-command.ts');
    const line = sourceLine(file, "const sessionIdHeader = req.headers['mcp-session-id'];");
    const breakpoint = await call<ToolResult & { verified: boolean }>(outer!, 'set_breakpoint', {
      sessionId: outerId, file, line, condition: "req.body?.method === 'tools/list'"
    });
    expect(breakpoint.verified).toBe(false);

    if (mode === 'attach') {
      const port = await spawnInspected(entry, ['http', '--port', '0']);
      await expect.poll(() => endpointFrom(targetOutput), { timeout: 15_000 }).toBeDefined();
      await connectNested(endpointFrom(targetOutput)!);
      expect((await call(outer!, 'attach_to_process', {
        sessionId: outerId, host: '127.0.0.1', port, stopOnEntry: false, verifyTimeout: 10_000
      })).state).toBe('running');
    } else {
      await connectNested(await launchNested());
    }

    // No readiness retry or breakpoint re-installation after the tool returns.
    const threads = await call<ToolResult & { threads: unknown[] }>(outer!, 'list_threads', { sessionId: outerId });
    expect(threads.threads.length).toBeGreaterThan(0);
    const bps = await call<ToolResult & { breakpoints: Array<{ verified: boolean }> }>(outer!, 'list_breakpoints', { sessionId: outerId });
    expect(bps.breakpoints).toHaveLength(1);
    expect(bps.breakpoints[0].verified).toBe(true);
    let completed = false;
    const response = nested!.listTools().then(
      value => { completed = true; return { value, error: undefined }; },
      error => { completed = true; return { value: undefined, error }; }
    );
    await paused(outer!, outerId!);
    expect(completed).toBe(false);
    const stack = await call<ToolResult & { stackFrames: Frame[] }>(outer!, 'get_stack_trace', { sessionId: outerId });
    // js-debug can lowercase the Windows drive letter. Compare the full path
    // using the host platform's case rules, rather than normalized strings.
    expect(path.relative(file, stack.stackFrames[0].file)).toBe('');
    expect(stack.stackFrames[0].line).toBe(line);
    expect((await call(outer!, 'evaluate_expression', {
      sessionId: outerId, frameId: stack.stackFrames[0].id, expression: "req.body.method === 'tools/list'"
    })).result).toBe('true');
    expect((await call(outer!, 'step_over', { sessionId: outerId })).state).toBe('paused');
    await call(outer!, 'continue_execution', { sessionId: outerId });
    const result = await response;
    expect(result.error).toBeUndefined();
    expect(result.value?.tools.map(tool => tool.name)).toContain('start_debugging');
    if (mode === 'attach') {
      await call(outer!, 'detach_from_process', { sessionId: outerId });
      expect((await nested!.listTools()).tools.length).toBeGreaterThan(0);
      expect(target!.exitCode).toBeNull();
    }
  }, 60_000);

  it('steps through its own attach verification and debugs the nested target', async () => {
    const targetFile = path.join(root, 'examples/javascript/attach_target.js');
    const port = await spawnInspected(targetFile);
    await startOuter();
    await connectNested(await launchNested());
    innerId = await createSession(nested!, 'attached-by-inspected-debugger');

    const file = path.join(root, 'src/session/attach/attach-controller.ts');
    const line = sourceLine(file, 'const verification = await verifyAttachThreads(this.ctx, {');
    await call(outer!, 'set_breakpoint', {
      sessionId: outerId, file, line, condition: 'attachConfig.stopOnEntry === false'
    });
    const attach = call(nested!, 'attach_to_process', {
      sessionId: innerId, host: '127.0.0.1', port, stopOnEntry: false, verifyTimeout: 10_000
    }).then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
    await paused(outer!, outerId!);
    expect((await call(outer!, 'evaluate_expression', {
      sessionId: outerId, expression: 'attachConfig.stopOnEntry'
    })).result).toBe('false');
    await call(outer!, 'step_into', { sessionId: outerId });
    const stack = await call<ToolResult & { stackFrames: Frame[] }>(outer!, 'get_stack_trace', { sessionId: outerId });
    expect(path.relative(path.join(root, 'src/session/attach/attach-verification.ts'), stack.stackFrames[0].file)).toBe('');
    expect((await call(outer!, 'evaluate_expression', {
      sessionId: outerId, frameId: stack.stackFrames[0].id, expression: 'input.verifyTimeoutMs'
    })).result).toBe('10000');
    await call(outer!, 'clear_breakpoints', { sessionId: outerId });
    await call(outer!, 'continue_execution', { sessionId: outerId });
    const attached = await attach;
    expect(attached.error).toBeUndefined();
    expect(attached.value?.state).toBe('running');

    const targetLine = sourceLine(targetFile, 'counter += 1;');
    await call(nested!, 'set_breakpoint', { sessionId: innerId, file: targetFile, line: targetLine });
    await paused(nested!, innerId);
    const counter = await call(nested!, 'evaluate_expression', { sessionId: innerId, expression: 'counter' });
    expect(Number(counter.result)).toBeGreaterThanOrEqual(0);
    await call(nested!, 'clear_breakpoints', { sessionId: innerId });
    await call(nested!, 'continue_execution', { sessionId: innerId });
    await call(nested!, 'detach_from_process', { sessionId: innerId });
    const previousTick = targetOutput.match(/tick \d+/g)?.at(-1);
    await expect.poll(() => targetOutput.match(/tick \d+/g)?.at(-1), { timeout: 5000 }).not.toBe(previousTick);
    expect(target!.exitCode).toBeNull();
    console.info('Self-debug evidence:', {
      entered: path.relative(root, stack.stackFrames[0].file),
      stopOnEntry: false, verifyTimeoutMs: 10_000,
      inspectedTargetCounter: Number(counter.result), targetKeptRunningAfterDetach: true
    });
  }, 60_000);
});
