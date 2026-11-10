/**
 * Debug-session ownership in the core (issue #1025, step 2): a session is
 * created in the caller's scope, a child adopted under it inherits that scope,
 * and the visibility reads the handlers and resources filter through live
 * here. The key itself never reaches the public listing.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

const report = (reportId: string, pid = 4242) => ({
  reportId,
  targetId: String(pid),
  name: `Subprocess ${pid}`,
  configuration: { type: 'python', subProcessId: pid }
});

describe('SessionManager owner keys (issue #1025, step 2)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;
  const config: SessionManagerConfig = {
    logDirBase: '/tmp/test-sessions',
    defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true }
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  it('a session created in a scope is visible to that scope and to no other', async () => {
    const a = await sessionManager.createSession({ language: DebugLanguage.MOCK, ownerKey: 'agent-a' });

    expect(sessionManager.isSessionVisibleTo(a.id, 'agent-a')).toBe(true);
    expect(sessionManager.isSessionVisibleTo(a.id, 'agent-b')).toBe(false);
    expect(sessionManager.isSessionVisibleTo(a.id, undefined)).toBe(false);
  });

  it('the anonymous scope sees anonymous sessions only, and an unknown id is visible to nobody', async () => {
    const anon = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    const keyed = await sessionManager.createSession({ language: DebugLanguage.MOCK, ownerKey: 'agent-a' });

    expect(sessionManager.getSessionsVisibleTo(undefined).map((s) => s.id)).toEqual([anon.id]);
    expect(sessionManager.getSessionsVisibleTo('agent-a').map((s) => s.id)).toEqual([keyed.id]);
    expect(sessionManager.isSessionVisibleTo('nope', undefined)).toBe(false);
    expect(sessionManager.isSessionVisibleTo('nope', 'agent-a')).toBe(false);
  });

  it('a child adopted under a keyed root inherits the root scope', async () => {
    const root = await sessionManager.createSession({ language: DebugLanguage.MOCK, ownerKey: 'agent-a' });
    await sessionManager.setBreakpoint(root.id, { file: '/w/child.py', line: 7 });
    await sessionManager.startDebugging(root.id, 'test.py');
    await vi.runAllTimersAsync();

    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    await vi.runAllTimersAsync();

    const child = sessionManager.getAllSessions().find((s) => s.parentSessionId === root.id);
    expect(child).toBeDefined();
    expect(sessionManager.isSessionVisibleTo(child!.id, 'agent-a')).toBe(true);
    expect(sessionManager.isSessionVisibleTo(child!.id, undefined)).toBe(false);
    expect(sessionManager.getSessionsVisibleTo('agent-a').map((s) => s.id).sort()).toEqual([root.id, child!.id].sort());
  });

  it('the public listing never carries the key', async () => {
    await sessionManager.createSession({ language: DebugLanguage.MOCK, ownerKey: 'agent-a' });

    for (const row of sessionManager.getAllSessions()) {
      expect(row).not.toHaveProperty('ownerKey');
    }
  });
});
