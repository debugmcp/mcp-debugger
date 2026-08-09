/**
 * Issue #271 — SessionManager layer for content-addressed breakpoints:
 * options-object setBreakpoint contract, requestedLine bookkeeping (loud
 * snapping), and sync-warning propagation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

describe('SessionManager - breakpoint addressing (#271)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;
  let config: SessionManagerConfig;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    config = {
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: { stopOnEntry: true, justMyCode: true }
    };
    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  async function createLaunchedSession(script = 'test.py') {
    const session = await sessionManager.createSession({
      language: DebugLanguage.MOCK,
      executablePath: 'python'
    });
    await sessionManager.startDebugging(session.id, script);
    await vi.runAllTimersAsync();
    return session;
  }

  it('accepts an options object and returns { breakpoint }', async () => {
    const session = await createLaunchedSession();

    const result = await sessionManager.setBreakpoint(session.id, {
      file: 'test.py',
      line: 10,
      condition: 'x > 1'
    });

    expect(result.breakpoint.file).toBe('test.py');
    expect(result.breakpoint.line).toBe(10);
    expect(result.breakpoint.condition).toBe('x > 1');
    expect(result.breakpoint.verified).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('stores requestedLine and reflects the adapter-bound line after a snap', async () => {
    const session = await createLaunchedSession();
    dependencies.mockProxyManager.setDapRequestHandler(async (command, args) => {
      if (command === 'setBreakpoints') {
        return {
          success: true,
          body: {
            breakpoints: (args?.breakpoints ?? []).map((bp: { line: number }) => ({
              verified: true,
              line: bp.line + 1
            }))
          }
        };
      }
      return { success: true, body: {} };
    });

    const result = await sessionManager.setBreakpoint(session.id, {
      file: 'test.py',
      line: 12,
      requestedLine: 12
    });

    expect(result.breakpoint.line).toBe(13);
    expect(result.breakpoint.requestedLine).toBe(12);
    const [stored] = sessionManager.listBreakpoints(session.id);
    expect(stored.line).toBe(13);
    expect(stored.requestedLine).toBe(12);
  });

  it('does not record requestedLine when the caller omits it (line mode purity)', async () => {
    const session = await createLaunchedSession();

    const result = await sessionManager.setBreakpoint(session.id, {
      file: 'test.py',
      line: 10
    });

    expect(result.breakpoint.requestedLine).toBeUndefined();
    expect('requestedLine' in result.breakpoint).toBe(false);
  });

  describe('restart re-resolution of statement anchors', () => {
    function stubFileContent(content: string) {
      (dependencies.mockFileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(content);
    }

    async function terminate() {
      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();
    }

    async function restart(sessionId: string) {
      const restartPromise = sessionManager.restartDebugging(sessionId);
      await vi.runAllTimersAsync();
      return restartPromise;
    }

    it('re-resolves an anchored breakpoint against the edited file', async () => {
      const session = await createLaunchedSession();
      await sessionManager.setBreakpoint(session.id, {
        file: 'test.py',
        line: 3,
        requestedLine: 3,
        anchor: { statement: 'total = sum(prices)' }
      });
      await terminate();

      // The edit inserted two lines above the anchored statement.
      stubFileContent('import x\nimport y\ndef f():\n    prices = load()\n    total = sum(prices)\n');
      const result = await restart(session.id);

      expect(result.success).toBe(true);
      const [stored] = sessionManager.listBreakpoints(session.id);
      expect(stored.line).toBe(5);
      expect(stored.requestedLine).toBe(5);
      const data = result.data as {
        anchorResolution?: { moved: Array<{ breakpointId: string; from: number; to: number }> };
      };
      expect(data.anchorResolution?.moved).toEqual([
        expect.objectContaining({ from: 3, to: 5 })
      ]);
      // The relaunch must carry the re-resolved line.
      const startCalls = dependencies.mockProxyManager.startCalls;
      expect(startCalls[1].initialBreakpoints).toEqual([
        expect.objectContaining({ line: 5 })
      ]);
    });

    it('keeps the stale line with a warning when the anchor no longer matches', async () => {
      const session = await createLaunchedSession();
      await sessionManager.setBreakpoint(session.id, {
        file: 'test.py',
        line: 3,
        requestedLine: 3,
        anchor: { statement: 'total = sum(prices)' }
      });
      await terminate();

      stubFileContent('def f():\n    prices = load()\n    grand_total = compute(prices)\n');
      const result = await restart(session.id);

      expect(result.success).toBe(true);
      const [stored] = sessionManager.listBreakpoints(session.id);
      expect(stored.line).toBe(3);
      expect(stored.message).toContain('not found');
      const data = result.data as {
        anchorResolution?: { stale: Array<{ breakpointId: string; line: number }> };
        warning?: string;
      };
      expect(data.anchorResolution?.stale).toHaveLength(1);
      expect(String(data.warning)).toMatch(/anchor/i);
    });

    it('disambiguates duplicate statements toward the breakpoint\'s previous line', async () => {
      const session = await createLaunchedSession();
      await sessionManager.setBreakpoint(session.id, {
        file: 'test.py',
        line: 6,
        requestedLine: 6,
        anchor: { statement: 'retry()' }
      });
      await terminate();

      // Matches at lines 2 and 7; previous line 6 is closer to 7.
      stubFileContent('def a():\n    retry()\n\n\ndef b():\n    x = 1\n    retry()\n');
      const result = await restart(session.id);

      expect(result.success).toBe(true);
      const [stored] = sessionManager.listBreakpoints(session.id);
      expect(stored.line).toBe(7);
      const data = result.data as {
        anchorResolution?: { moved: Array<{ from: number; to: number }> };
      };
      expect(data.anchorResolution?.moved).toEqual([
        expect.objectContaining({ from: 6, to: 7 })
      ]);
    });

    it('reports no anchorResolution when no breakpoint has an anchor', async () => {
      const session = await createLaunchedSession();
      await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 3 });
      await terminate();

      const result = await restart(session.id);

      expect(result.success).toBe(true);
      expect((result.data as { anchorResolution?: unknown }).anchorResolution).toBeUndefined();
    });
  });

  it('never leaks anchor or requestedLine into the DAP setBreakpoints payload', async () => {
    const session = await createLaunchedSession();
    let dapPayload: { breakpoints?: Array<Record<string, unknown>> } | undefined;
    dependencies.mockProxyManager.setDapRequestHandler(async (command, args) => {
      if (command === 'setBreakpoints') {
        dapPayload = args;
        return {
          success: true,
          body: {
            breakpoints: (args?.breakpoints ?? []).map((bp: { line: number }) => ({
              verified: true,
              line: bp.line
            }))
          }
        };
      }
      return { success: true, body: {} };
    });

    await sessionManager.setBreakpoint(session.id, {
      file: 'test.py',
      line: 6,
      requestedLine: 6,
      anchor: { statement: 'return total' }
    });

    expect(dapPayload?.breakpoints).toHaveLength(1);
    const sent = dapPayload!.breakpoints![0];
    expect('anchor' in sent).toBe(false);
    expect('requestedLine' in sent).toBe(false);
  });

  it('preserves requestedLine when a breakpoint event relocates the line', async () => {
    const session = await createLaunchedSession();
    dependencies.mockProxyManager.setDapRequestHandler(async (command, args) => {
      if (command === 'setBreakpoints') {
        return {
          success: true,
          body: {
            breakpoints: (args?.breakpoints ?? []).map((bp: { line: number }) => ({
              id: 77,
              verified: false,
              line: bp.line
            }))
          }
        };
      }
      return { success: true, body: {} };
    });

    await sessionManager.setBreakpoint(session.id, {
      file: 'test.py',
      line: 5,
      requestedLine: 5
    });

    dependencies.mockProxyManager.simulateEvent('breakpoint', {
      reason: 'changed',
      breakpoint: { id: 77, verified: true, line: 6, source: { path: 'test.py' } }
    });
    await vi.runAllTimersAsync();

    const [stored] = sessionManager.listBreakpoints(session.id);
    expect(stored.line).toBe(6);
    expect(stored.verified).toBe(true);
    expect(stored.requestedLine).toBe(5);
  });

  describe('function breakpoints (#271 phase 3)', () => {
    function captureFunctionBreakpointRequests() {
      const payloads: Array<{ breakpoints: Array<Record<string, unknown>> }> = [];
      dependencies.mockProxyManager.setDapRequestHandler(async (command, args) => {
        if (command === 'setFunctionBreakpoints') {
          payloads.push(args);
          return {
            success: true,
            body: {
              breakpoints: (args?.breakpoints ?? []).map((_: unknown, i: number) => ({
                id: 900 + i,
                verified: true,
                line: 42,
                source: { path: 'test.py' }
              }))
            }
          };
        }
        return { success: true, body: { breakpoints: [] } };
      });
      return payloads;
    }

    it('stores the breakpoint and sends the whole session set (replace-all)', async () => {
      const session = await createLaunchedSession();
      const payloads = captureFunctionBreakpointRequests();

      const first = await sessionManager.setFunctionBreakpoint(session.id, {
        functionName: 'compute',
        condition: 'x > 1'
      });
      const second = await sessionManager.setFunctionBreakpoint(session.id, {
        functionName: 'main'
      });

      expect(first.breakpoint.functionName).toBe('compute');
      expect(first.warning).toBeUndefined();
      expect(payloads[0].breakpoints).toEqual([{ name: 'compute', condition: 'x > 1' }]);
      // replace-all: the second request carries BOTH function breakpoints
      expect(payloads[1].breakpoints).toEqual([
        { name: 'compute', condition: 'x > 1' },
        { name: 'main' }
      ]);
      expect(second.breakpoint.verified).toBe(true);
    });

    it('merges verified/adapterId/bound location from the response', async () => {
      const session = await createLaunchedSession();
      captureFunctionBreakpointRequests();

      const { breakpoint } = await sessionManager.setFunctionBreakpoint(session.id, {
        functionName: 'compute'
      });

      expect(breakpoint.verified).toBe(true);
      expect(breakpoint.adapterId).toBe(900);
      expect(breakpoint.boundLine).toBe(42);
      expect(breakpoint.boundFile).toBe('test.py');
      const [listed] = sessionManager.listFunctionBreakpoints(session.id);
      expect(listed.functionName).toBe('compute');
      expect(listed.verified).toBe(true);
    });

    it('returns a warning when the adapter rejects setFunctionBreakpoints', async () => {
      const session = await createLaunchedSession();
      dependencies.mockProxyManager.setDapRequestHandler(async (command) => {
        if (command === 'setFunctionBreakpoints') {
          throw new Error('unsupported by adapter');
        }
        return { success: true, body: { breakpoints: [] } };
      });

      const result = await sessionManager.setFunctionBreakpoint(session.id, {
        functionName: 'compute'
      });

      expect(result.breakpoint).toBeDefined();
      expect(result.warning).toContain('unsupported by adapter');
    });

    it('removeBreakpoint by id finds function breakpoints and re-syncs the remainder', async () => {
      const session = await createLaunchedSession();
      const payloads = captureFunctionBreakpointRequests();

      const { breakpoint: first } = await sessionManager.setFunctionBreakpoint(session.id, {
        functionName: 'compute'
      });
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'main' });

      const removal = await sessionManager.removeBreakpoint(session.id, first.id);

      expect(removal.removed?.id).toBe(first.id);
      expect(payloads.at(-1)!.breakpoints).toEqual([{ name: 'main' }]);
      expect(sessionManager.listFunctionBreakpoints(session.id)).toHaveLength(1);
    });

    it('clearBreakpoints without a file clears function breakpoints too (empty replace-all)', async () => {
      const session = await createLaunchedSession();
      const payloads = captureFunctionBreakpointRequests();
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'compute' });

      const result = await sessionManager.clearBreakpoints(session.id);

      expect(result.cleared).toBeGreaterThanOrEqual(1);
      expect(payloads.at(-1)!.breakpoints).toEqual([]);
      expect(sessionManager.listFunctionBreakpoints(session.id)).toHaveLength(0);
    });

    it('clearBreakpoints scoped to a file leaves function breakpoints alone', async () => {
      const session = await createLaunchedSession();
      captureFunctionBreakpointRequests();
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'compute' });
      await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 3 });

      await sessionManager.clearBreakpoints(session.id, 'test.py');

      expect(sessionManager.listFunctionBreakpoints(session.id)).toHaveLength(1);
    });
  });

  it('propagates the sync warning when the adapter rejects setBreakpoints', async () => {
    const session = await createLaunchedSession();
    dependencies.mockProxyManager.setDapRequestHandler(async (command) => {
      if (command === 'setBreakpoints') {
        throw new Error('adapter exploded');
      }
      return { success: true, body: {} };
    });

    const result = await sessionManager.setBreakpoint(session.id, {
      file: 'test.py',
      line: 10
    });

    expect(result.breakpoint).toBeDefined();
    expect(result.warning).toContain('adapter exploded');
  });
});
