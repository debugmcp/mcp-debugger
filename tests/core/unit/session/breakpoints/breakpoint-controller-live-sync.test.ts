/**
 * Issue #754: when the adapter REFUSES a live re-send, its own answer is
 * stamped onto the UNVERIFIED records the re-send covered — the way the
 * worker's `breakpoints_synced` echo does for a refused pre-launch set (#750)
 * — so `list_breakpoints` and the run-to-completion summary carry it, and
 * `resyncAll` hands the failures back instead of discarding them.
 *
 * A refusal is an answer about the REQUEST, not about any one breakpoint: a
 * record the adapter verified before (or a stop proved bound) stands, since
 * the adapter never said it was gone and its previous set may well still be
 * armed — and a verified record needs no explanation beside it. A transport
 * failure, a timeout or a shutdown is not the adapter's answer at all: those
 * are reported and leave every record alone. The stamp is marked
 * (`messageOrigin: 'refusal'`) so a later verification drops it, and it never
 * displaces a curated note.
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
const LOCALFS_HINT =
  "Hint: attach sessions send breakpoint paths to the remote debugger verbatim; the path must be valid on the debug target's filesystem. Use target-side paths, or pass localfsMap in the attach config to map local paths to remote ones.";

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

describe("BreakpointController live re-send refusal stamps the adapter's answer (issue #754)", () => {
  it("stamps the adapter's message on the unverified records the re-send covered and leaves verified ones standing", async () => {
    const { controller } = makeController();
    const { session } = refusingSession([
      { id: 'a', file: '/app/a.py', line: 7 },
      { id: 'b', file: '/app/a.py', line: 8, verified: true, verifiedBy: 'adapter', adapterId: 3, boundFile: '/app/gen.py', boundLine: 80 },
      { id: 'c', file: '/app/a.py', line: 9, boundFile: '/app/gen.py', boundLine: 90 },
      { id: 'other', file: '/app/b.py', line: 1, verified: true, verifiedBy: 'adapter' }
    ]);

    const outcome = await controller.syncBreakpointsForFile(session, '/app/a.py');

    expect(outcome).toEqual({
      synced: false,
      warning: `Breakpoint state updated, but live sync failed: ${REFUSAL}`,
      failure: { message: REFUSAL, refused: true }
    });
    expect(session.breakpoints.get('a')).toMatchObject({ verified: false, message: REFUSAL, messageOrigin: 'refusal' });
    // The refusal is about the request: a record the adapter verified before
    // is not unbound by it — the adapter never said so, and its previous set
    // may still be armed — and carries no explanation it does not need.
    expect(session.breakpoints.get('b')).toEqual({
      id: 'b', file: '/app/a.py', line: 8, verified: true, verifiedBy: 'adapter', adapterId: 3, boundFile: '/app/gen.py', boundLine: 80
    });
    // An unverified record claims no binding location.
    const c = session.breakpoints.get('c')!;
    expect(c).toMatchObject({ verified: false, message: REFUSAL, messageOrigin: 'refusal' });
    expect(c.boundFile).toBeUndefined();
    expect(c.boundLine).toBeUndefined();
    // Another file's records are not covered by this re-send.
    expect(session.breakpoints.get('other')).toMatchObject({ verified: true, verifiedBy: 'adapter' });
    expect(session.breakpoints.get('other')!.message).toBeUndefined();
  });

  it('leaves the records alone on a transport failure, timeout or shutdown, and still warns', async () => {
    const { controller } = makeController();
    const { session } = failingSession(
      () => new Error("Debug adapter did not respond to 'setBreakpoints' request within 30s"),
      [
        { id: 'a', file: '/app/a.py', line: 7, verified: true, verifiedBy: 'adapter', adapterId: 3 },
        { id: 'b', file: '/app/a.py', line: 8 }
      ]
    );

    const outcome = await controller.syncBreakpointsForFile(session, '/app/a.py');

    expect(outcome).toEqual({
      synced: false,
      warning: "Breakpoint state updated, but live sync failed: Debug adapter did not respond to 'setBreakpoints' request within 30s",
      failure: { message: "Debug adapter did not respond to 'setBreakpoints' request within 30s", refused: false }
    });
    expect(session.breakpoints.get('a')).toMatchObject({ verified: true, verifiedBy: 'adapter', adapterId: 3 });
    expect(session.breakpoints.get('a')!.message).toBeUndefined();
    expect(session.breakpoints.get('b')!.message).toBeUndefined();
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

  it("stamps the parent's refusal on an unverified record under a child-mirroring policy, keeping the child's binding facts", async () => {
    const { controller } = makeController({ getDapClientBehavior: () => ({ mirrorBreakpointsToChild: true }) });
    const { session } = refusingSession([
      { id: 'pending', file: '/app/a.ts', line: 3, boundFile: '/app/dist/a.js', boundLine: 9 }
    ]);

    await controller.syncBreakpointsForFile(session, '/app/a.ts');

    // The parent's refusal is no more authoritative than its answers: the
    // words land, the child-owned binding location stays.
    expect(session.breakpoints.get('pending')).toMatchObject({
      verified: false, message: REFUSAL, messageOrigin: 'refusal', boundFile: '/app/dist/a.js', boundLine: 9
    });
  });

  it("never displaces a curated note, but replaces a provisional note, the adapter's earlier verdict, an older refusal, and the same words stamped unmarked", async () => {
    const { controller } = makeController();
    const curated = 'Adapter does not advertise logpoint support — this may pause instead of logging';
    const { session } = refusingSession([
      { id: 'curated', file: '/app/a.py', line: 1, message: curated, messageOrigin: 'curated' },
      { id: 'provisional', file: '/app/a.py', line: 2, message: 'Unbound breakpoint' },
      { id: 'older', file: '/app/a.py', line: 3, message: 'Older refusal', messageOrigin: 'refusal' },
      { id: 'echoed', file: '/app/a.py', line: 4, message: REFUSAL },
      { id: 'verdict', file: '/app/a.py', line: 5, message: 'Cannot resolve line 5' }
    ]);

    await controller.syncBreakpointsForFile(session, '/app/a.py');

    expect(session.breakpoints.get('curated')).toMatchObject({ verified: false, message: curated, messageOrigin: 'curated' });
    // The adapter's earlier verdict is older information than its refusal.
    expect(session.breakpoints.get('verdict')).toMatchObject({ message: REFUSAL, messageOrigin: 'refusal' });
    expect(session.breakpoints.get('provisional')).toMatchObject({ message: REFUSAL, messageOrigin: 'refusal' });
    expect(session.breakpoints.get('older')).toMatchObject({ message: REFUSAL, messageOrigin: 'refusal' });
    // The pre-launch echo (#750) stamps the same words without the marker;
    // the live refusal marks them so a later verification can drop them.
    expect(session.breakpoints.get('echoed')).toMatchObject({ message: REFUSAL, messageOrigin: 'refusal' });
  });

  it('stamps the unverified function breakpoints the same way, leaving verified and hit-proven ones standing', async () => {
    const { controller } = makeController();
    const { session } = refusingSession([], [
      { id: 'f1', functionName: 'main', verified: true, verifiedBy: 'adapter', adapterId: 4 },
      { id: 'f2', functionName: 'helper', boundFile: '/app/old.py', boundLine: 3 },
      { id: 'f3', functionName: 'proven', verified: true, verifiedBy: 'hit', adapterId: 9 }
    ]);

    const outcome = await controller.syncFunctionBreakpoints(session);

    expect(outcome).toMatchObject({ synced: false, failure: { message: REFUSAL, refused: true } });
    expect(session.functionBreakpoints.get('f1')).toEqual({
      id: 'f1', functionName: 'main', verified: true, verifiedBy: 'adapter', adapterId: 4
    });
    const f2 = session.functionBreakpoints.get('f2')!;
    expect(f2).toMatchObject({ verified: false, message: REFUSAL, messageOrigin: 'refusal' });
    expect(f2.boundFile).toBeUndefined();
    expect(f2.boundLine).toBeUndefined();
    expect(session.functionBreakpoints.get('f3')).toMatchObject({ verified: true, verifiedBy: 'hit', adapterId: 9 });
  });

  it('applies the hit-proven rule to a successful function re-send too, and a verifying answer drops a stamped refusal', async () => {
    const { controller } = makeController();
    const { session, sendDapRequest } = refusingSession([], [
      { id: 'f1', functionName: 'main', verified: true, verifiedBy: 'hit', adapterId: 4 },
      { id: 'f2', functionName: 'helper', message: REFUSAL, messageOrigin: 'refusal' },
      { id: 'f3', functionName: 'gone', verified: true, verifiedBy: 'adapter', adapterId: 5, boundFile: '/app/lib.py', boundLine: 3 }
    ]);
    sendDapRequest.mockResolvedValue({ body: { breakpoints: [
      { verified: false, id: 40, message: 'Cannot resolve symbol' },
      { verified: true, id: 41, line: 12, source: { path: '/app/lib.py' } },
      { verified: false, id: 50, message: 'Cannot resolve symbol' }
    ] } });

    const outcome = await controller.syncFunctionBreakpoints(session);

    expect(outcome).toEqual({ synced: true });
    // The unbound answer keeps the hit-proven record verified, id current.
    expect(session.functionBreakpoints.get('f1')).toMatchObject({ verified: true, verifiedBy: 'hit', adapterId: 40 });
    expect(session.functionBreakpoints.get('f1')!.message).toBeUndefined();
    const f2 = session.functionBreakpoints.get('f2')!;
    expect(f2).toMatchObject({ verified: true, verifiedBy: 'adapter', adapterId: 41, boundLine: 12, boundFile: '/app/lib.py' });
    expect(f2.message).toBeUndefined();
    expect(f2.messageOrigin).toBeUndefined();
    // An answer of "unbound" for a record the adapter had bound before: no
    // binding location is claimed any more.
    const f3 = session.functionBreakpoints.get('f3')!;
    expect(f3).toMatchObject({ verified: false, adapterId: 50, message: 'Cannot resolve symbol' });
    expect(f3.verifiedBy).toBeUndefined();
    expect(f3.boundFile).toBeUndefined();
    expect(f3.boundLine).toBeUndefined();
  });

  it("stamps nothing when the re-send succeeded; the adapter's answer displaces a stamped refusal either way", async () => {
    const { controller } = makeController();
    const { session, sendDapRequest } = refusingSession([
      { id: 'a', file: '/app/a.py', line: 7, message: REFUSAL, messageOrigin: 'refusal' },
      { id: 'b', file: '/app/a.py', line: 9, message: REFUSAL, messageOrigin: 'refusal' }
    ]);
    sendDapRequest.mockResolvedValue({ body: { breakpoints: [
      { verified: true, id: 9, line: 7 },
      { verified: false, id: 10, message: 'No source for line 9' }
    ] } });

    const outcome = await controller.syncBreakpointsForFile(session, '/app/a.py');

    expect(outcome).toEqual({ synced: true });
    expect(session.breakpoints.get('a')).toMatchObject({ verified: true, adapterId: 9 });
    expect(session.breakpoints.get('a')!.message).toBeUndefined();
    expect(session.breakpoints.get('a')!.messageOrigin).toBeUndefined();
    expect(session.breakpoints.get('b')).toMatchObject({ verified: false, adapterId: 10, message: 'No source for line 9' });
    expect(session.breakpoints.get('b')!.messageOrigin).toBeUndefined();
  });

  it("hands the failure back to setBreakpoint alongside the warning, for the handler's dedupe", async () => {
    const { controller, ctx } = makeController();
    const { session } = refusingSession([]);
    vi.mocked(ctx.getSession).mockReturnValue(session);

    const result = await controller.setBreakpoint('sess-1', { file: '/app/a.py', line: 7 });

    expect(result.breakpoint).toMatchObject({ verified: false, message: REFUSAL, messageOrigin: 'refusal' });
    expect(result.warning).toBe(`Breakpoint state updated, but live sync failed: ${REFUSAL}`);
    expect(result.failure).toEqual({ message: REFUSAL, refused: true });
  });

  it('reports a policy whose client behaviour throws as a failed re-send, never as a rejection', async () => {
    const { controller } = makeController({ getDapClientBehavior: () => { throw new Error('boom'); } });
    const { session } = refusingSession([{ id: 'a', file: '/app/a.py', line: 7 }], [{ id: 'f', functionName: 'main' }]);

    await expect(controller.syncBreakpointsForFile(session, '/app/a.py')).resolves.toMatchObject({
      synced: false,
      failure: { message: REFUSAL, refused: true }
    });
    await expect(controller.syncFunctionBreakpoints(session)).resolves.toMatchObject({
      synced: false,
      failure: { message: REFUSAL, refused: true }
    });
  });
});

describe('BreakpointController.resyncAll hands the failures back (issue #754)', () => {
  const refused = (message = REFUSAL) => ({ synced: false, warning: 'w', failure: { message, refused: true } });
  const failed = (message: string) => ({ synced: false, warning: 'w', failure: { message, refused: false } });

  it('groups the files refused with the same words into one sentence, naming a file by basename unless two collide', async () => {
    const { controller } = makeController();
    vi.spyOn(controller, 'syncBreakpointsForFile').mockImplementation(async (_session, file) =>
      file === '/app/ok.py' ? { synced: true } : refused()
    );
    vi.spyOn(controller, 'syncFunctionBreakpoints').mockResolvedValue(refused());
    const { session } = refusingSession(
      [
        { id: 'a', file: '/app/a.py', line: 1 },
        { id: 'b', file: '/app/b.py', line: 1 },
        { id: 'ok', file: '/app/ok.py', line: 1 },
        { id: 'x', file: '/app/x/utils.py', line: 1 },
        { id: 'y', file: '/app/y/utils.py', line: 1 }
      ],
      [{ id: 'f', functionName: 'main' }]
    );

    const outcome = await controller.resyncAll(session, { forceFreshEcho: true });

    expect(outcome).toEqual({
      warnings: [
        `The debugger refused the re-send of the breakpoints for a.py, b.py, /app/x/utils.py, /app/y/utils.py: ${REFUSAL}`,
        `The debugger refused the re-send of the function breakpoints: ${REFUSAL}`
      ],
      functionBreakpointsFailed: true
    });
  });

  it('keeps distinct answers apart, in send order', async () => {
    const { controller } = makeController();
    vi.spyOn(controller, 'syncBreakpointsForFile').mockImplementation(async (_session, file) =>
      file === '/app/a.py' ? refused() : refused('Path not found')
    );
    const { session } = refusingSession([{ id: 'a', file: '/app/a.py', line: 1 }, { id: 'b', file: '/app/b.py', line: 1 }]);

    const { warnings } = await controller.resyncAll(session);

    expect(warnings).toEqual([
      `The debugger refused the re-send of the breakpoints for a.py: ${REFUSAL}`,
      'The debugger refused the re-send of the breakpoints for b.py: Path not found'
    ]);
  });

  it('phrases a transport failure as a failure; a failed function re-send of any kind withholds the symptom warning', async () => {
    const { controller } = makeController();
    vi.spyOn(controller, 'syncBreakpointsForFile').mockResolvedValue(failed('Proxy exited'));
    vi.spyOn(controller, 'syncFunctionBreakpoints').mockResolvedValue(failed('Proxy exited'));
    const { session } = refusingSession([{ id: 'a', file: 'C:\\app\\a.py', line: 1 }], [{ id: 'f', functionName: 'main' }]);

    const outcome = await controller.resyncAll(session);

    expect(outcome).toEqual({
      warnings: [
        'The re-send of the breakpoints for a.py failed: Proxy exited',
        'The re-send of the function breakpoints failed: Proxy exited'
      ],
      functionBreakpointsFailed: true
    });
  });

  it('carries the ruby attach topology hint once, however many files the target refused (issue #357)', async () => {
    const { controller } = makeController();
    vi.spyOn(controller, 'syncBreakpointsForFile').mockImplementation(async (_session, file) => refused(`${file} is not available`));
    const { session } = refusingSession([{ id: 'a', file: '/host/app.rb', line: 1 }, { id: 'b', file: '/host/lib.rb', line: 1 }]);
    Object.assign(session, { language: 'ruby', attachMode: true });

    const { warnings } = await controller.resyncAll(session);

    // rdbg names the path, so every file is a distinct answer; the hint is one sentence at the end.
    expect(warnings).toEqual([
      'The debugger refused the re-send of the breakpoints for app.rb: /host/app.rb is not available',
      'The debugger refused the re-send of the breakpoints for lib.rb: /host/lib.rb is not available',
      LOCALFS_HINT
    ]);
  });

  it('appends the curated notes the function records carry, so capability-drift guidance still reaches the launch result', async () => {
    const { controller } = makeController();
    const drift = 'Adapter does not advertise function-breakpoint support — this breakpoint will not bind';
    vi.spyOn(controller, 'syncFunctionBreakpoints').mockResolvedValue(refused('Unsupported request'));
    const { session } = refusingSession([], [
      { id: 'f1', functionName: 'main', message: drift, messageOrigin: 'curated' },
      { id: 'f2', functionName: 'helper', message: 'Unsupported request', messageOrigin: 'refusal' },
      { id: 'f3', functionName: 'other', message: drift, messageOrigin: 'curated' },
      // An earlier adapter verdict is not a curated note.
      { id: 'f4', functionName: 'stale', message: 'Cannot resolve symbol stale' }
    ]);

    const { warnings } = await controller.resyncAll(session);

    expect(warnings).toEqual([`The debugger refused the re-send of the function breakpoints: Unsupported request (${drift})`]);
  });

  it('returns no warnings when every re-send succeeded, or there was nothing to send', async () => {
    const { controller } = makeController();
    vi.spyOn(controller, 'syncBreakpointsForFile').mockResolvedValue({ synced: true });
    vi.spyOn(controller, 'syncFunctionBreakpoints').mockResolvedValue({ synced: true });
    const { session } = refusingSession([{ id: 'a', file: '/app/a.py', line: 1 }], [{ id: 'f', functionName: 'main' }]);

    expect(await controller.resyncAll(session)).toEqual({ warnings: [], functionBreakpointsFailed: false });
    expect(await controller.resyncAll(refusingSession([]).session)).toEqual({ warnings: [], functionBreakpointsFailed: false });
  });
});
