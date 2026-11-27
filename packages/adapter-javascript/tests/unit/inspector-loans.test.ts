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
  INSPECTOR_DISCOVERY_MS,
  INSPECTOR_END_ANSWER_MS,
  INSPECTOR_PORT_REFUSAL_MS,
  type InspectorLoanDependencies
} from '../../src/utils/inspector-loans.js';
import { SignalledActivationError, type InspectorEndResult, type InspectorProbe } from '../../src/utils/inspector-activation.js';

/** A promise and the function that settles it, to force an ordering. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

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

  });

  /**
   * One endpoint is one queue (review of round 1): an attach's activation and
   * registration, and a last holder's release with its close, never
   * interleave. Each ordering is forced with deferred promises.
   */
  describe('the endpoint queue', () => {
    const result = (alreadyActive: boolean, targetId = 'id-1') =>
      ({ host: '127.0.0.1', port: 9229, alreadyActive, title: 'server.js', targetId });
    const endpoint = { host: '127.0.0.1', port: 9229 };
    const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

    it('an attach whose activation is in flight when the last holder leaves joins first; the leaving holder then leaves it open', async () => {
      const { loans, deps } = harness();
      const a = (await loans.attachByProcessId(PID, endpoint, async () => result(false))).loan!;
      a.holder = 'session-a';
      const activation = deferred<ReturnType<typeof result>>();
      const joining = loans.attachByProcessId(PID, endpoint, () => activation.promise);

      const leaving = a.giveBack();
      // The release waits for the attach in flight: nothing was sent yet.
      await tick();
      expect(deps.endSession).not.toHaveBeenCalled();
      activation.resolve(result(true));
      const b = (await joining).loan!;
      expect(b.kind).toBe('joined');

      await expect(leaving).resolves.toMatch(/^left open: an attach still in progress uses it too/);
      expect(deps.endSession).not.toHaveBeenCalled();
      await expect(b.giveBack()).resolves.toMatch(/^closed: /);
      expect(deps.endSession).toHaveBeenCalledTimes(1);
    });

    it('an attach that arrives while the last holder\'s close is in flight runs after it, and finds the port closed', async () => {
      const finishEnd = deferred<InspectorEndResult>();
      const { loans, deps, setInspector } = harness({
        endSession: vi.fn(async () => { const r = await finishEnd.promise; setInspector(closed); return r; })
      });
      const a = (await loans.attachByProcessId(PID, endpoint, async () => result(false))).loan!;
      const leaving = a.giveBack();
      await vi.waitFor(() => expect(deps.endSession).toHaveBeenCalled());
      const activate = vi.fn(async () => result(false, 'id-2'));
      const attaching = loans.attachByProcessId(PID, endpoint, activate);
      await tick();
      expect(activate).not.toHaveBeenCalled();

      finishEnd.resolve({ status: 'dropped' });
      await expect(leaving).resolves.toMatch(/^closed: /);
      const b = (await attaching).loan!;
      expect(activate).toHaveBeenCalledTimes(1);
      expect(b.kind).toBe('opened');
    });

    it('an attach that finds the inspector another attach\'s signal is opening waits for that attach to record it, then shares it', async () => {
      const { loans, deps } = harness();
      const opening = deferred<ReturnType<typeof result>>();
      const first = loans.attachByProcessId(PID, endpoint, () => opening.promise);
      const secondActivation = vi.fn(async () => result(true));
      const second = loans.attachByProcessId(PID, endpoint, secondActivation);
      await tick();
      expect(secondActivation).not.toHaveBeenCalled();

      opening.resolve(result(false));
      const a = (await first).loan!;
      const b = (await second).loan!;
      expect(b.kind).toBe('joined');
      await a.giveBack();
      expect(deps.endSession).not.toHaveBeenCalled();
      await b.giveBack();
      expect(deps.endSession).toHaveBeenCalledTimes(1);
    });

    it('an attach by port that arrives during the last holder\'s close waits for it, and shares nothing', async () => {
      const finishEnd = deferred<InspectorEndResult>();
      const { loans, deps, setInspector } = harness({
        endSession: vi.fn(async () => { const r = await finishEnd.promise; setInspector(closed); return r; })
      });
      const a = loans.forActivation(activation(false));
      const leaving = a.giveBack();
      await vi.waitFor(() => expect(deps.endSession).toHaveBeenCalled());
      let joined = false;
      const joining = loans.forAddress({ host: '127.0.0.1', port: 9229 }).then((loan) => { joined = true; return loan; });
      await tick();
      expect(joined).toBe(false);

      finishEnd.resolve({ status: 'dropped' });
      await leaving;
      expect((await joining).kind).toBe('addressed');
    });

    it('an attach by port in flight when the last holder leaves joins first, so the holder leaves it open', async () => {
      const { loans, deps } = harness();
      const a = loans.forActivation(activation(false));
      a.holder = 'session-a';
      const probe = deferred<InspectorProbe>();
      vi.mocked(deps.listTargets).mockImplementationOnce(() => probe.promise);
      const joining = loans.forAddress({ host: '127.0.0.1', port: 9229 });
      await vi.waitFor(() => expect(deps.listTargets).toHaveBeenCalledTimes(1));
      const leaving = a.giveBack();
      probe.resolve(open());
      const b = await joining;

      expect(b.kind).toBe('joined');
      await expect(leaving).resolves.toMatch(/^left open: /);
      expect(deps.endSession).not.toHaveBeenCalled();
    });

    it('an attach by port that arrives while an attach told no port is still searching waits for it, and shares what it found', async () => {
      const { loans, deps } = harness();
      const activation = deferred<ReturnType<typeof result>>();
      const byPid = loans.attachByProcessId(PID, endpoint, () => activation.promise, { mayOpenElsewhere: true });
      vi.mocked(deps.listTargets).mockResolvedValue({ status: 'inspector', targets: [{ id: 'id-5', webSocketDebuggerUrl: 'ws://127.0.0.1:5945/id-5' }] });
      let joined = false;
      const byPort = loans.forAddress({ host: '127.0.0.1', port: 5945 }).then((loan) => { joined = true; return loan; });
      await tick();
      expect(joined).toBe(false);

      // The activation finds its inspector on 5945, a port nothing named.
      activation.resolve({ ...result(false, 'id-5'), port: 5945 });
      const a = (await byPid).loan!;
      const b = await byPort;
      expect(a.kind).toBe('opened');
      expect(b.kind).toBe('joined');
      expect(loans.portOpenedFor(PID)).toBe(5945);
      await a.giveBack();
      expect(deps.endSession).not.toHaveBeenCalled();
    });

    it('an attach by port does not wait for an attach by processId that was told its port', async () => {
      const { loans } = harness();
      const activation = deferred<ReturnType<typeof result>>();
      const byPid = loans.attachByProcessId(PID, endpoint, () => activation.promise);
      const b = await loans.forAddress({ host: '127.0.0.1', port: 5945 });
      expect(b.kind).toBe('addressed');
      activation.resolve(result(false));
      await byPid;
    });

    it('settled() resolves once everything queued on the endpoint has run', async () => {
      const finishEnd = deferred<InspectorEndResult>();
      const { loans, deps } = harness({ endSession: vi.fn(() => finishEnd.promise) });
      const a = loans.forActivation(activation(false));
      const leaving = a.giveBack();
      await vi.waitFor(() => expect(deps.endSession).toHaveBeenCalled());
      let settled = false;
      const waiting = loans.settled('127.0.0.1', 9229).then(() => { settled = true; });
      await tick();
      expect(settled).toBe(false);
      finishEnd.resolve({ status: 'dropped' });
      await leaving;
      await waiting;
      expect(settled).toBe(true);
    });

    it('a failed activation that did not signal holds nothing; one that signalled holds a loan that looks for what it opened', async () => {
      const { loans } = harness();
      const refused = await loans.attachByProcessId(PID, endpoint, async () => { throw new Error('not a Node.js process'); });
      expect(refused.loan).toBeUndefined();
      expect(refused.error).toBeInstanceOf(Error);

      const signalled = await loans.attachByProcessId(PID, endpoint, async () => {
        throw new SignalledActivationError('none opened on 127.0.0.1:9229', PID, '127.0.0.1', [9229, 5945]);
      });
      expect(signalled.loan?.kind).toBe('signalled');
      expect(signalled.error).toBeInstanceOf(SignalledActivationError);
    });
  });

  describe('who may share an opening', () => {
    it('an activation for another PID does not join this server\'s opening, even with the same id', () => {
      const { loans } = harness();
      loans.forActivation(activation(false));
      const other = loans.forActivation({ pid: PID + 1, host: '127.0.0.1', port: 9229, alreadyActive: true, targetId: 'id-1' });
      expect(other.kind).toBe('found');
    });

    it('an activation that found another opening on the port (another id) does not join', () => {
      const { loans } = harness();
      loans.forActivation(activation(false));
      expect(loans.forActivation(activation(true, 'id-2')).kind).toBe('found');
    });

    it('an opening with no id is never joined, by processId or by address', async () => {
      const { loans } = harness();
      loans.forActivation({ pid: PID, host: '127.0.0.1', port: 9229, alreadyActive: false });
      expect(loans.forActivation({ pid: PID, host: '127.0.0.1', port: 9229, alreadyActive: true }).kind).toBe('found');
      expect((await loans.forAddress({ host: '127.0.0.1', port: 9229 })).kind).toBe('addressed');
    });

    it('a remote address never shares a local opening, though its port and id match', async () => {
      const { loans, deps } = harness();
      loans.forActivation(activation(false));
      expect((await loans.forAddress({ host: '10.0.0.5', port: 9229 })).kind).toBe('addressed');
      expect((await loans.forAddress({ websocketAddress: 'ws://10.0.0.5:9229/id-1' })).kind).toBe('addressed');
      expect(deps.listTargets).not.toHaveBeenCalled();
    });
  });

  describe('an attach that signalled and then failed', () => {
    const signalledLoan = async (loans: InspectorLoans, ports = [9229, 5945]) =>
      (await loans.attachByProcessId(PID, { host: '127.0.0.1', port: 9229 }, async () => {
        throw new SignalledActivationError('none opened', PID, '127.0.0.1', ports);
      })).loan!;

    it('closes an inspector of the PID it finds on one of the places the signal could open it, and says so', async () => {
      const probes: Record<number, InspectorProbe> = { 9229: closed, 5945: open('id-9') };
      const { loans, deps } = harness({
        listTargets: vi.fn(async (_host: string, port: number) => probes[port] ?? closed),
        endSession: vi.fn(async () => { probes[5945] = closed; return { status: 'dropped' as const }; })
      });
      const loan = await signalledLoan(loans);

      await expect(loan.giveBack()).resolves.toBe(
        `closed: the signal this attach sent had opened PID ${PID}'s inspector on 127.0.0.1:5945; it no longer accepts connections, and PID ${PID} runs on`
      );
      expect(deps.endSession).toHaveBeenCalledWith('ws://127.0.0.1:9229/id-9', PID, INSPECTOR_END_ANSWER_MS);
    });

    it('says plainly when nothing was found, naming where it looked, and never says closed', async () => {
      const { loans, setInspector } = harness();
      setInspector(closed);
      const loan = await signalledLoan(loans);
      await expect(loan.giveBack()).resolves.toBe(
        `not confirmed closed: this attach signalled PID ${PID} to open its inspector, and none of PID ${PID}'s was found on ` +
          '127.0.0.1:9229 or 127.0.0.1:5945; one may be open on a port this server could not identify ' +
          '(a target started with --inspect-port=<n> opens it there) — restart the target to close it'
      );
    });

    it('passes over an inspector of another PID, and a port another session of this server holds', async () => {
      const { loans, deps } = harness({ endResult: { status: 'other-pid', pid: 777 } });
      loans.forActivation({ pid: 777, host: '127.0.0.1', port: 5945, alreadyActive: false, targetId: 'id-5' });
      const loan = await signalledLoan(loans);
      await expect(loan.giveBack()).resolves.toMatch(/^not confirmed closed: this attach signalled/);
      // 9229 was asked (and answered for PID 777); 5945 is another session's opening and was not.
      expect(deps.endSession).toHaveBeenCalledTimes(1);
    });

    it('says the process is gone when it has exited, and looks for nothing', async () => {
      const { loans, deps } = harness({ processExists: vi.fn(() => false) });
      const loan = await signalledLoan(loans);
      await expect(loan.giveBack()).resolves.toMatch(/^gone: PID 4242 is no longer running/);
      expect(deps.listTargets).not.toHaveBeenCalled();
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

    it('leaves an inspector whose id changed, saying only what it saw: another opening is on the port', async () => {
      const { loans, deps, setInspector } = harness();
      const loan = loans.forActivation(activation(false));
      setInspector(open('id-other'));
      await expect(loan.giveBack()).resolves.toBe(
        'left open: the inspector on 127.0.0.1:9229 is not the opening this server made (its target list has id id-other, not id-1)'
      );
      expect(deps.endSession).not.toHaveBeenCalled();
    });

    it('does not report a missing WebSocket address as a changed opening: the close is not confirmed, and nothing is sent', async () => {
      const { loans, deps, setInspector } = harness();
      const loan = loans.forActivation(activation(false));
      setInspector({ status: 'inspector', targets: [{ id: 'id-1', title: 'server.js', type: 'node' }] });
      await expect(loan.giveBack()).resolves.toBe(
        'not confirmed closed: the target list names this opening but gives no WebSocket address for it, so nothing was sent; ' +
          '127.0.0.1:9229 may still be listening'
      );
      expect(deps.endSession).not.toHaveBeenCalled();
    });

    it('an opening whose id was never learned is not closed blind: not confirmed, and nothing is probed or sent', async () => {
      const { loans, deps } = harness();
      const loan = loans.forActivation({ pid: PID, host: '127.0.0.1', port: 9229, alreadyActive: false });
      await expect(loan.giveBack()).resolves.toMatch(/^not confirmed closed: this server did not learn which opening/);
      expect(deps.listTargets).not.toHaveBeenCalled();
      expect(deps.endSession).not.toHaveBeenCalled();
    });

    it('sends nothing to a responder that is not a Node inspector', async () => {
      const { loans, deps, setInspector } = harness();
      const loan = loans.forActivation(activation(false));
      setInspector({ status: 'other', detail: 'HTTP 404 from /json/list' });
      await expect(loan.giveBack()).resolves.toBe(
        'not closed: 127.0.0.1:9229 answers as something other than a Node inspector (HTTP 404 from /json/list), so nothing was sent to it'
      );
      expect(deps.endSession).not.toHaveBeenCalled();
    });

    it('an unreachable inspector is not confirmed closed while the port still answers, and gone when the process is', async () => {
      let h = harness({ endResult: { status: 'unreachable', detail: 'the inspector refused the connection' } });
      await expect(h.loans.forActivation(activation(false)).giveBack()).resolves.toBe(
        'not confirmed closed: could not reach the inspector to close it (the inspector refused the connection); 127.0.0.1:9229 may still be listening'
      );
      const exists = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
      h = harness({ processExists: exists, endResult: { status: 'unreachable', detail: 'refused' } });
      await expect(h.loans.forActivation(activation(false)).giveBack()).resolves.toMatch(/^gone: PID 4242/);
    });

    it('an unreachable inspector whose port then refuses stopped while the session ended, and is not claimed as this server\'s close', async () => {
      const h = harness({ endResult: { status: 'unreachable', detail: 'refused' } });
      const loan = h.loans.forActivation(activation(false));
      vi.mocked(h.deps.endSession).mockImplementation(async () => { h.setInspector(closed); return { status: 'unreachable', detail: 'refused' }; });
      await expect(loan.giveBack()).resolves.toBe(
        'closed: 127.0.0.1:9229 stopped listening while this session ended (not closed by this server); PID 4242 runs on'
      );
    });

    it('keeps polling for the refusal until it comes, within the window', async () => {
      const { loans, deps } = harness();
      const answers = [open(), open(), open(), closed];
      vi.mocked(deps.endSession).mockResolvedValue({ status: 'dropped' });
      vi.mocked(deps.listTargets).mockImplementation(async () => answers.shift() ?? closed);
      await expect(loans.forActivation(activation(false)).giveBack()).resolves.toMatch(/^closed: 127\.0\.0\.1:9229 no longer accepts connections/);
      expect(deps.listTargets).toHaveBeenCalledTimes(4);
    });

    it('holds its windows as absolute bounds: no probe outlasts what is left of the refusal window', async () => {
      let clock = 0;
      const budgets: number[] = [];
      const { loans } = harness({
        now: () => clock,
        sleep: vi.fn(async (ms: number) => { clock += ms; }),
        endSession: vi.fn(async () => ({ status: 'dropped' as const })),
        // Every probe uses its whole budget and the port never refuses.
        listTargets: vi.fn(async (_host: string, _port: number, timeoutMs?: number) => {
          budgets.push(timeoutMs ?? -1);
          clock += timeoutMs ?? 0;
          return open();
        })
      });
      const startedAt = clock;
      await expect(loans.forActivation(activation(false)).giveBack()).resolves.toMatch(/^not confirmed closed: 127\.0\.0\.1:9229 still answered/);
      // The discovery probe, then the refusal window: 1 s each, never more.
      expect(budgets[0]).toBe(INSPECTOR_DISCOVERY_MS);
      expect(clock - startedAt).toBeLessThanOrEqual(INSPECTOR_DISCOVERY_MS + INSPECTOR_PORT_REFUSAL_MS);
      expect(budgets.slice(1).every((budget) => budget > 0 && budget <= 250)).toBe(true);
    });

    it('a dependency that throws is reported as not confirmed, never as closed', async () => {
      const { loans } = harness({ listTargets: vi.fn(async () => { throw new Error('EMFILE: too many open files'); }) });
      await expect(loans.forActivation(activation(false)).giveBack()).resolves.toBe(
        'not confirmed closed: EMFILE: too many open files; 127.0.0.1:9229 may still be listening'
      );
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
