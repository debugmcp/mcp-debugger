/**
 * Issue #754: when the adapter REFUSES a live re-send, its own answer is
 * stamped onto every record the re-send covered — the way the worker's
 * `breakpoints_synced` echo does for a refused pre-launch set (#750) — so
 * `list_breakpoints` and the run-to-completion summary carry it, and
 * `resyncAll` hands the failures back instead of discarding them. A transport
 * failure, a timeout or a shutdown is not the adapter's answer: the previous
 * set may still be armed, so those are reported and leave the records alone.
 *
 * Measured (python, `noDebug: true`, `examples/python/pause_test.py`): a live
 * `set_breakpoint` answered `live sync failed: Server is not available` while
 * the records for that file stayed `{ verified: false }` with no message.
 */
import { describe, it, expect, vi } from 'vitest';
import { BreakpointController } from '../../../../../src/session/breakpoints/breakpoint-controller.js';
import type { BreakpointContext } from '../../../../../src/session/operations-context.js';
import type { ManagedSession } from '../../../../../src/session/session-store.js';
import { DapResponseError } from '../../../../../src/proxy/dap-response-error.js';
import type { Breakpoint, FunctionBreakpoint } from '@debugmcp/shared';
import { createMockLogger } from '../../../../test-utils/helpers/test-dependencies.js';

const REFUSAL = 'Server is not available';

/** The adapter's own error response to a request, as the proxy rejects it. */
function refusalOf(command: string, message = REFUSAL): DapResponseError {
  return new DapResponseError({ seq: 1, type: 'response', request_seq: 1, success: false, command, message });
}

function makeController(policy: unknown = {}): { controller: BreakpointController; ctx: BreakpointContext } {
  const ctx: BreakpointContext = {
    logger: createMockLogger(),
    getSession: vi.fn(),
    selectPolicy: vi.fn().mockReturnValue(policy),
    selectStorePolicy: vi.fn()
  };
  return { controller: new BreakpointController(ctx), ctx };
}

/** A paused session whose proxy answers every DAP request with the given rejection. */
function failingSession(
  reject: (command: string) => unknown,
  lines: Array<Partial<Breakpoint> & { id: string; file: string; line: number }>,
  functions: Array<Partial<FunctionBreakpoint> & { id: string; functionName: string }> = []
): { session: ManagedSession; sendDapRequest: ReturnType<typeof vi.fn> } {
  const sendDapRequest = vi.fn().mockImplementation(async (command: string) => { throw reject(command); });
  const breakpoints = new Map<string, Breakpoint>(
    lines.map((bp) => [bp.id, { verified: false, ...bp } as Breakpoint])
  );
  const functionBreakpoints = new Map<string, FunctionBreakpoint>(
    functions.map((bp) => [bp.id, { verified: false, ...bp } as FunctionBreakpoint])
  );
  const session = {
    id: 'sess-1',
    language: 'python',
    state: 'paused',
    proxyManager: { isRunning: () => true, sendDapRequest },
    breakpoints,
    functionBreakpoints
  } as unknown as ManagedSession;
  return { session, sendDapRequest };
}

const refusingSession = (
  lines: Array<Partial<Breakpoint> & { id: string; file: string; line: number }>,
  functions: Array<Partial<FunctionBreakpoint> & { id: string; functionName: string }> = []
) => failingSession(refusalOf, lines, functions);

describe('BreakpointController live re-send refusal stamps the adapter\'s answer (issue #754)', () => {
  it('stamps verified:false and the adapter\'s message on every record the re-send covered', async () => {
    const { controller } = makeController();
    const { session } = refusingSession([
      { id: 'a', file: '/app/a.py', line: 7 },
      { id: 'b', file: '/app/a.py', line: 8, verified: true, verifiedBy: 'adapter', adapterId: 3, boundFile: '/app/gen.py', boundLine: 80 },
      { id: 'other', file: '/app/b.py', line: 1, verified: true, verifiedBy: 'adapter' }
    ]);

    const outcome = await controller.syncBreakpointsForFile(session, '/app/a.py');

    expect(outcome).toEqual({
      synced: false,
      warning: `Breakpoint state updated, but live sync failed: ${REFUSAL}`,
      failure: REFUSAL,
      refusal: REFUSAL
    });
    expect(session.breakpoints.get('a')).toMatchObject({ verified: false, message: REFUSAL });
    // A record the adapter had verified before is unbound by a refused
    // replace-all, and an unverified record claims no binding location.
    const b = session.breakpoints.get('b')!;
    expect(b).toMatchObject({ verified: false, message: REFUSAL, adapterId: 3 });
    expect(b.verifiedBy).toBeUndefined();
    expect(b.boundFile).toBeUndefined();
    expect(b.boundLine).toBeUndefined();
    // Another file's records are not covered by this re-send.
    expect(session.breakpoints.get('other')).toMatchObject({ verified: true, verifiedBy: 'adapter' });
    expect(session.breakpoints.get('other')!.message).toBeUndefined();
  });

  it('leaves the records alone on a transport failure, timeout or shutdown, and still warns', async () => {
    const { controller } = makeController();
    const { session } = failingSession(
      () => new Error("Debug adapter did not respond to 'setBreakpoints' request within 30s"),
      [{ id: 'a', file: '/app/a.py', line: 7, verified: true, verifiedBy: 'adapter', adapterId: 3 }]
    );

    const outcome = await controller.syncBreakpointsForFile(session, '/app/a.py');

    expect(outcome).toEqual({
      synced: false,
      warning: "Breakpoint state updated, but live sync failed: Debug adapter did not respond to 'setBreakpoints' request within 30s",
      failure: "Debug adapter did not respond to 'setBreakpoints' request within 30s"
    });
    expect(session.breakpoints.get('a')).toMatchObject({ verified: true, verifiedBy: 'adapter', adapterId: 3 });
    expect(session.breakpoints.get('a')!.message).toBeUndefined();
  });

  it('leaves a hit-proven record alone: a stop already proved it bound (issue #673)', async () => {
    const { controller } = makeController();
    const { session } = refusingSession([
      { id: 'hit', file: '/app/a.py', line: 7, verified: true, verifiedBy: 'hit', adapterId: 1 },
      { id: 'a', file: '/app/a.py', line: 9 }
    ]);

    await controller.syncBreakpointsForFile(session, '/app/a.py');

    expect(session.breakpoints.get('hit')).toMatchObject({ verified: true, verifiedBy: 'hit', adapterId: 1 });
    expect(session.breakpoints.get('hit')!.message).toBeUndefined();
    expect(session.breakpoints.get('a')).toMatchObject({ verified: false, message: REFUSAL });
  });

  it('keeps a child-verified record for a child-mirroring policy (js-debug, issue #500)', async () => {
    const { controller } = makeController({ getDapClientBehavior: () => ({ mirrorBreakpointsToChild: true }) });
    const { session } = refusingSession([
      { id: 'child', file: '/app/a.js', line: 3, verified: true, verifiedBy: 'adapter', adapterId: 11 },
      { id: 'a', file: '/app/a.js', line: 5 }
    ]);

    await controller.syncBreakpointsForFile(session, '/app/a.js');

    expect(session.breakpoints.get('child')).toMatchObject({ verified: true, adapterId: 11 });
    expect(session.breakpoints.get('child')!.message).toBeUndefined();
    expect(session.breakpoints.get('a')).toMatchObject({ verified: false, message: REFUSAL });
  });

  it('stamps the function breakpoints the same way, sparing a hit-proven one', async () => {
    const { controller } = makeController();
    const { session } = refusingSession([], [
      { id: 'f1', functionName: 'main', verified: true, verifiedBy: 'adapter', adapterId: 4 },
      { id: 'f2', functionName: 'helper' },
      { id: 'f3', functionName: 'proven', verified: true, verifiedBy: 'hit', adapterId: 9 }
    ]);

    const outcome = await controller.syncFunctionBreakpoints(session);

    expect(outcome).toMatchObject({ synced: false, refusal: REFUSAL });
    expect(session.functionBreakpoints.get('f1')).toMatchObject({ verified: false, message: REFUSAL });
    expect(session.functionBreakpoints.get('f2')).toMatchObject({ verified: false, message: REFUSAL });
    expect(session.functionBreakpoints.get('f3')).toMatchObject({ verified: true, verifiedBy: 'hit', adapterId: 9 });
  });

  it('applies the hit-proven rule to a successful function re-send too, and normalizes its message', async () => {
    const { controller } = makeController();
    const { session, sendDapRequest } = refusingSession([], [
      { id: 'f1', functionName: 'main', verified: true, verifiedBy: 'hit', adapterId: 4 },
      { id: 'f2', functionName: 'helper' }
    ]);
    sendDapRequest.mockResolvedValue({ body: { breakpoints: [
      { verified: false, id: 40, message: 'Cannot resolve symbol' },
      { verified: true, id: 41, line: 12, source: { path: '/app/lib.py' } }
    ] } });

    const outcome = await controller.syncFunctionBreakpoints(session);

    expect(outcome).toEqual({ synced: true });
    // The unbound answer keeps the hit-proven record verified, id current.
    expect(session.functionBreakpoints.get('f1')).toMatchObject({ verified: true, verifiedBy: 'hit', adapterId: 40 });
    expect(session.functionBreakpoints.get('f1')!.message).toBeUndefined();
    expect(session.functionBreakpoints.get('f2')).toMatchObject({
      verified: true, verifiedBy: 'adapter', adapterId: 41, boundLine: 12, boundFile: '/app/lib.py'
    });
  });

  it('stamps nothing when the re-send succeeded', async () => {
    const { controller } = makeController();
    const { session, sendDapRequest } = refusingSession([{ id: 'a', file: '/app/a.py', line: 7 }]);
    sendDapRequest.mockResolvedValue({ body: { breakpoints: [{ verified: true, id: 9, line: 7 }] } });

    const outcome = await controller.syncBreakpointsForFile(session, '/app/a.py');

    expect(outcome).toEqual({ synced: true });
    expect(session.breakpoints.get('a')).toMatchObject({ verified: true, adapterId: 9 });
    expect(session.breakpoints.get('a')!.message).toBeUndefined();
  });

  it('hands the refusal back to setBreakpoint alongside the warning, for the handler\'s dedupe', async () => {
    const { controller, ctx } = makeController();
    const { session } = refusingSession([]);
    vi.mocked(ctx.getSession).mockReturnValue(session);

    const result = await controller.setBreakpoint('sess-1', { file: '/app/a.py', line: 7 });

    expect(result.breakpoint).toMatchObject({ verified: false, message: REFUSAL });
    expect(result.warning).toBe(`Breakpoint state updated, but live sync failed: ${REFUSAL}`);
    expect(result.refusal).toBe(REFUSAL);
  });
});

describe('BreakpointController.resyncAll hands the failures back (issue #754)', () => {
  it('phrases one deduplicated sentence per failed re-send and flags a refused function re-send', async () => {
    const { controller } = makeController();
    vi.spyOn(controller, 'syncBreakpointsForFile').mockImplementation(async (_session, file) =>
      file === '/app/ok.py'
        ? { synced: true }
        : { synced: false, warning: 'w', failure: REFUSAL, refusal: REFUSAL }
    );
    vi.spyOn(controller, 'syncFunctionBreakpoints').mockResolvedValue({
      synced: false, warning: 'w', failure: REFUSAL, refusal: REFUSAL
    });
    const { session } = refusingSession(
      [{ id: 'a', file: '/app/a.py', line: 1 }, { id: 'b', file: '/app/b.py', line: 1 }, { id: 'ok', file: '/app/ok.py', line: 1 }],
      [{ id: 'f', functionName: 'main' }]
    );

    const outcome = await controller.resyncAll(session, { forceFreshEcho: true });

    expect(outcome).toEqual({
      warnings: [
        `The debugger refused the re-send of the breakpoints for a.py: ${REFUSAL}`,
        `The debugger refused the re-send of the breakpoints for b.py: ${REFUSAL}`,
        `The debugger refused the re-send of the function breakpoints: ${REFUSAL}`
      ],
      functionBreakpointsRefused: true
    });
  });

  it('phrases a transport failure as a failure, not a refusal, and does not flag the function breakpoints', async () => {
    const { controller } = makeController();
    vi.spyOn(controller, 'syncBreakpointsForFile').mockResolvedValue({ synced: false, warning: 'w', failure: 'Proxy exited' });
    vi.spyOn(controller, 'syncFunctionBreakpoints').mockResolvedValue({ synced: false, warning: 'w', failure: 'Proxy exited' });
    const { session } = refusingSession([{ id: 'a', file: 'C:\\app\\a.py', line: 1 }], [{ id: 'f', functionName: 'main' }]);

    const outcome = await controller.resyncAll(session);

    expect(outcome).toEqual({
      warnings: [
        'The re-send of the breakpoints for a.py failed: Proxy exited',
        'The re-send of the function breakpoints failed: Proxy exited'
      ],
      functionBreakpointsRefused: false
    });
  });

  it('returns no warnings when every re-send succeeded, or there was nothing to send', async () => {
    const { controller } = makeController();
    vi.spyOn(controller, 'syncBreakpointsForFile').mockResolvedValue({ synced: true });
    vi.spyOn(controller, 'syncFunctionBreakpoints').mockResolvedValue({ synced: true });
    const { session } = refusingSession([{ id: 'a', file: '/app/a.py', line: 1 }], [{ id: 'f', functionName: 'main' }]);

    expect(await controller.resyncAll(session)).toEqual({ warnings: [], functionBreakpointsRefused: false });
    expect(await controller.resyncAll(refusingSession([]).session)).toEqual({ warnings: [], functionBreakpointsRefused: false });
  });
});
