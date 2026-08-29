/**
 * list_supported_languages handler, driven directly against a ToolContext.
 * (Moved out of tests/unit/server-coverage.test.ts, which reached it through a
 * private DebugMcpServer delegate that no longer exists.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleListSupportedLanguages } from '../../../../../src/server/handlers/language-tools.js';
import { createMockToolContext } from '../server-test-helpers.js';

// DebugMcpServer builds its dependencies in the constructor; mock the container
// so createMockToolContext() never opens a real logger transport or session dir.
vi.mock('../../../../../src/container/dependencies.js');
vi.mock('../../../../../src/session/session-manager.js');

describe('handleListSupportedLanguages', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns installed languages and adapter metadata', async () => {
    const result = await handleListSupportedLanguages(ctx);
    const payload = JSON.parse(result.content[0].text);

    expect(payload.success).toBe(true);
    expect(payload.installed).toEqual(['python', 'mock']);
    expect(payload.available).toHaveLength(2);
    expect(payload.available[0].language).toBe('python');
    expect(payload.available[0].package).toBe('@debugmcp/adapter-python');
    expect(payload.count).toBe(2);
  });

  it('falls back to installed list when listAvailableAdapters fails', async () => {
    ctx.sessionManager.adapterRegistry.listAvailableAdapters.mockRejectedValue(
      new Error('metadata unavailable')
    );

    const result = await handleListSupportedLanguages(ctx);
    const payload = JSON.parse(result.content[0].text);

    expect(payload.success).toBe(true);
    expect(payload.installed).toEqual(['python', 'mock']);
    // available falls back to simple format derived from installed
    expect(payload.available).toHaveLength(2);
    expect(payload.available[0].installed).toBe(true);
  });
});
