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
import { installShutdownHandlers } from '../../../tools/dev-proxy/shutdown.mjs';

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
