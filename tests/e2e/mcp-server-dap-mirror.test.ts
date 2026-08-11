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

    // Re-expose, then closing the session closes the listener with it.
    const third = await exposeSession(sessionId);
    const closeRes = await callToolSafely(mcpClient!, 'close_debug_session', { sessionId });
    expect(closeRes.success).toBe(true);
    currentSessionId = null;

    // The worker (and its listener) is gone; give teardown a moment.
    const deadline = Date.now() + 10_000;
    let refused = false;
    while (Date.now() < deadline && !refused) {
      refused = await isPortRefused(third.port);
      if (!refused) await new Promise((r) => setTimeout(r, 200));
    }
    expect(refused).toBe(true);
  }, 60_000);
});
