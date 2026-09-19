/**
 * createCobolShim lifecycle: listener, engine spawn and connect, teardown paths.
 * No CodeLLDB — the engine is a FakeEngine behind an injected spawnFn.
 */
import { describe, expect, it, afterEach } from 'vitest';
import net from 'node:net';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { startShim, tick, waitFor, type Harness } from './harness.js';

describe('cobol shim lifecycle', () => {
  let h: Harness | undefined;

  afterEach(async () => {
    await h?.cleanup();
    h = undefined;
  });

  it('spawns the engine with --port appended, inherited stdio and windowsHide on the first client', async () => {
    h = await startShim();
    expect(h.spawnCalls).toHaveLength(1);
    const [call] = h.spawnCalls;
    expect(call.command).toBe('fake-codelldb');
    expect(call.args.slice(0, 2)).toEqual(['--liblldb', 'liblldb.so']);
    expect(call.args[2]).toBe('--port');
    expect(Number(call.args[3])).toBeGreaterThan(0);
    expect(call.options.stdio).toEqual(['ignore', 'inherit', 'inherit']);
    expect(call.options.windowsHide).toBe(true);
  });

  it('opens --stdin-file, hands the fd to the engine as stdin and closes its own copy', async () => {
    const opened: string[] = [];
    const closed: number[] = [];
    h = await startShim({
      argv: { stdinFile: '/data/input.txt' },
      openStdinFile: (file) => {
        opened.push(file);
        return 42;
      },
      closeFd: (fd) => {
        closed.push(fd);
      }
    });
    expect(opened).toEqual(['/data/input.txt']);
    expect(h.spawnCalls[0].options.stdio).toEqual([42, 'inherit', 'inherit']);
    expect(closed).toEqual([42]);
  });

  it('refuses a second client', async () => {
    h = await startShim();
    const second = await new Promise<net.Socket>((resolve, reject) => {
      const socket = net.createConnection({ port: h!.handle.port(), host: '127.0.0.1' }, () => resolve(socket));
      socket.once('error', reject);
    });
    await new Promise<void>((resolve) => second.once('close', () => resolve()));
    expect(second.destroyed).toBe(true);
    expect(h.spawnCalls).toHaveLength(1);
  });

  it('buffers client frames until the engine socket is up', async () => {
    h = await startShim({ delayEngineListenMs: 150, engineSetup: (engine) => engine.on('threads', () => ({ threads: [{ id: 1, name: 'main' }] })) });
    const response = await h.client.request('threads', {});
    expect(response.success).toBe(true);
    expect((response.body as { threads: unknown[] }).threads).toHaveLength(1);
    expect(h.engine.received('threads')).toHaveLength(1);
  });

  it('gives up on an engine that never listens: client ended, exit 1', async () => {
    h = await startShim({ delayEngineListenMs: 60_000, timing: { connectTimeoutMs: 200, connectRetryMs: 20 } });
    await waitFor(() => h!.exitCodes.length > 0, 3000, 'exit');
    expect(h.exitCodes).toEqual([1]);
    expect(h.child.killCalls).toBe(1);
    await waitFor(() => h!.client.closed, 2000, 'client close');
  });

  it('client close: kills the engine after the grace period and exits 0', async () => {
    h = await startShim();
    await h.client.close();
    await waitFor(() => h!.exitCodes.length > 0, 3000, 'exit');
    expect(h.child.killCalls).toBe(1);
    expect(h.exitCodes).toEqual([0]);
  });

  it('client close after launch: the engine is told to terminate the debuggee', async () => {
    h = await startShim();
    await h.client.request('launch', { program: '/bin/prog' });
    await h.client.close();
    await waitFor(() => h!.exitCodes.length > 0, 3000, 'exit');
    const [disconnect] = h.engine.received('disconnect');
    expect(disconnect?.arguments).toEqual({ terminateDebuggee: true });
  });

  it('client close after attach: the attached process is detached from, not terminated', async () => {
    h = await startShim();
    await h.client.request('attach', { pid: 4242 });
    await h.client.close();
    await waitFor(() => h!.exitCodes.length > 0, 3000, 'exit');
    const [disconnect] = h.engine.received('disconnect');
    expect(disconnect?.arguments).toEqual({ terminateDebuggee: false });
  });

  it('engine exit: ends the client and exits with the engine code', async () => {
    h = await startShim();
    h.child.exitWith(3);
    await waitFor(() => h!.exitCodes.length > 0, 3000, 'exit');
    expect(h.exitCodes).toEqual([3]);
    await waitFor(() => h!.client.closed, 2000, 'client end');
    expect(h.child.killCalls).toBe(0);
  });

  it('disconnect: forwarded, then the engine gets the grace period before being killed', async () => {
    h = await startShim({ timing: { disconnectGraceMs: 150 } });
    const response = await h.client.request('disconnect', {});
    expect(response.success).toBe(true);
    expect(h.engine.received('disconnect')).toHaveLength(1);
    expect(h.child.killCalls).toBe(0);
    await tick(80);
    expect(h.child.killCalls).toBe(0);
    await waitFor(() => h!.child.killCalls === 1, 2000, 'kill after grace');
    await waitFor(() => h!.exitCodes.length > 0, 2000, 'exit');
    expect(h.exitCodes).toEqual([0]);
  });

  it('disconnect: an engine that exits on its own is not killed', async () => {
    h = await startShim({
      timing: { disconnectGraceMs: 500 },
      engineSetup: (engine) => engine.on('disconnect', () => {
        setTimeout(() => h?.child.exitWith(0), 30);
        return {};
      })
    });
    await h.client.request('disconnect', {});
    await waitFor(() => h!.exitCodes.length > 0, 2000, 'exit');
    expect(h.child.killCalls).toBe(0);
    expect(h.exitCodes).toEqual([0]);
  });

  it('delivers the disconnect response even when the engine exits right after answering it', async () => {
    h = await startShim({
      engineSetup: (engine) =>
        engine.on('disconnect', () => {
          setImmediate(() => h?.child.exitWith(0));
          return {};
        })
    });
    const response = await h.client.request('disconnect', {});
    expect(response.success).toBe(true);
    await waitFor(() => h!.exitCodes.length > 0, 3000, 'exit');
    expect(h.exitCodes).toEqual([0]);
    expect(h.child.killCalls).toBe(0);
  });

  it('exits 1 instead of idling when the listen port cannot be taken', async () => {
    const blocker = net.createServer();
    const port = await new Promise<number>((resolve) => blocker.listen(0, '127.0.0.1', () => resolve((blocker.address() as net.AddressInfo).port)));
    const exitCodes: number[] = [];
    const logs: string[] = [];
    const { createCobolShim } = await import('../../../src/shim/shim-core.js');
    const { recordingLogger } = await import('./harness.js');
    const handle = createCobolShim(
      { listenPort: port, manifestDirs: [], engineCommand: ['fake-codelldb'] },
      { exit: (code) => { exitCodes.push(code); }, logger: recordingLogger(logs) }
    );
    await expect(handle.ready).rejects.toThrow(/EADDRINUSE/);
    expect(exitCodes).toEqual([1]);
    expect(logs.some((line) => line.includes('listen failed'))).toBe(true);
    await new Promise<void>((resolve) => blocker.close(() => resolve()));
  });

  it('does not deadlock the handshake: initialized reaches the client before the launch response', async () => {
    h = await startShim({
      engineSetup: (engine) => {
        engine.on('launch', async () => {
          engine.emit('initialized');
          await engine.waitForRequest('configurationDone');
          return {};
        });
      }
    });
    await h.client.request('initialize', {});
    const launchDone = h.client.request('launch', { program: '/x' });
    const initialized = await h.client.nextEvent('initialized');
    expect(initialized.event).toBe('initialized');
    expect(h.client.responses('launch')).toHaveLength(0);
    await h.client.request('configurationDone', {});
    const launch = await launchDone;
    expect(launch.success).toBe(true);
    const order = h.client.received.map((m) => (m.type === 'event' ? `event:${(m as DebugProtocol.Event).event}` : `response:${(m as DebugProtocol.Response).command}`));
    expect(order.indexOf('event:initialized')).toBeLessThan(order.indexOf('response:launch'));
  });
});
