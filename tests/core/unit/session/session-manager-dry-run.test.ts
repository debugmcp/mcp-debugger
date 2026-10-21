/**
 * `start_debugging { dryRunSpawn: true }` is a query (issue #812): it runs the
 * launch preparation in the parent — adapter, transform, executable, the spawn
 * command — and answers with what the launch would run, leaving the session
 * exactly as it found it. Before #812 it was a launch attempt that rode the
 * proxy worker, reset every per-launch record, tore down a live program and
 * ended the session `stopped`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import type { CustomLaunchRequestArguments } from '../../../../src/session/session-manager-core.js';
import {
  AdapterError,
  AdapterErrorCode,
  SessionState,
  SessionLifecycleState,
  DebugLanguage,
  type AdapterPolicy
} from '@debugmcp/shared';
import { FakeDebugAdapter } from '../../../test-utils/fakes/fake-debug-adapter.js';
import { createMockDependencies } from './session-manager-test-utils.js';

/** The attach shape is not in `CustomLaunchRequestArguments`; production passes it through the same cast. */
function launchArgs(args: Record<string, unknown>): Partial<CustomLaunchRequestArguments> {
  return args as unknown as Partial<CustomLaunchRequestArguments>;
}

describe('SessionManager dry run (issue #812)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.useFakeTimers();
    dependencies = createMockDependencies();
    const config: SessionManagerConfig = {
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true }
    };
    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  const proxy = () => dependencies.mockProxyManager;

  async function createSession(name: string) {
    return sessionManager.createSession({ language: DebugLanguage.MOCK, name, executablePath: 'python' });
  }

  /** Launch to the entry stop: the mock proxy reports it on the next tick; the landing read settles 10 ms later. */
  async function launchToEntryStop(sessionId: string, scriptArgs: string[] = []) {
    const launch = sessionManager.startDebugging(sessionId, 'test.py', scriptArgs, { stopOnEntry: true });
    await vi.advanceTimersByTimeAsync(50);
    const result = await launch;
    expect(result.state).toBe(SessionState.PAUSED);
  }

  it('answers the spawn command for a fresh session and leaves it untouched: no proxy, no launch record', async () => {
    const session = await createSession('Fresh');
    const before = sessionManager.getSession(session.id)!;
    expect(before.state).toBe(SessionState.CREATED);

    const dry = await sessionManager.startDebugging(session.id, 'test.py', [], {}, true);

    // The fake adapter resolves the session's executable and builds `<exe> fake-adapter.js --port <port>`;
    // the mock policy hands that command back verbatim, so this is the string the worker used to log.
    expect(dry).toMatchObject({
      success: true,
      state: SessionState.CREATED,
      data: { dryRun: true, command: 'python fake-adapter.js --port 12345', script: 'test.py' }
    });
    expect(dry.data?.message).toMatch(/nothing was started/i);
    expect(proxy().startCalls).toHaveLength(0);
    expect(dependencies.proxyManagerFactory.create).not.toHaveBeenCalled();

    const after = sessionManager.getSession(session.id)!;
    expect(after.state).toBe(SessionState.CREATED);
    expect(after.sessionLifecycle).toBe(SessionLifecycleState.CREATED);
    expect(after.lastLaunch).toBeUndefined();
    expect(after.logDir).toBeUndefined();
    expect(after.transformedLaunch).toBeUndefined();
    expect(after.launchConfigNotices ?? []).toEqual([]);
  });

  it('leaves a paused program paused: the live proxy is not torn down and the run\'s records survive', async () => {
    const session = await createSession('Paused');
    await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 5 });
    await launchToEntryStop(session.id);
    const before = sessionManager.getSession(session.id)!;
    const { proxyManager, lastStop, outputBuffer, logDir, transformedLaunch } = before;
    const verifiedBefore = sessionManager.listBreakpoints(session.id)[0].verified;
    expect(lastStop?.reason).toBe('entry');

    const dry = await sessionManager.startDebugging(session.id, 'test.py', [], {}, true);

    expect(dry.success).toBe(true);
    expect(dry.state).toBe(SessionState.PAUSED);
    expect(dry.data?.dryRun).toBe(true);
    const after = sessionManager.getSession(session.id)!;
    expect(after.state).toBe(SessionState.PAUSED);
    expect(after.proxyManager).toBe(proxyManager);
    expect(after.lastStop).toBe(lastStop);
    expect(after.outputBuffer).toBe(outputBuffer);
    expect(after.logDir).toBe(logDir);
    expect(after.transformedLaunch).toBe(transformedLaunch);
    expect(sessionManager.listBreakpoints(session.id)[0].verified).toBe(verifiedBefore);
    expect(proxy().stopCalls).toBe(0);
    expect(proxy().startCalls).toHaveLength(1);
    expect(proxy().isRunning()).toBe(true);
    // The program is still there to drive.
    const resumed = await sessionManager.continue(session.id);
    expect(resumed.success).toBe(true);
  });

  it('keeps a finished run\'s exit code and buffer, and restart_debugging still replays the real launch', async () => {
    const session = await createSession('Finished');
    await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 9 });
    const launch = sessionManager.startDebugging(session.id, 'test.py', ['--real']);
    await vi.advanceTimersByTimeAsync(20);
    proxy().simulateExited(7);
    proxy().simulateEvent('terminated');
    await vi.advanceTimersByTimeAsync(20);
    expect((await launch).state).toBe(SessionState.STOPPED);
    const before = sessionManager.getSession(session.id)!;
    expect(before.exitCode).toBe(7);
    const { outputBuffer, transformedLaunch } = before;

    const dry = await sessionManager.startDebugging(session.id, 'test.py', [], {}, true);

    expect(dry.success).toBe(true);
    expect(dry.state).toBe(SessionState.STOPPED);
    const after = sessionManager.getSession(session.id)!;
    expect(after.exitCode).toBe(7);
    expect(after.outputBuffer).toBe(outputBuffer);
    expect(after.transformedLaunch).toBe(transformedLaunch);
    expect(after.lastLaunch?.scriptArgs).toEqual(['--real']);
    expect(sessionManager.listBreakpoints(session.id)).toHaveLength(1);

    const restart = sessionManager.restartDebugging(session.id);
    await vi.advanceTimersByTimeAsync(1500);
    expect((await restart).success).toBe(true);
    const startCalls = proxy().startCalls;
    expect(startCalls).toHaveLength(2);
    expect(startCalls[1].scriptArgs).toEqual(['--real']);
    expect(startCalls[1].initialBreakpoints).toEqual([expect.objectContaining({ file: 'test.py', line: 9 })]);
  });

  it('keeps the session launchable: the real launch after a dry run binds the breakpoint set before it (issue #793)', async () => {
    const session = await createSession('DryThenReal');
    await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 5 });

    const dry = await sessionManager.startDebugging(session.id, 'test.py', [], {}, true);
    expect(dry.success).toBe(true);
    await launchToEntryStop(session.id);

    // One proxy start, the real launch's; the dry run never reached the proxy.
    const startCalls = proxy().startCalls;
    expect(startCalls).toHaveLength(1);
    expect(startCalls[0].initialBreakpoints).toEqual([expect.objectContaining({ file: 'test.py', line: 5 })]);
  });

  it('refuses a dry run of an attach-shaped config: the attach transform reaches into the target process', async () => {
    const session = await createSession('AttachShaped');

    const dry = await sessionManager.startDebugging(
      session.id, 'attach://remote', [], launchArgs({ request: 'attach', port: 5678 }), true
    );

    expect(dry.success).toBe(false);
    expect(dry.error).toMatch(/attach/);
    expect(dry.state).toBe(SessionState.CREATED);
    expect(dependencies.adapterRegistry.create).not.toHaveBeenCalled();
    expect(sessionManager.getSession(session.id)!.state).toBe(SessionState.CREATED);
  });

  it('answers a failed preparation without touching the session: a paused program stays paused', async () => {
    const session = await createSession('PrepFails');
    await launchToEntryStop(session.id);
    const before = sessionManager.getSession(session.id)!;
    vi.mocked(dependencies.adapterRegistry.create).mockRejectedValueOnce(
      new Error('Maximum adapter instances (10) reached')
    );

    const dry = await sessionManager.startDebugging(session.id, 'test.py', [], {}, true);

    expect(dry.success).toBe(false);
    expect(dry.error).toContain('Maximum adapter instances');
    expect(dry.state).toBe(SessionState.PAUSED);
    const after = sessionManager.getSession(session.id)!;
    expect(after.state).toBe(SessionState.PAUSED);
    expect(after.proxyManager).toBe(before.proxyManager);
    expect(after.failureDiagnostics).toBe(before.failureDiagnostics);
    expect(proxy().stopCalls).toBe(0);
  });

  // Issue #959: an adapter's transform refusing the launch (a .NET source file
  // as the program) answers the dry run with its own sentence, untouched session.
  it("answers an adapter's transform refusal with the adapter's words, leaving a paused program paused", async () => {
    const session = await createSession('TransformRefuses');
    await launchToEntryStop(session.id);
    const refusal = new AdapterError(
      'The .NET program must be the compiled assembly, not the source file Program.cs: pass the .dll as dapLaunchArgs.program',
      AdapterErrorCode.SCRIPT_NOT_FOUND
    );
    vi.mocked(dependencies.adapterRegistry.create).mockImplementationOnce(async () => {
      const adapter = new FakeDebugAdapter();
      adapter.transformLaunchConfig.mockRejectedValueOnce(refusal);
      return adapter;
    });

    const dry = await sessionManager.startDebugging(session.id, 'Program.cs', [], {}, true);

    expect(dry).toMatchObject({ success: false, error: refusal.message, errorType: 'AdapterError' });
    expect(dry.state).toBe(SessionState.PAUSED);
    expect(sessionManager.getSession(session.id)!.state).toBe(SessionState.PAUSED);
    expect(proxy().stopCalls).toBe(0);
  });

  it('renders an incompatible toolchain verdict the way a launch does, without the state rollback a launch needs', async () => {
    const verdict = { compatible: false, toolchain: 'msvc', behavior: 'warn', message: 'MSVC PDB detected' };
    vi.mocked(dependencies.adapterRegistry.create).mockImplementationOnce(async () =>
      new FakeDebugAdapter().withExtras({ consumeLastToolchainValidation: vi.fn(() => verdict) })
    );
    const session = await createSession('Msvc');

    const dry = await sessionManager.startDebugging(session.id, 'test.py', [], {}, true);

    expect(dry.success).toBe(false);
    expect(dry.error).toBe('MSVC_TOOLCHAIN_DETECTED');
    expect(dry.state).toBe(SessionState.CREATED);
    expect(dry.data).toMatchObject({ message: 'MSVC PDB detected', toolchainValidation: verdict });
    expect(dry.canContinue).toBe(true);
    const after = sessionManager.getSession(session.id)!;
    expect(after.state).toBe(SessionState.CREATED);
    expect(after.toolchainValidation).toBeUndefined();
  });

  it('says an incompatible toolchain with behavior "error" cannot be continued past, as a launch does', async () => {
    const verdict = { compatible: false, toolchain: 'msvc', behavior: 'error', message: 'MSVC PDB detected' };
    vi.mocked(dependencies.adapterRegistry.create).mockImplementationOnce(async () =>
      new FakeDebugAdapter().withExtras({ consumeLastToolchainValidation: vi.fn(() => verdict) })
    );
    const session = await createSession('MsvcError');

    const dry = await sessionManager.startDebugging(session.id, 'test.py', [], {}, true);

    expect(dry.success).toBe(false);
    expect(dry.error).toBe('MSVC_TOOLCHAIN_DETECTED');
    expect(dry.canContinue).toBe(false);
    expect(sessionManager.getSession(session.id)!.state).toBe(SessionState.CREATED);
  });

  it('gives the adapter back after answering: the registry slot a dry run takes is released', async () => {
    const adapter = new FakeDebugAdapter();
    vi.mocked(dependencies.adapterRegistry.create).mockImplementationOnce(async () => adapter);
    const session = await createSession('Slot');

    const dry = await sessionManager.startDebugging(session.id, 'test.py', [], {}, true);

    expect(dry.success).toBe(true);
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
  });

  it('answers a policy that cannot say what it would spawn as a failure, naming it, and still gives the adapter back', async () => {
    const adapter = new FakeDebugAdapter();
    vi.mocked(dependencies.adapterRegistry.create).mockImplementationOnce(async () => adapter);
    const facade = sessionManager as unknown as { selectPolicy: (language: string) => AdapterPolicy };
    const original = facade.selectPolicy.bind(sessionManager);
    vi.spyOn(facade, 'selectPolicy').mockImplementation((language) => ({
      ...original(language),
      getAdapterSpawnConfig: () => undefined
    }));
    const session = await createSession('NoSpawnConfig');

    const dry = await sessionManager.startDebugging(session.id, 'test.py', [], {}, true);

    expect(dry.success).toBe(false);
    expect(dry.error).toMatch(/Cannot determine adapter command .*\(policy: mock\)/);
    expect(dry.state).toBe(SessionState.CREATED);
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
    expect(sessionManager.getSession(session.id)!.state).toBe(SessionState.CREATED);
  });

  it('carries the transform\'s configuration notices as the warning, from the preparation and not from the session', async () => {
    vi.mocked(dependencies.adapterRegistry.create).mockImplementationOnce(async () =>
      Object.assign(new FakeDebugAdapter(), { supportedLaunchKeys: ['program'] })
    );
    const session = await createSession('Notices');
    sessionManager.getSession(session.id)!.launchConfigNotices = ['a note from the last real launch'];

    const dry = await sessionManager.startDebugging(session.id, 'test.py', [], {}, true, { typo: 1 });

    expect(dry.success).toBe(true);
    expect(dry.data?.warning).toBe('adapterLaunchConfig.typo: forwarded to the adapter but unrecognized');
    expect(sessionManager.getSession(session.id)!.launchConfigNotices).toEqual(['a note from the last real launch']);
  });
});
