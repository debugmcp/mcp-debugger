/**
 * The test-runner preset gate on launch (issue #985): `start_debugging {
 * testRunner }` is checked against the language's factory metadata before
 * the session changes state — the way the attach-addressing contract (#903)
 * gates attach — so an undeclared runner is refused with the session left
 * exactly as it was, and a declared one reaches the launch.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { SessionState, DebugLanguage, type AdapterMetadata, type AdapterModes } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

function metadataWithModes(modes: AdapterModes): AdapterMetadata {
  return { language: 'mock', displayName: 'Mock', version: '1.0.0', author: 'tests', description: 'mock', modes };
}

describe('SessionManager launch: the test-runner preset gate (issue #985)', () => {
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

  async function createSession(name: string) {
    return sessionManager.createSession({ language: DebugLanguage.MOCK, name, executablePath: 'python' });
  }

  it('refuses a runner the language does not declare, before any state changes', async () => {
    // The default metadata double declares no modes at all.
    const session = await createSession('gate-undeclared');

    const result = await sessionManager.startDebugging(session.id, 'test.py', [], {}, false, { testRunner: 'pytest' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no test-runner preset/);
    expect(result.error).toContain("'pytest'");
    expect(sessionManager.getSession(session.id)!.state).toBe(SessionState.CREATED);
    expect(dependencies.proxyManagerFactory.create).not.toHaveBeenCalled();
    expect(sessionManager.getSession(session.id)!.lastLaunch).toBeUndefined();
  });

  it('names the runners the language does take when it declares some', async () => {
    vi.mocked(dependencies.adapterRegistry.getFactoryMetadata).mockResolvedValue(
      metadataWithModes({ launch: true, attach: 'none', testRunners: ['pytest'] })
    );
    const session = await createSession('gate-other');

    const result = await sessionManager.startDebugging(session.id, 'test.py', [], {}, false, { testRunner: 'jest' });

    expect(result.success).toBe(false);
    expect(result.error).toContain("'jest'");
    expect(result.error).toContain('pytest');
    expect(sessionManager.getSession(session.id)!.state).toBe(SessionState.CREATED);
  });

  it('refuses a testTarget that comes without a runner', async () => {
    const session = await createSession('gate-orphan');

    const result = await sessionManager.startDebugging(session.id, 'test.py', [], {}, false, { testTarget: 'test_x' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('testRunner');
    expect(sessionManager.getSession(session.id)!.state).toBe(SessionState.CREATED);
  });

  it('lets a declared runner through to the launch itself', async () => {
    vi.mocked(dependencies.adapterRegistry.getFactoryMetadata).mockResolvedValue(
      metadataWithModes({ launch: true, attach: 'none', testRunners: ['pytest'] })
    );
    const session = await createSession('gate-ok');

    const launch = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: true }, false, { testRunner: 'pytest' });
    await vi.advanceTimersByTimeAsync(50);
    const result = await launch;

    expect(result.success).toBe(true);
    expect(dependencies.proxyManagerFactory.create).toHaveBeenCalled();
    expect(sessionManager.getSession(session.id)!.lastLaunch?.adapterLaunchConfig).toEqual({ testRunner: 'pytest' });
  });
});
