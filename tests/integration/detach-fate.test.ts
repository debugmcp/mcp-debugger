/**
 * Issue #1148: what became of an attached process is observed, not assumed.
 *
 * A real server and a real worker, against a scripted DAP listener that
 * stands in for the debug server a Python attach connects to (no adapter is
 * spawned for a direct connection, so the listener is everything the worker
 * talks to). It answers every request and reports one thread; a row can tell
 * it to stay silent on `disconnect`, or to reply the way debugpy does, with a
 * `terminated` event and no response.
 *
 * Before: a detach the server never acknowledged answered "Detached from
 * process (process still running)" after 30 s, and a close answered
 * `released: true` whatever the server did.
 */
import { describe, it, expect, afterEach } from 'vitest';
import net from 'node:net';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../test-utils/helpers/mcp-stdio-client.js';

type DisconnectReply = 'response' | 'terminated' | 'silence';
interface ScriptedDebugServer { port: number; seen: () => string[]; close: () => Promise<void> }
interface Ended extends ToolAnswer { released?: boolean; processEnded?: boolean; warning?: string }

async function scriptedDebugServer(onDisconnect: DisconnectReply): Promise<ScriptedDebugServer> {
  const seen: string[] = [];
  const sockets = new Set<net.Socket>();
  const listener = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => undefined);
    socket.on('close', () => sockets.delete(socket));
    let buffer = Buffer.alloc(0);
    let seq = 1;
    const send = (message: Record<string, unknown>) => {
      const body = Buffer.from(JSON.stringify({ seq: seq++, ...message }), 'utf8');
      socket.write(`Content-Length: ${body.length}\r\n\r\n`);
      socket.write(body);
    };
    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        const length = headerEnd === -1 ? null : /Content-Length: (\d+)/i.exec(buffer.subarray(0, headerEnd).toString('utf8'));
        if (headerEnd === -1 || !length || buffer.length < headerEnd + 4 + Number(length[1])) return;
        const request = JSON.parse(buffer.subarray(headerEnd + 4, headerEnd + 4 + Number(length[1])).toString('utf8'));
        buffer = buffer.subarray(headerEnd + 4 + Number(length[1]));
        if (request.type !== 'request') continue;
        seen.push(request.command);
        if (request.command === 'disconnect' && onDisconnect !== 'response') {
          if (onDisconnect === 'terminated') send({ type: 'event', event: 'terminated' });
          continue;
        }
        const body =
          request.command === 'initialize' ? { supportsConfigurationDoneRequest: true }
            : request.command === 'threads' ? { threads: [{ id: 1, name: 'MainThread' }] }
              : request.command === 'setBreakpoints'
                ? { breakpoints: (request.arguments?.breakpoints ?? []).map(() => ({ verified: true })) }
                : {};
        if (request.command === 'attach') send({ type: 'event', event: 'initialized' });
        send({ type: 'response', request_seq: request.seq, command: request.command, success: true, body });
      }
    });
  });
  await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve));
  return {
    port: (listener.address() as net.AddressInfo).port,
    seen: () => seen,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => listener.close(() => resolve()));
    }
  };
}

describe('the fate of an attached process, as the debug server answered for it (issue #1148)', () => {
  let server: StdioClientHandle | undefined;
  let target: ScriptedDebugServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
    await target?.close();
    target = undefined;
  }, 30_000);

  async function attached(name: string, onDisconnect: DisconnectReply): Promise<void> {
    target = await scriptedDebugServer(onDisconnect);
    server = await startStdioClient({ name, callTimeoutMs: 60_000 });
    await server.createSession('python', name);
    const answer = await server.call('attach_to_process', { host: '127.0.0.1', port: target.port, stopOnEntry: false });
    expect(answer.success, JSON.stringify(answer)).toBe(true);
  }

  it.each([
    ['answers the request', 'response'],
    ['sends terminated in reply and no response, as debugpy does', 'terminated']
  ] as const)('detach says released when the debug server %s', async (_what, reply) => {
    await attached(`detach-fate-${reply}`, reply);

    const detached = await server!.call<Ended>('detach_from_process');

    expect(detached.success, JSON.stringify(detached)).toBe(true);
    expect(detached.released, JSON.stringify(detached)).toBe(true);
    expect(detached.warning).toBeUndefined();
    expect(detached.message).toBe('Detached from process: the debug adapter confirmed the detach, and the process was left running');
    expect(target!.seen()).toContain('disconnect');
  }, 60_000);

  it('detach does not say released when the debug server never acknowledges it, and answers inside its bound', async () => {
    await attached('detach-fate-silence', 'silence');

    const startedAt = Date.now();
    const detached = await server!.call<Ended>('detach_from_process');
    const elapsed = Date.now() - startedAt;

    expect(detached.success, JSON.stringify(detached)).toBe(true);
    expect(detached.state).toBe('stopped');
    expect(detached.released, JSON.stringify(detached)).toBeUndefined();
    expect(detached.processEnded).toBeUndefined();
    expect(detached.message, JSON.stringify(detached)).toMatch(/^Detached, but the debug adapter did not confirm it \(.*timed out.*\)\./);
    expect(detached.message).toContain('whether the process is still running is not known');
    expect(detached.warning).toBe(detached.message);
    // The 10 s bound, not the 30 s request timeout it used to wait out.
    expect(elapsed).toBeGreaterThan(8_000);
    expect(elapsed).toBeLessThan(20_000);
  }, 60_000);

  it.each([
    ['answers the request', 'response'],
    ['sends terminated in reply and no response', 'terminated']
  ] as const)('close says released when the debug server %s', async (_what, reply) => {
    await attached(`close-fate-${reply}`, reply);

    const closed = await server!.call<Ended>('close_debug_session');

    expect(closed.success, JSON.stringify(closed)).toBe(true);
    expect(closed.released, JSON.stringify(closed)).toBe(true);
    expect(closed.warning).toBeUndefined();
  }, 60_000);

  it('close does not say released when the debug server never acknowledges the detach', async () => {
    await attached('close-fate-silence', 'silence');

    const closed = await server!.call<Ended>('close_debug_session');

    expect(closed.success, JSON.stringify(closed)).toBe(true);
    expect(closed.released, JSON.stringify(closed)).toBeUndefined();
    expect(closed.warning, JSON.stringify(closed)).toMatch(
      /^The debug adapter did not confirm that it released the process \(.*\); whether the process is still running is not known$/
    );
  }, 60_000);
});
