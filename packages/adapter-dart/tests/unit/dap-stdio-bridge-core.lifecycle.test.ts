/**
 * Bridge lifecycle edges (issue #790 review): bytes that arrive after the adapter has gone, and a
 * child stdin that errors. The Flutter adapter exits by itself right after `terminate`/`disconnect`
 * (measured), and the proxy's follow-up request still arrives on the socket.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter, once } from 'node:events';
import net from 'node:net';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import { createBridge, type BridgeHandle } from '../../src/bridge/dap-stdio-bridge-core.js';

function fakeChild() {
  return Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    pid: 4242,
    exitCode: null as number | null,
    killed: false,
    kill: vi.fn(() => true),
  });
}

let bridge: BridgeHandle | undefined;
afterEach(async () => {
  await bridge?.close();
  bridge = undefined;
});

async function connect(handle: BridgeHandle): Promise<net.Socket> {
  const socket = net.connect({ host: '127.0.0.1', port: handle.port });
  await once(socket, 'connect');
  return socket;
}

describe('createBridge after the adapter is gone', () => {
  it('stops forwarding socket bytes once the child closed, and survives a late request', async () => {
    const child = fakeChild();
    const stderr = new PassThrough();
    bridge = await createBridge({ port: 0, host: '127.0.0.1', command: 'dart', args: [], spawnFn: () => child as unknown as ChildProcess, stderr });
    const socket = await connect(bridge);
    await vi.waitFor(() => expect(child.stdin.listenerCount('error')).toBeGreaterThan(0));
    const toChild: Buffer[] = [];
    child.stdin.on('data', (d: Buffer) => toChild.push(d));
    socket.write('before');
    await vi.waitFor(() => expect(Buffer.concat(toChild).toString()).toBe('before'));

    child.exitCode = 0;
    child.emit('close', 0, null);
    // The socket's read side is still open to the proxy; a `disconnect` arrives now.
    socket.write('after');
    await new Promise((r) => setTimeout(r, 50));
    expect(Buffer.concat(toChild).toString()).toBe('before');
    await expect(bridge.done).resolves.toBe(0);
  });

  it('logs a child stdin error instead of dying on it', async () => {
    const child = fakeChild();
    const stderr = new PassThrough();
    const logged: string[] = [];
    stderr.on('data', (d: Buffer) => logged.push(d.toString()));
    bridge = await createBridge({ port: 0, host: '127.0.0.1', command: 'dart', args: [], spawnFn: () => child as unknown as ChildProcess, stderr });
    await connect(bridge);
    await vi.waitFor(() => expect(child.stdin.listenerCount('error')).toBeGreaterThan(0));
    child.stdin.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));
    await vi.waitFor(() => expect(logged.join('')).toMatch(/EPIPE/));
    expect(bridge.listening).toBe(true);
  });
});
