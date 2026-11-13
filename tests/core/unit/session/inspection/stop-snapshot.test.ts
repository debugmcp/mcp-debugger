/**
 * composeStopSnapshot — the bounded state payload PAUSED answers carry
 * (issue #982): exception from the stop record, top user frames from the
 * landing's own resolver read, locals through the get_local_variables
 * pipeline under tight caps and a timeout. Never awaits exceptionInfo,
 * never re-resolves, degrades to undefined on any failure.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SessionState, PythonAdapterPolicy } from '@debugmcp/shared';
import type { StackTraceResult } from '../../../../../src/session/inspection/frame-anchor-resolver.js';
import {
  composeStopSnapshot,
  type StopSnapshotContext
} from '../../../../../src/session/inspection/stop-snapshot.js';

const FRAMES = [
  { id: 1, name: 'compute', file: '/proj/app.py', line: 44, column: 0 },
  { id: 2, name: 'bill', file: '/proj/billing.py', line: 12, column: 0 },
  { id: 3, name: 'main', file: '/proj/main.py', line: 3, column: 0 },
  { id: 4, name: 'runner', file: '/proj/runner.py', line: 99, column: 0 }
];

function stack(overrides: Partial<StackTraceResult> = {}): StackTraceResult {
  return {
    frames: FRAMES as never,
    totalFrameCount: FRAMES.length,
    hiddenFrameCount: 0,
    allFramesInternal: false,
    ...overrides
  };
}

type LocalsOutcome =
  | { kind: 'result'; value: Record<string, unknown> }
  | { kind: 'throw'; error: Error }
  | { kind: 'hang' };

function makeCtx(opts: {
  state?: SessionState;
  lastStop?: Record<string, unknown>;
  locals?: LocalsOutcome;
  redaction?: boolean;
  snapshot?: boolean;
  mode?: 'open' | 'explicit';
  timeoutMs?: number;
} = {}) {
  const locals = opts.locals ?? {
    kind: 'result',
    value: {
      variables: [
        { name: 'subtotal', value: '125.0', type: 'float', variablesReference: 0 },
        { name: 'user', value: "'ada'", type: 'str', variablesReference: 0 }
      ],
      frame: { name: 'compute', file: '/proj/app.py', line: 44 },
      scopeName: 'Locals'
    }
  };
  const extractLocalsFromResolved = vi.fn(() => {
    if (locals.kind === 'throw') return Promise.reject(locals.error);
    if (locals.kind === 'hang') return new Promise(() => {});
    return Promise.resolve(locals.value);
  });
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  // One stable session object: the diff cache (issue #983) lives on it and
  // the stop-identity rule compares lastStop by reference.
  const session: Record<string, unknown> = {
    state: opts.state ?? SessionState.PAUSED,
    lastStop: opts.lastStop ?? { reason: 'breakpoint', timestamp: 1, threadId: 1 }
  };
  const ctx = {
    logger,
    tunables: { snapshotLocalsTimeoutMs: opts.timeoutMs ?? 2000 },
    getSession: vi.fn(() => session),
    redactionEnabled: () => opts.redaction ?? true,
    snapshotEnabled: () => opts.snapshot ?? true,
    variableAccessMode: () => opts.mode ?? 'open',
    extractLocalsFromResolved
  } as unknown as StopSnapshotContext;
  return { ctx, extractLocalsFromResolved, logger, session };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('composeStopSnapshot gates (issue #982)', () => {
  it('answers nothing when the snapshot is disabled, and never reads locals', async () => {
    const { ctx, extractLocalsFromResolved } = makeCtx({ snapshot: false });
    expect(await composeStopSnapshot(ctx, 'sid', stack(), 'test')).toBeUndefined();
    expect(extractLocalsFromResolved).not.toHaveBeenCalled();
  });

  it('answers nothing without a landing read (a failed landing means no snapshot)', async () => {
    const { ctx } = makeCtx();
    expect(await composeStopSnapshot(ctx, 'sid', undefined, 'test')).toBeUndefined();
  });

  it('answers nothing when the session is no longer paused', async () => {
    const { ctx } = makeCtx({ state: SessionState.RUNNING });
    expect(await composeStopSnapshot(ctx, 'sid', stack(), 'test')).toBeUndefined();
  });

  it('answers nothing on an entry stop', async () => {
    const { ctx } = makeCtx({ lastStop: { reason: 'entry', timestamp: 1 } });
    expect(await composeStopSnapshot(ctx, 'sid', stack(), 'test')).toBeUndefined();
  });

  it('answers nothing when there are no frames and no exception', async () => {
    const { ctx } = makeCtx();
    expect(await composeStopSnapshot(ctx, 'sid', stack({ frames: [] }), 'test')).toBeUndefined();
  });

  it('degrades to nothing when composition itself throws, logging at debug level', async () => {
    const { ctx, logger } = makeCtx();
    (ctx.getSession as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('boom');
    });
    expect(await composeStopSnapshot(ctx, 'sid', stack(), 'test')).toBeUndefined();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Could not compose stop snapshot'),
      expect.any(Error)
    );
  });
});

describe('composeStopSnapshot frames and locals', () => {
  it('carries the top three visible frames and flat redacted locals', async () => {
    const { ctx, extractLocalsFromResolved } = makeCtx();
    const read = stack();

    const snapshot = await composeStopSnapshot(ctx, 'sid', read, 'test');

    expect(snapshot).toBeDefined();
    expect(snapshot?.frames).toEqual([
      { name: 'compute', file: '/proj/app.py', line: 44 },
      { name: 'bill', file: '/proj/billing.py', line: 12 },
      { name: 'main', file: '/proj/main.py', line: 3 }
    ]);
    expect(snapshot?.locals).toEqual({ subtotal: '125.0', user: "'ada'" });
    expect(snapshot?.exception).toBeUndefined();
    expect(extractLocalsFromResolved).toHaveBeenCalledWith('sid', read, { maxFrames: 3 });
  });

  it('keeps the first value when a name repeats, and stores exotic names safely', async () => {
    const { ctx } = makeCtx({
      locals: {
        kind: 'result',
        value: {
          variables: [
            { name: 'x', value: '1', type: 'int', variablesReference: 0 },
            { name: 'x', value: '2', type: 'int', variablesReference: 0 },
            { name: '__proto__', value: '{}', type: 'object', variablesReference: 0 }
          ],
          frame: null,
          scopeName: 'Locals'
        }
      }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot?.locals?.x).toBe('1');
    expect(Object.prototype.hasOwnProperty.call(snapshot?.locals, '__proto__')).toBe(true);
    expect(JSON.parse(JSON.stringify(snapshot?.locals))['__proto__']).toBe('{}');
  });

  it('caps locals at the snapshot limits and says what was cut', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      name: `v${String(i).padStart(2, '0')}`,
      value: i === 0 ? 'y'.repeat(500) : `${i}`,
      type: 'str',
      variablesReference: 0
    }));
    const { ctx } = makeCtx({
      locals: { kind: 'result', value: { variables: many, frame: null, scopeName: 'Locals' } }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(Object.keys(snapshot?.locals ?? {})).toHaveLength(20);
    expect(snapshot?.locals?.v00).toHaveLength(200);
    expect(snapshot?.truncation).toContain('get_local_variables');
  });

  it('joins the locals anchor note into the snapshot note', async () => {
    const { ctx } = makeCtx({
      locals: {
        kind: 'result',
        value: {
          variables: [{ name: 'x', value: '1', type: 'int', variablesReference: 0 }],
          frame: { name: 'bill', file: '/proj/billing.py', line: 12 },
          scopeName: 'Locals',
          anchorNote: "Top frame 'compute' has no local variables (runtime/stdlib frame); showing frame #1 'bill' instead"
        }
      }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot?.note).toContain("showing frame #1 'bill' instead");
  });

  it('withholds locals in explicit-names mode but keeps frames, and says why', async () => {
    const { ctx, extractLocalsFromResolved } = makeCtx({ mode: 'explicit' });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(extractLocalsFromResolved).not.toHaveBeenCalled();
    expect(snapshot?.locals).toBeUndefined();
    expect(snapshot?.frames).toHaveLength(3);
    expect(snapshot?.note).toContain('DEBUG_MCP_VARIABLE_ACCESS=explicit');
  });

  it('skips the locals read silently when no frame is program code', async () => {
    const { ctx, extractLocalsFromResolved } = makeCtx();
    const read = stack({ noProgramFrame: true });

    const snapshot = await composeStopSnapshot(ctx, 'sid', read, 'test');

    expect(extractLocalsFromResolved).not.toHaveBeenCalled();
    expect(snapshot?.locals).toBeUndefined();
    expect(snapshot?.note).toBeUndefined();
  });

  it('skips the locals read when a lone sourceless frame is all there is (noProgramFrame)', async () => {
    const { ctx, extractLocalsFromResolved } = makeCtx();
    // The resolver sets noProgramFrame for a stack with no program frame; a
    // lone '<unknown_source>' frame always has it.
    const read = stack({
      frames: [{ id: 9, name: '<anonymous>', file: '<unknown_source>', line: 1, column: 1 }] as never,
      noProgramFrame: true
    });

    await composeStopSnapshot(ctx, 'sid', read, 'test');

    expect(extractLocalsFromResolved).not.toHaveBeenCalled();
  });

  it('reads locals through the walk-down when the KEPT top frame is sourceless but program frames sit below', async () => {
    // The issue #672 keep rule can put a raw internal frame at frames[0]
    // while user frames follow; the walk-down (#468) exists for exactly this.
    const { ctx, extractLocalsFromResolved } = makeCtx({
      locals: {
        kind: 'result',
        value: {
          variables: [{ name: 'x', value: '1', type: 'int', variablesReference: 0 }],
          frame: { name: 'compute', file: '/proj/app.py', line: 44 },
          scopeName: 'Locals'
        }
      }
    });
    const read = stack({
      frames: [
        { id: 9, name: 'DbgBreakPoint', file: '<unknown_source>', line: 0, column: 0 },
        ...FRAMES
      ] as never
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', read, 'test');

    expect(extractLocalsFromResolved).toHaveBeenCalled();
    expect(snapshot?.locals).toEqual({ x: '1' });
  });

  it('ships without locals when the read exceeds snapshotLocalsTimeoutMs, saying what expired, and leaves no timer behind', async () => {
    vi.useFakeTimers();
    const { ctx } = makeCtx({ locals: { kind: 'hang' }, timeoutMs: 2000 });

    const pending = composeStopSnapshot(ctx, 'sid', stack(), 'test');
    await vi.advanceTimersByTimeAsync(2000);
    const snapshot = await pending;

    expect(snapshot?.frames).toHaveLength(3);
    expect(snapshot?.locals).toBeUndefined();
    expect(snapshot?.note).toContain('2000ms');
    expect(snapshot?.note).toContain('get_local_variables');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ships without locals when the read fails, and says so', async () => {
    const { ctx, logger } = makeCtx({ locals: { kind: 'throw', error: new Error('scopes failed') } });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot?.frames).toHaveLength(3);
    expect(snapshot?.locals).toBeUndefined();
    expect(snapshot?.note).toContain('locals omitted');
    expect(logger.debug).toHaveBeenCalled();
  });
});

describe('composeStopSnapshot exception mapping', () => {
  const SECRET = 'ghp_' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123';

  it('maps description/text to type/message on an exception stop, redacted', async () => {
    const { ctx } = makeCtx({
      lastStop: {
        reason: 'exception',
        timestamp: 1,
        description: 'AuthError',
        text: `token ${SECRET} rejected`
      }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot?.exception?.type).toBe('AuthError');
    expect(snapshot?.exception?.message).toContain('<redacted:github-pat>');
    expect(snapshot?.exception?.message).not.toContain(SECRET);
  });

  it('leaves the exception raw when redaction is off', async () => {
    const { ctx } = makeCtx({
      redaction: false,
      lastStop: { reason: 'exception', timestamp: 1, description: 'AuthError', text: `token ${SECRET}` }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot?.exception?.message).toContain(SECRET);
  });

  it('falls back to merged exceptionInfo fields and never includes its stackTrace', async () => {
    const { ctx } = makeCtx({
      lastStop: {
        reason: 'exception',
        timestamp: 1,
        exceptionInfo: {
          exceptionId: 'errors.AuthError',
          breakMode: 'unhandled',
          description: 'AuthError: bad token',
          details: {
            message: 'bad token',
            typeName: 'AuthError',
            fullTypeName: 'errors.AuthError',
            stackTrace: 'Traceback (most recent call last): ...'
          }
        }
      }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot?.exception?.type).toBe('errors.AuthError');
    expect(snapshot?.exception?.message).toBe('bad token');
    expect(snapshot?.exception?.details).toBe('AuthError: bad token');
    expect(JSON.stringify(snapshot)).not.toContain('Traceback');
  });

  it('prefers the unambiguous exceptionInfo fields over the adapter-variant raw pair (debugpy order)', async () => {
    // debugpy follows the DAP spec reading: text carries the exception NAME,
    // description the message — the opposite of the model-comment convention
    // other adapters use. Once exceptionInfo has merged, its typed fields win.
    const { ctx } = makeCtx({
      lastStop: {
        reason: 'exception',
        timestamp: 1,
        description: 'division by zero',
        text: 'ZeroDivisionError',
        exceptionInfo: {
          exceptionId: 'ZeroDivisionError',
          breakMode: 'unhandled',
          description: 'division by zero',
          details: { message: 'division by zero', typeName: 'ZeroDivisionError' }
        }
      }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot?.exception?.type).toBe('ZeroDivisionError');
    expect(snapshot?.exception?.message).toBe('division by zero');
    expect(snapshot?.exception?.details).toBeUndefined();
  });

  // Issue #985: at a userUnhandled stop pydevd appends a note to the exception
  // name everywhere it reports it — `text`, `exceptionId`, `typeName`:
  // "AssertionError       (note: full exception trace is shown but execution is
  // paused at: test_x)". The core strips it when it stores the record (issue
  // #1047); the composer applies the same lens, so a record that still carries
  // the note — written before #1047 — yields the class all the same.
  it("strips pydevd's paused-at note from the exception type, with exceptionInfo merged", async () => {
    const noted = 'AssertionError       (note: full exception trace is shown but execution is paused at: test_assert_fails)';
    const { ctx } = makeCtx({
      lastStop: {
        reason: 'exception',
        timestamp: 1,
        description: 'assert 20.0 == 21.0',
        text: noted,
        exceptionInfo: {
          exceptionId: noted,
          breakMode: 'always',
          description: 'assert 20.0 == 21.0',
          details: { message: 'assert 20.0 == 21.0', typeName: noted }
        }
      }
    });

    // The session's policy says what the class is; the composer asks it.
    Object.assign(ctx, { selectPolicy: () => PythonAdapterPolicy });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot?.exception?.type).toBe('AssertionError');
    expect(snapshot?.exception?.message).toBe('assert 20.0 == 21.0');
    expect(snapshot?.exception?.details).toBeUndefined();
  });

  it("strips the note from the raw stopped pair too, before the pair's shape is read", async () => {
    const { ctx } = makeCtx({
      lastStop: {
        reason: 'exception',
        timestamp: 1,
        description: 'not today',
        text: 'Skipped       (note: full exception trace is shown but execution is paused at: test_skip)'
      }
    });

    Object.assign(ctx, { selectPolicy: () => PythonAdapterPolicy });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot?.exception?.type).toBe('Skipped');
    expect(snapshot?.exception?.message).toBe('not today');
  });

  it('omits details when it only repeats the message', async () => {
    const { ctx } = makeCtx({
      lastStop: {
        reason: 'exception',
        timestamp: 1,
        exceptionInfo: { exceptionId: 'E', breakMode: 'unhandled', description: 'bad token' }
      }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot?.exception?.message).toBe('bad token');
    expect(snapshot?.exception?.details).toBeUndefined();
  });

  it('omits the exception entirely when the adapter reported nothing (CodeLLDB panic relabel)', async () => {
    const { ctx } = makeCtx({
      lastStop: { reason: 'exception', rawReason: 'breakpoint', timestamp: 1 }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot).toBeDefined();
    expect(snapshot?.exception).toBeUndefined();
    expect(snapshot?.frames).toHaveLength(3);
  });

  it('caps runaway exception strings at 500 chars with an ellipsis', async () => {
    const { ctx } = makeCtx({
      lastStop: { reason: 'exception', timestamp: 1, description: 'E', text: 'x'.repeat(2000) }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot?.exception?.message).toHaveLength(501);
    expect(snapshot?.exception?.message?.endsWith('…')).toBe(true);
  });

  it('still answers frames-only for an exception stop whose landing read saw no frames', async () => {
    const { ctx } = makeCtx({
      lastStop: { reason: 'exception', timestamp: 1, description: 'E', text: 'boom' }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack({ frames: [] }), 'test');

    expect(snapshot?.frames).toEqual([]);
    expect(snapshot?.exception?.type).toBe('E');
  });

  it('omits the exception on request (wait_for_stop already carries lastStop)', async () => {
    const { ctx } = makeCtx({
      lastStop: { reason: 'exception', timestamp: 1, description: 'E', text: 'boom' }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test', { omitException: true });

    expect(snapshot?.exception).toBeUndefined();
    expect(snapshot?.frames).toHaveLength(3);
  });
});

describe('composeStopSnapshot diff cache (issue #983)', () => {
  type Extract = ReturnType<typeof vi.fn>;
  const localsResult = (
    vals: Record<string, string>,
    frame: { name: string; file: string; line: number } = { name: 'compute', file: '/proj/app.py', line: 44 }
  ) => ({
    variables: Object.entries(vals).map(([name, value]) => ({ name, value, type: 'str', variablesReference: 0 })),
    frame,
    scopeName: 'Locals'
  });
  const newStop = (session: Record<string, unknown>) => {
    session.lastStop = { reason: 'breakpoint', timestamp: Date.now(), threadId: 1 };
  };

  it('first stop emits full locals and seeds the cache; the next stop in the same frame emits only what changed', async () => {
    const { ctx, extractLocalsFromResolved, session } = makeCtx();
    (extractLocalsFromResolved as Extract)
      .mockResolvedValueOnce(localsResult({ subtotal: '100.0', user: "'ada'" }))
      .mockResolvedValueOnce(localsResult({ subtotal: '125.0', user: "'ada'", discount: '15.0' }));

    const first = await composeStopSnapshot(ctx, 'sid', stack(), 'test');
    expect(first?.locals).toEqual({ subtotal: '100.0', user: "'ada'" });
    expect(first?.changedVariables).toBeUndefined();

    newStop(session);
    const second = await composeStopSnapshot(ctx, 'sid', stack(), 'test');
    expect(second?.locals).toBeUndefined();
    // A variable that was not there is marked as such, with no invented
    // "before" value (issue #1140).
    expect(second?.changedVariables).toEqual({
      subtotal: { before: '100.0', after: '125.0' },
      discount: { after: '15.0', new: true }
    });
  });

  it('a stop where nothing visible changed emits an empty changedVariables — that is information', async () => {
    const { ctx, extractLocalsFromResolved, session } = makeCtx();
    (extractLocalsFromResolved as Extract)
      .mockResolvedValueOnce(localsResult({ x: '1' }))
      .mockResolvedValueOnce(localsResult({ x: '1' }));

    await composeStopSnapshot(ctx, 'sid', stack(), 'test');
    newStop(session);
    const second = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(second?.changedVariables).toEqual({});
    expect(second?.locals).toBeUndefined();
  });

  it('the same stop answered twice re-emits full locals and leaves the base untouched (no self-diff)', async () => {
    const { ctx, extractLocalsFromResolved, session } = makeCtx();
    (extractLocalsFromResolved as Extract)
      .mockResolvedValueOnce(localsResult({ x: '1' }))
      .mockResolvedValueOnce(localsResult({ x: '1' }))
      .mockResolvedValueOnce(localsResult({ x: '2' }));

    await composeStopSnapshot(ctx, 'sid', stack(), 'test');          // seeds on stop A
    const reanswered = await composeStopSnapshot(ctx, 'sid', stack(), 'test'); // stop A again
    expect(reanswered?.locals).toEqual({ x: '1' });
    expect(reanswered?.changedVariables).toBeUndefined();

    newStop(session);
    const third = await composeStopSnapshot(ctx, 'sid', stack(), 'test'); // stop B diffs vs A
    expect(third?.changedVariables).toEqual({ x: { before: '1', after: '2' } });
  });

  it('a frame-key mismatch re-emits full locals and rebases (never a wrong diff)', async () => {
    const { ctx, extractLocalsFromResolved, session } = makeCtx();
    const bill = { name: 'bill', file: '/proj/billing.py', line: 12 };
    (extractLocalsFromResolved as Extract)
      .mockResolvedValueOnce(localsResult({ x: '1' }))                 // compute
      .mockResolvedValueOnce(localsResult({ y: '9' }, bill))           // different anchor
      .mockResolvedValueOnce(localsResult({ y: '10' }, bill));         // bill again

    await composeStopSnapshot(ctx, 'sid', stack(), 'test');
    newStop(session);
    const atBill = await composeStopSnapshot(ctx, 'sid', stack(), 'test');
    expect(atBill?.locals).toEqual({ y: '9' });
    expect(atBill?.changedVariables).toBeUndefined();

    newStop(session);
    const atBillAgain = await composeStopSnapshot(ctx, 'sid', stack(), 'test');
    expect(atBillAgain?.changedVariables).toEqual({ y: { before: '9', after: '10' } });
  });

  it('a changed visible depth is a frame-key mismatch too (recursion-safe)', async () => {
    const { ctx, extractLocalsFromResolved, session } = makeCtx();
    (extractLocalsFromResolved as Extract)
      .mockResolvedValueOnce(localsResult({ x: '1' }))
      .mockResolvedValueOnce(localsResult({ x: '2' }));

    await composeStopSnapshot(ctx, 'sid', stack(), 'test');            // depth 4
    newStop(session);
    const shallower = await composeStopSnapshot(ctx, 'sid', stack({ frames: FRAMES.slice(0, 2) as never }), 'test'); // depth 2
    expect(shallower?.locals).toEqual({ x: '2' });
    expect(shallower?.changedVariables).toBeUndefined();
  });

  it('a failed locals read leaves the cache untouched, so the next diff is against the last SHOWN values', async () => {
    const { ctx, extractLocalsFromResolved, session } = makeCtx();
    (extractLocalsFromResolved as Extract)
      .mockResolvedValueOnce(localsResult({ x: '1' }))
      .mockRejectedValueOnce(new Error('scopes failed'))
      .mockResolvedValueOnce(localsResult({ x: '3' }));

    await composeStopSnapshot(ctx, 'sid', stack(), 'test');
    newStop(session);
    const failed = await composeStopSnapshot(ctx, 'sid', stack(), 'test');
    expect(failed?.locals).toBeUndefined();
    expect(failed?.note).toContain('locals omitted');

    newStop(session);
    const third = await composeStopSnapshot(ctx, 'sid', stack(), 'test');
    expect(third?.changedVariables).toEqual({ x: { before: '1', after: '3' } });
  });
});

describe('composeStopSnapshot diff vocabulary: changed, new, gone (issue #1140)', () => {
  type Extract = ReturnType<typeof vi.fn>;
  const COMPUTE = { name: 'compute', file: '/proj/app.py', line: 44 };
  const variablesOf = (vals: Array<[string, string]>) =>
    vals.map(([name, value]) => ({ name, value, type: 'str', variablesReference: 0 }));
  const localsResult = (vals: Array<[string, string]>, extra: Record<string, unknown> = {}) => ({
    variables: variablesOf(vals),
    frame: COMPUTE,
    scopeName: 'Locals',
    ...extra
  });
  const numbered = (prefix: string, count: number): Array<[string, string]> =>
    Array.from({ length: count }, (_, i): [string, string] => [`${prefix}${String(i).padStart(2, '0')}`, `${i}`]);
  const newStop = (session: Record<string, unknown>) => {
    session.lastStop = { reason: 'step', timestamp: Date.now(), threadId: 1 };
  };

  /** Compose once per read, each on a fresh stop, and answer the last snapshot. */
  async function diffOf(...reads: Array<ReturnType<typeof localsResult>>) {
    const { ctx, extractLocalsFromResolved, session } = makeCtx();
    for (const read of reads) {
      (extractLocalsFromResolved as Extract).mockResolvedValueOnce(read);
    }
    let last: Awaited<ReturnType<typeof composeStopSnapshot>>;
    for (let i = 0; i < reads.length; i++) {
      if (i > 0) newStop(session);
      last = await composeStopSnapshot(ctx, 'sid', stack(), 'test');
    }
    return last;
  }

  it('says all three in one map: what changed, what appeared, what left scope', async () => {
    const snapshot = await diffOf(
      localsResult([['x', '1'], ['i', '3']]),
      localsResult([['x', '2'], ['sum', '30']])
    );

    expect(snapshot?.changedVariables).toEqual({
      x: { before: '1', after: '2' },
      sum: { after: '30', new: true },
      i: { before: '3', gone: true }
    });
    expect(snapshot?.locals).toBeUndefined();
  });

  it('a variable that left scope carries its last shown value', async () => {
    const snapshot = await diffOf(localsResult([['x', '1'], ['i', '3']]), localsResult([['x', '1']]));

    expect(snapshot?.changedVariables).toEqual({ i: { before: '3', gone: true } });
  });

  it('an empty map still means nothing visible changed', async () => {
    const snapshot = await diffOf(localsResult([['x', '1']]), localsResult([['x', '1']]));

    expect(snapshot?.changedVariables).toEqual({});
  });

  it('never calls a variable new when the previous list was cut: it may have been there, unseen', async () => {
    // 25 locals, 20 shown: v20..v24 exist and were never shown.
    const snapshot = await diffOf(
      localsResult(numbered('v', 25)),
      localsResult([['v24', '24'], ...numbered('v', 19)])
    );

    // Shown now, absent from what was shown before — and that is all that is known.
    expect(snapshot?.changedVariables?.v24).toEqual({ after: '24' });
    // v19 WAS shown and is absent from a list that is complete: that is known.
    expect(snapshot?.changedVariables?.v19).toEqual({ before: '19', gone: true });
    expect(Object.keys(snapshot?.changedVariables ?? {}).sort()).toEqual(['v19', 'v24']);
  });

  it('never calls a variable gone when the current list was cut: it may still be there, unseen', async () => {
    const snapshot = await diffOf(
      localsResult([['a', '1'], ['b', '2']]),
      localsResult([['a', '1'], ...numbered('c', 24)])
    );

    // b is not among the 20 shown, and 5 were omitted: nothing can be said of b.
    expect(snapshot?.changedVariables).not.toHaveProperty('b');
    // The previous list was complete, so what is shown now and was not there is new.
    expect(snapshot?.changedVariables?.c00).toEqual({ after: '0', new: true });
    expect(snapshot?.truncation).toContain('omitted');
  });

  it('never calls a variable gone when a scope went unread this time', async () => {
    const snapshot = await diffOf(
      localsResult([['a', '1'], ['b', '2']]),
      localsResult([['a', '1']], { truncation: { omittedCount: 0, valueTruncatedCount: 0, scopesSkipped: 1 } })
    );

    expect(snapshot?.changedVariables).toEqual({});
  });

  it('never calls a variable new when a scope went unread last time', async () => {
    const snapshot = await diffOf(
      localsResult([['a', '1']], { truncation: { omittedCount: 0, valueTruncatedCount: 0, scopesSkipped: 1 } }),
      localsResult([['a', '1'], ['b', '2']])
    );

    expect(snapshot?.changedVariables).toEqual({ b: { after: '2' } });
  });

  it('a list cut by its upstream caps counts as cut', async () => {
    const snapshot = await diffOf(
      localsResult([['a', '1']], { truncation: { omittedCount: 3, valueTruncatedCount: 0 } }),
      localsResult([['a', '1'], ['b', '2']])
    );

    expect(snapshot?.changedVariables).toEqual({ b: { after: '2' } });
  });

  it('a value that was only shortened does not make its list incomplete', async () => {
    const snapshot = await diffOf(
      localsResult([['a', 'y'.repeat(500)]]),
      localsResult([['a', 'y'.repeat(500)], ['b', '2']])
    );

    expect(snapshot?.changedVariables).toEqual({ b: { after: '2', new: true } });
  });

  it('carries completeness forward: the list a diff was built from is the next base', async () => {
    const snapshot = await diffOf(
      localsResult([['a', '1']]),
      localsResult([['a', '1'], ...numbered('c', 24)]),   // cut: becomes an incomplete base
      localsResult([['a', '1'], ['z', '9']])
    );

    // z was not among the 20 shown, but 5 were omitted then: not provably new.
    expect(snapshot?.changedVariables?.z).toEqual({ after: '9' });
    // c00 was shown and is absent from a complete list: gone.
    expect(snapshot?.changedVariables?.c00).toEqual({ before: '0', gone: true });
  });

  it('treats the text "<undefined>" as the value it is', async () => {
    const snapshot = await diffOf(
      localsResult([['x', '<undefined>']]),
      localsResult([['x', '5'], ['y', '<undefined>']])
    );

    expect(snapshot?.changedVariables).toEqual({
      x: { before: '<undefined>', after: '5' },
      y: { after: '<undefined>', new: true }
    });
  });

  it('keeps exotic names as own keys in both directions', async () => {
    const appeared = await diffOf(localsResult([['x', '1']]), localsResult([['x', '1'], ['__proto__', '{}']]));
    expect(Object.prototype.hasOwnProperty.call(appeared?.changedVariables, '__proto__')).toBe(true);
    expect(JSON.parse(JSON.stringify(appeared?.changedVariables))['__proto__']).toEqual({ after: '{}', new: true });

    const left = await diffOf(localsResult([['x', '1'], ['__proto__', '{}']]), localsResult([['x', '1']]));
    expect(Object.prototype.hasOwnProperty.call(left?.changedVariables, '__proto__')).toBe(true);
    expect(JSON.parse(JSON.stringify(left?.changedVariables))['__proto__']).toEqual({ before: '{}', gone: true });

    // An inherited name is not a variable: "constructor" is new, not changed.
    const inherited = await diffOf(localsResult([['x', '1']]), localsResult([['x', '1'], ['constructor', 'f']]));
    expect(inherited?.changedVariables).toEqual({ constructor: { after: 'f', new: true } });
  });

  it("reports an adapter's return-value entry as it happens: new when it appears", async () => {
    // debugpy keeps "(return) add" in the frame once it appears (measured,
    // 1.8.20); js-debug shows "Return value" at a function's return point.
    const appeared = await diffOf(
      localsResult([['a', '1']]),
      localsResult([['a', '1'], ['(return) add', '3'], ['s', '3']])
    );
    expect(appeared?.changedVariables).toEqual({
      '(return) add': { after: '3', new: true },
      s: { after: '3', new: true }
    });

    // It stays, so the next stop says nothing more about it.
    const snapshot = await diffOf(
      localsResult([['a', '1']]),
      localsResult([['a', '1'], ['(return) add', '3'], ['s', '3']]),
      localsResult([['a', '1'], ['(return) add', '3'], ['s', '3'], ['t', '4']])
    );

    expect(snapshot?.changedVariables).toEqual({ t: { after: '4', new: true } });
  });

  it('an empty read emits no diff and leaves the base alone, so the next diff is against the last shown list', async () => {
    const { ctx, extractLocalsFromResolved, session } = makeCtx();
    (extractLocalsFromResolved as Extract)
      .mockResolvedValueOnce(localsResult([['x', '1']]))
      .mockResolvedValueOnce(localsResult([]))
      .mockResolvedValueOnce(localsResult([['x', '2']]));

    await composeStopSnapshot(ctx, 'sid', stack(), 'test');
    newStop(session);
    const empty = await composeStopSnapshot(ctx, 'sid', stack(), 'test');
    expect(empty).not.toHaveProperty('changedVariables');
    expect(empty).not.toHaveProperty('locals');

    newStop(session);
    const third = await composeStopSnapshot(ctx, 'sid', stack(), 'test');
    expect(third?.changedVariables).toEqual({ x: { before: '1', after: '2' } });
  });
});

describe('review fixes: exception pair orientation (pre-merge heuristic)', () => {
  it('labels the identifier-shaped half as type when the raw pair arrives in spec order, without exceptionInfo', async () => {
    const { ctx } = makeCtx({
      lastStop: {
        reason: 'exception',
        timestamp: 1,
        description: 'java.lang.RuntimeException: uncaught on purpose',
        text: 'java.lang.RuntimeException'
      }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot?.exception?.type).toBe('java.lang.RuntimeException');
    expect(snapshot?.exception?.message).toBe('java.lang.RuntimeException: uncaught on purpose');
  });

  it('keeps the model-comment order when description is the identifier (mock convention)', async () => {
    const { ctx } = makeCtx({
      lastStop: {
        reason: 'exception',
        timestamp: 1,
        description: 'MockError',
        text: 'Mock uncaught exception'
      }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot?.exception?.type).toBe('MockError');
    expect(snapshot?.exception?.message).toBe('Mock uncaught exception');
  });
});

describe('review fixes: notes and truncation honesty', () => {
  it("never re-ships the landing's resolver note inside snapshot.note", async () => {
    const resolverNote = 'The stop was reported on thread 1; showing thread 2.';
    const { ctx } = makeCtx({
      locals: {
        kind: 'result',
        value: {
          variables: [{ name: 'x', value: '1', type: 'int', variablesReference: 0 }],
          frame: null,
          scopeName: 'Locals',
          anchorNote: resolverNote + "; Top frame 'idle' has no local variables (runtime/stdlib frame); showing frame #1 'bill' instead"
        }
      }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack({ note: resolverNote }), 'test');

    expect(snapshot?.note).toContain("showing frame #1 'bill' instead");
    expect(snapshot?.note).not.toContain('showing thread 2');
  });

  it('counts a re-cut value once and says when scopes went unread', async () => {
    const long = 'y'.repeat(1024); // already cut upstream at the pipeline cap
    const { ctx } = makeCtx({
      locals: {
        kind: 'result',
        value: {
          variables: [{ name: 'big', value: long, type: 'str', variablesReference: 0 }],
          frame: null,
          scopeName: 'Locals',
          truncation: { omittedCount: 0, valueTruncatedCount: 1, scopesSkipped: 1 }
        }
      }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot?.truncation).toContain('1 value(s) cut');
    expect(snapshot?.truncation).not.toContain('2 value(s)');
    expect(snapshot?.truncation).toContain('scope(s) unread');
  });

  it('never renders the all-zero truncation sentence for a scopes-skipped-only summary', async () => {
    const { ctx } = makeCtx({
      locals: {
        kind: 'result',
        value: {
          variables: [{ name: 'x', value: '1', type: 'int', variablesReference: 0 }],
          frame: null,
          scopeName: 'Locals',
          truncation: { omittedCount: 0, valueTruncatedCount: 0, scopesSkipped: 2 }
        }
      }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot?.truncation).toBeDefined();
    expect(snapshot?.truncation).not.toContain('0 variable(s) omitted');
    expect(snapshot?.truncation).toContain('2 scope(s) unread');
  });

  it('says when the capped walk-down found nothing although deeper frames exist', async () => {
    const { ctx } = makeCtx({
      locals: {
        kind: 'result',
        value: { variables: [], frame: null, scopeName: null }
      }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test'); // 4 frames > 3 probed

    expect(snapshot?.note).toContain('no locals in the top 3 frames');
    expect(snapshot?.note).toContain('get_local_variables');
  });

  it('stays silent about locals when the whole stack was probed and is simply locals-free', async () => {
    const { ctx } = makeCtx({
      locals: { kind: 'result', value: { variables: [], frame: null, scopeName: null } }
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack({ frames: FRAMES.slice(0, 2) as never }), 'test');

    expect(snapshot?.note).toBeUndefined();
  });
});

describe('review fixes: stop identity across the locals read', () => {
  it('answers no snapshot when the stop changed under the locals read (never mixes two stops)', async () => {
    const { ctx, extractLocalsFromResolved, session } = makeCtx();
    (extractLocalsFromResolved as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      // A different stop lands while the read is in flight.
      session.lastStop = { reason: 'breakpoint', timestamp: 2, threadId: 1 };
      return {
        variables: [{ name: 'x', value: '1', type: 'int', variablesReference: 0 }],
        frame: null,
        scopeName: 'Locals'
      };
    });

    const snapshot = await composeStopSnapshot(ctx, 'sid', stack(), 'test');

    expect(snapshot).toBeUndefined();
  });
});

