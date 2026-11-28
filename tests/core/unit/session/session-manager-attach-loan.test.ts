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

    // Nor the report the root's teardown kept: the root's own answer carries it.
    await sessionManager.returnAttachLoan(root);
    await expect(sessionManager.giveBackAttachLoan(child)).resolves.toBeUndefined();
    expect(root.run.attachLoanReturns).toHaveLength(1);
    await expect(sessionManager.giveBackAttachLoan(root)).resolves.toMatchObject({ field: 'inspector' });
  });

  describe('a connection that ended by itself (review of round 1)', () => {
    it.each(['terminated', 'exited', 'error'] as const)(
      'after %s, the root gives it back once its worker teardown completes, and the next close carries the report',
      async (event) => {
        const loan = fakeLoan(events);
        const sessionId = await attachedSession(loan);

        if (event === 'error') {
          dependencies.mockProxyManager.simulateError(new Error('adapter died'));
        } else if (event === 'exited') {
          dependencies.mockProxyManager.simulateExited(0);
        } else {
          dependencies.mockProxyManager.simulateEvent('terminated');
        }
        await vi.runAllTimersAsync();
        await sessionManager.getSession(sessionId)!.pendingProxyStop;

        expect(loan.giveBack).toHaveBeenCalledTimes(1);
        expect(events).toEqual(['workerStop', 'giveBack']);
        expect(sessionManager.getSession(sessionId)!.run.attachLoan).toBeUndefined();

        const outcome = await sessionManager.closeSessionReporting(sessionId);
        expect(outcome.loan).toEqual({ field: 'inspector', text: 'closed: 127.0.0.1:9229 no longer accepts connections' });
        expect(loan.giveBack).toHaveBeenCalledTimes(1);
      }
    );

    it('a root that ends with a live child keeps its worker for the child, and gives back only when the last child ends', async () => {
      const loan = fakeLoan(events);
      const sessionId = await attachedSession(loan);
      dependencies.mockProxyManager.simulateEvent('child-reported', {
        reportId: 'r1', targetId: '5151', name: 'Subprocess 5151', configuration: { type: 'python', subProcessId: 5151 }
      });
      await vi.runAllTimersAsync();
      const child = sessionManager.getAllSessions().find((s) => s.parentSessionId === sessionId);
      expect(child).toBeDefined();
      events.length = 0;

      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      // The root's worker is deferred for its child: nothing given back yet.
      expect(loan.giveBack).not.toHaveBeenCalled();
      expect(sessionManager.getSession(sessionId)!.run.attachLoan).toBe(loan);

      dependencies.mockProxyManager.childViews.get(child!.id)!.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      await sessionManager.getSession(sessionId)!.pendingProxyStop;

      expect(loan.giveBack).toHaveBeenCalledTimes(1);
      expect(events).toEqual(['workerStop', 'giveBack']);
      const outcome = await sessionManager.closeSessionReporting(sessionId);
      expect(outcome.loan?.text).toMatch(/^closed: /);
    });

    it('a worker process that exits under a root with a live child gives back nothing then; the close does', async () => {
      const loan = fakeLoan(events);
      const sessionId = await attachedSession(loan);
      dependencies.mockProxyManager.simulateEvent('child-reported', {
        reportId: 'r1', targetId: '5151', name: 'Subprocess 5151', configuration: { type: 'python', subProcessId: 5151 }
      });
      await vi.runAllTimersAsync();
      expect(sessionManager.getAllSessions().some((s) => s.parentSessionId === sessionId)).toBe(true);

      dependencies.mockProxyManager.simulateExit(1);
      await vi.runAllTimersAsync();
      expect(loan.giveBack).not.toHaveBeenCalled();

      const outcome = await sessionManager.closeSessionReporting(sessionId);
      expect(loan.giveBack).toHaveBeenCalledTimes(1);
      expect(outcome.loan?.text).toMatch(/^closed: /);
    });

    it('after the worker process itself exits, it is given back too', async () => {
      const loan = fakeLoan(events);
      const sessionId = await attachedSession(loan);
      dependencies.mockProxyManager.simulateExit(1);
      await vi.runAllTimersAsync();
      await sessionManager.getSession(sessionId)!.pendingProxyStop;
      expect(loan.giveBack).toHaveBeenCalledTimes(1);
    });

    it('the detach that follows answers with that report, once', async () => {
      const loan = fakeLoan(events);
      const sessionId = await attachedSession(loan);
      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();

      const detached = await sessionManager.detachFromProcess(sessionId);
      expect(detached).toMatchObject({ success: false, error: 'No active debug session to detach from' });
      expect(detached.data?.loan?.text).toMatch(/^closed: /);

      const closed = await sessionManager.closeSessionReporting(sessionId);
      expect(closed.loan).toBeUndefined();
    });
  });

  describe('a teardown already in flight is waited for (review of round 1)', () => {
    /** A worker stop that finishes only when the test says. */
    function heldStop(): { release: () => void } {
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      vi.mocked(dependencies.mockProxyManager.stop).mockImplementation(async () => {
        events.push('workerStop');
        await held;
        events.push('workerStopped');
      });
      return { release };
    }

    it('a detach after the connection ended by itself waits for the worker stop before it gives back', async () => {
      const loan = fakeLoan(events);
      const sessionId = await attachedSession(loan);
      const { release } = heldStop();
      dependencies.mockProxyManager.simulateEvent('terminated');
      await Promise.resolve();

      const detaching = sessionManager.detachFromProcess(sessionId);
      await new Promise((resolve) => setImmediate(resolve));
      expect(loan.giveBack).not.toHaveBeenCalled();
      release();
      const detached = await detaching;

      expect(events).toEqual(['workerStop', 'workerStopped', 'giveBack']);
      expect(detached.data?.loan?.text).toMatch(/^closed: /);
    });

    it('a detach whose disconnect drew a terminated in reply waits for that teardown before it gives back', async () => {
      const loan = fakeLoan(events);
      const sessionId = await attachedSession(loan);
      const { release } = heldStop();
      const send = dependencies.mockProxyManager.sendDapRequest.bind(dependencies.mockProxyManager);
      vi.spyOn(dependencies.mockProxyManager, 'sendDapRequest').mockImplementation(async (command: string, args?: unknown) => {
        if (command === 'disconnect') {
          dependencies.mockProxyManager.simulateEvent('terminated');
        }
        return send(command, args);
      });

      const detaching = sessionManager.detachFromProcess(sessionId);
      await new Promise((resolve) => setImmediate(resolve));
      expect(loan.giveBack).not.toHaveBeenCalled();
      release();
      const detached = await detaching;

      expect(events.indexOf('workerStopped')).toBeLessThan(events.indexOf('giveBack'));
      expect(detached.data?.loan?.text).toMatch(/^closed: /);
    });
  });

  it('the teardown before a new run gives back after the worker stop, and leaves the report for the next answer', async () => {
    const loan = fakeLoan(events);
    const sessionId = await attachedSession(loan);
    const managed = sessionManager.getSession(sessionId)!;

    await (sessionManager as unknown as { stopProxyPreservingSession(s: typeof managed): Promise<number> })
      .stopProxyPreservingSession(managed);

    expect(events).toEqual(['workerStop', 'giveBack']);
    expect(managed.run.attachLoan).toBeUndefined();
    expect(managed.run.attachLoanReturns).toHaveLength(1);
    await expect(sessionManager.giveBackAttachLoan(managed)).resolves.toEqual({ field: 'inspector', text: 'closed: 127.0.0.1:9229 no longer accepts connections' });
    expect(managed.run.attachLoanReturns).toBeUndefined();
  });

  describe('a report is never dropped by a new run (review round 2, blocker 3)', () => {
    const unconfirmed = 'not confirmed closed: the inspector did not end within 2000 ms (PID 4242 may be held paused by another debugger, or busy outside JavaScript); 127.0.0.1:9229 may still be listening';

    it('a launch after an attach whose close could not be confirmed keeps that report, and the next close carries it', async () => {
      const loan = fakeLoan(events, unconfirmed);
      const sessionId = await attachedSession(loan);

      const relaunched = sessionManager.startDebugging(sessionId, 'test.py', [], { stopOnEntry: false });
      await vi.runAllTimersAsync();
      expect((await relaunched).success).toBe(true);
      expect(loan.giveBack).toHaveBeenCalledTimes(1);

      const outcome = await sessionManager.closeSessionReporting(sessionId);
      expect(outcome.loan).toEqual({ field: 'inspector', text: unconfirmed });
    });

    it('an attach after it keeps it too: the next detach carries both, this run\'s first', async () => {
      const earlier = fakeLoan(events, unconfirmed);
      const sessionId = await attachedSession(earlier);
      const managed = sessionManager.getSession(sessionId)!;
      await (sessionManager as unknown as { stopProxyPreservingSession(s: typeof managed): Promise<number> })
        .stopProxyPreservingSession(managed);

      // The next run holds a loan of its own.
      const later = fakeLoan(events, 'closed: 127.0.0.1:9229 no longer accepts connections, and PID 4242 runs on');
      const relaunched = sessionManager.startDebugging(sessionId, 'test.py', [], { stopOnEntry: false });
      await vi.runAllTimersAsync();
      await relaunched;
      managed.run.attachMode = true;
      managed.run.programOwnership = 'borrowed';
      managed.run.attachLoan = later;

      const detached = await sessionManager.detachFromProcess(sessionId);
      expect(detached.data?.loan).toEqual({
        field: 'inspector',
        text: `closed: 127.0.0.1:9229 no longer accepts connections, and PID 4242 runs on; earlier in this session: ${unconfirmed}`
      });
      // ...and once: the close after it carries nothing.
      expect((await sessionManager.closeSessionReporting(sessionId)).loan).toBeUndefined();
    });
  });

  it('a loan that rejects, against its contract, is still reported, and never as closed', async () => {
    const loan = fakeLoan(events);
    loan.giveBack.mockRejectedValueOnce(new Error('socket hang up'));
    const sessionId = await attachedSession(loan);

    const outcome = await sessionManager.closeSessionReporting(sessionId);

    expect(outcome.loan).toEqual({ field: 'inspector', text: 'not confirmed: socket hang up' });
  });
});
