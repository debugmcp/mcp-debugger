import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AdapterDependencies } from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { DotnetAdapterFactory } from '../../src/DotnetAdapterFactory.js';
import { DotnetDebugAdapter } from '../../src/DotnetDebugAdapter.js';
import {
  findNetcoredbgExecutable,
  getNetcoredbgVersion,
  getDotnetSdkVersion
} from '../../src/utils/dotnet-utils.js';

vi.mock('../../src/utils/dotnet-utils.js', () => ({
  findNetcoredbgExecutable: vi.fn(),
  findDotnetBackend: vi.fn(),
  listDotnetProcesses: vi.fn(),
  getNetcoredbgVersion: vi.fn(),
  getDotnetSdkVersion: vi.fn()
}));

const findNetcoredbgExecutableMock = vi.mocked(findNetcoredbgExecutable);
const getNetcoredbgVersionMock = vi.mocked(getNetcoredbgVersion);
const getDotnetSdkVersionMock = vi.mocked(getDotnetSdkVersion);

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

describe('DotnetAdapterFactory.describeToolchain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNetcoredbgVersionMock.mockReset();
    getDotnetSdkVersionMock.mockReset();
  });

  const validation = (details: Record<string, unknown>) => ({
    valid: true,
    errors: [],
    warnings: [],
    details
  });

  it('probes netcoredbg and SDK versions and renders both cells', async () => {
    getNetcoredbgVersionMock.mockResolvedValue('3.1.2-1054');
    getDotnetSdkVersionMock.mockResolvedValue('8.0.401');

    const description = await new DotnetAdapterFactory().describeToolchain(
      validation({ debuggerPath: '/path/to/netcoredbg', backend: 'netcoredbg', platform: 'linux', timestamp: 'now' })
    );

    expect(getNetcoredbgVersionMock).toHaveBeenCalledWith('/path/to/netcoredbg');
    expect(description).toEqual({
      runtime: { label: '.NET SDK', version: '8.0.401' },
      backend: { label: 'netcoredbg', path: '/path/to/netcoredbg', version: '3.1.2-1054' }
    });
  });

  it('skips the netcoredbg probe when validate() found no debugger path', async () => {
    getDotnetSdkVersionMock.mockResolvedValue('8.0.401');

    const description = await new DotnetAdapterFactory().describeToolchain(
      validation({ backend: 'netcoredbg', platform: 'linux', timestamp: 'now' })
    );

    expect(getNetcoredbgVersionMock).not.toHaveBeenCalled();
    expect(description).toEqual({
      runtime: { label: '.NET SDK', version: '8.0.401' }
    });
  });

  it('degrades gracefully when the probes fail', async () => {
    getNetcoredbgVersionMock.mockRejectedValue(new Error('spawn failed'));
    getDotnetSdkVersionMock.mockRejectedValue(new Error('spawn failed'));

    const description = await new DotnetAdapterFactory().describeToolchain(
      validation({ debuggerPath: '/path/to/netcoredbg' })
    );

    expect(description).toEqual({
      backend: { label: 'netcoredbg', path: '/path/to/netcoredbg' }
    });
  });
});
