/**
 * composeStopSnapshot — the bounded state payload PAUSED answers carry
 * (issue #982): exception from the stop record, top user frames from the
 * landing's own resolver read, locals through the get_local_variables
 * pipeline under tight caps and a timeout. Never awaits exceptionInfo,
 * never re-resolves, degrades to undefined on any failure.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SessionState } from '@debugmcp/shared';
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
  const ctx = {
    logger,
    tunables: { snapshotLocalsTimeoutMs: opts.timeoutMs ?? 2000 },
    getSession: vi.fn(() => ({
      state: opts.state ?? SessionState.PAUSED,
      lastStop: opts.lastStop ?? { reason: 'breakpoint', timestamp: 1, threadId: 1 }
    })),
    redactionEnabled: () => opts.redaction ?? true,
    snapshotEnabled: () => opts.snapshot ?? true,
    variableAccessMode: () => opts.mode ?? 'open',
    extractLocalsFromResolved
  } as unknown as StopSnapshotContext;
  return { ctx, extractLocalsFromResolved, logger };
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

  it('skips the locals read for a sourceless top frame', async () => {
    const { ctx, extractLocalsFromResolved } = makeCtx();
    const read = stack({
      frames: [{ id: 9, name: '<anonymous>', file: '<unknown_source>', line: 1, column: 1 }] as never
    });

    await composeStopSnapshot(ctx, 'sid', read, 'test');

    expect(extractLocalsFromResolved).not.toHaveBeenCalled();
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
