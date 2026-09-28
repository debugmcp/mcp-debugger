/**
 * Issue #754: when a live re-send fails, the adapter's own answer is stamped
 * onto every record the re-send covered — the way the worker's
 * `breakpoints_synced` echo does for a refused pre-launch set (#750) — so
 * `list_breakpoints` and the run-to-completion summary carry it, and
 * `resyncAll` hands the per-file warnings back instead of discarding them.
 *
 * Measured (python, `noDebug: true`, `examples/python/pause_test.py`): a live
 * `set_breakpoint` answered `live sync failed: Server is not available` while
 * the records for that file stayed `{ verified: false }` with no message.
 */
import { describe, it, expect, vi } from 'vitest';
import { BreakpointController } from '../../../../../src/session/breakpoints/breakpoint-controller.js';
import type { BreakpointContext } from '../../../../../src/session/operations-context.js';
import type { ManagedSession } from '../../../../../src/session/session-store.js';
import type { Breakpoint, FunctionBreakpoint } from '@debugmcp/shared';
import { createMockLogger } from '../../../../test-utils/helpers/test-dependencies.js';

const REFUSAL = 'Server is not available';

function makeController(policy: unknown = {}): { controller: BreakpointController; ctx: BreakpointContext } {
  const ctx: BreakpointContext = {
    logger: createMockLogger(),
    getSession: vi.fn(),
    selectPolicy: vi.fn().mockReturnValue(policy),
    selectStorePolicy: vi.fn()
  };
  return { controller: new BreakpointController(ctx), ctx };
}

/** A paused session whose proxy refuses every DAP request with the adapter's own words. */
function refusingSession(
  lines: Array<Partial<Breakpoint> & { id: string; file: string; line: number }>,
  functions: Array<Partial<FunctionBreakpoint> & { id: string; functionName: string }> = []
): { session: ManagedSession; sendDapRequest: ReturnType<typeof vi.fn> } {
  const sendDapRequest = vi.fn().mockRejectedValue(new Error(REFUSAL));
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

describe('BreakpointController live re-send failure stamps the adapter\'s answer (issue #754)', () => {
  it('stamps verified:false and the adapter\'s message on every record the re-send covered', async () => {
    const { controller } = makeController();
    const { session } = refusingSession([
      { id: 'a', file: '/app/a.py', line: 7 },
      { id: 'b', file: '/app/a.py', line: 8, verified: true, verifiedBy: 'adapter', adapterId: 3 },
      { id: 'other', file: '/app/b.py', line: 1, verified: true, verifiedBy: 'adapter' }
    ]);

    const outcome = await controller.syncBreakpointsForFile(session, '/app/a.py');

    expect(outcome).toEqual({ synced: false, warning: `Breakpoint state updated, but live sync failed: ${REFUSAL}` });
    expect(session.breakpoints.get('a')).toMatchObject({ verified: false, message: REFUSAL });
    // A record the adapter had verified before is unbound by a refused replace-all.
    expect(session.breakpoints.get('b')).toMatchObject({ verified: false, verifiedBy: undefined, message: REFUSAL });
    // Another file's records are not covered by this re-send.
    expect(session.breakpoints.get('other')).toMatchObject({ verified: true, verifiedBy: 'adapter' });
    expect(session.breakpoints.get('other')!.message).toBeUndefined();
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

  it('stamps the function breakpoints the same way', async () => {
    const { controller } = makeController();
    const { session } = refusingSession([], [
      { id: 'f1', functionName: 'main', verified: true, adapterId: 4 },
      { id: 'f2', functionName: 'helper' }
    ]);

    const outcome = await controller.syncFunctionBreakpoints(session);

    expect(outcome).toEqual({ synced: false, warning: `Breakpoint state updated, but live sync failed: ${REFUSAL}` });
    expect(session.functionBreakpoints.get('f1')).toMatchObject({ verified: false, message: REFUSAL });
    expect(session.functionBreakpoints.get('f2')).toMatchObject({ verified: false, message: REFUSAL });
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
});

describe('BreakpointController.resyncAll hands the warnings back (issue #754)', () => {
  it('returns every per-file and function warning in send order', async () => {
    const { controller } = makeController();
    vi.spyOn(controller, 'syncBreakpointsForFile').mockImplementation(async (_session, file) =>
      file === '/app/b.py' ? { synced: false, warning: `b: ${REFUSAL}` } : { synced: true }
    );
    vi.spyOn(controller, 'syncFunctionBreakpoints').mockResolvedValue({ synced: false, warning: `fn: ${REFUSAL}` });
    const { session } = refusingSession(
      [{ id: 'a', file: '/app/a.py', line: 1 }, { id: 'b', file: '/app/b.py', line: 1 }],
      [{ id: 'f', functionName: 'main' }]
    );

    const warnings = await controller.resyncAll(session, { forceFreshEcho: true });

    expect(warnings).toEqual([`b: ${REFUSAL}`, `fn: ${REFUSAL}`]);
  });

  it('returns an empty list when every re-send succeeded, or there was nothing to send', async () => {
    const { controller } = makeController();
    vi.spyOn(controller, 'syncBreakpointsForFile').mockResolvedValue({ synced: true });
    vi.spyOn(controller, 'syncFunctionBreakpoints').mockResolvedValue({ synced: true });
    const { session } = refusingSession([{ id: 'a', file: '/app/a.py', line: 1 }], [{ id: 'f', functionName: 'main' }]);

    expect(await controller.resyncAll(session)).toEqual([]);
    expect(await controller.resyncAll(refusingSession([]).session)).toEqual([]);
  });
});
