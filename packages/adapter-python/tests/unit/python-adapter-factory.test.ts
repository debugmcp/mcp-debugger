import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { AdapterDependencies } from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { EventEmitter } from 'events';
import { PythonAdapterFactory } from '../../src/python-adapter-factory.js';
import { PythonDebugAdapter } from '../../src/python-debug-adapter.js';
import { findPythonExecutable, getPythonVersion } from '../../src/utils/python-utils.js';
import { spawn } from 'child_process';

vi.mock('../../src/utils/python-utils.js', () => ({
  findPythonExecutable: vi.fn(),
  getPythonVersion: vi.fn()
}));

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    spawn: vi.fn()
  };
});

const findPythonExecutableMock = vi.mocked(findPythonExecutable);
const getPythonVersionMock = vi.mocked(getPythonVersion);
const spawnMock = spawn as unknown as Mock;

const createDependencies = (): AdapterDependencies & {
  logger: { info: () => void; debug: () => void; error: () => void };
} => ({
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

const simulateSpawn = (options: { output?: string; exitCode?: number; emitError?: boolean } = {}): void => {
  const { output = '', exitCode = 0, emitError = false } = options;
  spawnMock.mockImplementation(() => {
    const stdout = new EventEmitter();
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter };
    (child as unknown as { stdout: EventEmitter }).stdout = stdout;

    queueMicrotask(() => {
      if (emitError) {
        child.emit('error', new Error('spawn failed'));
        return;
      }

      if (output) {
        stdout.emit('data', Buffer.from(output));
      }
      child.emit('exit', exitCode ?? 0);
    });

    return child as unknown as ReturnType<typeof spawn>;
  });
};

describe('PythonAdapterFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findPythonExecutableMock.mockReset();
    getPythonVersionMock.mockReset();
    spawnMock.mockReset();
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
    simulateSpawn({ output: '1.8.1', exitCode: 0 });

    const factory = new PythonAdapterFactory();
    const result = await factory.validate();

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.details).toMatchObject({
      pythonPath: '/usr/bin/python3',
      pythonVersion: '3.10.1',
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
    simulateSpawn({ output: '1.6.0', exitCode: 0 });

    const factory = new PythonAdapterFactory();
    const result = await factory.validate();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Python 3.7 or higher required. Current version: 3.6.9');
  });

  it('warns when Python version cannot be determined', async () => {
    findPythonExecutableMock.mockResolvedValue('/usr/bin/python3');
    getPythonVersionMock.mockResolvedValue(undefined);
    simulateSpawn({ output: '1.6.0', exitCode: 0 });

    const factory = new PythonAdapterFactory();
    const result = await factory.validate();

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain('Could not determine Python version');
  });

  it('warns (not errors) when debugpy detection fails with exit code', async () => {
    findPythonExecutableMock.mockResolvedValue('/usr/bin/python3');
    getPythonVersionMock.mockResolvedValue('3.10.1');
    simulateSpawn({ output: '', exitCode: 1 });

    const factory = new PythonAdapterFactory();
    const result = await factory.validate();

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings.some(w => w.includes('debugpy'))).toBe(true);
  });

  it('warns (not errors) when debugpy spawn emits an error', async () => {
    findPythonExecutableMock.mockResolvedValue('/usr/bin/python3');
    getPythonVersionMock.mockResolvedValue('3.10.1');
    simulateSpawn({ emitError: true });

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
    simulateSpawn({ output: '', exitCode: 1 }); // debugpy not installed

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
