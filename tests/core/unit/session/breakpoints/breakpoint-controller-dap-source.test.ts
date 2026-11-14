/**
 * Issue #1147: the live route sends a breakpoint's file in the same form the
 * launch route does.
 *
 * A `set_breakpoint` on a running session used to send the path as the
 * caller typed it; the launch sent `path.resolve` of it. On Windows, .NET
 * matched only the launch's form, so a forward-slash breakpoint set live
 * never bound. Both routes build the DAP `source` with one helper now, and
 * the live route collects a file's breakpoints by that form, so a file named
 * under two spellings is still one replace-all set (two requests would each
 * wipe the other's breakpoints in the adapter).
 */
import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { BreakpointController } from '../../../../../src/session/breakpoints/breakpoint-controller.js';
import type { BreakpointContext } from '../../../../../src/session/operations-context.js';
import type { ManagedSession } from '../../../../../src/session/session-store.js';
import { toDapSource } from '../../../../../src/utils/dap-source.js';
import type { Breakpoint, FunctionBreakpoint } from '@debugmcp/shared';
import { createMockLogger } from '../../../../test-utils/helpers/test-dependencies.js';

// One file under two spellings a caller on this OS might type.
const onWindows = process.platform === 'win32';
const TYPED = onWindows ? 'C:/proj/src/PauseTest.cs' : '/proj/src/../src/PauseTest.cs';
const OTHER_SPELLING = onWindows ? 'C:\\proj\\src\\PauseTest.cs' : '/proj/src/PauseTest.cs';
const HOST_FORM = path.resolve(TYPED);
// A path of another system: the debuggee's own, in a remote attach.
const REMOTE = onWindows ? '/app/src/main.py' : 'C:\\app\\src\\main.py';

function harness() {
  const sendDapRequest = vi.fn(async (_command: string, args?: { breakpoints?: unknown[] }) => ({
    body: { breakpoints: (args?.breakpoints ?? []).map(() => ({ verified: true })) }
  }));
  const session = {
    id: 'sess-1',
    language: 'dotnet',
    state: 'running',
    proxyManager: { isRunning: () => true, sendDapRequest },
    breakpoints: new Map<string, Breakpoint>(),
    functionBreakpoints: new Map<string, FunctionBreakpoint>()
  } as unknown as ManagedSession;
  const ctx = {
    logger: createMockLogger(),
    getSession: vi.fn().mockReturnValue(session),
    selectPolicy: vi.fn().mockReturnValue({}),
    selectStorePolicy: vi.fn()
  } as unknown as BreakpointContext;
  const sent = () => sendDapRequest.mock.calls.map(([, args]) => {
    const a = args as { source: { path: string; name?: string }; breakpoints: Array<{ line: number }> };
    return { source: a.source, lines: a.breakpoints.map((bp) => bp.line) };
  });
  return { controller: new BreakpointController(ctx), session, sent };
}

describe('the DAP source of a live breakpoint request (issue #1147)', () => {
  it('sends a host path in the form the launch route sends it, with the file name', async () => {
    const { controller, sent } = harness();

    const { breakpoint } = await controller.setBreakpoint('sess-1', { file: TYPED, line: 9 });

    expect(sent()).toEqual([{ source: { path: HOST_FORM, name: 'PauseTest.cs' }, lines: [9] }]);
    expect(sent()[0].source).toEqual(toDapSource(TYPED));
    // The record keeps what the caller typed; only the wire has one form.
    expect(breakpoint.file).toBe(TYPED);
    expect(breakpoint.verified).toBe(true);
  });

  it('sends one set for a file named under two spellings', async () => {
    const { controller, sent, session } = harness();
    await controller.setBreakpoint('sess-1', { file: TYPED, line: 9 });

    await controller.setBreakpoint('sess-1', { file: OTHER_SPELLING, line: 10 });

    expect(sent()[1]).toEqual({ source: { path: HOST_FORM, name: 'PauseTest.cs' }, lines: [9, 10] });
    expect([...session.breakpoints.values()].map((bp) => bp.verified)).toEqual([true, true]);
  });

  it('keeps the other spelling\'s breakpoints set when one spelling\'s are cleared', async () => {
    const { controller, sent } = harness();
    await controller.setBreakpoint('sess-1', { file: TYPED, line: 9 });
    await controller.setBreakpoint('sess-1', { file: OTHER_SPELLING, line: 10 });

    await controller.clearBreakpoints('sess-1', OTHER_SPELLING);

    expect(sent().at(-1)).toEqual({ source: { path: HOST_FORM, name: 'PauseTest.cs' }, lines: [9] });
  });

  it('passes a path of another system through as given', async () => {
    const { controller, sent } = harness();

    await controller.setBreakpoint('sess-1', { file: REMOTE, line: 3 });

    expect(sent()).toEqual([{ source: { path: REMOTE, name: onWindows ? 'main.py' : 'main.py' }, lines: [3] }]);
  });
});
