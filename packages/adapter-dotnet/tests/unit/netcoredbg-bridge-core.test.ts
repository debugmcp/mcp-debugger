/**
 * Unit tests for netcoredbg-bridge-core.ts
 *
 * All tests use mock spawn and mock sockets — no real processes or TCP.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import net from 'net';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { createBridge, type BridgeHandle, type BridgeOptions } from '../../src/utils/netcoredbg-bridge-core.js';

type SpawnFn = NonNullable<BridgeOptions['spawnFn']>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Minimal mock ChildProcess with piped stdio */
function createMockChildProcess() {
  return Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    kill: vi.fn(),
    pid: 12345
  });
}

/** Wait for the TCP server to start listening; returns the OS-assigned port */
function waitForListening(server: net.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    if (server.listening) {
      resolve((server.address() as net.AddressInfo).port);
      return;
    }
    server.once('listening', () => resolve((server.address() as net.AddressInfo).port));
    server.once('error', reject);
  });
}

/** Connect a client socket to the bridge */
async function connectClient(port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' }, () => resolve(socket));
    socket.once('error', reject);
  });
}

/** Wait briefly for event handlers to fire */
const tick = () => new Promise((r) => setTimeout(r, 30));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('netcoredbg-bridge-core', () => {
  let bridge: BridgeHandle;
  let mockCp: ReturnType<typeof createMockChildProcess>;
  let spawnFn: Mock<SpawnFn>;
  let stderrChunks: string[];
  let stderrStream: NodeJS.WritableStream;

  beforeEach(() => {
    mockCp = createMockChildProcess();
    // The bridge only reads stdin/stdout/stderr/kill/pid off the child; the rest of
    // `ChildProcess` is deliberately absent, so the double is cast at this one boundary.
    spawnFn = vi.fn<SpawnFn>().mockReturnValue(mockCp as unknown as ChildProcess);
    stderrChunks = [];
    // Likewise: the bridge only ever calls `write`.
    stderrStream = {
      write: (chunk: string | Uint8Array) => { stderrChunks.push(String(chunk)); return true; }
    } as unknown as NodeJS.WritableStream;
  });

  afterEach(() => {
    bridge?.cleanup();
  });

  it('creates a TCP server on the specified port', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', 0, { spawnFn, stderr: stderrStream });
    await waitForListening(bridge.server);
    expect(bridge.server.listening).toBe(true);
    const addr = bridge.server.address() as net.AddressInfo;
    expect(addr.port).toBeGreaterThan(0);
  });

  it('spawns netcoredbg with correct args on first connection', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', 0, { spawnFn, stderr: stderrStream });
    const port = await waitForListening(bridge.server);

    const client = await connectClient(port);
    await tick();

    expect(spawnFn).toHaveBeenCalledOnce();
    expect(spawnFn).toHaveBeenCalledWith(
      '/usr/bin/netcoredbg',
      ['--interpreter=vscode'],
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] })
    );

    client.destroy();
  });

  it('forwards TCP data → netcoredbg stdin', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', 0, { spawnFn, stderr: stderrStream });
    const port = await waitForListening(bridge.server);

    const client = await connectClient(port);
    await tick();

    const stdinWrite = vi.spyOn(mockCp.stdin, 'write');
    const payload = Buffer.from('Content-Length: 5\r\n\r\nhello');
    client.write(payload);
    await tick();

    expect(stdinWrite).toHaveBeenCalledWith(payload);
    client.destroy();
  });

  it('forwards netcoredbg stdout → TCP socket', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', 0, { spawnFn, stderr: stderrStream });
    const port = await waitForListening(bridge.server);

    const client = await connectClient(port);
    await tick();

    const received: Buffer[] = [];
    client.on('data', (d: Buffer) => received.push(d));

    const chunk = Buffer.from('Content-Length: 3\r\n\r\nfoo');
    mockCp.stdout.emit('data', chunk);
    await tick();

    expect(Buffer.concat(received).toString()).toBe(chunk.toString());
    client.destroy();
  });

  it('rejects second TCP connection (single-client)', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', 0, { spawnFn, stderr: stderrStream });
    const port = await waitForListening(bridge.server);

    const client1 = await connectClient(port);
    await tick();

    // Second connection should be immediately destroyed
    const client2 = await connectClient(port);
    const closed = new Promise<void>((resolve) => {
      client2.on('close', resolve);
    });
    await closed;

    // Only one spawn should have happened
    expect(spawnFn).toHaveBeenCalledOnce();
    client1.destroy();
  });

  it('cleans up on TCP socket close', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', 0, { spawnFn, stderr: stderrStream });
    const port = await waitForListening(bridge.server);

    const client = await connectClient(port);
    await tick();

    client.destroy();
    await tick();

    expect(mockCp.kill).toHaveBeenCalled();
  });

  it('cleans up once netcoredbg has closed', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', 0, { spawnFn, stderr: stderrStream });
    const port = await waitForListening(bridge.server);

    const client = await connectClient(port);
    await tick();

    const ended = new Promise<void>((resolve) => {
      client.on('end', resolve);
      client.on('close', resolve);
    });

    mockCp.emit('exit', 0, null);
    mockCp.emit('close', 0, null);
    await ended;
  });

  it('keeps the socket open across netcoredbg exit until its streams close, then ends it (issue #878)', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', 0, { spawnFn, stderr: stderrStream });
    const port = await waitForListening(bridge.server);

    const client = await connectClient(port);
    await tick();

    const received: Buffer[] = [];
    client.on('data', (d: Buffer) => received.push(d));
    const ended = new Promise<void>((resolve) => client.on('end', resolve));

    // Node fires `exit` when the process ends and `close` when its stdio has
    // drained: the last DAP frame can still be in the stdout pipe at `exit`.
    mockCp.emit('exit', 0, null);
    const lastFrame = Buffer.from('Content-Length: 2\r\n\r\n{}');
    mockCp.stdout.emit('data', lastFrame);
    mockCp.emit('close', 0, null);
    await ended;

    expect(Buffer.concat(received).toString()).toBe(lastFrame.toString());
    expect(stderrChunks.join('')).toBe('netcoredbg closed (code=0, signal=null)\n');
  });

  it('survives the proxy closing first and the child closing afterwards', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', 0, { spawnFn, stderr: stderrStream });
    const port = await waitForListening(bridge.server);

    const client = await connectClient(port);
    await tick();

    client.destroy();
    await tick();
    expect(mockCp.kill).toHaveBeenCalled();

    // The late exit/close of the killed child must neither throw nor double-end.
    mockCp.emit('exit', null, 'SIGTERM');
    mockCp.emit('close', null, 'SIGTERM');
    await tick();
    expect(stderrChunks.join('')).toBe('netcoredbg closed (code=null, signal=SIGTERM)\n');
  });

  it('stops forwarding socket bytes to netcoredbg stdin once it has exited', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', 0, { spawnFn, stderr: stderrStream });
    const port = await waitForListening(bridge.server);

    const client = await connectClient(port);
    await tick();

    const stdinWrite = vi.spyOn(mockCp.stdin, 'write');
    mockCp.emit('exit', 0, null);
    client.write(Buffer.from('Content-Length: 2\r\n\r\n{}'));
    await tick();

    expect(stdinWrite).not.toHaveBeenCalled();
    mockCp.emit('close', 0, null);
  });

  it('logs a netcoredbg stdin error instead of dying on it', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', 0, { spawnFn, stderr: stderrStream });
    const port = await waitForListening(bridge.server);

    const client = await connectClient(port);
    await tick();

    mockCp.stdin.emit('error', new Error('EPIPE'));
    await tick();

    expect(stderrChunks.join('')).toContain('netcoredbg stdin: EPIPE');
    client.destroy();
  });

  it('handles netcoredbg spawn error', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', 0, { spawnFn, stderr: stderrStream });
    const port = await waitForListening(bridge.server);

    const client = await connectClient(port);
    await tick();

    const closed = new Promise<void>((resolve) => {
      client.on('close', resolve);
    });

    mockCp.emit('error', new Error('ENOENT'));
    await closed;

    expect(stderrChunks.join('')).toContain('netcoredbg error: ENOENT');
  });

  it('logs netcoredbg stderr to stderr stream', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', 0, { spawnFn, stderr: stderrStream });
    const port = await waitForListening(bridge.server);

    const client = await connectClient(port);
    await tick();

    mockCp.stderr.emit('data', Buffer.from('warning: something'));
    await tick();

    expect(stderrChunks.join('')).toContain('warning: something');
    client.destroy();
  });
});
