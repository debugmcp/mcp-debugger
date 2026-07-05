/**
 * Unit tests for the dev-proxy shutdown wiring (issue #122, PR-1).
 *
 * The helper lives in tools/dev-proxy/shutdown.mjs (separate from dev-proxy.mjs,
 * which runs main() at module top level and therefore cannot be imported safely).
 *
 * These tests verify that when the MCP client (Claude Code) goes away — stdin
 * EOF/close/error, protocol-level server close, or signals — the proxy stops its
 * backend child exactly once and then exits, even if backend.stop() hangs or throws.
 */
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- plain-JS module without type declarations
import { installShutdownHandlers, killChildGracefully } from '../../../tools/dev-proxy/shutdown.mjs';

interface FakeProc extends EventEmitter {
  exit: ReturnType<typeof vi.fn>;
}

function makeDeps() {
  const stdin = new EventEmitter();
  const proc = new EventEmitter() as FakeProc;
  proc.exit = vi.fn();
  const backend = { stop: vi.fn().mockResolvedValue(undefined) };
  const log = vi.fn();
  return { stdin, proc, backend, log };
}

describe('dev-proxy installShutdownHandlers', () => {
  it('stops the backend then exits 0 when stdin ends (client died)', async () => {
    const { stdin, proc, backend, log } = makeDeps();
    installShutdownHandlers({ stdin, backend, log, proc });

    stdin.emit('end');

    await vi.waitFor(() => expect(proc.exit).toHaveBeenCalledWith(0));
    expect(backend.stop).toHaveBeenCalledTimes(1);
    // stop must be initiated before exit
    expect(backend.stop.mock.invocationCallOrder[0]).toBeLessThan(
      proc.exit.mock.invocationCallOrder[0]
    );
  });

  it('shuts down on stdin close', async () => {
    const { stdin, proc, backend, log } = makeDeps();
    installShutdownHandlers({ stdin, backend, log, proc });

    stdin.emit('close');

    await vi.waitFor(() => expect(proc.exit).toHaveBeenCalledWith(0));
    expect(backend.stop).toHaveBeenCalledTimes(1);
  });

  it('treats stdin error as client disconnect (Windows broken pipe)', async () => {
    const { stdin, proc, backend, log } = makeDeps();
    installShutdownHandlers({ stdin, backend, log, proc });

    stdin.emit('error', new Error('EPIPE: broken pipe'));

    await vi.waitFor(() => expect(proc.exit).toHaveBeenCalledWith(0));
    expect(backend.stop).toHaveBeenCalledTimes(1);
  });

  it('shuts down on SIGINT and SIGTERM', async () => {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      const { stdin, proc, backend, log } = makeDeps();
      installShutdownHandlers({ stdin, backend, log, proc });

      proc.emit(signal);

      await vi.waitFor(() => expect(proc.exit).toHaveBeenCalledWith(0));
      expect(backend.stop).toHaveBeenCalledTimes(1);
    }
  });

  it('is idempotent: multiple triggers stop the backend and exit only once', async () => {
    const { stdin, proc, backend, log } = makeDeps();
    installShutdownHandlers({ stdin, backend, log, proc });

    // Realistic Windows sequence: 'end' then 'close', plus stray signals
    stdin.emit('end');
    stdin.emit('close');
    proc.emit('SIGINT');
    proc.emit('SIGTERM');

    await vi.waitFor(() => expect(proc.exit).toHaveBeenCalled());
    // Allow any queued microtasks/macrotasks from the extra triggers to flush
    await new Promise((r) => setTimeout(r, 20));

    expect(backend.stop).toHaveBeenCalledTimes(1);
    expect(proc.exit).toHaveBeenCalledTimes(1);
  });

  it('still exits if backend.stop() hangs (stop timeout)', async () => {
    const { stdin, proc, log } = makeDeps();
    const backend = { stop: vi.fn().mockReturnValue(new Promise<void>(() => {})) };
    installShutdownHandlers({
      stdin,
      backend,
      log,
      proc,
      stopTimeoutMs: 25,
      forceExitDelayMs: 5000,
    });

    stdin.emit('end');

    await vi.waitFor(() => expect(proc.exit).toHaveBeenCalledWith(0), { timeout: 2000 });
    expect(backend.stop).toHaveBeenCalledTimes(1);
  });

  it('still exits 0 if backend.stop() rejects', async () => {
    const { stdin, proc, log } = makeDeps();
    const backend = { stop: vi.fn().mockRejectedValue(new Error('kill failed')) };
    installShutdownHandlers({ stdin, backend, log, proc });

    stdin.emit('end');

    await vi.waitFor(() => expect(proc.exit).toHaveBeenCalledWith(0));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('kill failed'));
  });

  it('chains server.onclose instead of replacing it, and shuts down on server close', async () => {
    const { stdin, proc, backend, log } = makeDeps();
    const previousOnClose = vi.fn();
    const server: { onclose?: () => void } = { onclose: previousOnClose };
    installShutdownHandlers({ stdin, backend, server, log, proc });

    expect(server.onclose).not.toBe(previousOnClose);
    server.onclose!();

    await vi.waitFor(() => expect(proc.exit).toHaveBeenCalledWith(0));
    expect(previousOnClose).toHaveBeenCalledTimes(1);
    expect(backend.stop).toHaveBeenCalledTimes(1);
  });

  it('returns an idempotent shutdown function usable directly', async () => {
    const { stdin, proc, backend, log } = makeDeps();
    const shutdown = installShutdownHandlers({ stdin, backend, log, proc });

    await shutdown('test reason');
    await shutdown('second call is a no-op');

    expect(backend.stop).toHaveBeenCalledTimes(1);
    expect(proc.exit).toHaveBeenCalledTimes(1);
    expect(proc.exit).toHaveBeenCalledWith(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('test reason'));
  });
});

/**
 * killChildGracefully (issue #122, PR-3): the backend gets a graceful shutdown
 * request first (stdin close on Windows — no SIGTERM there — or SIGTERM
 * elsewhere) and is force-killed only if it does not exit within the grace
 * period.
 */
interface FakeChild extends EventEmitter {
  pid: number;
  exitCode: number | null;
  kill: ReturnType<typeof vi.fn>;
  stdin: { destroyed: boolean; end: ReturnType<typeof vi.fn> } | null;
}

function makeFakeChild({ withStdin = true }: { withStdin?: boolean } = {}): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.pid = 4242;
  child.exitCode = null;
  child.kill = vi.fn();
  child.stdin = withStdin ? { destroyed: false, end: vi.fn() } : null;
  return child;
}

describe('dev-proxy killChildGracefully', () => {
  it('resolves immediately for a missing or already-exited child', async () => {
    await killChildGracefully(null);

    const child = makeFakeChild();
    child.exitCode = 0;
    const forceKill = vi.fn();
    await killChildGracefully(child, { platform: 'win32', forceKill });

    expect(forceKill).not.toHaveBeenCalled();
    expect(child.stdin!.end).not.toHaveBeenCalled();
  });

  it('win32: closes the stdin pipe and resolves on prompt exit without force-killing', async () => {
    const child = makeFakeChild();
    const forceKill = vi.fn();
    const promise = killChildGracefully(child, {
      platform: 'win32',
      forceKill,
      killTimeoutMs: 1000,
    });

    expect(child.stdin!.end).toHaveBeenCalledTimes(1);
    child.exitCode = 0;
    child.emit('exit', 0, null);
    await promise;

    expect(forceKill).not.toHaveBeenCalled();
    expect(child.kill).not.toHaveBeenCalled();
  });

  it('win32: force-kills when the child ignores the graceful request', async () => {
    const child = makeFakeChild();
    const forceKill = vi.fn(() => {
      setTimeout(() => child.emit('exit', 1, null), 5);
    });

    await killChildGracefully(child, { platform: 'win32', forceKill, killTimeoutMs: 20 });

    expect(child.stdin!.end).toHaveBeenCalledTimes(1);
    expect(forceKill).toHaveBeenCalledWith(child.pid);
  });

  it('win32: force-kills immediately when no stdin pipe is available', async () => {
    const child = makeFakeChild({ withStdin: false });
    const forceKill = vi.fn(() => {
      setTimeout(() => child.emit('exit', 1, null), 5);
    });

    await killChildGracefully(child, { platform: 'win32', forceKill, killTimeoutMs: 5000 });

    expect(forceKill).toHaveBeenCalledWith(child.pid);
  });

  it('unix: sends SIGTERM first and resolves on exit without force-killing', async () => {
    const child = makeFakeChild();
    const forceKill = vi.fn();
    const promise = killChildGracefully(child, {
      platform: 'linux',
      forceKill,
      killTimeoutMs: 1000,
    });

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(child.stdin!.end).not.toHaveBeenCalled();
    child.emit('exit', 0, null);
    await promise;

    expect(forceKill).not.toHaveBeenCalled();
  });

  it('unix: escalates to force kill after the grace period', async () => {
    const child = makeFakeChild();
    const forceKill = vi.fn(() => {
      setTimeout(() => child.emit('exit', null, 'SIGKILL'), 5);
    });

    await killChildGracefully(child, { platform: 'linux', forceKill, killTimeoutMs: 20 });

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(forceKill).toHaveBeenCalledWith(child.pid);
  });

  it('resolves via the bail timer when even force-kill surfaces no exit event', async () => {
    const child = makeFakeChild();
    const forceKill = vi.fn(); // does nothing — no 'exit' will ever fire

    await killChildGracefully(child, {
      platform: 'win32',
      forceKill,
      killTimeoutMs: 10,
      bailMs: 20,
    });

    expect(forceKill).toHaveBeenCalledWith(child.pid);
  });
});
