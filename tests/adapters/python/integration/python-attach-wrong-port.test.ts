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
 * path and answers within a second. A second listener resets the connection
 * instead (what a forwarder with nothing behind it does): the reset reaches
 * the worker as a socket error before the request fails, and that first
 * report used to be the bare "DAP client error: read ECONNRESET". The other
 * path — a listener that stays
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

/**
 * A TCP listener that drops the client as soon as it says anything. `hangUp`
 * closes the socket, which is what an HTTP server does with a DAP frame;
 * `reset` aborts it (RST), which is what a forwarder with nothing behind it
 * does.
 */
async function droppingListener(how: 'hangUp' | 'reset'): Promise<{ port: number; received: () => number; close: () => Promise<void> }> {
  let bytes = 0;
  const sockets = new Set<net.Socket>();
  const listener = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('data', (chunk) => {
      bytes += chunk.length;
      if (how === 'reset') {
        socket.resetAndDestroy();
      } else {
        socket.destroy();
      }
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

/**
 * A listener that speaks just enough DAP to answer `initialize`, and hangs up
 * on the request after it: a debug server (or a forwarder to one) that goes
 * away mid-handshake.
 */
async function answersInitializeThenHangsUp(): Promise<{ port: number; received: () => number; close: () => Promise<void> }> {
  let requests = 0;
  const sockets = new Set<net.Socket>();
  const listener = net.createServer((socket) => {
    sockets.add(socket);
    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        const length = headerEnd === -1 ? null : /Content-Length: (\d+)/i.exec(buffer.subarray(0, headerEnd).toString('utf8'));
        if (headerEnd === -1 || !length || buffer.length < headerEnd + 4 + Number(length[1])) return;
        const request = JSON.parse(buffer.subarray(headerEnd + 4, headerEnd + 4 + Number(length[1])).toString('utf8'));
        buffer = buffer.subarray(headerEnd + 4 + Number(length[1]));
        requests++;
        if (request.command !== 'initialize') {
          socket.destroy();
          return;
        }
        const body = Buffer.from(JSON.stringify({
          seq: 1, type: 'response', request_seq: request.seq, command: 'initialize', success: true,
          body: { supportsConfigurationDoneRequest: true }
        }), 'utf8');
        socket.write(`Content-Length: ${body.length}\r\n\r\n`);
        socket.write(body);
      }
    });
    socket.on('error', () => undefined);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve));
  return {
    port: (listener.address() as net.AddressInfo).port,
    received: () => requests,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => listener.close(() => resolve()));
    }
  };
}

describe('A Python attach to a port that is not a debug server (issue #1139)', () => {
  let server: StdioClientHandle | undefined;
  let target: Awaited<ReturnType<typeof droppingListener>> | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
    await target?.close();
    target = undefined;
  });

  it('names the endpoint and says nothing was started, instead of describing an adapter process', async () => {
    target = await droppingListener('hangUp');
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

  it('says the same of an endpoint that resets the connection', async () => {
    target = await droppingListener('reset');
    server = await startStdioClient({ name: 'attach-reset-port' });
    await server.createSession('python', 'attach-reset-port');

    const answer = await server.call<AttachAnswer>('attach_to_process', { port: target.port });

    expect(answer.success, JSON.stringify(answer)).toBe(false);
    expect(target.received()).toBeGreaterThan(0);
    // The reason in parentheses is the socket's own (ECONNRESET, or a plain
    // disconnect where the platform reports the reset as a close), so it is
    // not pinned; everything the caller acts on is.
    expect(answer.message, JSON.stringify(answer)).toMatch(
      new RegExp(
        `^Failed to attach: Critical initialization error: 127\\.0\\.0\\.1:${target.port} never answered the DAP "initialize" request \\(.+\\)\\. ` +
        'Nothing was started for this attach: the server connected to what is already listening on that port, ' +
        'so check that it is a debugpy listener .+ and not another service\\.$'
      )
    );
    expect(answer.message).not.toContain('DAP client error');
  }, 60_000);

  it('names the endpoint when a debug server answers initialize and then hangs up, without doubting what it is', async () => {
    // The close reaches the worker before the pending attach request fails,
    // and the worker's connection-closed status used to reach the parent
    // first: "Proxy exited during initialization. Code: null, Signal:
    // undefined", followed by lines of worker stderr.
    target = await answersInitializeThenHangsUp();
    server = await startStdioClient({ name: 'attach-dropped-port' });
    await server.createSession('python', 'attach-dropped-port');

    const answer = await server.call<AttachAnswer>('attach_to_process', { port: target.port });

    expect(answer.success, JSON.stringify(answer)).toBe(false);
    // initialize, then the attach it hung up on.
    expect(target.received()).toBe(2);
    expect(answer.message, JSON.stringify(answer)).toBe(
      'Failed to attach: Critical initialization error: DAP client disconnected ' +
      `[direct connect to 127.0.0.1:${target.port}; no adapter process was started]`
    );
  }, 60_000);
});
