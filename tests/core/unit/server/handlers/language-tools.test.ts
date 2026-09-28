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

  it('reports the modes unavailable with the import failure when the adapter package is present but fails to import (issue #795)', async () => {
    // Measured with dotenv removed next to an installed adapter-javascript:
    // the entry read installed:true, launch available:true, and nothing said
    // the import had failed until start_debugging did.
    const loadError = new Error(
      "Failed to load adapter for 'python' from package '@debugmcp/adapter-python'. The package is installed but importing it failed: Cannot find package 'dotenv' imported from /app/dist/x.js — its dependency 'dotenv' is missing or broken. Reinstall it (npm install @debugmcp/adapter-python) or rebuild it."
    );
    ctx.sessionManager.adapterRegistry.getFactoryResult = vi.fn().mockImplementation(async (language: string) =>
      language === 'python' ? { loadError } : { factory: undefined }
    );

    const result = await handleListSupportedLanguages(ctx);
    const payload = JSON.parse(result.content[0].text);

    const python = payload.available.find((entry: { language: string }) => entry.language === 'python');
    expect(python.installed).toBe(true); // the metadata probe: the package is on disk
    expect(python.modes.launch).toEqual({ supported: true, available: false, reason: loadError.message });
    // The mock registry declares attach 'none'; the load failure does not
    // rewrite an unsupported mode's reason.
    expect(python.modes.attach.supported).toBe(false);
    expect(python).not.toHaveProperty('warning');
    const mock = payload.available.find((entry: { language: string }) => entry.language === 'mock');
    expect(mock.modes.launch.available).toBe(true);
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
