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

  it('translateErrorMessage: ENOENT and not found messages (case-insensitive) map to missing runtime message', () => {
    const enoentLower = new Error('spawn node enoent');
    const enoentUpper = new Error('SPAWN NODE ENOENT');
    const notFoundMixed = new Error('Node not Found');

    const m1 = adapter.translateErrorMessage(enoentLower);
    const m2 = adapter.translateErrorMessage(enoentUpper);
    const m3 = adapter.translateErrorMessage(notFoundMixed);

    expect(m1).toMatch(/Node\.js runtime not found/i);
    expect(m2).toMatch(/Node\.js runtime not found/i);
    expect(m3).toMatch(/Node\.js runtime not found/i);
  });

  it('translateErrorMessage: EACCES/permission denied maps to permission text (case-insensitive)', () => {
    const e1 = new Error('EACCES: permission denied');
    const e2 = new Error('Permission Denied executing');

    const m1 = adapter.translateErrorMessage(e1);
    const m2 = adapter.translateErrorMessage(e2);

    expect(m1).toMatch(/Permission denied/i);
    expect(m2).toMatch(/Permission denied/i);
  });

  it("translateErrorMessage: 'Cannot find module' for ts-node/tsx yields install hint", () => {
    const tsnode1 = new Error("Cannot find module 'ts-node'");
    const tsx1 = new Error("Cannot find module 'tsx'");

    for (const e of [tsnode1, tsx1]) {
      const m = adapter.translateErrorMessage(e);
      expect(m).toMatch(/Install tsx or ts-node/i);
    }
  });

  it("translateErrorMessage: generic 'module not found' falls back to missing runtime message", () => {
    const generic1 = new Error('ts-node Module not found');
    const generic2 = new Error('tsx module NOT FOUND');
    for (const e of [generic1, generic2]) {
      const m = adapter.translateErrorMessage(e);
      expect(m).toMatch(/Node\.js runtime not found/i);
    }
  });

  it('translateErrorMessage: unrelated messages are passed through unchanged', () => {
    const other = new Error('some other error');
    expect(adapter.translateErrorMessage(other)).toBe('some other error');
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
