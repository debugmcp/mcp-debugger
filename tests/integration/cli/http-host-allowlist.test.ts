/**
 * Issue #667: the Streamable HTTP app's Host allowlist, exercised through a
 * real Express app on a real socket (no mocks). Only /health is driven, so the
 * server factory is never invoked.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { createHttpApp } from '../../../src/cli/http-command.js';
import { FakeCurrentProcess } from '../../test-utils/mocks/fake-current-process.js';
import type { Logger as WinstonLogger } from 'winston';
import { createMockLogger } from '../../test-utils/mocks/mock-logger.js';

interface Reply {
  status: number;
  body: string;
  headers: http.IncomingHttpHeaders;
}

const servers: http.Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))
  );
});

async function listen(options: { allowedHost?: string[] } = {}, env: Record<string, string> = {}): Promise<number> {
  const proc = new FakeCurrentProcess();
  // Disable the session reapers so no interval outlives the test.
  Object.assign(proc.env, { MCP_HTTP_STALE_SESSION_MS: '0', MCP_HTTP_STREAM_LOST_SESSION_MS: '0' }, env);
  const app = createHttpApp(
    { port: '0', ...options },
    { logger: createMockLogger() as unknown as WinstonLogger, serverFactory: vi.fn(), proc }
  );
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  return (server.address() as AddressInfo).port;
}

function request(
  port: number,
  opts: { path?: string; method?: string; host?: string; origin?: string; body?: string; encoding?: string } = {}
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (opts.host !== undefined) headers.Host = opts.host;
    if (opts.origin !== undefined) headers.Origin = opts.origin;
    if (opts.encoding !== undefined) headers['Content-Encoding'] = opts.encoding;
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(opts.body));
    }
    const req = http.request(
      { host: '127.0.0.1', port, path: opts.path ?? '/health', method: opts.method ?? 'GET', headers },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
      }
    );
    req.on('error', reject);
    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}

describe('HTTP Host allowlist (issue #667)', () => {
  it('answers a foreign Host with a JSON-RPC 403 that names the host and both opt-in paths', async () => {
    const port = await listen();
    const reply = await request(port, { host: 'mcp-debugger:3000' });
    expect(reply.status).toBe(403);
    const parsed = JSON.parse(reply.body);
    expect(parsed.error.code).toBe(-32000);
    expect(parsed.error.message).toContain('Invalid Host: mcp-debugger');
    expect(parsed.error.message).toContain('--allowed-host mcp-debugger');
    expect(parsed.error.message).toContain('MCP_HTTP_ALLOWED_HOSTS=mcp-debugger');
  });

  it('admits loopback Hosts with or without a port by default', async () => {
    const port = await listen();
    for (const host of ['localhost', `localhost:${port}`, `127.0.0.1:${port}`, '[::1]:3001']) {
      const reply = await request(port, { host });
      expect(reply.status, host).toBe(200);
      expect(JSON.parse(reply.body).status).toBe('ok');
    }
  });

  it('admits a Host added with the allowedHost option', async () => {
    const port = await listen({ allowedHost: ['mcp-debugger'] });
    expect((await request(port, { host: 'mcp-debugger:3000' })).status).toBe(200);
    expect((await request(port, { host: 'other.example' })).status).toBe(403);
  });

  it('admits Hosts listed in MCP_HTTP_ALLOWED_HOSTS', async () => {
    const port = await listen({}, { MCP_HTTP_ALLOWED_HOSTS: 'a.example, b.example' });
    expect((await request(port, { host: 'a.example' })).status).toBe(200);
    expect((await request(port, { host: 'B.example:8443' })).status).toBe(200);
    expect((await request(port, { host: 'c.example' })).status).toBe(403);
  });

  it('accepts a JSON body larger than 100 KB on /mcp (the 10 MB limit is live, issue #670)', async () => {
    const port = await listen();
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: { pad: 'a'.repeat(200_000) } });
    const reply = await request(port, { path: '/mcp', method: 'POST', body });
    // Not an initialize request and no session: the handler's own 400, which
    // proves the body was parsed rather than refused by a 100 KB parser.
    expect(reply.status).toBe(400);
    expect(JSON.parse(reply.body).error.code).toBe(-32600);
  });

  it('answers a body over 10 MB with a JSON-RPC 413, not an HTML page (issue #670)', async () => {
    const port = await listen();
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: { pad: 'a'.repeat(10_600_000) } });
    const reply = await request(port, { path: '/mcp', method: 'POST', body });
    expect(reply.status).toBe(413);
    const parsed = JSON.parse(reply.body);
    expect(parsed.jsonrpc).toBe('2.0');
    expect(parsed.id).toBeNull();
    expect(parsed.error.code).toBe(-32600);
    expect(parsed.error.message).toContain('10mb');
  });

  it('answers a corrupt compressed body with a JSON-RPC error, not an HTML page (issue #670)', async () => {
    const port = await listen();
    const reply = await request(port, { path: '/mcp', method: 'POST', body: 'not-compressed', encoding: 'gzip' });
    expect(reply.status).toBe(400);
    expect(reply.headers['content-type']).toContain('application/json');
    expect(JSON.parse(reply.body).error.code).toBe(-32600);
  });

  it('refuses a browser request from a foreign Origin even with a loopback Host (issue #677)', async () => {
    const port = await listen();
    const reply = await request(port, { origin: 'https://evil.example' });
    expect(reply.status).toBe(403);
    expect(JSON.parse(reply.body).error.message).toContain('Invalid Origin: https://evil.example');
  });

  it('admits a browser request from an allowlisted Origin and echoes exactly that origin in CORS', async () => {
    const port = await listen({ allowedHost: ['app.internal'] });
    for (const origin of ['http://localhost:6274', 'https://app.internal']) {
      const reply = await request(port, { origin });
      expect(reply.status, origin).toBe(200);
      expect(reply.headers['access-control-allow-origin'], origin).toBe(origin);
    }
  });

  it('answers malformed JSON with a JSON-RPC parse error, not an HTML page (issue #670)', async () => {
    const port = await listen();
    const reply = await request(port, { path: '/mcp', method: 'POST', body: '{"jsonrpc":"2.0",' });
    expect(reply.status).toBe(400);
    const parsed = JSON.parse(reply.body);
    expect(parsed.error.code).toBe(-32700);
    expect(parsed.id).toBeNull();
  });
});
