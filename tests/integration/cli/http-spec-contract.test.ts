/**
 * Streamable HTTP, the clauses this server answers with its own code — one case per clause,
 * against the real server, over raw HTTP.
 *
 * Spec: Transports, protocol revision 2025-11-25 (the revision the pinned SDK speaks):
 * https://modelcontextprotocol.io/specification/2025-11-25/basic/transports — "Session
 * Management" §1–§5, "Security Warning" §1, "Protocol Version Header". The 2026-07-28
 * revision removes protocol-level sessions and the `Mcp-Session-Id` header (SEP-2567); the
 * legacy era stays supported under the feature lifecycle policy, and this file pins it.
 *
 * Why raw HTTP: the SDK client folds every non-2xx answer into a thrown StreamableHTTPError,
 * so a case about a status code has to read the status code. Why the real server: the session
 * map, the stale-session reaper and the Host/Origin allowlist are wired in `createHttpApp` and
 * the CLI, and each clause is about what a client sees on the wire.
 *
 * Out of scope: the clauses the SDK transport answers after `transport.handleRequest` (Accept
 * negotiation, 405 on a GET without SSE, 202 for notifications, …) are its conformance —
 * `scripts/mcp-conformance.mjs` runs the protocol org's suite for the scenarios that apply.
 * stdio's "nothing but protocol on stdout" is pinned by tests/unit/cli/entry-prologue.test.ts.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import * as http from 'node:http';
import net, { type AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serverEnvironment } from '../../test-utils/helpers/mcp-stdio-client.js';
import { waitForHealthEndpoint } from '../../e2e/smoke-test-utils.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const entry = path.join(root, 'dist/index.js');

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

const INITIALIZE = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'spec-contract', version: '1.0.0' } },
};
const TOOLS_LIST = { jsonrpc: '2.0', id: 2, method: 'tools/list' };

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

async function startServer(env: Record<string, string> = {}): Promise<RunningServer> {
  const port = await freePort();
  let output = '';
  const child = spawn(process.execPath, [entry, 'http', '-p', String(port)], {
    cwd: root,
    // The developer's own allowlist or bind address must not reach the Origin and Host cases.
    env: serverEnvironment({ scrub: ['MCP_HTTP_BIND', 'MCP_HTTP_ALLOWED_HOSTS'], exitOnStdinClose: false, env }),
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

/** One raw request to /mcp; the SDK transport needs both Accept types on a POST. */
function request(
  port: number,
  options: { method?: string; sessionId?: string; body?: unknown; headers?: Record<string, string>; path?: string } = {}
): Promise<Reply> {
  const method = options.method ?? 'POST';
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  const headers: Record<string, string> = {
    Accept: method === 'GET' ? 'text/event-stream' : 'application/json, text/event-stream',
    ...(payload !== undefined ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(payload)) } : {}),
    ...(options.sessionId !== undefined ? { 'Mcp-Session-Id': options.sessionId } : {}),
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

/** The JSON-RPC error body of a refused request, whichever framing it came in. */
function errorOf(reply: Reply): { code: number; message: string } {
  const parsed = JSON.parse(reply.body) as { error: { code: number; message: string } };
  return parsed.error;
}

/** Open a session the way an SDK client does, and hand back its id. */
async function initialize(port: number): Promise<string> {
  const reply = await request(port, { body: INITIALIZE });
  expect(reply.status, reply.body).toBe(200);
  const sessionId = reply.headers['mcp-session-id'];
  expect(typeof sessionId, 'initialize must answer an Mcp-Session-Id').toBe('string');
  return sessionId as string;
}

async function health(port: number): Promise<{ sessions: string[] }> {
  const reply = await request(port, { method: 'GET', path: '/health', headers: { Accept: 'application/json' } });
  return JSON.parse(reply.body) as { sessions: string[] };
}

describe('Streamable HTTP contract (spec 2025-11-25, Transports)', () => {
  let server: RunningServer | undefined;
  const opened: string[] = [];

  beforeAll(async () => {
    server = await startServer();
  }, 30_000);

  afterEach(async () => {
    for (const sessionId of opened.splice(0)) {
      await request(server!.port, { method: 'DELETE', sessionId }).catch(() => undefined);
    }
  });

  afterAll(async () => {
    await stopServer(server);
  });

  it('Session Management §1: initialize answers an Mcp-Session-Id of visible ASCII, and a request carrying it reaches that session', async () => {
    const sessionId = await initialize(server!.port);
    opened.push(sessionId);
    expect(sessionId).toMatch(/^[\x21-\x7E]+$/);

    const listed = await request(server!.port, { sessionId, body: TOOLS_LIST });
    expect(listed.status, listed.body).toBe(200);
    expect(listed.body).toContain('"tools"');
    expect((await health(server!.port)).sessions).toContain(sessionId);
  });

  it('Session Management §2: a request without Mcp-Session-Id that is not an initialize answers 400 with a JSON-RPC error body', async () => {
    for (const method of ['POST', 'GET', 'DELETE']) {
      const reply = await request(server!.port, { method, body: method === 'POST' ? TOOLS_LIST : undefined });
      expect(reply.status, method).toBe(400);
      expect(errorOf(reply).code, method).toBe(-32600);
    }
  });

  it('Session Management §3: a session id the server does not know answers 404 Session not found on POST, GET and DELETE', async () => {
    const posted = await request(server!.port, { sessionId: 'no-such-session', body: TOOLS_LIST });
    expect(posted.status).toBe(404);
    expect(errorOf(posted)).toEqual({ code: -32001, message: 'Session not found' });
    for (const method of ['GET', 'DELETE']) {
      const reply = await request(server!.port, { method, sessionId: 'no-such-session' });
      expect(reply.status, method).toBe(404);
    }
  });

  it('Session Management §3/§5: after the client DELETEs its session, that id answers 404', async () => {
    const sessionId = await initialize(server!.port);
    const deleted = await request(server!.port, { method: 'DELETE', sessionId });
    expect(deleted.status, deleted.body).toBe(200);
    expect((await health(server!.port)).sessions).not.toContain(sessionId);

    const afterwards = await request(server!.port, { sessionId, body: TOOLS_LIST });
    expect(afterwards.status, afterwards.body).toBe(404);
    expect(errorOf(afterwards).code).toBe(-32001);
  });

  it('Protocol Version Header: an unsupported MCP-Protocol-Version on a request in a live session answers 400', async () => {
    const sessionId = await initialize(server!.port);
    opened.push(sessionId);
    const reply = await request(server!.port, { sessionId, body: TOOLS_LIST, headers: { 'MCP-Protocol-Version': '1999-01-01' } });
    expect(reply.status, reply.body).toBe(400);
  });

  it('Security Warning §1: an invalid Origin answers 403 with a JSON-RPC error body', async () => {
    const reply = await request(server!.port, { body: INITIALIZE, headers: { Origin: 'https://evil.example' } });
    expect(reply.status).toBe(403);
    expect(errorOf(reply).message).toContain('Invalid Origin');
    expect(reply.headers['mcp-session-id']).toBeUndefined();
  });
});

describe('Streamable HTTP contract: a session the server ended on its own', () => {
  let server: RunningServer | undefined;

  afterAll(async () => {
    await stopServer(server);
  });

  it('Session Management §3: after the stale-session sweep reaps an idle session, its id answers 404', async () => {
    // A pure-POST session (no GET stream) falls under the stale window; make it short.
    server = await startServer({ MCP_HTTP_STALE_SESSION_MS: '1500', MCP_HTTP_STALE_SWEEP_INTERVAL_MS: '500' });
    const sessionId = await initialize(server.port);

    // /health reads the map without touching the session's idle clock; a request carrying
    // the id would refresh it and keep the session alive.
    const deadline = Date.now() + 15_000;
    while ((await health(server.port)).sessions.includes(sessionId)) {
      expect(Date.now(), `session ${sessionId} was never reaped; server output:\n${server.output()}`).toBeLessThan(deadline);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const afterwards = await request(server.port, { sessionId, body: TOOLS_LIST });
    expect(afterwards.status, afterwards.body).toBe(404);
    expect(errorOf(afterwards)).toEqual({ code: -32001, message: 'Session not found' });
  }, 40_000);
});
