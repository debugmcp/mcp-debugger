import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AdapterDependencies } from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { PythonAdapterFactory } from '../../src/python-adapter-factory.js';
import { PythonDebugAdapter } from '../../src/python-debug-adapter.js';
import { findPythonExecutable, getPythonVersion, getDebugpyVersion } from '../../src/utils/python-utils.js';

vi.mock('../../src/utils/python-utils.js', () => ({
  findPythonExecutable: vi.fn(),
  getPythonVersion: vi.fn(),
  getDebugpyVersion: vi.fn()
}));

const findPythonExecutableMock = vi.mocked(findPythonExecutable);
const getPythonVersionMock = vi.mocked(getPythonVersion);
const getDebugpyVersionMock = vi.mocked(getDebugpyVersion);

const createDependencies = (): AdapterDependencies & {
  logger: { info: () => void; debug: () => void; error: () => void };
} => ({
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

describe('PythonAdapterFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findPythonExecutableMock.mockReset();
    getPythonVersionMock.mockReset();
    getDebugpyVersionMock.mockReset();
  });

  it('creates PythonDebugAdapter instances with provided dependencies', () => {
    const factory = new PythonAdapterFactory();
    const adapter = factory.createAdapter(createDependencies());

    expect(adapter).toBeInstanceOf(PythonDebugAdapter);
  });

  it('returns accurate adapter metadata', () => {
    const factory = new PythonAdapterFactory();

    const metadata = factory.getMetadata();

    expect(metadata).toMatchObject({
      language: DebugLanguage.PYTHON,
      displayName: 'Python',
      version: '2.0.0',
      author: 'mcp-debugger team',
      documentationUrl: 'https://github.com/debugmcp/mcp-debugger/docs/python',
      fileExtensions: ['.py', '.pyw']
    });
  });

  it('validates environment when Python and debugpy are available', async () => {
    findPythonExecutableMock.mockResolvedValue('/usr/bin/python3');
    getPythonVersionMock.mockResolvedValue('3.10.1');
    getDebugpyVersionMock.mockResolvedValue('1.8.1');

    const factory = new PythonAdapterFactory();
    const result = await factory.validate();

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.details).toMatchObject({
      pythonPath: '/usr/bin/python3',
      pythonVersion: '3.10.1',
      debugpyVersion: '1.8.1',
      platform: process.platform
    });
  });

  it('fails validation when Python executable cannot be located', async () => {
    findPythonExecutableMock.mockRejectedValue(new Error('Python executable not found'));

    const factory = new PythonAdapterFactory();
    const result = await factory.validate();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Python executable not found');
  });

  it('reports error when Python version is below 3.7', async () => {
    findPythonExecutableMock.mockResolvedValue('/usr/bin/python3');
    getPythonVersionMock.mockResolvedValue('3.6.9');
    getDebugpyVersionMock.mockResolvedValue('1.6.0');

    const factory = new PythonAdapterFactory();
    const result = await factory.validate();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Python 3.7 or higher required. Current version: 3.6.9');
  });

  it('warns when Python version cannot be determined', async () => {
    findPythonExecutableMock.mockResolvedValue('/usr/bin/python3');
    getPythonVersionMock.mockResolvedValue(undefined);
    getDebugpyVersionMock.mockResolvedValue('1.6.0');

    const factory = new PythonAdapterFactory();
    const result = await factory.validate();

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain('Could not determine Python version');
  });

  it('warns (not errors) when debugpy detection fails', async () => {
    findPythonExecutableMock.mockResolvedValue('/usr/bin/python3');
    getPythonVersionMock.mockResolvedValue('3.10.1');
    getDebugpyVersionMock.mockResolvedValue(null);

    const factory = new PythonAdapterFactory();
    const result = await factory.validate();

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings.some(w => w.includes('debugpy'))).toBe(true);
  });

  it('passes validation when Python exists but debugpy is missing (virtualenv scenario, issue #16)', async () => {
    // Scenario: System Python is found and is a valid version, but debugpy
    // is only installed in a virtualenv (not system-wide). validate() should
    // return valid:true with a warning, NOT block adapter registration.
    findPythonExecutableMock.mockResolvedValue('/usr/bin/python3');
    getPythonVersionMock.mockResolvedValue('3.11.0');
    getDebugpyVersionMock.mockResolvedValue(null); // debugpy not installed

    const factory = new PythonAdapterFactory();
    const result = await factory.validate();

    // Must be valid so AdapterRegistry.register() succeeds
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    // The missing-debugpy message should be a warning, not an error
    expect(result.warnings.some(w => w.includes('debugpy'))).toBe(true);
    expect(result.details).toMatchObject({
      pythonPath: '/usr/bin/python3',
      pythonVersion: '3.11.0'
    });
  });
});

describe('PythonAdapterFactory.describeToolchain', () => {
  const validation = (details: Record<string, unknown>) => ({
    valid: true,
    errors: [],
    warnings: [],
    details
  });

  it('renders Python and debugpy cells from its own validate() details', async () => {
    const factory = new PythonAdapterFactory();

    const description = await factory.describeToolchain(
      validation({
        pythonPath: '/usr/bin/python3',
        pythonVersion: '3.12.1',
        debugpyVersion: '1.8.14',
        pythonDetectionMethod: 'multi-strategy',
        platform: 'linux',
        timestamp: 'now'
      })
    );

    expect(description).toEqual({
      runtime: { label: 'Python', path: '/usr/bin/python3', version: '3.12.1' },
      backend: { label: 'debugpy', version: '1.8.14' }
    });
  });

  it('omits a component that was not detected instead of naming it as if found', async () => {
    const factory = new PythonAdapterFactory();

    const description = await factory.describeToolchain(
      validation({ pythonPath: '/usr/bin/python3' })
    );

    expect(description).toEqual({
      runtime: { label: 'Python', path: '/usr/bin/python3' }
    });
  });

  it('renders empty cells when validate() produced no details', async () => {
    const factory = new PythonAdapterFactory();

    const description = await factory.describeToolchain({
      valid: false,
      errors: ['Python executable not found'],
      warnings: []
    });

    expect(description).toEqual({});
  });
});
