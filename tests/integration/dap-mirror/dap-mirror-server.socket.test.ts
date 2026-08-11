/**
 * Live-socket check of DapMirrorServer's production defaults (issue #217):
 * real net.createServer listener on 127.0.0.1:0, real TCP client, full
 * handshake plus one forwarded request against a stubbed host. The full
 * protocol matrix lives in the hermetic unit suite
 * (tests/proxy/dap-mirror-server.test.ts); this file only proves the
 * default net wiring works end to end.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import net from 'net';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { DapMirrorServer, type IDapMirrorServer } from '../../../src/proxy/dap-mirror-server.js';
import { TcpDapClient } from '../../test-utils/helpers/dap-test-client.js';

const silentLogger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() };

describe('DapMirrorServer over real sockets', () => {
  let mirror: IDapMirrorServer | undefined;
  const clients: TcpDapClient[] = [];

  afterEach(async () => {
    clients.splice(0).forEach((c) => c.close());
    await mirror?.stop();
    mirror = undefined;
  });

  it('serves the full handshake and forwards a read request over TCP', async () => {
    const forwardRequest = vi.fn(async (command: string) => ({
      seq: 1,
      type: 'response' as const,
      request_seq: 0,
      command,
      success: true,
      body: { threads: [{ id: 1, name: 'main' }] }
    }));
    mirror = new DapMirrorServer(
      {
        forwardRequest,
        getCapabilities: () => ({ supportsEvaluateForHovers: true }),
        getLastStop: () => ({ reason: 'breakpoint', threadId: 1, allThreadsStopped: true })
      },
      { logger: silentLogger }
    );

    const endpoint = await mirror.start();
    expect(endpoint.host).toBe('127.0.0.1');
    expect(endpoint.port).toBeGreaterThan(0);
    expect(endpoint.token.length).toBeGreaterThanOrEqual(32);

    const client = new TcpDapClient();
    clients.push(client);
    await client.connect(endpoint.port);

    const init = await client.request('initialize', { adapterID: 'mock' });
    expect(init.success).toBe(true);
    expect((init.body as DebugProtocol.Capabilities).supportsEvaluateForHovers).toBe(true);
    await client.waitForEvent('initialized');

    const attach = await client.request('attach', { mirrorToken: endpoint.token });
    expect(attach.success).toBe(true);
    await client.request('configurationDone');

    // Late-join stop replay for the already-paused session.
    const stopped = await client.waitForEvent('stopped');
    expect(stopped.body).toMatchObject({ reason: 'breakpoint', threadId: 1 });

    const threads = await client.request('threads');
    expect(threads.success).toBe(true);
    expect(forwardRequest).toHaveBeenCalledWith('threads', undefined);
    expect((threads.body as { threads: unknown[] }).threads).toHaveLength(1);

    // Control stays rejected over the wire too.
    const cont = await client.request('continue', { threadId: 1 });
    expect(cont.success).toBe(false);
    expect(cont.message).toContain('read-only');
  });

  it('refuses connections after stop()', async () => {
    mirror = new DapMirrorServer(
      { forwardRequest: vi.fn(), getCapabilities: () => undefined, getLastStop: () => undefined },
      { logger: silentLogger }
    );
    const endpoint = await mirror.start();
    await mirror.stop();

    await expect(
      new Promise((resolve, reject) => {
        const socket = net.connect({ port: endpoint.port, host: '127.0.0.1' }, () => {
          socket.destroy();
          resolve(undefined);
        });
        socket.on('error', reject);
      })
    ).rejects.toMatchObject({ code: 'ECONNREFUSED' });
  });
});
