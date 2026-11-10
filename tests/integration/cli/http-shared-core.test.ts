/**
 * Streamable HTTP: one debugger core per process (issue #1025, step 2). A
 * debug session is addressable by whoever holds its id — the handle is the
 * capability — so two clients of one server see the same list, either can
 * close what the other created, and a debug session outlives the MCP session
 * that created it. The per-client server and its "belongs to another MCP
 * client session" refusal (#939) were the 2025 era's behaviour; the
 * 2026-07-28 revision has no client sessions to key them on.
 *
 * This suite also measures the premise the idle policy's "attended" rule rests
 * on: a v2 SDK client in legacy mode holds a standalone SSE stream open for the
 * life of its connection, so /health reports the process attended while it is
 * connected and unattended once it has closed. Real server, two SDK clients,
 * the mock adapter — no toolchain.
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

interface Answer {
  success: boolean;
  error?: string;
  message?: string;
  sessionId?: string;
  sessions?: Array<{ id: string }>;
}

interface Health {
  attended: boolean;
  listenStreams: number;
  sessions: string[];
  debugSessions: Array<{ id: string; idleMs?: number }>;
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

async function connect(port: number, name: string): Promise<{ client: Client; transport: StreamableHTTPClientTransport }> {
  const client = new Client({ name, version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
  await client.connect(transport);
  clients.push(client);
  return { client, transport };
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<Answer> {
  const raw = await client.callTool({ name, arguments: args }, { timeout: 30_000 });
  const text = (raw.content as Array<{ type: string; text?: string }>).find(item => item.type === 'text')?.text;
  expect(text, JSON.stringify(raw)).toBeDefined();
  return JSON.parse(text!) as Answer;
}

async function health(port: number): Promise<Health> {
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  return (await response.json()) as Health;
}

/** Polls /health until `predicate` holds or the deadline passes; answers the last reading. */
async function healthUntil(port: number, predicate: (h: Health) => boolean, deadlineMs = 10_000): Promise<Health> {
  const deadline = Date.now() + deadlineMs;
  let last = await health(port);
  while (!predicate(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    last = await health(port);
  }
  return last;
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

describe('Streamable HTTP: one core per process (issue #1025, step 2)', () => {
  it('two clients see one list, either can drive the other\'s session, and a session outlives its MCP session', async () => {
    const port = await startServer();
    const a = await connect(port, 'agent-a');
    const b = await connect(port, 'agent-b');

    const created = await call(a.client, 'create_debug_session', { language: 'mock', name: 'shared' });
    expect(created.success, JSON.stringify(created)).toBe(true);
    const sessionId = created.sessionId!;

    // The whole process's list, from either client; the id is the capability.
    expect((await call(b.client, 'list_debug_sessions')).sessions?.map(session => session.id)).toContain(sessionId);
    const output = await call(b.client, 'get_output', { sessionId });
    expect(output.success, JSON.stringify(output)).toBe(true);
    expect((await health(port)).debugSessions.map(session => session.id)).toContain(sessionId);

    // Client A ends its MCP session cleanly (DELETE /mcp). The connection is gone;
    // the debug session is not: it answers to the idle policy, not to the MCP session.
    await a.transport.terminateSession();
    await a.client.close().catch(() => {});
    const afterDelete = await healthUntil(port, (h) => h.sessions.length === 1);
    expect(afterDelete.sessions).toHaveLength(1);
    expect(afterDelete.debugSessions.map(session => session.id)).toContain(sessionId);
    expect((await call(b.client, 'list_debug_sessions')).sessions?.map(session => session.id)).toContain(sessionId);

    // Client B closes what A created.
    expect((await call(b.client, 'close_debug_session', { sessionId })).success).toBe(true);
    const gone = await call(b.client, 'close_debug_session', { sessionId });
    expect(gone.success).toBe(false);
    expect(gone.message).toMatch(/Failed to close debug session/);
  }, 60_000);

  it('a connected legacy client attends the process for the life of its connection (the idle policy\'s premise)', async () => {
    const port = await startServer();
    expect((await health(port)).attended).toBe(false);

    const a = await connect(port, 'agent-a');
    // No tool call at all: presence alone, through the SDK client's standalone SSE stream.
    const connected = await healthUntil(port, (h) => h.attended);
    expect(connected.attended, JSON.stringify(connected)).toBe(true);
    expect(connected.listenStreams).toBe(0);

    await a.client.close();
    const closed = await healthUntil(port, (h) => !h.attended);
    expect(closed.attended, JSON.stringify(closed)).toBe(false);
  }, 60_000);
});
