/**
 * Unit tests for inspector-loans.ts (issue #1261): which inspector a session
 * closes when it ends, and what its answer says.
 *
 * The decision, case by case:
 *   - opened by this attach: closed when the session ends;
 *   - found open: left open, on every path;
 *   - shared by sessions of this server: closed by the last one to leave;
 *   - a failed attach that opened it: closed again (its give-back is the same);
 *   - there is no opt-out: nothing a caller passes keeps an inspector this
 *     server opened (see the transform tests for the adapterConfig side).
 * And the close itself: sent only to the opening this server made (its
 * `/json/list` id), answered "closed" only once the port refuses.
 *
 * Every effect outside the process is a fake: the probe, the CDP session, the
 * liveness check and the clock.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  InspectorLoans,
  INSPECTOR_END_ANSWER_MS,
  INSPECTOR_PORT_REFUSAL_MS,
  type InspectorLoanDependencies
} from '../../src/utils/inspector-loans.js';
import type { InspectorEndResult, InspectorProbe } from '../../src/utils/inspector-activation.js';

const PID = 4242;
const open = (id = 'id-1'): InspectorProbe => ({
  status: 'inspector',
  targets: [{ id, title: 'server.js', type: 'node', webSocketDebuggerUrl: `ws://127.0.0.1:9229/${id}` }]
});
const closed: InspectorProbe = { status: 'closed' };

/** A target whose inspector is open until the CDP close ends it. */
function harness(overrides: Partial<InspectorLoanDependencies> & { endResult?: InspectorEndResult } = {}) {
  let inspector: InspectorProbe = open();
  let clock = 0;
  const { endResult = { status: 'dropped' }, ...rest } = overrides;
  const deps: InspectorLoanDependencies = {
    listTargets: vi.fn(async () => inspector),
    endSession: vi.fn(async () => {
      if (endResult.status === 'dropped') inspector = closed;
      return endResult;
    }),
    processExists: vi.fn(() => true),
    sleep: vi.fn(async (ms: number) => { clock += ms; }),
    now: () => clock,
    ...rest
  };
  return {
    loans: new InspectorLoans(deps),
    deps,
    setInspector: (probe: InspectorProbe) => { inspector = probe; }
  };
}

const activation = (alreadyActive: boolean, targetId = 'id-1') =>
  ({ pid: PID, host: '127.0.0.1', port: 9229, alreadyActive, targetId });

describe('InspectorLoans (issue #1261)', () => {
  describe('opened or found', () => {
    it('closes an inspector the attach opened: one guarded CDP close to that opening, then the port must refuse', async () => {
      const { loans, deps } = harness();
      const loan = loans.forActivation(activation(false));
      loan.holder = 'session-a';

      expect(loan.field).toBe('inspector');
      expect(loan.describe()).toBe('opened by this attach on 127.0.0.1:9229; closed when this session detaches or closes');
      await expect(loan.giveBack()).resolves.toBe(
        'closed: 127.0.0.1:9229 no longer accepts connections, and PID 4242 runs on; an attach by processId opens it again'
      );
      expect(deps.endSession).toHaveBeenCalledWith('ws://127.0.0.1:9229/id-1', PID, INSPECTOR_END_ANSWER_MS);
    });

    it('leaves an inspector it found open, and touches nothing to do so', async () => {
      const { loans, deps } = harness();
      const loan = loans.forActivation(activation(true));

      expect(loan.describe()).toBe('already open on 127.0.0.1:9229 before this attach; left open when this session ends');
      await expect(loan.giveBack()).resolves.toBe('left open: it was already open on 127.0.0.1:9229 before this attach');
      expect(deps.listTargets).not.toHaveBeenCalled();
      expect(deps.endSession).not.toHaveBeenCalled();
    });

    it('leaves alone an inspector an attach by port reached that this server did not open, claiming no more than it saw', async () => {
      const { loans, deps } = harness();
      const loan = await loans.forAddress({ host: '127.0.0.1', port: 9229 });

      expect(loan.describe()).toMatch(/^not opened by this server/);
      await expect(loan.giveBack()).resolves.toBe(
        'left as it was: this server did not open it (this attach named its address, 127.0.0.1:9229)'
      );
      expect(deps.endSession).not.toHaveBeenCalled();
    });

    it('a failed attach that opened it gives it back the same way: closed again', async () => {
      // The decision does not depend on how the attach went: the session layer
      // gives the loan back on failure too, after the adapter is stopped.
      const { loans, deps } = harness();
      const loan = loans.forActivation(activation(false));
      await expect(loan.giveBack()).resolves.toMatch(/^closed: /);
      expect(deps.endSession).toHaveBeenCalledTimes(1);
    });

    it('gives back once: a second call answers the first outcome and sends nothing', async () => {
      const { loans, deps } = harness();
      const loan = loans.forActivation(activation(false));
      const first = await loan.giveBack();
      await expect(loan.giveBack()).resolves.toBe(first);
      expect(deps.endSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('the last session out closes it', () => {
    it('a second attach by processId that finds this server\'s inspector shares it; the first to leave leaves it open, naming the other', async () => {
      const { loans, deps } = harness();
      const a = loans.forActivation(activation(false));
      a.holder = 'session-a';
      const b = loans.forActivation(activation(true));
      b.holder = 'session-b';

      expect(b.describe()).toBe(
        'opened by this server on 127.0.0.1:9229, and also used by session session-a; closed when the last of these sessions detaches or closes'
      );
      await expect(a.giveBack()).resolves.toBe(
        'left open: session session-b uses it too and has not detached or closed yet; the last session of this server using it closes it'
      );
      expect(deps.endSession).not.toHaveBeenCalled();
      await expect(b.giveBack()).resolves.toMatch(/^closed: 127\.0\.0\.1:9229 no longer accepts connections/);
      expect(deps.endSession).toHaveBeenCalledTimes(1);
    });

    it('two attaches by processId that both signalled share the one opening', async () => {
      const { loans, deps } = harness();
      const a = loans.forActivation(activation(false));
      const b = loans.forActivation(activation(false));
      await a.giveBack();
      expect(deps.endSession).not.toHaveBeenCalled();
      await b.giveBack();
      expect(deps.endSession).toHaveBeenCalledTimes(1);
    });

    it('an attach by port that reaches this server\'s opening shares it (its id is checked)', async () => {
      const { loans, deps } = harness();
      const a = loans.forActivation(activation(false));
      a.holder = 'session-a';
      const b = await loans.forAddress({ host: 'localhost', port: 9229 });

      expect(b.describe()).toMatch(/also used by session session-a/);
      await expect(a.giveBack()).resolves.toMatch(/^left open: an attach still in progress uses it too and has not detached or closed yet/);
      await expect(b.giveBack()).resolves.toMatch(/^closed: /);
      expect(deps.endSession).toHaveBeenCalledTimes(1);
    });

    it('an attach by inspector URL shares it when the URL names that opening, with no probe', async () => {
      const { loans, deps } = harness();
      const a = loans.forActivation(activation(false));
      const b = await loans.forAddress({ websocketAddress: 'ws://127.0.0.1:9229/id-1' });
      expect(deps.listTargets).not.toHaveBeenCalled();
      await a.giveBack();
      expect(deps.endSession).not.toHaveBeenCalled();
      await b.giveBack();
      expect(deps.endSession).toHaveBeenCalledTimes(1);
    });

    it('an address that reaches a different opening on that port, or another host, shares nothing', async () => {
      const { loans, setInspector } = harness();
      loans.forActivation(activation(false));
      setInspector(open('id-2'));
      expect((await loans.forAddress({ host: '127.0.0.1', port: 9229 })).describe()).toMatch(/^not opened by this server/);
      expect((await loans.forAddress({ websocketAddress: 'ws://127.0.0.1:9229/id-2' })).describe()).toMatch(/^not opened by this server/);
      expect((await loans.forAddress({ host: '10.0.0.5', port: 9229 })).describe()).toMatch(/^not opened by this server/);
    });

    it('an attach by port whose probe overlaps the last holder leaving shares nothing, and waits for the close', async () => {
      const { loans, deps } = harness();
      const a = loans.forActivation(activation(false));
      let answerProbe!: (probe: InspectorProbe) => void;
      vi.mocked(deps.listTargets).mockImplementationOnce(() => new Promise((resolve) => { answerProbe = resolve; }));
      const joining = loans.forAddress({ host: '127.0.0.1', port: 9229 });
      await vi.waitFor(() => expect(deps.listTargets).toHaveBeenCalledTimes(1));

      const closing = a.giveBack();
      answerProbe(open());
      const b = await joining;

      expect(b.describe()).toMatch(/^not opened by this server/);
      await expect(closing).resolves.toMatch(/^closed: /);
      await expect(b.giveBack()).resolves.toMatch(/^left as it was/);
      expect(deps.endSession).toHaveBeenCalledTimes(1);
    });

    it('an attach that finds the port mid-close waits for the close to finish', async () => {
      let finishEnd!: () => void;
      const { loans, deps } = harness({
        endSession: vi.fn(() => new Promise<InspectorEndResult>((resolve) => { finishEnd = () => resolve({ status: 'dropped' }); }))
      });
      vi.mocked(deps.listTargets).mockResolvedValueOnce(open()).mockResolvedValue(closed);
      const a = loans.forActivation(activation(false));
      const giving = a.giveBack();
      await vi.waitFor(() => expect(deps.endSession).toHaveBeenCalled());
      let settled = false;
      const waiting = loans.settled('127.0.0.1', 9229).then(() => { settled = true; });
      await Promise.resolve();
      expect(settled).toBe(false);
      finishEnd();
      await giving;
      await waiting;
      expect(settled).toBe(true);
    });
  });

  describe('what the close observed', () => {
    it('says the process is gone, and sends nothing, when the target has exited', async () => {
      const { loans, deps } = harness({ processExists: vi.fn(() => false) });
      await expect(loans.forActivation(activation(false)).giveBack()).resolves.toBe(
        'gone: PID 4242 is no longer running, and its inspector went with it'
      );
      expect(deps.endSession).not.toHaveBeenCalled();
    });

    it('leaves an inspector whose id changed: the one on the port is no longer the opening this server made', async () => {
      const { loans, deps, setInspector } = harness();
      const loan = loans.forActivation(activation(false));
      setInspector(open('id-other'));
      await expect(loan.giveBack()).resolves.toBe(
        'left open: the inspector on 127.0.0.1:9229 is no longer the one this server opened (it was closed and opened again since)'
      );
      expect(deps.endSession).not.toHaveBeenCalled();
    });

    it('says an inspector something else already closed is closed, and not by this server', async () => {
      const { loans, deps, setInspector } = harness();
      const loan = loans.forActivation(activation(false));
      setInspector(closed);
      await expect(loan.giveBack()).resolves.toBe(
        'closed: 127.0.0.1:9229 had already stopped listening when this session ended (not closed by this server); PID 4242 runs on'
      );
      expect(deps.endSession).not.toHaveBeenCalled();
    });

    it('never says closed on hope: a close that drew no drop within its window is not confirmed', async () => {
      const { loans } = harness({ endResult: { status: 'timeout' } });
      await expect(loans.forActivation(activation(false)).giveBack()).resolves.toBe(
        `not confirmed closed: the inspector did not end within ${INSPECTOR_END_ANSWER_MS} ms ` +
          '(PID 4242 may be held paused by another debugger, or busy outside JavaScript); 127.0.0.1:9229 may still be listening'
      );
    });

    it('never says closed on hope: a port that still answers after the drop is not confirmed', async () => {
      const { loans, deps } = harness();
      vi.mocked(deps.endSession).mockResolvedValue({ status: 'dropped' });
      await expect(loans.forActivation(activation(false)).giveBack()).resolves.toBe(
        `not confirmed closed: 127.0.0.1:9229 still answered ${INSPECTOR_PORT_REFUSAL_MS} ms after the inspector dropped the connection; ` +
          '127.0.0.1:9229 may still be listening'
      );
    });

    it('names a failed _debugEnd, and a guard that found another PID, without closing anything', async () => {
      let h = harness({ endResult: { status: 'failed', detail: 'TypeError: process._debugEnd is not a function' } });
      await expect(h.loans.forActivation(activation(false)).giveBack()).resolves.toBe(
        'not confirmed closed: process._debugEnd() failed in PID 4242: TypeError: process._debugEnd is not a function; 127.0.0.1:9229 may still be listening'
      );
      h = harness({ endResult: { status: 'other-pid', pid: 777 } });
      await expect(h.loans.forActivation(activation(false)).giveBack()).resolves.toBe(
        'left open: the inspector on 127.0.0.1:9229 answers for PID 777, not PID 4242'
      );
    });

    it('a target that exits during the close is reported gone, not closed', async () => {
      const exists = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
      const { loans } = harness({ processExists: exists });
      await expect(loans.forActivation(activation(false)).giveBack()).resolves.toMatch(/^gone: PID 4242/);
    });
  });
});
