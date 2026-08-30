/**
 * `resyncAll` is the one re-send launch and attach share once the debuggee is
 * provably live. What matters is the fan-out: every file that has a line
 * breakpoint exactly once (replace-all per file), the caller's option carried
 * to each of those sends, and the function breakpoints after them.
 */
import { describe, it, expect, vi } from 'vitest';
import { BreakpointController } from '../../../../../src/session/breakpoints/breakpoint-controller.js';
import type { BreakpointContext } from '../../../../../src/session/operations-context.js';
import type { ManagedSession } from '../../../../../src/session/session-store.js';
import type { Breakpoint, FunctionBreakpoint } from '@debugmcp/shared';
import { createMockLogger } from '../../../../test-utils/helpers/test-dependencies.js';

function sessionWith(lines: Array<[id: string, file: string]>, functions: string[] = []): ManagedSession {
  const breakpoints = new Map<string, Breakpoint>(
    lines.map(([id, file]) => [id, { id, file, line: 1, verified: false }])
  );
  const functionBreakpoints = new Map<string, FunctionBreakpoint>(
    functions.map((functionName) => [functionName, { id: functionName, functionName, verified: false }])
  );
  return { id: 'sess-1', breakpoints, functionBreakpoints } as unknown as ManagedSession;
}

function makeController(): BreakpointController {
  const ctx: BreakpointContext = {
    logger: createMockLogger(),
    getSession: vi.fn(),
    selectPolicy: vi.fn(),
    selectStorePolicy: vi.fn()
  };
  return new BreakpointController(ctx);
}

describe('BreakpointController.resyncAll', () => {
  it('re-sends each file once with the option forwarded, then the function breakpoints', async () => {
    const controller = makeController();
    const perFile = vi.spyOn(controller, 'syncBreakpointsForFile').mockResolvedValue({ synced: true });
    const functions = vi.spyOn(controller, 'syncFunctionBreakpoints').mockResolvedValue({ synced: true });
    const session = sessionWith([['a', '/app/a.py'], ['b', '/app/a.py'], ['c', '/app/b.py']], ['main']);

    await controller.resyncAll(session, { forceFreshEcho: true });

    expect(perFile.mock.calls).toEqual([
      [session, '/app/a.py', { forceFreshEcho: true }],
      [session, '/app/b.py', { forceFreshEcho: true }]
    ]);
    expect(functions).toHaveBeenCalledTimes(1);
    expect(functions).toHaveBeenCalledWith(session);
    expect(functions.mock.invocationCallOrder[0]).toBeGreaterThan(perFile.mock.invocationCallOrder[1]);
  });

  it('sends without an option when the caller gave none (the launch path)', async () => {
    const controller = makeController();
    const perFile = vi.spyOn(controller, 'syncBreakpointsForFile').mockResolvedValue({ synced: true });
    const functions = vi.spyOn(controller, 'syncFunctionBreakpoints').mockResolvedValue({ synced: true });

    await controller.resyncAll(sessionWith([['a', '/app/a.py']]));

    expect(perFile).toHaveBeenCalledTimes(1);
    expect(perFile.mock.calls[0][2]).toBeUndefined();
    expect(functions).not.toHaveBeenCalled();
  });

  it('sends nothing for a session with no breakpoints of either kind', async () => {
    const controller = makeController();
    const perFile = vi.spyOn(controller, 'syncBreakpointsForFile');
    const functions = vi.spyOn(controller, 'syncFunctionBreakpoints');

    await controller.resyncAll(sessionWith([]));

    expect(perFile).not.toHaveBeenCalled();
    expect(functions).not.toHaveBeenCalled();
  });
});
