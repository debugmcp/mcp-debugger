import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { ILogger } from '@debugmcp/shared';
import { ChildProxyView, type ChildViewRoot } from '../../../src/proxy/child-proxy-view.js';
import { CHILD_ADOPT_COMMAND, CHILD_CLOSE_COMMAND } from '../../../src/proxy/dap-proxy-interfaces.js';
import type { ProxyMessage, ProxyStatusMessage } from '../../../src/dap-core/types.js';
import type { ProxyConfig } from '../../../src/proxy/proxy-config.js';

const response = (body?: unknown): DebugProtocol.Response => ({
  seq: 1, request_seq: 1, type: 'response', command: CHILD_ADOPT_COMMAND, success: true, body
});
type SendRequest = (...args: Parameters<ChildViewRoot['sendDapRequestAs']>) => Promise<DebugProtocol.Response>;

describe('ChildProxyView connection lifecycle and event contract', () => {
  let root: ChildViewRoot;
  let send: Mock<SendRequest>;
  let logger: ILogger;
  let view: ChildProxyView;

  beforeEach(() => {
    send = vi.fn<SendRequest>().mockResolvedValue(response());
    root = {
      isRunning: vi.fn().mockReturnValue(true),
      getProxyPid: vi.fn().mockReturnValue(42),
      getAdapterStderrTail: vi.fn().mockReturnValue(['adapter diagnostic']),
      sendDapRequestAs: send as ChildViewRoot['sendDapRequestAs'],
      createChildView: vi.fn(),
      detachChildView: vi.fn(),
      releaseReportedChild: vi.fn()
    };
    logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as ILogger;
    view = new ChildProxyView(root, 'child', logger);
  });

  it('refuses direct launches and requests before adoption, retaining shared diagnostics', async () => {
    await expect(view.start({} as ProxyConfig)).rejects.toThrow('started by its parent');
    await expect(view.sendDapRequest('threads')).rejects.toThrow('connection is not open');
    expect(view.isRunning()).toBe(false);
    expect(view.getProxyPid()).toBe(42);
    expect(view.getAdapterStderrTail()).toEqual(['adapter diagnostic']);
    expect(view.getPreDetachResume()).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('adopts without optional capabilities and preserves request arguments and deadlines', async () => {
    const initialized = vi.fn();
    const capabilities = vi.fn();
    view.on('initialized', initialized);
    view.on('adapter-capabilities', capabilities);
    await expect(view.adopt({ reportId: 'report' })).resolves.toEqual({ sessionId: 'child', capabilities: undefined });
    expect(send).toHaveBeenCalledWith('child', CHILD_ADOPT_COMMAND, { reportId: 'report' }, { timeoutMs: 30000 });
    expect(initialized).toHaveBeenCalledOnce();
    expect(capabilities).not.toHaveBeenCalled();
    await view.sendDapRequest('stackTrace', { threadId: 7 }, { timeoutMs: 250 });
    expect(send).toHaveBeenLastCalledWith('child', 'stackTrace', { threadId: 7 }, { timeoutMs: 250 });
    vi.mocked(root.isRunning).mockReturnValue(false);
    expect(view.isRunning()).toBe(false);
    await expect(view.sendDapRequest('threads')).rejects.toThrow('connection is not open');
  });

  it('closes an in-flight adoption and rejects a late success without reviving the view', async () => {
    let finishAdoption!: (answer: DebugProtocol.Response) => void;
    send.mockImplementationOnce(() => new Promise((resolve) => { finishAdoption = resolve; }));
    const initialized = vi.fn();
    const capabilities = vi.fn();
    view.on('initialized', initialized);
    view.on('adapter-capabilities', capabilities);
    const adopting = view.adopt({ reportId: 'report' });
    const rejected = expect(adopting).rejects.toThrow('closed during adoption');

    await view.stop();
    expect(send).toHaveBeenLastCalledWith('child', CHILD_CLOSE_COMMAND, { terminateDebuggee: true }, { timeoutMs: 5000 });
    expect(root.detachChildView).toHaveBeenCalledWith('child');
    finishAdoption(response({ sessionId: 'child', capabilities: { supportsConfigurationDoneRequest: true } }));
    await rejected;
    expect(view.isRunning()).toBe(false);
    expect(initialized).not.toHaveBeenCalled();
    expect(capabilities).not.toHaveBeenCalled();
    await expect(view.adopt({ reportId: 'another' })).rejects.toThrow('connection is closed');
    await expect(view.sendDapRequest('threads')).rejects.toThrow('connection is not open');
  });

  it('queues inspection triggered by an early stop until the adoption answer arrives', async () => {
    let finishAdoption!: (answer: DebugProtocol.Response) => void;
    send.mockImplementationOnce(() => new Promise((resolve) => { finishAdoption = resolve; }));
    const adopting = view.adopt({ reportId: 'report' });
    let inspection!: Promise<DebugProtocol.Response>;
    view.on('stopped', (threadId) => {
      expect(view.isRunning()).toBe(true);
      inspection = view.sendDapRequest('stackTrace', { threadId }, { timeoutMs: 250 });
    });

    view.dispatch({ type: 'dapEvent', sessionId: 'child', event: 'stopped', body: { threadId: 7, reason: 'breakpoint' } });
    expect(send).toHaveBeenCalledTimes(1);
    finishAdoption(response({ sessionId: 'child' }));
    await adopting;
    await inspection;
    expect(send).toHaveBeenLastCalledWith('child', 'stackTrace', { threadId: 7 }, { timeoutMs: 250 });
    expect(view.getCurrentThreadId()).toBe(7);
  });

  it('rejects queued inspection with the adoption failure and leaves the view inactive', async () => {
    let failAdoption!: (error: Error) => void;
    send.mockImplementationOnce(() => new Promise((_, reject) => { failAdoption = reject; }));
    const adopting = view.adopt({ reportId: 'report' });
    const inspection = view.sendDapRequest('stackTrace', { threadId: 7 });
    const rejected = Promise.all([
      expect(adopting).rejects.toThrow('attach refused'),
      expect(inspection).rejects.toThrow('attach refused')
    ]);
    failAdoption(new Error('attach refused'));
    await rejected;
    expect(view.isRunning()).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    await expect(view.sendDapRequest('threads')).rejects.toThrow('connection is not open');
  });

  it.each(['stop', 'exit'] as const)('never sends queued inspection if %s wins the adoption race', async (ending) => {
    let finishAdoption!: (answer: DebugProtocol.Response) => void;
    send.mockImplementationOnce(() => new Promise((resolve) => { finishAdoption = resolve; }));
    const adopting = view.adopt({ reportId: 'report' });
    const inspection = view.sendDapRequest('stackTrace', { threadId: 7 });
    const rejected = Promise.all([
      expect(adopting).rejects.toThrow('closed during adoption'),
      expect(inspection).rejects.toThrow('connection is not open')
    ]);
    if (ending === 'stop') {
      await view.stop();
    } else {
      view.onWorkerExit(1);
    }
    finishAdoption(response());
    await rejected;
    expect(send.mock.calls.some(([, command]) => command === 'stackTrace')).toBe(false);
    expect(view.isRunning()).toBe(false);
  });

  it('does not announce readiness when the worker exits ahead of its adoption response', async () => {
    let finishAdoption!: (answer: DebugProtocol.Response) => void;
    send.mockImplementationOnce(() => new Promise((resolve) => { finishAdoption = resolve; }));
    const initialized = vi.fn();
    view.on('initialized', initialized);
    const adopting = view.adopt({ reportId: 'report' });
    const rejected = expect(adopting).rejects.toThrow('closed during adoption');
    view.onWorkerExit(1, 'SIGTERM');
    finishAdoption(response());
    await rejected;
    await view.stop();
    expect(send).toHaveBeenCalledTimes(1);
    expect(root.detachChildView).toHaveBeenCalledWith('child');
    expect(initialized).not.toHaveBeenCalled();
    expect(view.isRunning()).toBe(false);
  });

  it('stops accepting new requests as soon as close starts', async () => {
    await view.adopt({ reportId: 'report' });
    let finishClose!: (answer: DebugProtocol.Response) => void;
    send.mockImplementationOnce(() => new Promise((resolve) => { finishClose = resolve; }));
    const stopping = view.stop();
    expect(view.isRunning()).toBe(false);
    await expect(view.sendDapRequest('continue', { threadId: 1 })).rejects.toThrow('connection is not open');
    finishClose(response());
    await stopping;
  });

  it.each([new Error('socket closed'), 'socket closed'])('detaches even when close fails: %s', async (failure) => {
    await view.adopt({ reportId: 'report' });
    send.mockRejectedValueOnce(failure);
    await view.stop();
    await view.stop();
    expect(view.isRunning()).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('socket closed'));
    expect(root.detachChildView).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('closes its connection without ending the child when asked to release it (a detach cascade, issue #1081)', async () => {
    await view.adopt({ reportId: 'report' });
    await view.stop({ terminateDebuggee: false });
    expect(send).toHaveBeenLastCalledWith('child', CHILD_CLOSE_COMMAND, { terminateDebuggee: false }, { timeoutMs: 5000 });
    expect(root.detachChildView).toHaveBeenCalledWith('child');
    expect(view.isRunning()).toBe(false);
  });

  it('detaches an unused view without sending a close request', async () => {
    await view.stop();
    expect(send).not.toHaveBeenCalled();
    expect(root.detachChildView).toHaveBeenCalledWith('child');
  });

  it('detaches without sending on a worker that has already died', async () => {
    await view.adopt({ reportId: 'report' });
    vi.mocked(root.isRunning).mockReturnValue(false);
    await view.stop();
    expect(send).toHaveBeenCalledTimes(1);
    expect(root.detachChildView).toHaveBeenCalledWith('child');
  });

  it('keeps the stopped thread anchor when a later event omits its thread id', () => {
    const stopped = vi.fn();
    view.on('stopped', stopped);
    view.dispatch({ type: 'dapEvent', sessionId: 'child', event: 'stopped', body: { threadId: 7, reason: 'breakpoint' } });
    view.dispatch({ type: 'dapEvent', sessionId: 'child', event: 'stopped' });
    expect(stopped).toHaveBeenLastCalledWith(undefined, 'unknown', undefined);
    expect(view.getCurrentThreadId()).toBe(7);
    view.setCurrentThreadId(9);
    expect(view.getCurrentThreadId()).toBe(9);
  });

  it.each([
    ['continued', undefined, 'continued', []],
    ['terminated', undefined, 'terminated', []],
    ['exited', { exitCode: 2 }, 'exited', [2]],
    ['exited', undefined, 'exited', [undefined]],
    ['output', { category: 'stdout', output: 'child output' }, 'output', [{ category: 'stdout', output: 'child output' }]],
    ['breakpoint', { reason: 'changed', breakpoint: { id: 2, verified: true } }, 'breakpoint', [{ reason: 'changed', breakpoint: { id: 2, verified: true } }]],
    ['thread', { reason: 'started', threadId: 7 }, 'dap-event', ['thread', { reason: 'started', threadId: 7 }]]
  ] as const)('forwards %s with the public proxy event arguments', (event, body, emitted, args) => {
    const listener = vi.fn();
    view.on(emitted, listener);
    view.dispatch({ type: 'dapEvent', sessionId: 'child', event, body });
    expect(listener).toHaveBeenCalledExactlyOnceWith(...args);
  });

  it('routes configuration statuses without changing another connection', () => {
    const breakpoints = [{ file: '/work/child.py', line: 7, verified: true }];
    const functions = [{ name: 'run', verified: false }];
    const capabilities = { supportsConfigurationDoneRequest: true };
    const bpListener = vi.fn();
    const functionListener = vi.fn();
    const capabilityListener = vi.fn();
    const noticeListener = vi.fn();
    view.on('breakpoints-synced', bpListener);
    view.on('function-breakpoints-synced', functionListener);
    view.on('adapter-capabilities', capabilityListener);
    view.on('adapter-notice', noticeListener);
    view.dispatch({ type: 'status', sessionId: 'child', status: 'breakpoints_synced', breakpoints });
    view.dispatch({ type: 'status', sessionId: 'child', status: 'function_breakpoints_synced', functionBreakpoints: functions });
    view.dispatch({ type: 'status', sessionId: 'child', status: 'adapter_capabilities', capabilities });
    view.dispatch({ type: 'status', sessionId: 'child', status: 'adapter_notice', note: 'warning from adapter' });
    view.dispatch({ type: 'status', sessionId: 'child', status: 'adapter_notice', note: '' });
    view.dispatch({ type: 'status', sessionId: 'child', status: 'adapter_connected' });
    expect(bpListener).toHaveBeenCalledExactlyOnceWith(breakpoints);
    expect(functionListener).toHaveBeenCalledExactlyOnceWith(functions);
    expect(capabilityListener).toHaveBeenCalledExactlyOnceWith(capabilities);
    expect(noticeListener).toHaveBeenCalledExactlyOnceWith('warning from adapter');
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Ignoring status adapter_connected'));
  });

  it('accepts legacy sync statuses without result arrays', () => {
    const breakpoints = vi.fn();
    const functions = vi.fn();
    view.on('breakpoints-synced', breakpoints);
    view.on('function-breakpoints-synced', functions);
    view.dispatch({ type: 'status', sessionId: 'child', status: 'breakpoints_synced' } as ProxyStatusMessage);
    view.dispatch({ type: 'status', sessionId: 'child', status: 'function_breakpoints_synced' } as ProxyStatusMessage);
    expect(breakpoints).toHaveBeenCalledWith([]);
    expect(functions).toHaveBeenCalledWith([]);
  });

  it.each(['dap_connection_closed', 'terminated', 'adapter_exited'] as const)('emits only one exit after %s', async (status) => {
    await view.adopt({ reportId: 'report' });
    const exit = vi.fn();
    view.on('exit', exit);
    view.dispatch({ type: 'status', sessionId: 'child', status, code: 1, signal: 'SIGTERM', expected: false });
    view.onWorkerExit(null);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1, 'SIGTERM', false);
    expect(view.isRunning()).toBe(false);
  });

  it('forwards errors safely and leaves response correlation on the root', () => {
    expect(() => view.dispatch({ type: 'error', sessionId: 'child', message: 'first error' })).not.toThrow();
    const error = vi.fn();
    view.on('error', error);
    view.dispatch({ type: 'error', sessionId: 'child', message: 'connection failure' });
    view.dispatch({ type: 'error', sessionId: 'child' } as ProxyMessage);
    view.dispatch({ type: 'dapResponse', sessionId: 'child', requestId: 'r1', success: true });
    expect(error).toHaveBeenNthCalledWith(1, expect.objectContaining({ message: 'connection failure' }));
    expect(error).toHaveBeenNthCalledWith(2, expect.objectContaining({ message: 'proxy error' }));
  });
});
