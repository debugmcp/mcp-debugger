/**
 * Issue #1261: what an attach left in its target is carried, never given
 * back. The close of an attach root carries its run's footprint for the
 * answer to word; a child, which shares its root's run, carries none.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AttachFootprint } from '@debugmcp/shared';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { createMockDependencies } from './session-manager-test-utils.js';

function fakeFootprint(): AttachFootprint {
  return { field: 'inspector', atAttach: 'opened by this attach on 127.0.0.1:9229', atEnd: vi.fn(async () => 'still listening') };
}

describe('SessionManager - what an attach left in its target (issue #1261)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
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

  /** A running session that borrows its program and carries a footprint, the way an attach leaves one. */
  async function attachedSession(footprint: AttachFootprint): Promise<string> {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
    const started = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
    await vi.runAllTimersAsync();
    expect((await started).state).toBe(SessionState.RUNNING);
    const managed = sessionManager.getSession(session.id)!;
    managed.run.attachMode = true;
    managed.run.programOwnership = 'borrowed';
    managed.run.attachFootprint = footprint;
    return session.id;
  }

  it('closing an attach root carries its footprint, and observes nothing itself', async () => {
    const footprint = fakeFootprint();
    const sessionId = await attachedSession(footprint);

    const outcome = await sessionManager.closeSessionReporting(sessionId);

    expect(outcome.closed).toBe(true);
    expect(outcome.attachFootprint).toBe(footprint);
    expect(footprint.atEnd).not.toHaveBeenCalled();
  });

  it('closing a child that shares the root\'s run carries none', async () => {
    const footprint = fakeFootprint();
    const rootId = await attachedSession(footprint);
    const root = sessionManager.getSession(rootId)!;
    const child = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
    const managedChild = sessionManager.getSession(child.id)!;
    managedChild.parentSessionId = rootId;
    managedChild.run = root.run;

    const outcome = await sessionManager.closeSessionReporting(child.id);

    expect(outcome.closed).toBe(true);
    expect(outcome).not.toHaveProperty('attachFootprint');
    expect(root.run.attachFootprint).toBe(footprint);
  });

  it('a session whose attach left nothing carries nothing', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
    expect(await sessionManager.closeSessionReporting(session.id)).not.toHaveProperty('attachFootprint');
  });
});
