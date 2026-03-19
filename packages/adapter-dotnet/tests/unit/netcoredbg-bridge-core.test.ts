/**
 * Unit tests for netcoredbg-bridge-core.ts
 *
 * All tests use mock spawn and mock sockets — no real processes or TCP.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import net from 'net';
import { EventEmitter } from 'events';
import { createBridge, type BridgeHandle } from '../../src/utils/netcoredbg-bridge-core.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Minimal mock ChildProcess with piped stdio */
function createMockChildProcess() {
  const stdin = new (require('stream').PassThrough)();
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const cp: any = new EventEmitter();
  cp.stdin = stdin;
  cp.stdout = stdout;
  cp.stderr = stderr;
  cp.kill = vi.fn();
  cp.pid = 12345;
  return cp;
}

/** Wait for the TCP server to start listening */
function waitForListening(server: net.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (server.listening) {
      resolve();
      return;
    }
    server.once('listening', resolve);
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
  let spawnFn: ReturnType<typeof vi.fn>;
  let stderrChunks: string[];
  let stderrStream: NodeJS.WritableStream;

  // Pick a random high port to avoid collisions
  let port: number;

  beforeEach(() => {
    port = 40000 + Math.floor(Math.random() * 10000);
    mockCp = createMockChildProcess();
    spawnFn = vi.fn().mockReturnValue(mockCp);
    stderrChunks = [];
    stderrStream = {
      write: (chunk: any) => { stderrChunks.push(String(chunk)); return true; }
    } as any;
  });

  afterEach(() => {
    bridge?.cleanup();
  });

  it('creates a TCP server on the specified port', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', port, { spawnFn, stderr: stderrStream });
    await waitForListening(bridge.server);
    expect(bridge.server.listening).toBe(true);
    const addr = bridge.server.address() as net.AddressInfo;
    expect(addr.port).toBe(port);
  });

  it('spawns netcoredbg with correct args on first connection', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', port, { spawnFn, stderr: stderrStream });
    await waitForListening(bridge.server);

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
    bridge = createBridge('/usr/bin/netcoredbg', port, { spawnFn, stderr: stderrStream });
    await waitForListening(bridge.server);

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
    bridge = createBridge('/usr/bin/netcoredbg', port, { spawnFn, stderr: stderrStream });
    await waitForListening(bridge.server);

    const client = await connectClient(port);
    await tick();

    const received: Buffer[] = [];
    client.on('data', (d) => received.push(d));

    const chunk = Buffer.from('Content-Length: 3\r\n\r\nfoo');
    mockCp.stdout.emit('data', chunk);
    await tick();

    expect(Buffer.concat(received).toString()).toBe(chunk.toString());
    client.destroy();
  });

  it('rejects second TCP connection (single-client)', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', port, { spawnFn, stderr: stderrStream });
    await waitForListening(bridge.server);

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
    bridge = createBridge('/usr/bin/netcoredbg', port, { spawnFn, stderr: stderrStream });
    await waitForListening(bridge.server);

    const client = await connectClient(port);
    await tick();

    client.destroy();
    await tick();

    expect(mockCp.kill).toHaveBeenCalled();
  });

  it('cleans up on netcoredbg exit', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', port, { spawnFn, stderr: stderrStream });
    await waitForListening(bridge.server);

    const client = await connectClient(port);
    await tick();

    const ended = new Promise<void>((resolve) => {
      client.on('end', resolve);
      client.on('close', resolve);
    });

    mockCp.emit('exit', 0);
    await ended;
  });

  it('handles netcoredbg spawn error', async () => {
    bridge = createBridge('/usr/bin/netcoredbg', port, { spawnFn, stderr: stderrStream });
    await waitForListening(bridge.server);

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
    bridge = createBridge('/usr/bin/netcoredbg', port, { spawnFn, stderr: stderrStream });
    await waitForListening(bridge.server);

    const client = await connectClient(port);
    await tick();

    mockCp.stderr.emit('data', Buffer.from('warning: something'));
    await tick();

    expect(stderrChunks.join('')).toContain('warning: something');
    client.destroy();
  });
});
