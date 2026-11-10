/**
 * Streamable HTTP contract for the 2026-07-28 revision (issue #1025, step 2):
 * the modern, sessionless era served beside the 2025 sessionful app on the
 * same /mcp endpoint. One case per clause the SDK's modern handler answers on
 * our behalf — a raw request per case, because the SDK client hides status
 * codes and error bodies — plus the two routing facts this server decides
 * itself: a 2025-shaped request still lands on the sessionful app, and the
 * modern listen stream counts the process as attended. The 2025 clauses stay
 * pinned by http-spec-contract.test.ts; both eras are served until the legacy
 * one is retired.
 *
 * Spec: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import * as http from 'node:http';
import net, { type AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serverEnvironment } from '../../test-utils/helpers/mcp-stdio-client.js';
import { waitForHealthEndpoint } from '../../e2e/smoke-test-utils.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const entry = path.join(root, 'dist/index.js');

const VERSION = '2026-07-28';
const META = {
  'io.modelcontextprotocol/protocolVersion': VERSION,
  'io.modelcontextprotocol/clientInfo': { name: 'spec-contract-2026', version: '1.0.0' },
  'io.modelcontextprotocol/clientCapabilities': {}
};

interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

interface RunningServer {
  port: number;
  child: ChildProcess;
  output: () => string;
}

interface Health {
  attended: boolean;
  listenStreams: number;
  sessions: string[];
  requests?: { legacy: number; modern: number };
}

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

async function startServer(): Promise<RunningServer> {
  const port = await freePort();
  let output = '';
  const child = spawn(process.execPath, [entry, 'http', '-p', String(port)], {
    cwd: root,
    env: serverEnvironment({ scrub: ['MCP_HTTP_BIND', 'MCP_HTTP_ALLOWED_HOSTS'], exitOnStdinClose: false }),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout!.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr!.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  expect(await waitForHealthEndpoint(port, 20_000), output).toBe(true);
  return { port, child, output: () => output };
}

async function stopServer(server: RunningServer | undefined): Promise<void> {
  if (!server || server.child.exitCode !== null) return;
  const exited = new Promise<void>((resolve) => server.child.once('exit', () => resolve()));
  server.child.kill();
  await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 5_000))]);
}

/** A modern-era request body: the method's params plus the per-request `_meta` envelope. */
function envelope(id: number, method: string, params: Record<string, unknown> = {}, meta: Record<string, unknown> = META) {
  return { jsonrpc: '2.0', id, method, params: { ...params, _meta: meta } };
}

/** The headers the 2026-07-28 revision requires on a POST, derived from the body unless overridden. */
function modernHeaders(
  body: { method: string; params?: { name?: string; uri?: string; [key: string]: unknown } },
  overrides: Record<string, string | undefined> = {}
): Record<string, string> {
  const headers: Record<string, string | undefined> = {
    'MCP-Protocol-Version': VERSION,
    'Mcp-Method': body.method,
    ...(body.params?.name !== undefined ? { 'Mcp-Name': body.params.name } : {}),
    ...(body.params?.uri !== undefined ? { 'Mcp-Name': body.params.uri } : {}),
    ...overrides,
  };
  return Object.fromEntries(Object.entries(headers).filter((entry): entry is [string, string] => entry[1] !== undefined));
}

function request(
  port: number,
  options: { method?: string; body?: unknown; headers?: Record<string, string>; path?: string } = {}
): Promise<Reply> {
  const method = options.method ?? 'POST';
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  const headers: Record<string, string> = {
    Accept: method === 'GET' ? 'text/event-stream' : 'application/json, text/event-stream',
    ...(payload !== undefined ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(payload)) } : {}),
    ...(options.headers ?? {}),
  };
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: options.path ?? '/mcp', method, headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

/** The JSON-RPC message with `id` out of a JSON or SSE-framed reply. */
function messageOf(reply: Reply, id: number): Record<string, any> {
  const contentType = String(reply.headers['content-type'] ?? '');
  if (contentType.startsWith('text/event-stream')) {
    for (const line of reply.body.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const parsed = JSON.parse(line.slice(5).trim()) as Record<string, any>;
      if (parsed.id === id) return parsed;
    }
    throw new Error(`no message with id ${id} in the SSE reply:\n${reply.body}`);
  }
  const parsed = JSON.parse(reply.body) as Record<string, any>;
  if (Array.isArray(parsed)) {
    const found = parsed.find((message: { id?: number }) => message.id === id);
    if (found) return found;
    throw new Error(`no message with id ${id} in the batch reply:\n${reply.body}`);
  }
  return parsed;
}

async function health(port: number): Promise<Health> {
  const reply = await request(port, { method: 'GET', path: '/health', headers: { Accept: 'application/json' } });
  return JSON.parse(reply.body) as Health;
}

async function healthUntil(port: number, predicate: (h: Health) => boolean, deadlineMs = 10_000): Promise<Health> {
  const deadline = Date.now() + deadlineMs;
  let last = await health(port);
  while (!predicate(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    last = await health(port);
  }
  return last;
}

describe('Streamable HTTP contract (spec 2026-07-28, served beside 2025-11-25)', () => {
  let server: RunningServer | undefined;

  beforeAll(async () => {
    server = await startServer();
  }, 30_000);

  afterAll(async () => {
    await stopServer(server);
  });

  it('server/discover answers the supported versions, the capabilities and the server identity, with no session minted', async () => {
    const body = envelope(1, 'server/discover');
    const reply = await request(server!.port, { body, headers: modernHeaders(body) });

    expect(reply.status, reply.body).toBe(200);
    expect(reply.headers['mcp-session-id']).toBeUndefined();
    const message = messageOf(reply, 1);
    expect(message.result.supportedVersions).toContain(VERSION);
    expect(message.result.resultType).toBe('complete');
    expect(message.result.capabilities).toMatchObject({ tools: {}, resources: { subscribe: true, listChanged: true }, prompts: {} });
    expect(message.result._meta?.['io.modelcontextprotocol/serverInfo']?.name).toBe('debug-mcp-server');
  });

  it('tools/list carries the cache fields and a deterministic order', async () => {
    const body = envelope(2, 'tools/list');
    const first = messageOf(await request(server!.port, { body, headers: modernHeaders(body) }), 2);
    const second = messageOf(await request(server!.port, { body, headers: modernHeaders(body) }), 2);

    expect(first.result.tools).toHaveLength(29);
    expect(typeof first.result.ttlMs).toBe('number');
    expect(['public', 'private']).toContain(first.result.cacheScope);
    expect(first.result.resultType).toBe('complete');
    expect(second.result.tools.map((tool: { name: string }) => tool.name)).toEqual(first.result.tools.map((tool: { name: string }) => tool.name));
  });

  it('a modern request carrying a stale Mcp-Session-Id is served statelessly, the header ignored', async () => {
    const body = envelope(3, 'tools/list');
    const reply = await request(server!.port, { body, headers: { ...modernHeaders(body), 'Mcp-Session-Id': 'stale-from-another-life' } });

    expect(reply.status, reply.body).toBe(200);
    expect(messageOf(reply, 3).result.tools).toHaveLength(29);
    expect(reply.headers['mcp-session-id']).toBeUndefined();
  });

  it('a modern protocol header without the per-request envelope is refused with -32602', async () => {
    const body = { jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} };
    const reply = await request(server!.port, { body, headers: modernHeaders(body) });

    expect(reply.status, reply.body).toBe(400);
    expect(JSON.parse(reply.body).error.code).toBe(-32602);
  });

  it('a modern request missing the Mcp-Method header is refused with -32020 (HeaderMismatch)', async () => {
    const body = envelope(5, 'tools/list');
    const reply = await request(server!.port, { body, headers: modernHeaders(body, { 'Mcp-Method': undefined }) });

    expect(reply.status, reply.body).toBe(400);
    expect(JSON.parse(reply.body).error.code).toBe(-32020);
  });

  it('an unsupported claimed revision is refused with -32022 naming the supported ones', async () => {
    const body = envelope(6, 'tools/list', {}, { ...META, 'io.modelcontextprotocol/protocolVersion': '2099-01-01' });
    const reply = await request(server!.port, { body, headers: modernHeaders(body, { 'MCP-Protocol-Version': '2099-01-01' }) });

    expect(reply.status, reply.body).toBe(400);
    const error = JSON.parse(reply.body).error;
    expect(error.code).toBe(-32022);
    expect(error.data?.supported).toContain(VERSION);
  });

  it('a 2025 initialize on the same endpoint still opens a sessionful MCP session (both eras served)', async () => {
    const reply = await request(server!.port, {
      body: {
        jsonrpc: '2.0',
        id: 7,
        method: 'initialize',
        params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'spec-contract-2026', version: '1.0.0' } },
      },
    });

    expect(reply.status, reply.body).toBe(200);
    const sessionId = reply.headers['mcp-session-id'];
    expect(typeof sessionId).toBe('string');
    expect((await health(server!.port)).sessions).toContain(sessionId);
    await request(server!.port, { method: 'DELETE', headers: { 'Mcp-Session-Id': sessionId as string } });
  });

  it('a session-less 2025-shaped request still lands on the sessionful app and its 400 (unchanged)', async () => {
    const reply = await request(server!.port, { body: { jsonrpc: '2.0', id: 8, method: 'tools/list' } });

    expect(reply.status, reply.body).toBe(400);
    expect(JSON.parse(reply.body).error.code).toBe(-32600);
    const get = await request(server!.port, { method: 'GET' });
    expect(get.status).toBe(400);
  });

  it('an open subscriptions/listen stream counts the process as attended, and its close as unattended', async () => {
    const before = await health(server!.port);
    expect(before.listenStreams).toBe(0);

    const body = envelope(9, 'subscriptions/listen', { notifications: { resourcesListChanged: true } });
    const payload = JSON.stringify(body);
    const headers = {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(payload)),
      ...modernHeaders(body),
    };
    const firstEvent = new Promise<string>((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port: server!.port, path: '/mcp', method: 'POST', headers }, (res) => {
        expect(res.statusCode, 'listen must open a stream').toBe(200);
        res.setEncoding('utf8');
        let buffer = '';
        res.on('data', (chunk: string) => {
          buffer += chunk;
          if (buffer.includes('\n\n')) {
            resolve(buffer);
            // Hold the stream open a moment longer, then drop it: cancellation.
            setTimeout(() => req.destroy(), 1_500);
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    const opened = await firstEvent;
    expect(opened).toContain('notifications/subscriptions/acknowledged');
    const during = await healthUntil(server!.port, (h) => h.listenStreams === 1);
    expect(during.listenStreams, JSON.stringify(during)).toBe(1);
    expect(during.attended).toBe(true);

    const after = await healthUntil(server!.port, (h) => h.listenStreams === 0);
    expect(after.listenStreams, JSON.stringify(after)).toBe(0);
    expect(after.attended).toBe(false);
  }, 30_000);
});
