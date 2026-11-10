/**
 * The dev proxy's stdio transport to its backend (issue #1025, step 2).
 *
 * It is a subclass of the SDK's transport so that `auto` negotiation probes on
 * the backend's own pipe instead of on a second backend process. That has a
 * cost the SDK does not cover: under `auto` negotiation the SDK does not watch
 * the signal given to connect() while its probe is unanswered (measured, client
 * 2.4.0: `legacy` rejects the connect and closes the transport on an abort,
 * `auto` leaves the connect pending and the child running, sibling path and
 * in place alike). So a start that is still negotiating when the proxy shuts
 * down hangs, and the backend it spawned outlives the proxy — CI caught it on
 * Linux in the rebuild suite's shutdown cases. The transport therefore closes
 * itself on the proxy's shutdown signal, as the SDK does by itself in
 * `legacy` mode.
 */
import { getEventListeners } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { BackendStdioTransport } from '../../../tools/dev-proxy/backend-stdio-transport.mjs';

// A backend that never answers: what a shutdown finds while a start is still negotiating.
const SILENT = { command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'] };

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('dev-proxy backend stdio transport', () => {
  const pids: number[] = [];
  const transports: BackendStdioTransport[] = [];

  afterEach(async () => {
    for (const transport of transports.splice(0)) await transport.close().catch(() => undefined);
    for (const pid of pids.splice(0)) {
      try { process.kill(pid); } catch { /* already gone */ }
    }
  });

  function negotiating(signal: AbortSignal) {
    const transport = new BackendStdioTransport(SILENT, { signal });
    transports.push(transport);
    const client = new Client({ name: 'backend-transport-test', version: '0.0.0' }, { versionNegotiation: { mode: 'auto' } });
    const connecting = client.connect(transport, { signal }).then(() => 'connected' as const, () => 'rejected' as const);
    const pid = transport.pid!;
    pids.push(pid);
    return { transport, connecting, pid };
  }

  it('is a subclass of the SDK transport: that is what makes the negotiation probe in place', () => {
    const transport = new BackendStdioTransport(SILENT);

    expect(transport).toBeInstanceOf(StdioClientTransport);
    expect(Object.getPrototypeOf(transport)).not.toBe(StdioClientTransport.prototype);
  });

  it('ends a start that is still negotiating when the proxy shuts down: the connect settles and the backend is gone', async () => {
    const shutdown = new AbortController();
    const { connecting, pid } = negotiating(shutdown.signal);
    expect(isAlive(pid)).toBe(true);

    shutdown.abort();

    // Without the transport's own close the SDK leaves this pending past the abort.
    expect(await Promise.race([connecting, delay(4000).then(() => 'still pending' as const)])).toBe('rejected');
    await expect.poll(() => isAlive(pid), { timeout: 8000 }).toBe(false);
  }, 20_000);

  it('lets go of the shutdown signal once it is closed, so restarts do not pile listeners onto it', async () => {
    const shutdown = new AbortController();
    const { transport } = negotiating(shutdown.signal);
    expect(getEventListeners(shutdown.signal, 'abort').length).toBeGreaterThan(0);
    const before = getEventListeners(shutdown.signal, 'abort').length;

    await transport.close();

    expect(getEventListeners(shutdown.signal, 'abort').length).toBe(before - 1);
  }, 20_000);

  it('lets go of the signal when its owner says the backend has gone by itself', () => {
    const shutdown = new AbortController();
    const transport = new BackendStdioTransport(SILENT, { signal: shutdown.signal });
    expect(getEventListeners(shutdown.signal, 'abort')).toHaveLength(1);

    transport.detachFromSignal();
    transport.detachFromSignal();

    expect(getEventListeners(shutdown.signal, 'abort')).toHaveLength(0);
  });
});
