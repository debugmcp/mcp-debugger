/**
 * E2E: DAP mirror — read-only IDE attach to an agent-owned session
 * (issue #217), against the mock adapter.
 *
 * Full stack: MCP client → dist/index.js → SessionManager → proxy worker →
 * mock adapter, with a scripted TCP DAP client standing in for the IDE
 * against the worker-hosted mirror endpoint.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { ROOT } from './language-matrix-utils.js';
import { TcpDapClient, isPortRefused } from '../test-utils/helpers/dap-test-client.js';

const MOCK_SCRIPT = path.resolve(ROOT, 'tests', 'fixtures', 'debug-scripts', 'mock-snap-fixture.py');

describe('DAP mirror e2e (#217, mock adapter)', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let currentSessionId: string | null = null;
  const dapClients: TcpDapClient[] = [];

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: { ...process.env, NODE_ENV: 'test' },
    });
    mcpClient = new Client(
      { name: 'dap-mirror-test-client', version: '1.0.0' },
      { capabilities: {} },
    );
    await mcpClient.connect(transport);
  }, 120_000);

  afterAll(async () => {
    if (mcpClient) {
      await mcpClient.close().catch(() => {});
    }
    transport = null;
  });

  afterEach(async () => {
    dapClients.splice(0).forEach((c) => c.close());
    if (mcpClient && currentSessionId) {
      await callToolSafely(mcpClient, 'close_debug_session', { sessionId: currentSessionId });
      currentSessionId = null;
    }
  });

  async function createPausedMockSession(name: string): Promise<string> {
    const createRes = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'mock', name },
    });
    const sessionId = parseSdkToolResult(createRes).sessionId as string;
    expect(sessionId).toBeTruthy();
    currentSessionId = sessionId;

    const startRes = await callToolSafely(mcpClient!, 'start_debugging', {
      sessionId,
      scriptPath: MOCK_SCRIPT,
      dapLaunchArgs: { stopOnEntry: true },
    });
    expect(startRes.success).toBe(true);

    await waitForState(sessionId, ['paused']);
    return sessionId;
  }

  async function waitForState(sessionId: string, states: string[], timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastState = 'unknown';
    while (Date.now() < deadline) {
      const list = await callToolSafely(mcpClient!, 'list_debug_sessions', {});
      const session = (list as { sessions?: Array<{ id: string; state: string }> }).sessions?.find(
        (s) => s.id === sessionId
      );
      lastState = session?.state ?? 'gone';
      if (session && states.includes(session.state)) {
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Session ${sessionId} did not reach ${states.join('/')} (last state: ${lastState})`);
  }

  async function exposeSession(sessionId: string): Promise<{ host: string; port: number; token: string }> {
    const res = await callToolSafely(mcpClient!, 'expose_session', { sessionId });
    expect(res.success).toBe(true);
    const { host, port, token } = res as { host: string; port: number; token: string };
    expect(host).toBe('127.0.0.1');
    expect(port).toBeGreaterThan(0);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThanOrEqual(32);
    return { host, port, token };
  }

  async function connectAndJoin(port: number, token: string): Promise<TcpDapClient> {
    const client = new TcpDapClient();
    dapClients.push(client);
    await client.connect(port);
    const init = await client.request('initialize', { adapterID: 'mock', clientID: 'e2e-ide' });
    expect(init.success).toBe(true);
    await client.waitForEvent('initialized');
    const attach = await client.request('attach', { mirrorToken: token });
    expect(attach.success).toBe(true);
    await client.request('configurationDone');
    return client;
  }

  it('exposes a paused session and serves the full read-only inspection surface', async () => {
    const sessionId = await createPausedMockSession('mirror-full-flow');
    const { port, token } = await exposeSession(sessionId);

    // Endpoint surfaces in list_debug_sessions — without the token.
    const list = await callToolSafely(mcpClient!, 'list_debug_sessions', {});
    const session = (list as { sessions?: Array<Record<string, unknown>> }).sessions?.find(
      (s) => s.id === sessionId
    );
    expect(session?.exposure).toEqual({ host: '127.0.0.1', port });
    expect(JSON.stringify(list)).not.toContain(token);

    // IDE stand-in joins and lands on the paused frame (late-join synthesis).
    const ide = await connectAndJoin(port, token);
    const stopped = await ide.waitForEvent('stopped');
    expect((stopped.body as { reason?: string }).reason).toBeTruthy();

    // Inspection surface, all forwarded to the live mock adapter.
    const threads = await ide.request('threads');
    expect(threads.success).toBe(true);
    const threadList = (threads.body as { threads: Array<{ id: number }> }).threads;
    expect(threadList.length).toBeGreaterThanOrEqual(1);

    const stack = await ide.request('stackTrace', { threadId: threadList[0].id });
    expect(stack.success).toBe(true);
    const frames = (stack.body as { stackFrames: Array<{ id: number }> }).stackFrames;
    expect(frames.length).toBeGreaterThanOrEqual(1);

    const scopes = await ide.request('scopes', { frameId: frames[0].id });
    expect(scopes.success).toBe(true);
    const scopeList = (scopes.body as { scopes: Array<{ variablesReference: number }> }).scopes;
    expect(scopeList.length).toBeGreaterThanOrEqual(1);

    const variables = await ide.request('variables', {
      variablesReference: scopeList[0].variablesReference,
    });
    expect(variables.success).toBe(true);
    expect((variables.body as { variables: unknown[] }).variables.length).toBeGreaterThanOrEqual(1);

    const evaluate = await ide.request('evaluate', { expression: '1 + 1', context: 'repl' });
    expect(evaluate.success).toBe(true);
    expect((evaluate.body as { result: string }).result).toContain('mock_value');

    // Control is rejected — and really was not forwarded: still paused.
    const cont = await ide.request('continue', { threadId: threadList[0].id });
    expect(cont.success).toBe(false);
    expect(String(cont.message)).toMatch(/read-only/i);
    await waitForState(sessionId, ['paused']);

    // A second IDE client works concurrently.
    const second = await connectAndJoin(port, token);
    const secondThreads = await second.request('threads');
    expect(secondThreads.success).toBe(true);

    // Unexpose disconnects both and closes the listener.
    const unexpose = await callToolSafely(mcpClient!, 'unexpose_session', { sessionId });
    expect(unexpose.success).toBe(true);
    expect((unexpose as { wasExposed?: boolean }).wasExposed).toBe(true);
    await ide.waitForClose();
    await second.waitForClose();
    expect(await isPortRefused(port)).toBe(true);
  }, 60_000);

  /** Wait for an event that arrives AFTER the given frame index. */
  async function nextEvent(
    client: TcpDapClient,
    event: string,
    fromIndex: number,
    timeoutMs = 10_000
  ) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = client.frames
        .slice(fromIndex)
        .find((m) => m.type === 'event' && (m as { event?: string }).event === event);
      if (found) return found as { event: string; body?: unknown };
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`No '${event}' event after frame ${fromIndex}`);
  }

  it('mirrors live execution: MCP-side stepping and program exit reach the IDE client', async () => {
    const sessionId = await createPausedMockSession('mirror-live-flow');
    const { port, token } = await exposeSession(sessionId);
    const ide = await connectAndJoin(port, token);
    await ide.waitForEvent('stopped'); // late-join replay for the entry stop

    // The agent steps; the observing IDE sees the pause state move:
    // continued (resume inference from the successful 'next' response, since
    // adapters may skip the event) followed by the fresh stopped.
    let mark = ide.frames.length;
    const stepRes = await callToolSafely(mcpClient!, 'step_over', { sessionId });
    expect(stepRes.success).toBe(true);
    await nextEvent(ide, 'continued', mark);
    const stepStop = await nextEvent(ide, 'stopped', mark);
    expect((stepStop.body as { reason?: string }).reason).toBe('step');

    // The agent lets the program run to completion; the IDE client receives
    // exactly one terminated (terminal-signal dedupe) and the socket closes
    // with the worker — "closes on debuggee exit".
    mark = ide.frames.length;
    const contRes = await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    expect(contRes.success).toBe(true);
    await nextEvent(ide, 'terminated', mark, 15_000);
    await ide.waitForClose(15_000);
    const terminatedCount = ide.frames.filter(
      (m) => m.type === 'event' && (m as { event?: string }).event === 'terminated'
    ).length;
    expect(terminatedCount).toBe(1);
    expect(await isPortRefused(port)).toBe(true);
  }, 60_000);

  it('rejects wrong and missing mirror tokens', async () => {
    const sessionId = await createPausedMockSession('mirror-token-reject');
    const { port } = await exposeSession(sessionId);

    const wrong = new TcpDapClient();
    dapClients.push(wrong);
    await wrong.connect(port);
    await wrong.request('initialize', { adapterID: 'mock' });
    const wrongAttach = await wrong.request('attach', { mirrorToken: 'wrong-token' });
    expect(wrongAttach.success).toBe(false);
    expect(String(wrongAttach.message)).toMatch(/mirrorToken/);
    await wrong.waitForClose();

    const missing = new TcpDapClient();
    dapClients.push(missing);
    await missing.connect(port);
    await missing.request('initialize', { adapterID: 'mock' });
    const missingAttach = await missing.request('attach', {});
    expect(missingAttach.success).toBe(false);
    await missing.waitForClose();
  }, 60_000);

  it('is idempotent and cleans up with the session lifecycle', async () => {
    // Expose before launch fails with a friendly hint.
    const createRes = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'mock', name: 'mirror-lifecycle' },
    });
    const sessionId = parseSdkToolResult(createRes).sessionId as string;
    currentSessionId = sessionId;

    const early = await callToolSafely(mcpClient!, 'expose_session', { sessionId });
    expect(early.success).toBe(false);
    expect(String((early as { error?: string }).error)).toContain('start_debugging');

    // Launch, expose twice: same endpoint and token both times.
    const startRes = await callToolSafely(mcpClient!, 'start_debugging', {
      sessionId,
      scriptPath: MOCK_SCRIPT,
      dapLaunchArgs: { stopOnEntry: true },
    });
    expect(startRes.success).toBe(true);
    await waitForState(sessionId, ['paused']);

    const first = await exposeSession(sessionId);
    const second = await exposeSession(sessionId);
    expect(second).toEqual(first);

    // Unexpose twice: second is a no-op success.
    const un1 = await callToolSafely(mcpClient!, 'unexpose_session', { sessionId });
    expect(un1.success).toBe(true);
    expect((un1 as { wasExposed?: boolean }).wasExposed).toBe(true);
    const un2 = await callToolSafely(mcpClient!, 'unexpose_session', { sessionId });
    expect(un2.success).toBe(true);
    expect((un2 as { wasExposed?: boolean }).wasExposed).toBe(false);

    // restart_debugging replaces the worker — the old endpoint must die and
    // the exposure record must not resurrect against the new worker.
    const third = await exposeSession(sessionId);
    const restartRes = await callToolSafely(mcpClient!, 'restart_debugging', { sessionId });
    expect(restartRes.success).toBe(true);
    await waitForState(sessionId, ['paused']);
    expect(await waitForPortRefused(third.port)).toBe(true);
    const listAfterRestart = await callToolSafely(mcpClient!, 'list_debug_sessions', {});
    const restarted = (listAfterRestart as { sessions?: Array<Record<string, unknown>> }).sessions?.find(
      (s) => s.id === sessionId
    );
    expect(restarted?.exposure).toBeUndefined();

    // Re-expose on the new worker (fresh endpoint), then closing the session
    // closes the listener with it.
    const fourth = await exposeSession(sessionId);
    expect(fourth.port).not.toBe(third.port);
    const closeRes = await callToolSafely(mcpClient!, 'close_debug_session', { sessionId });
    expect(closeRes.success).toBe(true);
    currentSessionId = null;
    expect(await waitForPortRefused(fourth.port)).toBe(true);
  }, 60_000);

  /** Poll until a fresh connection to the port is refused (worker teardown is async). */
  async function waitForPortRefused(port: number, timeoutMs = 10_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await isPortRefused(port)) return true;
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  }
});
