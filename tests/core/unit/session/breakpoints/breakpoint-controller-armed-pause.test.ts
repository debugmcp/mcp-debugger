/**
 * Issue #1146: nothing that runs code in the target goes out while a pause of
 * ours is armed and no stop has been observed.
 *
 * A pause requested on a program that is executing nothing stays armed in the
 * engine and fires inside the next code that runs there. For js-debug a
 * breakpoint request can be that code: the adapter installs its source-map
 * handler when its breakpoint count rises from zero by evaluating a script in
 * every execution context, and the function-breakpoint bridge evaluates too.
 * Measured on Node 24 with js-debug 1.140: the pause then landed inside the
 * evaluation, js-debug resumed it without reporting it or Node spun a core,
 * and `close_debug_session` did not free the target.
 *
 * So, for a policy that declares it, breakpoint requests wait for the stop:
 * the store takes the change at once, the wire gets it when the session
 * pauses. A policy without the declaration is not held, and neither is any
 * request while nothing is armed.
 *
 * The second half is the answer a re-send gets when the adapter answered but
 * the session that owns the runtime did not: the records carry no verdict
 * from the target, and the answer says so.
 */
import { describe, it, expect, vi } from 'vitest';
import { SessionState, type Breakpoint, type FunctionBreakpoint } from '@debugmcp/shared';
import { BreakpointController } from '../../../../../src/session/breakpoints/breakpoint-controller.js';
import type { BreakpointContext } from '../../../../../src/session/operations-context.js';
import type { ManagedSession } from '../../../../../src/session/session-store.js';
import { ErrorMessages } from '../../../../../src/utils/error-messages.js';
import { markChildMirrorUnanswered } from '../../../../../src/utils/child-origin-events.js';
import { createMockLogger } from '../../../../test-utils/helpers/test-dependencies.js';

const FILE = '/app/server.js';
const OTHER = '/app/routes.js';
const HOLDS = { holdsBreakpointsWhilePauseArmed: true };

function harness(policy: unknown = HOLDS) {
  const listeners = new Set<() => void>();
  const unsubscribe = vi.fn();
  const sendDapRequest = vi.fn(async (command: string, args?: { breakpoints?: unknown[] }) => ({
    body: { breakpoints: (args?.breakpoints ?? []).map(() => ({ verified: true })) },
    command
  }));
  const session = {
    id: 'sess-1',
    language: 'javascript',
    state: SessionState.RUNNING,
    proxyGeneration: 3,
    proxyManager: { isRunning: () => true, sendDapRequest },
    breakpoints: new Map<string, Breakpoint>(),
    functionBreakpoints: new Map<string, FunctionBreakpoint>()
  } as unknown as ManagedSession;
  const ctx: BreakpointContext = {
    logger: createMockLogger(),
    getSession: vi.fn().mockReturnValue(session),
    selectPolicy: vi.fn().mockReturnValue(policy),
    selectStorePolicy: vi.fn(),
    onStateChange: vi.fn((_sessionId: string, listener: () => void) => {
      listeners.add(listener);
      return () => {
        unsubscribe();
        listeners.delete(listener);
      };
    })
  };
  const controller = new BreakpointController(ctx);
  /** What the core does on a transition: tell the listeners, inside the change. */
  const notify = async () => {
    for (const listener of [...listeners]) listener();
    await new Promise((resolve) => setImmediate(resolve));
  };
  const arm = () => { session.pauseIntent = { generation: 3, source: 'user', armedAt: Date.now() }; };
  const land = async () => {
    session.pauseIntent = undefined;
    session.lastStop = { reason: 'pause' } as ManagedSession['lastStop'];
    session.state = SessionState.PAUSED;
    await notify();
  };
  const sent = () => sendDapRequest.mock.calls.map(([command, args]) => {
    const a = args as { source?: { path: string }; breakpoints: Array<{ line?: number; name?: string }> };
    return command === 'setBreakpoints'
      ? `${command} ${a.source?.path} [${a.breakpoints.map((bp) => bp.line).join(',')}]`
      : `${command} [${a.breakpoints.map((bp) => bp.name).join(',')}]`;
  });
  return { controller, session, ctx, sendDapRequest, listeners, unsubscribe, notify, arm, land, sent };
}

describe('breakpoint requests wait for an armed pause (issue #1146)', () => {
  it('holds a line breakpoint set under an armed pause: stored, answered as held, not sent', async () => {
    const { controller, session, arm, sent } = harness();
    arm();

    const result = await controller.setBreakpoint('sess-1', { file: FILE, line: 29 });

    expect(sent()).toEqual([]);
    expect(result.warning).toBe(ErrorMessages.breakpointHeldForPendingPause);
    expect(result.breakpoint).toMatchObject({ file: FILE, line: 29, verified: false });
    expect(session.breakpoints.size).toBe(1);
  });

  it('sends what it held when the session stops, with a fresh echo, and stamps the answer', async () => {
    const { controller, session, arm, land, sent, sendDapRequest, unsubscribe } = harness();
    arm();
    const { breakpoint } = await controller.setBreakpoint('sess-1', { file: FILE, line: 29 });

    await land();

    expect(sent()).toEqual([`setBreakpoints ${FILE} [29]`]);
    expect(sendDapRequest.mock.calls[0][1]).toMatchObject({ __mcpForceFreshEcho: true });
    expect(session.breakpoints.get(breakpoint.id)?.verified).toBe(true);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('sends each held file once, however many requests named it, and subscribes once', async () => {
    const { controller, ctx, arm, land, sent } = harness();
    arm();
    await controller.setBreakpoint('sess-1', { file: FILE, line: 29 });
    await controller.setBreakpoint('sess-1', { file: FILE, line: 31 });
    await controller.setBreakpoint('sess-1', { file: OTHER, line: 4 });

    await land();

    expect(ctx.onStateChange).toHaveBeenCalledTimes(1);
    expect(sent()).toEqual([`setBreakpoints ${FILE} [29,31]`, `setBreakpoints ${OTHER} [4]`]);
  });

  it('does not lose a removal made while held: the file is sent with its empty set', async () => {
    const { controller, session, arm, land, sent, sendDapRequest } = harness();
    const first = await controller.setBreakpoint('sess-1', { file: FILE, line: 29 });
    expect(sent()).toEqual([`setBreakpoints ${FILE} [29]`]);
    sendDapRequest.mockClear();
    arm();

    await controller.removeBreakpoint('sess-1', first.breakpoint.id);
    expect(session.breakpoints.size).toBe(0);
    expect(sent()).toEqual([]);

    await land();

    expect(sent()).toEqual([`setBreakpoints ${FILE} []`]);
  });

  it('holds the function breakpoints too, and sends them after the files', async () => {
    const { controller, arm, land, sent } = harness();
    arm();
    await controller.setBreakpoint('sess-1', { file: FILE, line: 29 });
    const fn = await controller.setFunctionBreakpoint('sess-1', { functionName: 'doWork' });
    expect(fn.warning).toBe(ErrorMessages.breakpointHeldForPendingPause);
    expect(sent()).toEqual([]);

    await land();

    expect(sent()).toEqual([`setBreakpoints ${FILE} [29]`, 'setFunctionBreakpoints [doWork]']);
  });

  it('keeps holding through a state change that leaves the pause armed', async () => {
    const { controller, arm, notify, sent, listeners } = harness();
    arm();
    await controller.setBreakpoint('sess-1', { file: FILE, line: 29 });

    await notify();

    expect(sent()).toEqual([]);
    expect(listeners.size).toBe(1);
  });

  it('sends what it held when the armed pause is gone without a stop (the adapter resumed it unreported)', async () => {
    const { controller, session, arm, notify, sent } = harness();
    arm();
    await controller.setBreakpoint('sess-1', { file: FILE, line: 29 });

    session.pauseIntent = undefined;
    await notify();

    expect(session.state).toBe(SessionState.RUNNING);
    expect(sent()).toEqual([`setBreakpoints ${FILE} [29]`]);
  });

  it('drops what it held when the session ended instead', async () => {
    const { controller, session, arm, notify, sent, unsubscribe, listeners } = harness();
    arm();
    await controller.setBreakpoint('sess-1', { file: FILE, line: 29 });

    session.pauseIntent = undefined;
    session.state = SessionState.STOPPED;
    await notify();

    expect(sent()).toEqual([]);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  });

  it('drops what it held when the session was removed', async () => {
    const { controller, ctx, arm, notify, sent, unsubscribe } = harness();
    arm();
    await controller.setBreakpoint('sess-1', { file: FILE, line: 29 });

    vi.mocked(ctx.getSession).mockImplementation((id: string) => {
      if (id === 'sess-1' && unsubscribe.mock.calls.length === 0 && sent().length === 0) {
        throw new Error('Managed session not found: sess-1');
      }
      throw new Error('unexpected lookup');
    });
    await notify();

    expect(sent()).toEqual([]);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('holds nothing once the pause has landed: a request while paused goes straight out', async () => {
    const { controller, arm, land, sent, sendDapRequest } = harness();
    arm();
    await controller.setBreakpoint('sess-1', { file: FILE, line: 29 });
    await land();
    sendDapRequest.mockClear();

    const result = await controller.setBreakpoint('sess-1', { file: FILE, line: 31 });

    expect(sent()).toEqual([`setBreakpoints ${FILE} [29,31]`]);
    expect(result.warning).toBeUndefined();
  });

  it.each([
    ['no pause is armed', HOLDS, (session: ManagedSession) => { session.pauseIntent = undefined; }],
    ['the armed pause belongs to an earlier proxy generation', HOLDS, (session: ManagedSession) => {
      session.pauseIntent = { generation: 2, source: 'user', armedAt: 1 };
    }],
    ['the policy does not declare the hold', {}, (session: ManagedSession) => {
      session.pauseIntent = { generation: 3, source: 'user', armedAt: 1 };
    }],
    ['the policy cannot be selected', undefined, (session: ManagedSession) => {
      session.pauseIntent = { generation: 3, source: 'user', armedAt: 1 };
    }]
  ] as const)('sends at once when %s', async (_name, policy, prepare) => {
    const { controller, session, ctx, sent } = harness(policy);
    if (policy === undefined) {
      vi.mocked(ctx.selectPolicy).mockImplementation(() => { throw new Error('no policy'); });
    }
    prepare(session);

    const result = await controller.setBreakpoint('sess-1', { file: FILE, line: 29 });

    expect(sent()).toEqual([`setBreakpoints ${FILE} [29]`]);
    expect(result.warning).toBeUndefined();
    expect(ctx.onStateChange).not.toHaveBeenCalled();
  });
});

describe('a resume does not outrun what was held (issue #1146)', () => {
  // Measured in the Linux image: a client that continued 47 ms after the
  // stop ran the program past a held breakpoint that was not set yet.
  it('has nothing for a resume to wait for when nothing is held', () => {
    const { controller, arm } = harness();
    expect(controller.heldInFlight('sess-1')).toBeUndefined();
    arm();
    expect(controller.heldInFlight('sess-1')).toBeUndefined();
  });

  it('hands a resume the send that is on its way, and it settles when the adapter has answered', async () => {
    const { controller, arm, land, sendDapRequest, sent } = harness();
    arm();
    await controller.setBreakpoint('sess-1', { file: FILE, line: 29 });
    let answer: ((value: unknown) => void) | undefined;
    sendDapRequest.mockImplementation(() => new Promise((resolve) => { answer = resolve; }) as never);

    await land();
    expect(sent()).toEqual([`setBreakpoints ${FILE} [29]`]);

    const waiting = controller.heldInFlight('sess-1');
    expect(waiting).toBeInstanceOf(Promise);
    let settled = false;
    void waiting!.then(() => { settled = true; });
    await new Promise((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);

    answer!({ body: { breakpoints: [{ verified: true }] } });
    await waiting;
    expect(settled).toBe(true);
    expect(controller.heldInFlight('sess-1')).toBeUndefined();
  });

  it('starts the send itself when a resume arrives before the state listener has run', async () => {
    const { controller, session, arm, sent } = harness();
    arm();
    await controller.setBreakpoint('sess-1', { file: FILE, line: 29 });
    // The stop has been recorded, the listener's turn has not come yet.
    session.pauseIntent = undefined;
    session.lastStop = { reason: 'pause' } as ManagedSession['lastStop'];
    session.state = SessionState.PAUSED;

    await controller.heldInFlight('sess-1');

    expect(sent()).toEqual([`setBreakpoints ${FILE} [29]`]);
  });

  it('sends once when the listener and a resume both ask', async () => {
    const { controller, arm, land, sent } = harness();
    arm();
    await controller.setBreakpoint('sess-1', { file: FILE, line: 29 });

    const landed = land();
    const waiting = controller.heldInFlight('sess-1');
    await Promise.all([landed, waiting]);

    expect(sent()).toEqual([`setBreakpoints ${FILE} [29]`]);
  });

  it('does not keep a resume waiting on a pause that is still armed', async () => {
    const { controller, arm, sent } = harness();
    arm();
    await controller.setBreakpoint('sess-1', { file: FILE, line: 29 });

    await controller.heldInFlight('sess-1');

    expect(sent()).toEqual([]);
  });
});

describe("a re-send the target session did not answer says so (issue #1146)", () => {
  it('reports the outstanding answer on set_breakpoint and leaves the record unverified', async () => {
    const { controller, sendDapRequest } = harness({ ...HOLDS, getDapClientBehavior: () => ({ mirrorBreakpointsToChild: true }) });
    sendDapRequest.mockImplementation(async () => {
      // The parent session's provisional stub; the child never answered.
      const response = { body: { breakpoints: [{ verified: false, message: 'Unbound breakpoint' }] }, command: 'setBreakpoints' };
      markChildMirrorUnanswered(response);
      return response;
    });

    const result = await controller.setBreakpoint('sess-1', { file: FILE, line: 29 });

    expect(result.warning).toBe(ErrorMessages.breakpointTargetUnanswered('server.js'));
    expect(result.breakpoint.verified).toBe(false);
  });

  it('hands resyncAll the fact, with one sentence naming the files', async () => {
    const { controller, session, sendDapRequest } = harness();
    session.breakpoints.set('a', { id: 'a', file: FILE, line: 29, verified: false } as Breakpoint);
    session.breakpoints.set('b', { id: 'b', file: OTHER, line: 4, verified: false } as Breakpoint);
    sendDapRequest.mockImplementation(async (_command: string, args?: { breakpoints?: unknown[] }) => {
      const response = { body: { breakpoints: (args?.breakpoints ?? []).map(() => ({ verified: false })) }, command: 'setBreakpoints' };
      markChildMirrorUnanswered(response);
      return response;
    });

    const outcome = await controller.resyncAll(session, { forceFreshEcho: true });

    expect(outcome.unanswered).toBe(true);
    expect(outcome.warnings).toEqual([ErrorMessages.breakpointTargetUnanswered('server.js, routes.js')]);
    expect(outcome.functionBreakpointsFailed).toBe(false);
  });

  it('adds nothing when every re-send was answered', async () => {
    const { controller, session } = harness();
    session.breakpoints.set('a', { id: 'a', file: FILE, line: 29, verified: false } as Breakpoint);

    const outcome = await controller.resyncAll(session, { forceFreshEcho: true });

    expect(outcome).toEqual({ warnings: [], functionBreakpointsFailed: false });
  });
});
