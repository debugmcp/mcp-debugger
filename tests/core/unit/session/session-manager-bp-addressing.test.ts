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
