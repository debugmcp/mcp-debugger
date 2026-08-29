/**
 * Session lifecycle tool handlers, driven directly against a ToolContext.
 * (Moved out of tests/unit/server-coverage.test.ts, which reached them through
 * private DebugMcpServer delegates that no longer exist.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleListDebugSessions } from '../../../../../src/server/handlers/session-tools.js';
import { createMockToolContext } from '../server-test-helpers.js';

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
        updatedAt: now
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
    });
  });
});
