/**
 * Session lifecycle tool handlers, driven directly against a ToolContext.
 * (Moved out of tests/unit/server-coverage.test.ts, which reached them through
 * private DebugMcpServer delegates that no longer exist.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleListDebugSessions } from '../../../../../src/server/handlers/session-tools.js';
import { createMockToolContext } from '../server-test-helpers.js';

// DebugMcpServer builds its dependencies in the constructor; mock the container
// so createMockToolContext() never opens a real logger transport or session dir.
vi.mock('../../../../../src/container/dependencies.js');
vi.mock('../../../../../src/session/session-manager.js');

describe('session tool handlers', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleListDebugSessions', () => {
    it('maps active sessions', async () => {
      const now = new Date();
      ctx.sessionManager.getAllSessions.mockReturnValue([{
        id: 'session-1',
        name: 'Test Session',
        language: 'python',
        state: 'active',
        createdAt: now,
        updatedAt: now,
        diagnostics: { proxyLogPath: '/logs/proxy-session-1.log' }
      }]);

      const result = await handleListDebugSessions(ctx);
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(1);
      expect(payload.sessions[0]).toMatchObject({
        id: 'session-1',
        name: 'Test Session',
        language: 'python'
      });
      expect(payload.sessions[0].diagnostics).toEqual({
        proxyLogPath: '/logs/proxy-session-1.log'
      });
    });

    // lastStop is the record of the stop the session is at (paused) or the last
    // one before it ended (stopped/error). The session model keeps the record
    // across continue/step, so the listing must not show a running session the
    // stop it already left as if it were still "Paused" (issue #720).
    it('reports lastStop only for paused and terminal sessions', async () => {
      const now = new Date();
      const stop = (reason: string) => ({ reason, threadId: 0, timestamp: 1, description: 'Paused' });
      ctx.sessionManager.getAllSessions.mockReturnValue([
        { id: 'running', name: 'r', language: 'javascript', state: 'running', createdAt: now, lastStop: stop('step') },
        { id: 'paused', name: 'p', language: 'javascript', state: 'paused', createdAt: now, lastStop: stop('breakpoint') },
        { id: 'stopped', name: 's', language: 'javascript', state: 'stopped', createdAt: now, lastStop: stop('breakpoint') },
        { id: 'errored', name: 'e', language: 'javascript', state: 'error', createdAt: now, lastStop: stop('exception') },
        { id: 'initializing', name: 'i', language: 'javascript', state: 'initializing', createdAt: now, lastStop: stop('entry') }
      ]);

      const result = await handleListDebugSessions(ctx);
      const payload = JSON.parse(result.content[0].text);
      const byId = Object.fromEntries(payload.sessions.map((s: { id: string }) => [s.id, s]));

      expect(byId.running).not.toHaveProperty('lastStop');
      expect(byId.initializing).not.toHaveProperty('lastStop');
      expect(byId.paused.lastStop).toMatchObject({ reason: 'breakpoint' });
      expect(byId.stopped.lastStop).toMatchObject({ reason: 'breakpoint' });
      expect(byId.errored.lastStop).toMatchObject({ reason: 'exception' });
    });

    it('reports debuggerDisabled for a launch running with the debugger off (issue #749)', async () => {
      const now = new Date();
      ctx.sessionManager.getAllSessions.mockReturnValue([
        { id: 'off', name: 'o', language: 'python', state: 'running', createdAt: now, debuggerDisabled: true },
        { id: 'on', name: 'n', language: 'python', state: 'running', createdAt: now },
        { id: 'over', name: 'v', language: 'python', state: 'stopped', createdAt: now, debuggerDisabled: true }
      ]);

      const result = await handleListDebugSessions(ctx);
      const payload = JSON.parse(result.content[0].text);
      const byId = Object.fromEntries(payload.sessions.map((s: { id: string }) => [s.id, s]));

      expect(byId.off.debuggerDisabled).toBe(true);
      expect(byId.on).not.toHaveProperty('debuggerDisabled');
      expect(byId.over).not.toHaveProperty('debuggerDisabled');
    });
  });
});
