/**
 * Issue #671: the deprecated SSE app's Host/Origin allowlist, exercised
 * through a real Express app on a real socket (no mocks) — the same control
 * the Streamable HTTP app got in #667/#677. Only /health is driven, so the
 * server factory is never invoked.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { createSSEApp } from '../../../src/cli/sse-command.js';
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
  Object.assign(proc.env, env);
  const app = createSSEApp(
    { port: '0', ...options },
    { logger: createMockLogger() as unknown as WinstonLogger, serverFactory: vi.fn().mockReturnValue({ server: {} }), proc }
  );
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  return (server.address() as AddressInfo).port;
}

function request(
  port: number,
  opts: { path?: string; method?: string; host?: string; origin?: string } = {}
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (opts.host !== undefined) headers.Host = opts.host;
    if (opts.origin !== undefined) headers.Origin = opts.origin;
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
    req.end();
  });
}

describe('SSE Host allowlist (issue #671)', () => {
  it('answers a foreign Host with a JSON-RPC 403 that names the host and both opt-in paths', async () => {
    const port = await listen();
    const reply = await request(port, { host: 'evil.example' });
    expect(reply.status).toBe(403);
    const parsed = JSON.parse(reply.body);
    expect(parsed.error.code).toBe(-32000);
    expect(parsed.error.message).toContain('Invalid Host: evil.example');
    expect(parsed.error.message).toContain('--allowed-host evil.example');
    expect(parsed.error.message).toContain('MCP_HTTP_ALLOWED_HOSTS=evil.example');
  });

  it('admits loopback Hosts with or without a port by default', async () => {
    const port = await listen();
    for (const host of ['localhost', `localhost:${port}`, `127.0.0.1:${port}`, '[::1]:3001']) {
      const reply = await request(port, { host });
      expect(reply.status, host).toBe(200);
      expect(JSON.parse(reply.body).mode).toBe('sse');
    }
  });

  it('admits a Host added with the allowedHost option', async () => {
    const port = await listen({ allowedHost: ['mcp-debugger'] });
    expect((await request(port, { host: 'mcp-debugger:3001' })).status).toBe(200);
    expect((await request(port, { host: 'other.example' })).status).toBe(403);
  });

  it('admits Hosts listed in MCP_HTTP_ALLOWED_HOSTS', async () => {
    const port = await listen({}, { MCP_HTTP_ALLOWED_HOSTS: 'a.example, b.example' });
    expect((await request(port, { host: 'a.example' })).status).toBe(200);
    expect((await request(port, { host: 'B.example:8443' })).status).toBe(200);
    expect((await request(port, { host: 'c.example' })).status).toBe(403);
  });

  it('refuses a browser request from a foreign Origin even with a loopback Host (issue #677 parity)', async () => {
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
      expect(reply.headers['vary']).toContain('Origin');
    }
  });

  it('guards the SSE endpoints, not just /health', async () => {
    const port = await listen();
    expect((await request(port, { path: '/sse', host: 'evil.example' })).status).toBe(403);
    expect((await request(port, { path: '/sse?sessionId=x', method: 'POST', host: 'evil.example' })).status).toBe(403);
  });
});
