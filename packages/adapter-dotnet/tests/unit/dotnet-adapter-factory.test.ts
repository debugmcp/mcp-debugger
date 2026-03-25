import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AdapterDependencies } from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { DotnetAdapterFactory } from '../../src/DotnetAdapterFactory.js';
import { DotnetDebugAdapter } from '../../src/DotnetDebugAdapter.js';
import { findNetcoredbgExecutable } from '../../src/utils/dotnet-utils.js';

vi.mock('../../src/utils/dotnet-utils.js', () => ({
  findNetcoredbgExecutable: vi.fn(),
  findDotnetBackend: vi.fn(),
  listDotnetProcesses: vi.fn()
}));

const findNetcoredbgExecutableMock = vi.mocked(findNetcoredbgExecutable);

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

describe('DotnetAdapterFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findNetcoredbgExecutableMock.mockReset();
  });

  it('creates DotnetDebugAdapter instances with provided dependencies', () => {
    const factory = new DotnetAdapterFactory();
    const adapter = factory.createAdapter(createDependencies());

    expect(adapter).toBeInstanceOf(DotnetDebugAdapter);
  });

  it('returns accurate adapter metadata', () => {
    const factory = new DotnetAdapterFactory();

    const metadata = factory.getMetadata();

    expect(metadata).toMatchObject({
      language: DebugLanguage.DOTNET,
      displayName: '.NET/C#',
      version: '0.2.0',
      author: 'mcp-debugger team',
      fileExtensions: ['.cs', '.vb', '.fs']
    });
  });

  it('validates environment when netcoredbg is available', async () => {
    findNetcoredbgExecutableMock.mockResolvedValue('/path/to/netcoredbg');

    const factory = new DotnetAdapterFactory();
    const result = await factory.validate();

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.details).toMatchObject({
      debuggerPath: '/path/to/netcoredbg',
      backend: 'netcoredbg',
      platform: process.platform
    });
  });

  it('fails validation when no debugger is found', async () => {
    findNetcoredbgExecutableMock.mockRejectedValue(new Error('netcoredbg not found'));

    const factory = new DotnetAdapterFactory();
    const result = await factory.validate();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('netcoredbg not found');
  });
});
