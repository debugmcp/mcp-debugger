import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AdapterDependencies } from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { DotnetAdapterFactory } from '../../src/DotnetAdapterFactory.js';
import { DotnetDebugAdapter } from '../../src/DotnetDebugAdapter.js';
import { findDotnetBackend } from '../../src/utils/dotnet-utils.js';

vi.mock('../../src/utils/dotnet-utils.js', () => ({
  findDotnetBackend: vi.fn(),
  findVsdbgExecutable: vi.fn(),
  findNetcoredbgExecutable: vi.fn(),
  listDotnetProcesses: vi.fn()
}));

const findDotnetBackendMock = vi.mocked(findDotnetBackend);

const createDependencies = (): AdapterDependencies => ({
  fileSystem: {} as unknown,
  processLauncher: {} as unknown,
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
    findDotnetBackendMock.mockReset();
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
      version: '0.1.0',
      author: 'mcp-debugger team',
      fileExtensions: ['.cs', '.vb', '.fs']
    });
  });

  it('validates environment when vsdbg is available', async () => {
    findDotnetBackendMock.mockResolvedValue({ backend: 'vsdbg', path: '/path/to/vsdbg' });

    const factory = new DotnetAdapterFactory();
    const result = await factory.validate();

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.details).toMatchObject({
      debuggerPath: '/path/to/vsdbg',
      backendType: 'vsdbg',
      platform: process.platform
    });
  });

  it('validates with warning when only netcoredbg is available', async () => {
    findDotnetBackendMock.mockResolvedValue({ backend: 'netcoredbg', path: '/path/to/netcoredbg' });

    const factory = new DotnetAdapterFactory();
    const result = await factory.validate();

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('netcoredbg');
    expect(result.details).toMatchObject({
      debuggerPath: '/path/to/netcoredbg',
      backendType: 'netcoredbg'
    });
  });

  it('fails validation when no debugger is found', async () => {
    findDotnetBackendMock.mockRejectedValue(new Error('.NET debugger not found'));

    const factory = new DotnetAdapterFactory();
    const result = await factory.validate();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('.NET debugger not found');
  });
});
