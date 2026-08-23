/**
 * Parity test for issue #435: list_supported_languages (the server) and
 * `mcp-debugger doctor` must report identical per-language launch/attach
 * availability for the same registry state. Both now consume the shared
 * probeLanguageEntry — this test is the fence that keeps them from drifting
 * back into hand-mirrored loops.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies } from '../../../../src/container/dependencies.js';
import { diagnose, type DiagnoseDeps } from '../../../../src/cli/commands/doctor/diagnose.js';
import {
  createMockEnvironment,
  createMockFileSystem
} from '../../../test-utils/helpers/test-dependencies.js';
import {
  createMockDependencies,
  createMockServer,
  createMockSessionManager,
  getToolHandlers
} from './server-test-helpers.js';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

/**
 * One registry covering every availability shape at once:
 * - python: valid toolchain, direct-connect attach
 * - go: invalid toolchain, no attach
 * - ruby: validate() throws (fail-open territory), direct-connect
 * - java: valid with warnings, spawn attach, metadata attach differs from entry
 * - dotnet: not installed
 * - mock: disabled via DEBUG_MCP_DISABLE_LANGUAGES
 */
function buildSharedRegistry() {
  const entries = [
    { name: 'python', packageName: '@debugmcp/adapter-python', installed: true, attach: 'direct-connect' as const },
    { name: 'go', packageName: '@debugmcp/adapter-go', installed: true, attach: 'none' as const },
    { name: 'ruby', packageName: '@debugmcp/adapter-ruby', installed: true, attach: 'direct-connect' as const },
    { name: 'java', packageName: '@debugmcp/adapter-java', installed: true, attach: 'none' as const },
    { name: 'dotnet', packageName: '@debugmcp/adapter-dotnet', installed: false, attach: 'spawn' as const },
    { name: 'mock', packageName: '@debugmcp/adapter-mock', installed: true, attach: 'none' as const }
  ];

  const factories: Record<string, unknown> = {
    python: {
      validate: async () => ({ valid: true, errors: [], warnings: [], details: {} }),
      getMetadata: () => ({ modes: { launch: true, attach: 'direct-connect' } })
    },
    go: {
      validate: async () => ({ valid: false, errors: ['Delve not found.'], warnings: [] }),
      getMetadata: () => ({ modes: { launch: true, attach: 'none' } })
    },
    ruby: {
      validate: async () => {
        throw new Error('probe exploded');
      },
      getMetadata: () => ({ modes: { launch: true, attach: 'direct-connect' } })
    },
    java: {
      validate: async () => ({ valid: true, errors: [], warnings: ['JDK below 21'], details: {} }),
      // Metadata says spawn even though the entry says none — metadata must win in both paths
      getMetadata: () => ({ modes: { launch: true, attach: 'spawn' } })
    }
  };

  return {
    listLanguages: vi.fn().mockResolvedValue(entries.filter((e) => e.installed).map((e) => e.name)),
    getSupportedLanguages: vi.fn().mockReturnValue(entries.filter((e) => e.installed).map((e) => e.name)),
    listAvailableAdapters: vi.fn().mockResolvedValue(entries),
    getFactory: vi.fn(async (language: string) => factories[language]),
    isLanguageSupported: vi.fn().mockReturnValue(true),
    create: vi.fn(),
    register: vi.fn()
  };
}

describe('doctor / list_supported_languages availability parity (issue #435)', () => {
  let mockServer: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    vi.stubEnv('DEBUG_MCP_DISABLE_LANGUAGES', 'mock');

    const mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies as never);

    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function () {
      return mockServer as never;
    });

    const registry = buildSharedRegistry();
    (mockDependencies as { adapterRegistry: unknown }).adapterRegistry = registry;
    const mockSessionManager = createMockSessionManager(registry);
    vi.mocked(SessionManager).mockImplementation(function () {
      return mockSessionManager as never;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('reports identical per-language modes from both paths against the same registry', async () => {
    // Server path
    new DebugMcpServer();
    const { callToolHandler } = getToolHandlers(mockServer);
    const serverResult = await callToolHandler({
      method: 'tools/call',
      params: { name: 'list_supported_languages', arguments: {} }
    });
    const serverPayload = JSON.parse(serverResult.content[0].text);
    const serverModes = new Map<string, unknown>(
      serverPayload.available.map((a: { language: string; modes: unknown }) => [a.language, a.modes])
    );

    // Doctor path, against a fresh identical registry (no shared validation cache)
    const fileSystem = createMockFileSystem();
    vi.mocked(fileSystem.readFile).mockRejectedValue(new Error('ENOENT'));
    vi.mocked(fileSystem.stat).mockRejectedValue(new Error('ENOENT'));
    vi.mocked(fileSystem.readdir).mockRejectedValue(new Error('ENOENT'));
    const doctorDeps: DiagnoseDeps = {
      registry: buildSharedRegistry() as unknown as DiagnoseDeps['registry'],
      environment: createMockEnvironment(),
      fileSystem,
      env: { DEBUG_MCP_DISABLE_LANGUAGES: 'mock' },
      platform: 'linux',
      timeoutMs: 5000,
      version: '0.0.0-test',
      collectExtras: async () => ({})
    };
    const report = await diagnose([], doctorDeps);
    const doctorModes = new Map(report.languages.map((l) => [l.language, l.modes]));

    expect([...doctorModes.keys()].sort()).toEqual([...serverModes.keys()].sort());
    for (const [language, modes] of serverModes) {
      expect(doctorModes.get(language), `modes for ${language}`).toEqual(modes);
    }
    // Sanity: the fixture really exercised the interesting shapes
    expect((serverModes.get('java') as { attach: { supported: boolean } }).attach.supported).toBe(true); // metadata attach won
    expect((serverModes.get('ruby') as { launch: { available: boolean } }).launch.available).toBe(true); // fail-open
    expect((serverModes.get('go') as { launch: { available: boolean } }).launch.available).toBe(false);
  });
});
