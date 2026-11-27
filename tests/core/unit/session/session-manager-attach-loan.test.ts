/**
 * Issue #1261: what an attach borrowed from its target is given back when the
 * session that borrowed it ends.
 *
 * The adapter decides what to give back and words it (the JavaScript adapter
 * closes an inspector its attach opened, and leaves one it found open); the
 * session layer holds the loan on the run and gives it back once the adapter
 * has disconnected, on every way an attach run ends: detach, close, a
 * terminating detach, a new launch or attach on the session, a detach after
 * the connection ended by itself. These pin that layer with a fake loan.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AttachLoan } from '@debugmcp/shared';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { createMockDependencies } from './session-manager-test-utils.js';

/** A loan that records when it was given back, relative to the worker stop. */
function fakeLoan(events: string[], text = 'closed: 127.0.0.1:9229 no longer accepts connections') {
  const loan = {
    field: 'inspector',
    describe: vi.fn(() => 'opened by this attach on 127.0.0.1:9229'),
    giveBack: vi.fn(async () => {
      events.push('giveBack');
      return text;
    })
  } satisfies AttachLoan;
  return loan;
}

describe('SessionManager - giving back what an attach borrowed (issue #1261)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;
  let events: string[];

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    const config: SessionManagerConfig = {
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true }
    };
    sessionManager = new SessionManager(config, dependencies);
    events = [];
    const stop = dependencies.mockProxyManager.stop.bind(dependencies.mockProxyManager);
    vi.spyOn(dependencies.mockProxyManager, 'stop').mockImplementation(async () => {
      events.push('workerStop');
      await stop();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  /** A running session that borrows its program and holds a loan, the way an attach leaves one. */
  async function attachedSession(loan: AttachLoan): Promise<string> {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
    const started = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
    await vi.runAllTimersAsync();
    expect((await started).state).toBe(SessionState.RUNNING);
    const managed = sessionManager.getSession(session.id)!;
    managed.run.attachMode = true;
    managed.run.programOwnership = 'borrowed';
    managed.run.attachLoan = loan;
    events.length = 0;
    return session.id;
  }

  it('a detach gives it back once the worker has stopped, and answers what the adapter said', async () => {
    const loan = fakeLoan(events);
    const sessionId = await attachedSession(loan);
    dependencies.mockProxyManager.detachResult = { trigger: 'detach', acknowledged: true, by: 'response' };

    const detached = await sessionManager.detachFromProcess(sessionId);

    expect(detached.success).toBe(true);
    expect(detached.data?.loan).toEqual({ field: 'inspector', text: 'closed: 127.0.0.1:9229 no longer accepts connections' });
    expect(events).toEqual(['workerStop', 'giveBack']);
    expect(sessionManager.getSession(sessionId)!.run.attachLoan).toBeUndefined();
  });

  it('a close after that detach has nothing left to give back and says nothing about it', async () => {
    const loan = fakeLoan(events);
    const sessionId = await attachedSession(loan);
    await sessionManager.detachFromProcess(sessionId);

    const outcome = await sessionManager.closeSessionReporting(sessionId);

    expect(outcome.closed).toBe(true);
    expect(outcome.loan).toBeUndefined();
    expect(loan.giveBack).toHaveBeenCalledTimes(1);
  });

  it('closing an attach root gives it back after the worker stop', async () => {
    const loan = fakeLoan(events, 'left open: it was already open on 127.0.0.1:9229 before this attach');
    const sessionId = await attachedSession(loan);

    const outcome = await sessionManager.closeSessionReporting(sessionId);

    expect(outcome.loan).toEqual({ field: 'inspector', text: 'left open: it was already open on 127.0.0.1:9229 before this attach' });
    expect(events).toEqual(['workerStop', 'giveBack']);
  });

  it('a terminating detach gives it back through the close, and the detach answer carries it', async () => {
    const loan = fakeLoan(events, 'gone: PID 4242 is no longer running, and its inspector went with it');
    const sessionId = await attachedSession(loan);

    const detached = await sessionManager.detachFromProcess(sessionId, true);

    expect(detached.data?.message).toBe('Detached and terminated process');
    expect(detached.data?.loan?.text).toMatch(/^gone: PID 4242/);
    expect(loan.giveBack).toHaveBeenCalledTimes(1);
  });

  it('a detach whose connection already ended by itself still gives it back, and says so beside the refusal', async () => {
    const loan = fakeLoan(events, 'closed: 127.0.0.1:9229 had already stopped listening when this session ended (not closed by this server)');
    const sessionId = await attachedSession(loan);
    const managed = sessionManager.getSession(sessionId)!;
    // The adapter went (its `terminated` reaped the worker) while the target runs on.
    managed.proxyManager = undefined;

    const detached = await sessionManager.detachFromProcess(sessionId);

    expect(detached).toMatchObject({ success: false, error: 'No active debug session to detach from' });
    expect(detached.data?.loan?.text).toMatch(/^closed: 127\.0\.0\.1:9229 had already stopped listening/);
    expect(loan.giveBack).toHaveBeenCalledTimes(1);
    // ...and only once: a second detach has nothing to give back.
    const again = await sessionManager.detachFromProcess(sessionId);
    expect(again.data).toBeUndefined();
  });

  it('a new launch on the session gives the last attach\'s loan back before it starts', async () => {
    const loan = fakeLoan(events);
    const sessionId = await attachedSession(loan);

    const relaunched = sessionManager.startDebugging(sessionId, 'test.py', [], { stopOnEntry: false });
    await vi.runAllTimersAsync();
    await relaunched;

    expect(loan.giveBack).toHaveBeenCalledTimes(1);
    expect(events.indexOf('workerStop')).toBeLessThan(events.indexOf('giveBack'));
    expect(sessionManager.getSession(sessionId)!.run.attachLoan).toBeUndefined();
  });

  it('a child never gives back the loan its tree shares with the root', async () => {
    const loan = fakeLoan(events);
    const sessionId = await attachedSession(loan);
    const root = sessionManager.getSession(sessionId)!;
    const child = { ...root, id: 'child-1', parentSessionId: root.id, run: root.run };

    await expect(sessionManager.giveBackAttachLoan(child)).resolves.toBeUndefined();
    expect(loan.giveBack).not.toHaveBeenCalled();
    expect(root.run.attachLoan).toBe(loan);
  });

  it('a loan that rejects, against its contract, is still reported, and never as closed', async () => {
    const loan = fakeLoan(events);
    loan.giveBack.mockRejectedValueOnce(new Error('socket hang up'));
    const sessionId = await attachedSession(loan);

    const outcome = await sessionManager.closeSessionReporting(sessionId);

    expect(outcome.loan).toEqual({ field: 'inspector', text: 'not confirmed: socket hang up' });
  });
});
