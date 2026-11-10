/**
 * The http transport speaks both protocol eras (issue #1025, step 2): a
 * probing v2 client lands on 2026-07-28 and drives a full debug session with
 * no MCP session at all; a client that opens with initialize gets the 2025
 * sessionful era as before. Real server (`dist/index.js http`), the v2 SDK
 * client in each negotiation mode, the mock adapter — no toolchain.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import net, { type AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { serverEnvironment } from '../../test-utils/helpers/mcp-stdio-client.js';
import { waitForHealthEndpoint } from '../../e2e/smoke-test-utils.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const entry = path.join(root, 'dist/index.js');
const MOCK_SCRIPT = path.join(root, 'examples/python/simple_test.py');

type Mode = 'auto' | 'legacy' | { pin: string };

interface Answer {
  success: boolean;
  sessionId?: string;
  state?: string;
  message?: string;
  error?: string;
}

let server: ChildProcess | undefined;
let serverOutput = '';
const clients: Client[] = [];

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

async function startServer(): Promise<number> {
  const port = await freePort();
  server = spawn(process.execPath, [entry, 'http', '-p', String(port)], {
    cwd: root,
    env: serverEnvironment({ scrub: ['MCP_HTTP_BIND'], exitOnStdinClose: false }),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  server.stdout!.on('data', (chunk: Buffer) => { serverOutput += chunk.toString(); });
  server.stderr!.on('data', (chunk: Buffer) => { serverOutput += chunk.toString(); });
  expect(await waitForHealthEndpoint(port, 20_000), serverOutput).toBe(true);
  return port;
}

async function connect(port: number, mode: Mode, name: string): Promise<Client> {
  const client = new Client({ name, version: '1.0.0' }, { versionNegotiation: { mode } });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
  clients.push(client);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<Answer> {
  const raw = await client.callTool({ name, arguments: args }, { timeout: 30_000 });
  const text = (raw.content as Array<{ type: string; text?: string }>).find((item) => item.type === 'text')?.text;
  expect(text, JSON.stringify(raw)).toBeDefined();
  return JSON.parse(text!) as Answer;
}

async function health(port: number): Promise<{ sessions: string[]; debugSessions: Array<{ id: string }>; requests: { legacy: number; modern: number } }> {
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  return (await response.json()) as { sessions: string[]; debugSessions: Array<{ id: string }>; requests: { legacy: number; modern: number } };
}

afterEach(async () => {
  for (const client of clients.splice(0)) {
    await client.close().catch(() => {});
  }
  if (server && server.exitCode === null) {
    const exited = new Promise<void>((resolve) => server!.once('exit', () => resolve()));
    server.kill();
    await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 5_000))]);
  }
  server = undefined;
  serverOutput = '';
});

describe('http serves both protocol eras (issue #1025, step 2)', () => {
  it('a probing client lands on 2026-07-28 with no MCP session, and the server counts it as modern traffic', async () => {
    const port = await startServer();
    const client = await connect(port, 'auto', 'era-auto');

    expect(client.getProtocolEra()).toBe('modern');
    expect(client.getNegotiatedProtocolVersion()).toBe('2026-07-28');
    expect(client.getServerVersion()?.name).toBe('debug-mcp-server');
    expect((await client.listTools()).tools.length).toBe(29);
    const h = await health(port);
    expect(h.sessions).toEqual([]);
    expect(h.requests.modern).toBeGreaterThan(0);
  }, 60_000);

  it('a client pinned to 2026-07-28 drives a full debug session sessionlessly and hears list changes', async () => {
    const port = await startServer();
    const client = await connect(port, { pin: '2026-07-28' }, 'era-pin');
    expect(client.getProtocolEra()).toBe('modern');

    const changes: string[] = [];
    client.setNotificationHandler('notifications/resources/list_changed', () => { changes.push('list_changed'); });
    const subscription = await client.listen({ resourcesListChanged: true });
    expect(subscription.honoredFilter.resourcesListChanged).toBe(true);

    const created = await call(client, 'create_debug_session', { language: 'mock', name: 'era-pin' });
    expect(created.success, JSON.stringify(created)).toBe(true);
    const sessionId = created.sessionId!;
    await expect.poll(() => changes.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    expect((await health(port)).debugSessions.map((s) => s.id)).toContain(sessionId);

    const bp = await call(client, 'set_breakpoint', { sessionId, file: MOCK_SCRIPT, line: 32 });
    expect(bp.success, JSON.stringify(bp)).toBe(true);
    const started = await call(client, 'start_debugging', { sessionId, scriptPath: MOCK_SCRIPT, dapLaunchArgs: { stopOnEntry: true } });
    expect(started.success, JSON.stringify(started)).toBe(true);
    const waited = await call(client, 'wait_for_stop', { sessionId, timeout: 15_000 });
    expect(waited.success, JSON.stringify(waited)).toBe(true);
    expect(waited.state).toBe('paused');
    expect((await call(client, 'close_debug_session', { sessionId })).success).toBe(true);

    await subscription.close();
  }, 90_000);

  it('a client that opens with initialize gets the 2025-11-25 era and an MCP session, as before', async () => {
    const port = await startServer();
    const client = await connect(port, 'legacy', 'era-legacy');

    expect(client.getProtocolEra()).toBe('legacy');
    expect(client.getNegotiatedProtocolVersion()).toBe('2025-11-25');
    expect((await health(port)).sessions).toHaveLength(1);
    const created = await call(client, 'create_debug_session', { language: 'mock', name: 'era-legacy' });
    expect(created.success).toBe(true);
    await client.subscribeResource({ uri: `debug://sessions/${created.sessionId}/output` });
    expect((await call(client, 'close_debug_session', { sessionId: created.sessionId! })).success).toBe(true);
  }, 60_000);
});
