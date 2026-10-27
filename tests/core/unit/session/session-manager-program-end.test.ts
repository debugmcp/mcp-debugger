/**
 * The policy's reading of a program's end (issue #877) reaches every answer that reports the end:
 * the launch that ended within its hold, wait_for_stop, and the session listing. Recorded once, at
 * the end event, from the output the program and its tool printed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { createMockDependencies, overridePolicy } from './session-manager-test-utils.js';

describe('SessionManager - program-end explanation (issue #877)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;
  let config: SessionManagerConfig;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    config = { logDirBase: '/tmp/test-sessions', defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true } };
    sessionManager = new SessionManager(config, dependencies);
    overridePolicy(sessionManager, {
      explainProgramEnd: ({ outputTail }) => {
        const m = /matching '([^']*)'/.exec(outputTail);
        return m ? { note: `deviceId '${m[1]}' matched no device.`, data: { availableDevices: [{ id: 'windows' }] } } : undefined;
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  async function createSession() {
    return sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
  }

  function endWithDeviceMiss() {
    dependencies.mockProxyManager.emit('output', { category: 'console', output: "No supported devices found with name or id matching 'bogus'.\n" });
    dependencies.mockProxyManager.simulateExited(1);
  }

  it('records the explanation at the end event and answers it from wait_for_stop and the listing', async () => {
    const session = await createSession();
    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();

    endWithDeviceMiss();
    await vi.runAllTimersAsync();

    const waited = await sessionManager.waitForStop(session.id, 1000);
    expect(waited.state).toBe(SessionState.STOPPED);
    expect(waited.data?.message).toMatch(/deviceId 'bogus' matched no device/);
    // Nested, so the tool handler can hoist it beside the message without knowing its keys.
    expect(waited.data?.programEnd).toEqual({ note: "deviceId 'bogus' matched no device.", data: { availableDevices: [{ id: 'windows' }] } });

    const listed = sessionManager.getAllSessions().find((s) => s.id === session.id);
    expect(listed?.programEnd?.note).toMatch(/matched no device/);
  });

  it('answers it from the launch itself when the program ends within the hold', async () => {
    const session = await createSession();
    const launching = sessionManager.startDebugging(session.id, 'test.py');
    await vi.advanceTimersByTimeAsync(50);
    endWithDeviceMiss();
    await vi.runAllTimersAsync();
    const result = await launching;

    expect(result.success).toBe(true);
    expect(result.state).toBe(SessionState.STOPPED);
    expect(result.data?.message).toMatch(/deviceId 'bogus' matched no device/);
    expect((result.data as { availableDevices?: unknown[] }).availableDevices).toEqual([{ id: 'windows' }]);
  });

  it('adds nothing when the policy has nothing to say, and forgets it on the next launch', async () => {
    const session = await createSession();
    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();
    endWithDeviceMiss();
    await vi.runAllTimersAsync();
    expect(sessionManager.getAllSessions().find((s) => s.id === session.id)?.programEnd).toBeDefined();

    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();
    dependencies.mockProxyManager.emit('output', { category: 'stdout', output: 'done\n' });
    dependencies.mockProxyManager.simulateExited(0);
    await vi.runAllTimersAsync();
    const waited = await sessionManager.waitForStop(session.id, 1000);
    expect(waited.data?.message).not.toMatch(/matched no device/);
    expect(sessionManager.getAllSessions().find((s) => s.id === session.id)?.programEnd).toBeUndefined();
  });
});
