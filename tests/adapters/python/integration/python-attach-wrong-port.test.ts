/**
 * A Python attach to a port that is not a debugpy listener, against a real
 * server (issue #1139).
 *
 * A Python attach starts nothing: the server connects straight to the host
 * and port it was given. The issue's example is the application's own HTTP
 * port given instead of the debugger's; an HTTP server answers a DAP frame by
 * hanging up, and the attach used to answer
 * "Critical initialization error: DAP client disconnected
 * [Executable: python | adapter PID=none exitCode=n/a]" — an executable and
 * an adapter process that never existed, and no word about the port.
 *
 * The listener here hangs up on the first bytes it receives, which is that
 * path and answers within a second. The other path — a listener that stays
 * silent — waits out the 30 s initialization deadline before it answers, so
 * its wording is covered at the unit level (error-messages, proxy-manager)
 * and was checked by hand against this server. So is a port where nothing
 * listens at all (the worker's own tests): it spends the 12.5 s connect
 * window before it answers.
 */
import { afterEach, describe, expect, it } from 'vitest';
import net from 'node:net';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';

type AttachAnswer = ToolAnswer & { data?: { initProgress?: unknown; proxyLogPath?: string } };

/** A TCP listener that hangs up as soon as a client says anything: what an HTTP server does with a DAP frame. */
async function hangUpListener(): Promise<{ port: number; received: () => number; close: () => Promise<void> }> {
  let bytes = 0;
  const sockets = new Set<net.Socket>();
  const listener = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('data', (chunk) => {
      bytes += chunk.length;
      socket.destroy();
    });
    socket.on('error', () => undefined);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve));
  return {
    port: (listener.address() as net.AddressInfo).port,
    received: () => bytes,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => listener.close(() => resolve()));
    }
  };
}

describe('A Python attach to a port that is not a debug server (issue #1139)', () => {
  let server: StdioClientHandle | undefined;
  let target: Awaited<ReturnType<typeof hangUpListener>> | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
    await target?.close();
    target = undefined;
  });

  it('names the endpoint and says nothing was started, instead of describing an adapter process', async () => {
    target = await hangUpListener();
    server = await startStdioClient({ name: 'attach-wrong-port' });
    await server.createSession('python', 'attach-wrong-port');

    const answer = await server.call<AttachAnswer>('attach_to_process', { port: target.port });

    expect(answer.success, JSON.stringify(answer)).toBe(false);
    // The endpoint did receive the DAP frame, and hung up on it.
    expect(target.received()).toBeGreaterThan(0);
    expect(answer.message).toBe(
      `Failed to attach: Critical initialization error: 127.0.0.1:${target.port} never answered the DAP "initialize" request ` +
      '(DAP client disconnected). Nothing was started for this attach: the server connected to what is already ' +
      `listening on that port, so check that it is a debugpy listener (python -m debugpy --listen 127.0.0.1:${target.port} …) ` +
      'and not another service.'
    );
    // The pointers a failed attach always carries are still there.
    expect(answer.data?.proxyLogPath, JSON.stringify(answer)).toEqual(expect.any(String));
  }, 60_000);
});
