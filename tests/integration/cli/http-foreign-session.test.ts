/**
 * Streamable HTTP: a debug session is visible only to the MCP client session
 * that created it — one DebugMcpServer per client (issues #337, #658). A second
 * client naming that id used to get the same `Session not found` an invalid id
 * gets, while the program kept running under the first client, unreachable
 * (issue #939). The answer now says whose it is. Real server, two SDK clients,
 * the mock adapter — no toolchain.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import net, { type AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
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

async function connect(port: number, name: string): Promise<Client> {
  const client = new Client({ name, version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
  clients.push(client);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<Answer> {
  const raw = await client.callTool({ name, arguments: args }, undefined, { timeout: 30_000 });
  const text = (raw.content as Array<{ type: string; text?: string }>).find(item => item.type === 'text')?.text;
  expect(text, JSON.stringify(raw)).toBeDefined();
  return JSON.parse(text!) as Answer;
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

describe('Streamable HTTP: a debug session named by another client (issue #939)', () => {
  it('answers whose it is instead of "not found", and the owner keeps it', async () => {
    const port = await startServer();
    const owner = await connect(port, 'owner');
    const other = await connect(port, 'other');

    const created = await call(owner, 'create_debug_session', { language: 'mock', name: 'owned' });
    expect(created.success, JSON.stringify(created)).toBe(true);
    const sessionId = created.sessionId!;

    // The odd shapes too: close_debug_session answers with `message`, get_output
    // with its own literal — the gate sits in front of every tool.
    const closed = await call(other, 'close_debug_session', { sessionId });
    expect(closed.success).toBe(false);
    expect(closed.error).toMatch(/belongs to another MCP client session/);
    expect(closed.error).toMatch(/each Streamable HTTP client sees only the debug sessions it created/);
    const output = await call(other, 'get_output', { sessionId });
    expect(output.success).toBe(false);
    expect(output.error).toMatch(/belongs to another MCP client session/);

    // Still the owner's, still invisible to the other client.
    expect((await call(other, 'list_debug_sessions')).sessions).toEqual([]);
    expect((await call(owner, 'list_debug_sessions')).sessions?.map(session => session.id)).toContain(sessionId);
    expect((await call(owner, 'close_debug_session', { sessionId })).success).toBe(true);

    // Gone everywhere: the plain answer, unchanged.
    const gone = await call(other, 'close_debug_session', { sessionId });
    expect(gone.success).toBe(false);
    expect(gone.message).toMatch(/Failed to close debug session/);
  }, 60_000);
});
