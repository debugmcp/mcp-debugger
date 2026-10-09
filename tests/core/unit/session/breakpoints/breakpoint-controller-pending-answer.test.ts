/**
 * A `reason: 'pending'` answer is not a verdict (issue #790).
 *
 * DAP marks an unverified `setBreakpoints` entry `reason: 'pending'` when the adapter cannot
 * verify it *yet*. The Dart SDK adapters answer every set that way — pre-launch and every live
 * re-send alike — and verify afterwards with `breakpoint` events, handing out NEW ids on every
 * re-send. Measured (`examples/dart/hello.dart`, breakpoints on lines 3 and 4): the launch
 * verified both by event (ids 100000/100001), the program stopped at line 3, and the post-launch
 * re-sync's answer `{ id: 100002, verified: false, reason: 'pending', message: 'Breakpoint has not
 * yet been resolved' }` downgraded both records, so `list_breakpoints` reported the breakpoint the
 * program was paused at as unverified. Dart's `stopped` event carries no `hitBreakpointIds`, so
 * the hit-proven rule (#673) never applied.
 *
 * The rule: such an answer stamps the fresh id onto a record that is currently verified and
 * changes nothing else; an unverified record takes the answer as before (the event will verify
 * it); an unverified answer WITHOUT `reason: 'pending'` is the adapter's verdict and still applies.
 */
import { describe, it, expect, vi } from 'vitest';
import { BreakpointController } from '../../../../../src/session/breakpoints/breakpoint-controller.js';
import type { BreakpointContext } from '../../../../../src/session/operations-context.js';
import type { ManagedSession } from '../../../../../src/session/session-store.js';
import type { Breakpoint, FunctionBreakpoint } from '@debugmcp/shared';
import { createMockLogger } from '../../../../test-utils/helpers/test-dependencies.js';

const FILE = 'C:\\p\\hello.dart';
const PENDING = 'Breakpoint has not yet been resolved';

function makeController(): BreakpointController {
  const ctx: BreakpointContext = {
    logger: createMockLogger(),
    getSession: vi.fn(),
    selectPolicy: vi.fn().mockReturnValue({}),
    selectStorePolicy: vi.fn()
  };
  return new BreakpointController(ctx);
}

/** A paused session whose proxy answers every DAP request with the given body. */
function answeringSession(
  answer: (command: string) => unknown,
  lines: Array<Partial<Breakpoint> & { id: string; file: string; line: number }>,
  functions: Array<Partial<FunctionBreakpoint> & { id: string; functionName: string }> = []
): ManagedSession {
  const sendDapRequest = vi.fn().mockImplementation(async (command: string) => answer(command));
  const breakpoints = new Map<string, Breakpoint>(
    lines.map((bp) => [bp.id, { verified: false, ...bp } as Breakpoint])
  );
  const functionBreakpoints = new Map<string, FunctionBreakpoint>(
    functions.map((bp) => [bp.id, { verified: false, ...bp } as FunctionBreakpoint])
  );
  return {
    id: 'sess-1',
    language: 'dart',
    state: 'paused',
    proxyManager: { isRunning: () => true, sendDapRequest },
    breakpoints,
    functionBreakpoints
  } as unknown as ManagedSession;
}

const pending = (id: number) => ({ id, verified: false, reason: 'pending', message: PENDING });

describe("BreakpointController: a `reason: 'pending'` answer is no verdict (issue #790)", () => {
  it('keeps a record the adapter verified before and takes the fresh id; an unverified record takes the answer', async () => {
    const controller = makeController();
    const session = answeringSession(
      () => ({ body: { breakpoints: [pending(100002), pending(100003)] } }),
      [
        { id: 'a', file: FILE, line: 3, verified: true, verifiedBy: 'adapter', adapterId: 100000 },
        { id: 'b', file: FILE, line: 4 }
      ]
    );

    const outcome = await controller.syncBreakpointsForFile(session, FILE);

    expect(outcome).toEqual({ synced: true });
    expect(session.breakpoints.get('a')).toEqual({
      id: 'a', file: FILE, line: 3, verified: true, verifiedBy: 'adapter', adapterId: 100002
    });
    const b = session.breakpoints.get('b')!;
    expect(b).toMatchObject({ verified: false, adapterId: 100003, message: PENDING });
    expect(b.verifiedBy).toBeUndefined();
  });

  it("still downgrades on an unverified answer without `reason: 'pending'`: that is the adapter's verdict", async () => {
    const controller = makeController();
    const session = answeringSession(
      () => ({ body: { breakpoints: [{ id: 7, verified: false, message: 'No source' }] } }),
      [{ id: 'a', file: FILE, line: 3, verified: true, verifiedBy: 'adapter', adapterId: 100000 }]
    );

    await controller.syncBreakpointsForFile(session, FILE);

    expect(session.breakpoints.get('a')).toMatchObject({ verified: false, adapterId: 7, message: 'No source' });
    expect(session.breakpoints.get('a')!.verifiedBy).toBeUndefined();
  });

  it('applies the same rule to function breakpoints', async () => {
    const controller = makeController();
    const session = answeringSession(
      () => ({ body: { breakpoints: [pending(2), pending(3)] } }),
      [],
      [
        { id: 'f', functionName: 'main', verified: true, verifiedBy: 'adapter', adapterId: 1 },
        { id: 'g', functionName: 'helper' }
      ]
    );

    const outcome = await controller.syncFunctionBreakpoints(session);

    expect(outcome).toEqual({ synced: true });
    expect(session.functionBreakpoints.get('f')).toEqual({
      id: 'f', functionName: 'main', verified: true, verifiedBy: 'adapter', adapterId: 2
    });
    expect(session.functionBreakpoints.get('g')).toMatchObject({ verified: false, adapterId: 3, message: PENDING });
  });
});
