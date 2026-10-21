import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JavascriptDebugAdapter } from '../../src/index.js';

// Minimal AdapterDependencies stub
const deps = {
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
} as unknown as import('@debugmcp/shared').AdapterDependencies;

describe('JavascriptDebugAdapter error helpers (edge cases)', () => {
  let adapter: JavascriptDebugAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    adapter = new JavascriptDebugAdapter(deps);
  });

  it('getInstallationInstructions/getMissingExecutableError contain expected hints', () => {
    const s = adapter.getInstallationInstructions();
    expect(s).toMatch(/nodejs\.org/i);
    expect(s).toMatch(/tsx/i);
    expect(s).toMatch(/ts-node/i);
    expect(s).toMatch(/tsconfig-paths/i);

    const missing = adapter.getMissingExecutableError();
    expect(missing).toMatch(/Node\.js runtime not found/i);
    expect(missing).toMatch(/nodejs\.org/i);
    expect(missing).toMatch(/PATH/i);
  });
});
