/**
 * ProxyManager and the session tree (issue #1081): one worker serves the root
 * session and every child the adapter reports. The parent-side manager
 * demultiplexes the worker's messages by session id into child proxy views —
 * each an IProxyManager over the same IPC channel — and its child_reported
 * status becomes a `child-reported` event (or an automatic release when
 * nobody listens).
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import { ProxyManager } from '../../../src/proxy/proxy-manager.js';
import type { IChildProxyView } from '../../../src/proxy/child-proxy-view.js';
import {
  CHILD_ADOPT_COMMAND,
  CHILD_CLOSE_COMMAND,
  CHILD_RELEASE_COMMAND
} from '../../../src/proxy/dap-proxy-interfaces.js';
import type { ProxyConfig } from '../../../src/proxy/proxy-config.js';
import { DebugLanguage, type IProxyProcess, type IProxyProcessLauncher, type IFileSystem, type ILogger } from '@debugmcp/shared';

class FakeProxyProcess extends EventEmitter implements IProxyProcess {
  sessionId = 'root';
  pid = 4242;
  killed = false;
  exitCode: number | null = null;
  signalCode: string | null = null;
  stdin: NodeJS.WritableStream | null = null;
  stdout: NodeJS.ReadableStream | null = null;
  stderr: NodeJS.ReadableStream | null = new EventEmitter() as unknown as NodeJS.ReadableStream;

  send = vi.fn().mockReturnValue(true);
  sendCommand = vi.fn();
  kill = vi.fn().mockReturnValue(true);
  waitForInitialization = vi.fn().mockResolvedValue(undefined);
}

const configuration = { type: 'python', name: 'Subprocess 4242', subProcessId: 4242 };
const reported = (sessionId: string, reportId = 'report-1') => ({
  type: 'status',
  status: 'child_reported',
  sessionId,
  reportId,
  targetId: '4242',
  name: 'Subprocess 4242',
  configuration
});

describe('ProxyManager child views (issue #1081)', () => {
  let fakeProcess: FakeProxyProcess;
  let logger: ILogger & { warn: Mock; debug: Mock };
  let root: ProxyManager;

  const config: ProxyConfig = {
    sessionId: 'root',
    language: DebugLanguage.PYTHON,
    executablePath: 'python',
    adapterHost: '127.0.0.1',
    adapterPort: 5678,
    logDir: './.tmp/logs',
    scriptPath: './tests/fixtures/parent.py'
  };

  /** Every `dap` command the fake worker received, newest last. */
  const sentDap = () =>
    fakeProcess.sendCommand.mock.calls.map(([cmd]) => cmd as Record<string, unknown>).filter((cmd) => cmd.cmd === 'dap');

  /** A success response the way the worker sends one: the DAP response beside its body. */
  const dapResponse = (sessionId: string, requestId: unknown, command: unknown, body: unknown) => ({
    type: 'dapResponse',
    sessionId,
    requestId,
    success: true,
    body,
    response: { type: 'response', seq: 1, request_seq: 1, success: true, command, body }
  });

  /** Answer the newest dap command with a success response stamped with the given session. */
  const answerLast = (sessionId: string, body: unknown = {}) => {
    const last = sentDap().at(-1)!;
    fakeProcess.emit('message', dapResponse(sessionId, last.requestId, last.dapCommand, body));
  };

  beforeEach(async () => {
    fakeProcess = new FakeProxyProcess();
    fakeProcess.sendCommand.mockImplementation((cmd: { cmd: string; sessionId: string }) => {
      if (cmd.cmd === 'init') {
        process.nextTick(() => {
          fakeProcess.emit('message', { type: 'status', status: 'init_received', sessionId: cmd.sessionId });
          setImmediate(() => {
            fakeProcess.emit('message', { type: 'status', status: 'adapter_connected', sessionId: cmd.sessionId });
          });
        });
      }
    });
    const launcher: IProxyProcessLauncher = {
      launchProxy: vi.fn().mockImplementation(() => {
        setImmediate(() => fakeProcess.emit('spawn'));
        return fakeProcess;
      })
    };
    const fileSystem = { pathExists: vi.fn().mockResolvedValue(true) } as unknown as IFileSystem;
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as ILogger & { warn: Mock; debug: Mock };
    root = new ProxyManager(null, launcher, fileSystem, logger);
    await root.start(config);
    (root as unknown as { isInitialized: boolean }).isInitialized = true;
    fakeProcess.sendCommand.mockClear();
  });

  afterEach(async () => {
    fakeProcess.removeAllListeners();
    root.removeAllListeners();
    await new Promise((resolve) => setImmediate(resolve));
  });

  async function adoptedView(id = 'c1'): Promise<IChildProxyView> {
    const view = root.createChildView!(id);
    const adopting = view.adopt({ reportId: 'report-1', breakpoints: [] });
    await new Promise((resolve) => setImmediate(resolve));
    answerLast(id, { sessionId: id, capabilities: { supportsConfigurationDoneRequest: true } });
    await adopting;
    return view;
  }

  it('turns the root connection\'s child_reported status into a child-reported event', () => {
    const listener = vi.fn();
    root.on('child-reported', listener);

    fakeProcess.emit('message', reported('root'));

    expect(listener).toHaveBeenCalledWith({ reportId: 'report-1', targetId: '4242', name: 'Subprocess 4242', configuration });
    expect(sentDap()).toHaveLength(0);
  });

  it('releases a reported child through the worker when nobody listens', () => {
    fakeProcess.emit('message', reported('root'));

    expect(sentDap()).toEqual([
      expect.objectContaining({
        cmd: 'dap',
        sessionId: 'root',
        dapCommand: CHILD_RELEASE_COMMAND,
        dapArgs: expect.objectContaining({ reportId: 'report-1' })
      })
    ]);
  });

  it('routes a child-tagged stopped event to its view only', () => {
    const view = root.createChildView!('c1');
    const onView = vi.fn();
    const onRoot = vi.fn();
    view.on('stopped', onView);
    root.on('stopped', onRoot);

    fakeProcess.emit('message', { type: 'dapEvent', sessionId: 'c1', event: 'stopped', body: { threadId: 1, reason: 'breakpoint' } });

    expect(onView).toHaveBeenCalledWith(1, 'breakpoint', { threadId: 1, reason: 'breakpoint' });
    expect(onRoot).not.toHaveBeenCalled();
    expect(view.getCurrentThreadId()).toBe(1);
    expect(root.getCurrentThreadId()).toBeNull();
  });

  it('adopt sends childAdopt on the child\'s envelope and reports the view ready on the answer', async () => {
    const view = root.createChildView!('c1');
    const capabilities = vi.fn();
    const configured = vi.fn();
    const initialized = vi.fn();
    view.on('adapter-capabilities', capabilities);
    view.on('adapter-configured', configured);
    view.on('initialized', initialized);
    expect(view.isRunning()).toBe(false);

    const adopting = view.adopt({ reportId: 'report-1', breakpoints: [{ file: '/w/child.py', line: 7 }] });
    await new Promise((resolve) => setImmediate(resolve));
    expect(sentDap().at(-1)).toMatchObject({
      sessionId: 'c1',
      dapCommand: CHILD_ADOPT_COMMAND,
      dapArgs: { reportId: 'report-1', breakpoints: [{ file: '/w/child.py', line: 7 }] }
    });

    answerLast('c1', { sessionId: 'c1', capabilities: { supportsConfigurationDoneRequest: true } });
    await expect(adopting).resolves.toMatchObject({ sessionId: 'c1' });
    expect(capabilities).toHaveBeenCalledWith({ supportsConfigurationDoneRequest: true });
    expect(configured).toHaveBeenCalledTimes(1);
    expect(initialized).toHaveBeenCalledTimes(1);
    expect(view.isRunning()).toBe(true);
  });

  it('a request on the view travels on the child\'s envelope and resolves from its tagged response', async () => {
    const view = await adoptedView();

    const threads = view.sendDapRequest('threads');
    const command = sentDap().at(-1)!;
    expect(command).toMatchObject({ cmd: 'dap', sessionId: 'c1', dapCommand: 'threads' });
    expect(typeof command.requestId).toBe('string');

    fakeProcess.emit('message', dapResponse('c1', command.requestId, 'threads', { threads: [{ id: 1, name: 'MainThread' }] }));
    await expect(threads).resolves.toMatchObject({ body: { threads: [{ id: 1, name: 'MainThread' }] } });
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Session ID mismatch'));
    // The child's thread list anchors the child, never the root (the threads fallback is per session).
    expect(view.getCurrentThreadId()).toBe(1);
    expect(root.getCurrentThreadId()).toBeNull();
  });

  it('stop closes only the child\'s connection and leaves the root running', async () => {
    const view = await adoptedView();

    const stopping = view.stop();
    await new Promise((resolve) => setImmediate(resolve));
    expect(sentDap().at(-1)).toMatchObject({ sessionId: 'c1', dapCommand: CHILD_CLOSE_COMMAND, dapArgs: { terminateDebuggee: true } });
    answerLast('c1', { closed: true });
    await stopping;

    expect(view.isRunning()).toBe(false);
    expect(root.isRunning()).toBe(true);
    expect(fakeProcess.kill).not.toHaveBeenCalled();
    // The root still talks to the worker as before.
    const after = root.sendDapRequest('threads');
    answerLast('root', { threads: [] });
    await expect(after).resolves.toMatchObject({ body: { threads: [] } });
    // A second stop is a no-op.
    await view.stop();
    expect(sentDap().filter((cmd) => cmd.dapCommand === CHILD_CLOSE_COMMAND)).toHaveLength(1);
  });

  it('a child connection\'s close becomes exactly one exit on its view', async () => {
    const view = await adoptedView();
    const exit = vi.fn();
    view.on('exit', exit);
    const rootExit = vi.fn();
    root.on('exit', rootExit);

    fakeProcess.emit('message', { type: 'status', status: 'dap_connection_closed', sessionId: 'c1', expected: true });
    fakeProcess.emit('message', { type: 'status', status: 'dap_connection_closed', sessionId: 'c1', expected: true });

    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(null, undefined, true);
    expect(rootExit).not.toHaveBeenCalled();
    expect(view.isRunning()).toBe(false);
  });

  it('the worker\'s death reaches every view and rejects their pending requests', async () => {
    const first = await adoptedView('c1');
    const second = await adoptedView('c2');
    const exits = [vi.fn(), vi.fn()];
    first.on('exit', exits[0]);
    second.on('exit', exits[1]);
    const pending = first.sendDapRequest('threads');

    fakeProcess.exitCode = 1;
    fakeProcess.emit('exit', 1, null);

    await expect(pending).rejects.toThrow('Proxy exited');
    expect(exits[0]).toHaveBeenCalledWith(1, undefined);
    expect(exits[1]).toHaveBeenCalledWith(1, undefined);
    expect(first.isRunning()).toBe(false);
  });

  it('rejects events and terminal statuses for unknown children before they can affect the root', () => {
    const stopped = vi.fn();
    const exit = vi.fn();
    root.on('stopped', stopped);
    root.on('exit', exit);
    fakeProcess.emit('message', { type: 'dapEvent', sessionId: 'nobody', event: 'stopped', body: { threadId: 99, reason: 'breakpoint' } });
    fakeProcess.emit('message', { type: 'status', sessionId: 'nobody', status: 'terminated', expected: true });
    expect(stopped).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    expect(root.getCurrentThreadId()).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Session ID mismatch'));
    expect(root.isRunning()).toBe(true);
  });

  it('warns for an unknown session id and drops a just-detached one quietly', async () => {
    const stray = vi.fn();
    root.on('stopped', stray);
    fakeProcess.emit('message', { type: 'status', sessionId: 'nobody', status: 'some_status' });
    expect(stray).not.toHaveBeenCalled();

    const view = await adoptedView();
    const stopping = view.stop();
    await new Promise((resolve) => setImmediate(resolve));
    answerLast('c1', { closed: true });
    await stopping;
    logger.warn.mockClear();

    fakeProcess.emit('message', { type: 'status', status: 'dap_connection_closed', sessionId: 'c1', expected: true });

    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Session ID mismatch'));
  });

  it('a view creates grandchild views on the root, so a grandchild\'s events reach its own view', async () => {
    const child = await adoptedView('c1');
    const grandchild = child.createChildView!('g1');
    const onGrandchild = vi.fn();
    const onChild = vi.fn();
    grandchild.on('stopped', onGrandchild);
    child.on('stopped', onChild);

    fakeProcess.emit('message', { type: 'dapEvent', sessionId: 'g1', event: 'stopped', body: { threadId: 1, reason: 'breakpoint' } });

    expect(onGrandchild).toHaveBeenCalledTimes(1);
    expect(onChild).not.toHaveBeenCalled();
  });

  it('a child_reported status on a child\'s connection is the child view\'s event, released through the worker when unheard', () => {
    const view = root.createChildView!('c1');
    const listener = vi.fn();
    view.on('child-reported', listener);
    fakeProcess.emit('message', reported('c1', 'report-g'));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ reportId: 'report-g' }));

    const unheard = root.createChildView!('c2');
    void unheard;
    fakeProcess.emit('message', reported('c2', 'report-h'));
    expect(sentDap().at(-1)).toMatchObject({ sessionId: 'c2', dapCommand: CHILD_RELEASE_COMMAND, dapArgs: expect.objectContaining({ reportId: 'report-h' }) });
  });

  it.each([new Error('worker unavailable'), 'worker unavailable'])('logs a failed automatic release without an unhandled rejection: %s', async (failure) => {
    vi.spyOn(root, 'sendDapRequestAs').mockRejectedValueOnce(failure);
    fakeProcess.emit('message', reported('root'));
    await new Promise((resolve) => setImmediate(resolve));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Releasing reported child report-1 failed: worker unavailable'));
  });

  it('forwards an adapter process exit to all views once, including its expected flag', async () => {
    const child = await adoptedView();
    const exit = vi.fn();
    child.on('exit', exit);
    fakeProcess.emit('message', { type: 'status', sessionId: 'root', status: 'adapter_exited', code: 1, expected: false });
    fakeProcess.emit('exit', 1, null);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1, undefined, false);
    expect(child.isRunning()).toBe(false);
  });
});
