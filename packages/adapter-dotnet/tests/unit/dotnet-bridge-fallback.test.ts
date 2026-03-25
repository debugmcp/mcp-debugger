/**
 * Tests for netcoredbg-bridge.js fallback path resolution in buildAdapterCommand.
 *
 * Separated from the main test file because we need to mock node:fs at the
 * module level (ESM modules can't be spied on after import).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AdapterDependencies } from '@debugmcp/shared';

// vi.hoisted ensures the mock fn is created before vi.mock factories run
const { existsSyncMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn<(p: string) => boolean>()
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, default: { ...actual, existsSync: existsSyncMock }, existsSync: existsSyncMock };
});

// Must also mock dotnet-utils (same as main test file) so initialize() etc. don't fail
vi.mock('../../src/utils/dotnet-utils.js', () => ({
  findNetcoredbgExecutable: vi.fn(),
  findDotnetBackend: vi.fn(),
  listDotnetProcesses: vi.fn(),
  findPdb2PdbExecutable: vi.fn(),
  convertPdbsToTemp: vi.fn(),
  getProcessExecutableDir: vi.fn(),
  getProcessArchitecture: vi.fn()
}));

import { DotnetDebugAdapter } from '../../src/DotnetDebugAdapter.js';

const createDependencies = (): AdapterDependencies => ({
  fileSystem: {} as unknown,
  environment: {
    get: () => undefined,
    getAll: () => ({}),
    getCurrentWorkingDirectory: () => process.cwd()
  },
  logger: {
    info: () => undefined,
    debug: () => undefined,
    error: () => undefined
  }
});

const defaultConfig = {
  sessionId: 'test',
  executablePath: '/path/to/netcoredbg',
  adapterHost: '127.0.0.1',
  adapterPort: 9999,
  logDir: '/tmp',
  scriptPath: '/app.dll',
  launchConfig: {}
};

describe('DotnetDebugAdapter bridge fallback resolution', () => {
  let adapter: DotnetDebugAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new DotnetDebugAdapter(createDependencies());
  });

  it('throws with actionable message when bridge script not found at any path', () => {
    existsSyncMock.mockReturnValue(false);

    expect(() => adapter.buildAdapterCommand(defaultConfig))
      .toThrow(/netcoredbg-bridge\.js not found/);
  });

  it('uses fallback path when primary path does not exist', () => {
    // First call returns false (dev path), second returns true (NPX fallback)
    let callCount = 0;
    existsSyncMock.mockImplementation(() => {
      callCount++;
      return callCount === 2;
    });

    const command = adapter.buildAdapterCommand(defaultConfig);

    expect(callCount).toBeGreaterThanOrEqual(2);
    expect(command.args[0]).toContain('netcoredbg-bridge');
  });

  it('searches multiple fallback paths before giving up', () => {
    existsSyncMock.mockReturnValue(false);

    try {
      adapter.buildAdapterCommand(defaultConfig);
    } catch {
      // expected
    }

    // Should have checked at least 4 candidate paths
    expect(existsSyncMock.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});
