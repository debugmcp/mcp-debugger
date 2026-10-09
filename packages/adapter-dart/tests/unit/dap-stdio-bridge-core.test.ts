/**
 * TCP ↔ stdio bridge for stdio-only DAP servers (`dart debug_adapter`, `flutter debug-adapter`).
 *
 * The proxy connects over TCP; the bridge spawns the child on the first connection and pipes
 * bytes both ways untouched. Lessons carried from the netcoredbg bridge: end the socket on the
 * child's `close` (not `exit`, which can precede the last stdout chunk), honour the bind host,
 * and exit non-zero when the child cannot be spawned.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter, once } from 'node:events';
import net from 'node:net';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import { createBridge, parseBridgeArgs, type BridgeHandle, type BridgeOptions } from '../../src/bridge/dap-stdio-bridge-core.js';

type SpawnFn = NonNullable<BridgeOptions['spawnFn']>;

function fakeChild() {
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    pid: 4242,
    exitCode: null as number | null,
    killed: false,
    kill: vi.fn(() => true),
  });
  return child;
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

describe('parseBridgeArgs', () => {
  it('reads --port/--host/--cwd and everything after -- as the child command', () => {
    const a = parseBridgeArgs(['--port', '4711', '--host', '127.0.0.1', '--cwd', 'C:\\proj', '--', 'C:\\dart\\bin\\dart.exe', 'debug_adapter', '--test']);
    expect(a).toEqual({ port: 4711, host: '127.0.0.1', cwd: 'C:\\proj', command: 'C:\\dart\\bin\\dart.exe', args: ['debug_adapter', '--test'] });
  });

  it('rejects a missing port or missing child command', () => {
    expect(() => parseBridgeArgs(['--', 'dart'])).toThrow(/--port/);
    expect(() => parseBridgeArgs(['--port', '1'])).toThrow(/--/);
  });
});

describe('createBridge', () => {
  it('listens before any child is spawned, and spawns the child only on the first connection', async () => {
    const child = fakeChild();
    const spawnFn = vi.fn<SpawnFn>(() => child as unknown as ChildProcess);
    bridge = await createBridge({ port: 0, host: '127.0.0.1', command: 'dart', args: ['debug_adapter'], cwd: 'C:\\proj', spawnFn, stderr: new PassThrough() });
    expect(bridge.port).toBeGreaterThan(0);
    expect(spawnFn).not.toHaveBeenCalled();
    const socket = await connect(bridge);
    await vi.waitFor(() => expect(spawnFn).toHaveBeenCalledOnce());
    expect(spawnFn).toHaveBeenCalledWith('dart', ['debug_adapter'], expect.objectContaining({ cwd: 'C:\\proj', stdio: ['pipe', 'pipe', 'pipe'] }));
    socket.destroy();
  });

  it('pipes socket bytes to the child stdin and child stdout bytes back, untouched', async () => {
    const child = fakeChild();
    bridge = await createBridge({ port: 0, host: '127.0.0.1', command: 'dart', args: [], spawnFn: () => child as unknown as ChildProcess, stderr: new PassThrough() });
    const socket = await connect(bridge);
    const toChild: Buffer[] = [];
    child.stdin.on('data', (d: Buffer) => toChild.push(d));
    const req = 'Content-Length: 2\r\n\r\n{}';
    socket.write(req);
    await vi.waitFor(() => expect(Buffer.concat(toChild).toString()).toBe(req));
    const fromChild: Buffer[] = [];
    socket.on('data', (d: Buffer) => fromChild.push(d));
    child.stdout.write('Content-Length: 15\r\n\r\n{"seq":1,"a":2}');
    await vi.waitFor(() => expect(Buffer.concat(fromChild).toString()).toBe('Content-Length: 15\r\n\r\n{"seq":1,"a":2}'));
    socket.destroy();
  });

  it('keeps the socket open across child exit until the child streams close, then ends it', async () => {
    const child = fakeChild();
    bridge = await createBridge({ port: 0, host: '127.0.0.1', command: 'dart', args: [], spawnFn: () => child as unknown as ChildProcess, stderr: new PassThrough() });
    const socket = await connect(bridge);
    const got: Buffer[] = [];
    socket.on('data', (d: Buffer) => got.push(d));
    const ended = once(socket, 'end');
    child.emit('exit', 0, null);
    // The last DAP frame can still be in flight after `exit`.
    child.stdout.write('Content-Length: 2\r\n\r\n{}');
    child.stdout.end();
    child.emit('close', 0, null);
    await ended;
    expect(Buffer.concat(got).toString()).toBe('Content-Length: 2\r\n\r\n{}');
    expect(bridge.exitCode).toBe(0);
  });

  it('kills the child and closes the server when the socket goes away', async () => {
    const child = fakeChild();
    bridge = await createBridge({ port: 0, host: '127.0.0.1', command: 'dart', args: [], spawnFn: () => child as unknown as ChildProcess, stderr: new PassThrough() });
    const socket = await connect(bridge);
    await vi.waitFor(() => expect(child.kill).not.toHaveBeenCalled());
    socket.destroy();
    await vi.waitFor(() => expect(child.kill).toHaveBeenCalled());
    await vi.waitFor(() => expect(bridge!.listening).toBe(false));
  });

  it('copies the child stderr to its own stderr line by line, never into the socket', async () => {
    const child = fakeChild();
    const stderr = new PassThrough();
    const err: Buffer[] = [];
    stderr.on('data', (d: Buffer) => err.push(d));
    bridge = await createBridge({ port: 0, host: '127.0.0.1', command: 'dart', args: [], spawnFn: () => child as unknown as ChildProcess, stderr });
    const socket = await connect(bridge);
    const got: Buffer[] = [];
    socket.on('data', (d: Buffer) => got.push(d));
    child.stderr.write('warning: something\n');
    await vi.waitFor(() => expect(Buffer.concat(err).toString()).toContain('warning: something'));
    expect(got).toHaveLength(0);
    socket.destroy();
  });

  it('reports a spawn failure on stderr and ends the socket with a non-zero exit code', async () => {
    const child = fakeChild();
    const stderr = new PassThrough();
    const err: Buffer[] = [];
    stderr.on('data', (d: Buffer) => err.push(d));
    bridge = await createBridge({ port: 0, host: '127.0.0.1', command: 'C:\\missing\\dart.exe', args: [], spawnFn: () => child as unknown as ChildProcess, stderr });
    const socket = await connect(bridge);
    const ended = once(socket, 'close');
    await vi.waitFor(() => expect(child.listenerCount('error')).toBeGreaterThan(0));
    child.emit('error', Object.assign(new Error('spawn C:\\missing\\dart.exe ENOENT'), { code: 'ENOENT' }));
    await ended;
    expect(Buffer.concat(err).toString()).toMatch(/ENOENT/);
    expect(bridge.exitCode).not.toBe(0);
  });

  it('refuses a second client while the first is connected', async () => {
    const child = fakeChild();
    bridge = await createBridge({ port: 0, host: '127.0.0.1', command: 'dart', args: [], spawnFn: () => child as unknown as ChildProcess, stderr: new PassThrough() });
    const first = await connect(bridge);
    const second = net.connect({ host: '127.0.0.1', port: bridge.port });
    await once(second, 'close');
    expect(first.destroyed).toBe(false);
    first.destroy();
  });
});
