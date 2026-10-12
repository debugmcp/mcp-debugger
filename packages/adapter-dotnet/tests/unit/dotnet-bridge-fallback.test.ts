/**
 * Tests for netcoredbg-bridge.js fallback path resolution in buildAdapterCommand.
 *
 * Separated from the main test file because we need to mock node:fs at the
 * module level (ESM modules can't be spied on after import).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AdapterDependencies } from '@debugmcp/shared';
import {
  createMockAdapterDependencies,
  createMockEnvironment
} from '../../../../tests/test-utils/helpers/adapter-dependencies.js';

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

// These adapters read `process.env` directly and never consult `dependencies.environment`
// (nor `dependencies.fileSystem`), but the inline double this replaced reported an *empty*
// environment — keep that, so this stays a type fix and not a behaviour change.
const createDependencies = (): AdapterDependencies =>
  createMockAdapterDependencies({
    environment: createMockEnvironment({ get: () => undefined, getAll: () => ({}) })
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

  // Moved from dotnet-debug-adapter.test.ts (issue #743): with the real fs the
  // probe only succeeds against a built dist from a repo-root cwd, so the
  // package never passed standalone. Here the bridge "exists" by name alone.
  it('builds the adapter command around the bridge: node, the bridge, netcoredbg, the port', () => {
    existsSyncMock.mockImplementation((p: string) => String(p).endsWith('netcoredbg-bridge.js'));

    const command = adapter.buildAdapterCommand({
      ...defaultConfig,
      sessionId: 'test-session',
      executablePath: '/path/to/netcoredbg.exe',
      adapterPort: 12345,
      logDir: '/tmp/logs',
      scriptPath: '/path/to/app.dll'
    });

    // Bridge runs under node; args: [bridge-path, netcoredbg-path, port]
    expect(command.command).toBe(process.execPath);
    expect(command.args[0]).toContain('netcoredbg-bridge');
    expect(command.args[1]).toBe('/path/to/netcoredbg.exe');
    expect(command.args[2]).toBe('12345');
  });

  it('propagates the environment in the adapter command', () => {
    existsSyncMock.mockImplementation((p: string) => String(p).endsWith('netcoredbg-bridge.js'));

    const command = adapter.buildAdapterCommand(defaultConfig);

    expect(command.env).toBeDefined();
    expect(typeof command.env).toBe('object');
  });

  it('throws with actionable message when bridge script not found at any path', () => {
    existsSyncMock.mockReturnValue(false);

    expect(() => adapter.buildAdapterCommand(defaultConfig))
      .toThrow(/netcoredbg-bridge\.js not found/);
  });

  it('uses fallback path when primary path does not exist', () => {
    // First call returns false (the package dist), second returns true: under vitest that is
    // the source-tree sibling (fromDir is src/); from dist/ it would be the npx bundle (#743)
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
