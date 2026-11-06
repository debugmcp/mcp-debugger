/** The auto-attach default must not inject host-only preloads into a forwarded target. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { canAutoAttachChildren } from '../../src/utils/child-attach-locality.js';
import { probeInspector } from '../../src/utils/inspector-activation.js';

vi.mock('../../src/utils/inspector-activation.js', () => ({ probeInspector: vi.fn() }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, writeFile: vi.fn(actual.writeFile), unlink: vi.fn(actual.unlink) };
});

const websocketAddress = 'ws://127.0.0.1:9229/target';
let adapterDirectory: string;
let nonceFiles: string[];

type TargetFs = Pick<typeof fs, 'constants' | 'accessSync' | 'readFileSync'>;
interface SocketOptions {
  targetFs?: TargetFs;
  reply?: unknown;
  silent?: boolean;
  useRequire?: boolean;
  failure?: 'constructor' | 'send' | 'malformed-json' | 'error-event' | 'close-event';
}

/** Execute the real CDP expression against the target's simulated filesystem. */
function installInspector(options: SocketOptions = {}) {
  const sockets: FakeSocket[] = [];
  const requests: Array<{ id: number; method: string; params: { expression: string; awaitPromise?: boolean } }> = [];
  let resolveOpened!: () => void;
  const opened = new Promise<void>((resolve) => { resolveOpened = resolve; });
  const targetFs = options.targetFs ?? fs;
  const observedFs: TargetFs = {
    constants: targetFs.constants,
    accessSync: targetFs.accessSync,
    readFileSync: ((file: fs.PathOrFileDescriptor, ...args: unknown[]) => {
      nonceFiles.push(String(file));
      return Reflect.apply(targetFs.readFileSync, targetFs, [file, ...args]);
    }) as typeof fs.readFileSync
  };
  class FakeSocket {
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: (() => void) | null = null;
    close = vi.fn();
    constructor(readonly address: string) {
      if (options.failure === 'constructor') throw new Error('invalid WebSocket URL');
      sockets.push(this);
      resolveOpened();
      queueMicrotask(() => {
        if (options.failure === 'error-event') this.onerror?.();
        else if (options.failure === 'close-event') this.onclose?.();
        else this.onopen?.();
      });
    }
    send(raw: string): void {
      if (options.failure === 'send') throw new Error('WebSocket is not open');
      const request = JSON.parse(raw) as typeof requests[number];
      requests.push(request);
      // Capture the nonce path even for timeouts, where the target never evaluates.
      const quoted = request.params.expression.match(/readFileSync\(("(?:\\.|[^"\\])*")/);
      if (quoted) nonceFiles.push(JSON.parse(quoted[1]) as string);
      if (options.silent) return;
      if (options.failure === 'malformed-json') {
        queueMicrotask(() => this.onmessage?.({ data: '{"id":1,broken' }));
        return;
      }
      if ('reply' in options) {
        queueMicrotask(() => this.onmessage?.({ data: JSON.stringify(options.reply) }));
        return;
      }
      const context = options.useRequire
        ? { process: {}, require: () => observedFs }
        : { process: { getBuiltinModule: () => observedFs } };
      void Promise.resolve(runInNewContext(request.params.expression, context))
        .then((value) => this.onmessage?.({ data: JSON.stringify({ id: request.id, result: { result: { value } } }) }));
    }
  }
  vi.stubGlobal('WebSocket', FakeSocket);
  return { sockets, requests, opened };
}

beforeEach(async () => {
  nonceFiles = [];
  adapterDirectory = await mkdtemp(join(tmpdir(), 'mcp-child-locality-test-'));
  await Promise.all(['bootloader.js', 'watchdog.js'].map(name => writeFile(join(adapterDirectory, name), '// fixture')));
  vi.mocked(probeInspector).mockResolvedValue({
    status: 'inspector',
    targets: [{ type: 'node', webSocketDebuggerUrl: websocketAddress }]
  });
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await Promise.all(['bootloader.js', 'watchdog.js'].map(name => unlink(join(adapterDirectory, name)).catch(() => {})));
  await rmdir(adapterDirectory);
  vi.clearAllMocks();
});

function expectNonceRemoved(): void {
  expect(nonceFiles.length).toBeGreaterThan(0);
  for (const file of nonceFiles) expect(fs.existsSync(file), `probe file remained: ${file}`).toBe(false);
}

describe('canAutoAttachChildren', () => {
  it('enables a target that can read the nonce and the installed bootloader and watchdog', async () => {
    const { sockets, requests } = installInspector();
    expect(await canAutoAttachChildren({ host: '127.0.0.1', port: 9229, adapterDirectory })).toBe(true);
    expect(probeInspector).toHaveBeenCalledWith('127.0.0.1', 9229, 1500);
    expect(sockets[0].address).toBe(websocketAddress);
    expect(requests.map(request => request.method)).toEqual(['Runtime.evaluate']);
    expect(requests[0].params.awaitPromise).toBe(true);
    expect(sockets[0].close).toHaveBeenCalledOnce();
    expectNonceRemoved();
  });

  it.each(['bootloader.js', 'watchdog.js'])('refuses shared temporary storage when %s is absent from the target', async (missing) => {
    await unlink(join(adapterDirectory, missing));
    installInspector();
    expect(await canAutoAttachChildren({ host: '127.0.0.1', port: 9229, adapterDirectory })).toBe(false);
    expectNonceRemoved();
  });

  it.each(['missing', 'different'])('refuses a forwarded target whose nonce is %s despite a matching path', async (kind) => {
    const targetFs: TargetFs = {
      constants: fs.constants,
      accessSync: fs.accessSync,
      readFileSync: (() => {
        if (kind === 'missing') throw Object.assign(new Error('not on target filesystem'), { code: 'ENOENT' });
        return 'another filesystem';
      }) as unknown as typeof fs.readFileSync
    };
    installInspector({ targetFs });
    expect(await canAutoAttachChildren({ host: '127.0.0.1', port: 9229, adapterDirectory })).toBe(false);
    expectNonceRemoved();
  });

  it('uses an exact websocketAddress without HTTP discovery, including a portless attach', async () => {
    const { sockets } = installInspector({ useRequire: true });
    const exact = 'ws://127.0.0.1:9345/forwarded-target';
    expect(await canAutoAttachChildren({ host: 'ignored-host', websocketAddress: exact, adapterDirectory })).toBe(true);
    expect(probeInspector).not.toHaveBeenCalled();
    expect(sockets[0].address).toBe(exact);
    expectNonceRemoved();
  });

  it.each([
    { id: 1, error: { code: -32000, message: 'execution context unavailable' } },
    { id: 1, result: { exceptionDetails: { text: 'evaluation failed' }, result: { value: true } } },
    { id: 1, result: { result: { value: 'true' } } }
  ])('refuses an inspector response that does not prove locality: %j', async (reply) => {
    const { sockets } = installInspector({ reply });
    expect(await canAutoAttachChildren({ host: '127.0.0.1', port: 9229, adapterDirectory })).toBe(false);
    expect(sockets[0].close).toHaveBeenCalledOnce();
    expectNonceRemoved();
  });

  it.each(['constructor', 'send', 'malformed-json', 'error-event', 'close-event'] as const)(
    'disables child auto-attach promptly after a WebSocket %s failure and cleans up',
    async (failure) => {
      // Leave timers frozen: transport failures must settle immediately,
      // without relying on the probe timeout to unblock attach.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const { sockets, requests } = installInspector({ failure });
      expect(await canAutoAttachChildren({ host: '127.0.0.1', port: 9229, adapterDirectory })).toBe(false);
      expect(sockets).toHaveLength(failure === 'constructor' ? 0 : 1);
      if (sockets.length > 0) expect(sockets[0].close).toHaveBeenCalledOnce();
      expect(requests.every(request => request.method === 'Runtime.evaluate')).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
      // Failure may precede send(), so read the created nonce path from the
      // exclusive write instead of from the never-sent CDP expression.
      const nonceWrite = vi.mocked(writeFile).mock.calls.find(([, , options]) =>
        typeof options === 'object' && options !== null && options.flag === 'wx');
      expect(nonceWrite).toBeDefined();
      nonceFiles.push(String(nonceWrite![0]));
      expectNonceRemoved();
    }
  );

  it('times out without resuming a paused target and removes its nonce', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { sockets, opened, requests } = installInspector({ silent: true });
    const pending = canAutoAttachChildren({ host: '127.0.0.1', port: 9229, adapterDirectory, timeoutMs: 50 });
    await opened;
    await vi.advanceTimersByTimeAsync(50);
    expect(await pending).toBe(false);
    expect(requests.map(request => request.method)).toEqual(['Runtime.evaluate']);
    expect(sockets[0].close).toHaveBeenCalledOnce();
    expectNonceRemoved();
  });

  it('refuses discovery without a Node target and never opens a CDP socket', async () => {
    const { sockets } = installInspector();
    vi.mocked(probeInspector).mockResolvedValue({ status: 'inspector', targets: [{ type: 'page', webSocketDebuggerUrl: websocketAddress }] });
    expect(await canAutoAttachChildren({ host: '127.0.0.1', port: 9229, adapterDirectory })).toBe(false);
    expect(sockets).toHaveLength(0);
    expect(nonceFiles).toEqual([]);
  });

  it('treats malformed discovery entries as unproven instead of failing the attach', async () => {
    const { sockets } = installInspector();
    // probeInspector accepts a JSON array from /json/list without validating its entries.
    vi.mocked(probeInspector).mockResolvedValue(JSON.parse('{"status":"inspector","targets":[null]}') as Awaited<ReturnType<typeof probeInspector>>);
    expect(await canAutoAttachChildren({ host: '127.0.0.1', port: 9229, adapterDirectory })).toBe(false);
    expect(sockets).toHaveLength(0);
  });

  it('treats a failed discovery request as unproven instead of failing the attach', async () => {
    installInspector();
    vi.mocked(probeInspector).mockRejectedValueOnce(new Error('discovery unavailable'));
    expect(await canAutoAttachChildren({ host: '127.0.0.1', port: 9229, adapterDirectory })).toBe(false);
  });

  it('does not remove a pre-existing file when exclusive nonce creation fails', async () => {
    const { sockets } = installInspector();
    let collision: string | undefined;
    vi.mocked(writeFile).mockImplementationOnce(async (file) => {
      collision = String(file);
      fs.writeFileSync(collision, 'belongs to another probe');
      throw Object.assign(new Error('file already exists'), { code: 'EEXIST' });
    });
    try {
      expect(await canAutoAttachChildren({ host: '127.0.0.1', port: 9229, adapterDirectory })).toBe(false);
      expect(sockets).toHaveLength(0);
      expect(unlink).not.toHaveBeenCalled();
      expect(fs.readFileSync(collision!, 'utf8')).toBe('belongs to another probe');
    } finally {
      if (collision && fs.existsSync(collision)) fs.unlinkSync(collision);
    }
  });

  it('refuses when WebSocket or the resolved adapter directory is unavailable', async () => {
    installInspector();
    expect(await canAutoAttachChildren({ host: '127.0.0.1', port: 9229 })).toBe(false);
    vi.stubGlobal('WebSocket', undefined);
    expect(await canAutoAttachChildren({ host: '127.0.0.1', port: 9229, adapterDirectory })).toBe(false);
    expect(probeInspector).not.toHaveBeenCalled();
  });
});
