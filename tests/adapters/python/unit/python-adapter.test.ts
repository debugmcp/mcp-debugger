/**
 * Unit tests for Python Debug Adapter
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PythonDebugAdapter } from '@debugmcp/adapter-python';
import { PythonAdapterFactory } from '@debugmcp/adapter-python';
import { 
  AdapterState, 
  DebugFeature 
} from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import * as pythonUtils from '../../../../packages/adapter-python/src/utils/python-utils.js';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';

/**
 * Mock python-utils via the exact module path the adapter imports,
 * so the adapter's internal imports are affected.
 */
vi.mock('../../../../packages/adapter-python/src/utils/python-utils.js', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    findPythonExecutable: vi.fn(),
    getPythonVersion: vi.fn()
  };
});

// Mock child_process
vi.mock('child_process', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    spawn: vi.fn()
  };
});

// Create a mock process helper
function createMockProcess() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const stdin = new EventEmitter();
  
  const mockProcess = Object.assign(new EventEmitter(), {
    stdout,
    stderr,
    stdin,
    pid: 1234,
    kill: vi.fn()
  });
  
  return mockProcess;
}

describe('PythonDebugAdapter', () => {
  let adapter: PythonDebugAdapter;
  
  // Create properly typed mock dependencies
  const mockDependencies = {
    logger: {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    },
    fileSystem: {},
    environment: {},
    pathUtils: {},
    processLauncher: {}
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Provide a safe default mock for child_process.spawn used by:
    // - getPythonVersion (args[0] === '--version')
    // - debugpy check (args[0] === '-c' and includes 'import debugpy')
    // - generic validation calls (args[0] === '-c' with other code)
    vi.mocked(child_process.spawn).mockImplementation((cmd: string, args?: readonly string[]) => {
      const mock = createMockProcess();

      // Ensure stdout/stderr exist for listeners
      if (!mock.stdout) (mock as any).stdout = new EventEmitter();
      if (!mock.stderr) (mock as any).stderr = new EventEmitter();

      process.nextTick(() => {
        if (Array.isArray(args) && args[0] === '--version') {
          // Simulate typical Python --version output on stdout
          mock.stdout.emit('data', 'Python 3.9.0\n');
          mock.emit('exit', 0);
        } else if (
          Array.isArray(args) &&
          args[0] === '-c' &&
          typeof args[1] === 'string' &&
          args[1].includes('import debugpy')
        ) {
          // Simulate debugpy version check
          mock.stdout.emit('data', '1.6.0\n');
          mock.emit('exit', 0);
        } else {
          // Generic success for other -c validations
          mock.emit('exit', 0);
        }
      });
      return mock as any;
    });

    adapter = new PythonDebugAdapter(mockDependencies as any);
  });

  afterEach(() => {
    adapter.dispose();
  });

  describe('initialization', () => {
    it('should initialize successfully when Python environment is valid', async () => {
      // Mock Python found
      vi.mocked(pythonUtils.findPythonExecutable).mockResolvedValue('/usr/bin/python3');
      vi.mocked(pythonUtils.getPythonVersion).mockResolvedValue('3.9.0');
      
      // Mock debugpy check with immediate response
      vi.mocked(child_process.spawn).mockImplementation(() => {
        const mockProcess = createMockProcess();
        
        // Immediately emit events
        process.nextTick(() => {
          mockProcess.stdout.emit('data', '1.6.0');
          mockProcess.emit('exit', 0);
        });
        
        return mockProcess as never;
      });
      
      await adapter.initialize();
      
      expect(adapter.getState()).toBe(AdapterState.READY);
      expect(adapter.isReady()).toBe(true);
    });

    it('should fail initialization when Python is not found', async () => {
      vi.mocked(pythonUtils.findPythonExecutable).mockRejectedValue(new Error('Python not found'));
      
      await expect(adapter.initialize()).rejects.toThrow('Python not found');
      expect(adapter.getState()).toBe(AdapterState.ERROR);
    });

    it('should fail initialization when Python version is too old', async () => {
      vi.mocked(pythonUtils.findPythonExecutable).mockResolvedValue('/usr/bin/python');
      vi.mocked(pythonUtils.getPythonVersion).mockResolvedValue('3.6.0');
      
      await expect(adapter.initialize()).rejects.toThrow('Python 3.7 or higher required');
      expect(adapter.getState()).toBe(AdapterState.ERROR);
    });

    it('should fail initialization when debugpy is not installed', async () => {
      vi.mocked(pythonUtils.findPythonExecutable).mockResolvedValue('/usr/bin/python3');
      vi.mocked(pythonUtils.getPythonVersion).mockResolvedValue('3.9.0');
      
      // Mock debugpy check failure with immediate response
      vi.mocked(child_process.spawn).mockImplementation(() => {
        const mockProcess = createMockProcess();
        
        // Immediately emit error
        process.nextTick(() => {
          mockProcess.stderr.emit('data', 'ModuleNotFoundError: No module named debugpy');
          mockProcess.emit('exit', 1);
        });
        
        return mockProcess as never;
      });
      
      await expect(adapter.initialize()).rejects.toThrow('debugpy not installed');
    });
  });

  describe('executable management', () => {
    it('should resolve executable path using findPythonExecutable', async () => {
      const expectedPath = '/usr/local/bin/python3';
      vi.mocked(pythonUtils.findPythonExecutable).mockResolvedValue(expectedPath);
      
      const result = await adapter.resolveExecutablePath();
      
      expect(result).toBe(expectedPath);
      expect(pythonUtils.findPythonExecutable).toHaveBeenCalledWith(undefined, mockDependencies.logger);
    });

    it('should use preferred path when provided', async () => {
      const preferredPath = '/custom/python';
      const expectedPath = '/custom/python';
      vi.mocked(pythonUtils.findPythonExecutable).mockResolvedValue(expectedPath);
      
      const result = await adapter.resolveExecutablePath(preferredPath);
      
      expect(result).toBe(expectedPath);
      expect(pythonUtils.findPythonExecutable).toHaveBeenCalledWith(preferredPath, mockDependencies.logger);
    });

    it('should cache executable paths', async () => {
      const expectedPath = '/usr/bin/python3';
      vi.mocked(pythonUtils.findPythonExecutable).mockResolvedValue(expectedPath);
      
      // First call
      await adapter.resolveExecutablePath();
      
      // Second call should use cache
      await adapter.resolveExecutablePath();
      
      expect(pythonUtils.findPythonExecutable).toHaveBeenCalledTimes(1);
    });

    it('should return correct default executable name for platform', () => {
      const originalPlatform = process.platform;
      
      // Test Windows
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(adapter.getDefaultExecutableName()).toBe('py');
      
      // Test other platforms
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      expect(adapter.getDefaultExecutableName()).toBe('python3');
      
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('adapter configuration', () => {
    it('should build correct debugpy adapter command', () => {
      const config = {
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: 'test.py',
        launchConfig: {}
      };
      
      const result = adapter.buildAdapterCommand(config);
      
      expect(result.command).toBe('/usr/bin/python3');
      expect(result.args).toEqual([
        '-m', 'debugpy.adapter',
        '--host', 'localhost',
        '--port', '5678'
      ]);
      expect(result.env?.PYTHONUNBUFFERED).toBe('1');
      expect(result.env?.DEBUGPY_LOG_DIR).toBe('/tmp/logs');
    });

    it('should return correct adapter module name', () => {
      expect(adapter.getAdapterModuleName()).toBe('debugpy.adapter');
    });

    it('should return correct install command', () => {
      expect(adapter.getAdapterInstallCommand()).toBe('pip install debugpy');
    });
  });


  describe('feature support', () => {
    it('should support Python-specific debug features', () => {
      expect(adapter.supportsFeature(DebugFeature.CONDITIONAL_BREAKPOINTS)).toBe(true);
      expect(adapter.supportsFeature(DebugFeature.FUNCTION_BREAKPOINTS)).toBe(true);
      expect(adapter.supportsFeature(DebugFeature.EXCEPTION_BREAKPOINTS)).toBe(true);
      expect(adapter.supportsFeature(DebugFeature.LOG_POINTS)).toBe(true);
      expect(adapter.supportsFeature(DebugFeature.SET_VARIABLE)).toBe(true);
      
      // Features not supported
      expect(adapter.supportsFeature(DebugFeature.STEP_BACK)).toBe(false);
      expect(adapter.supportsFeature(DebugFeature.DATA_BREAKPOINTS)).toBe(false);
    });

    it('should return correct feature requirements', () => {
      const condBreakpointReqs = adapter.getFeatureRequirements(DebugFeature.CONDITIONAL_BREAKPOINTS);
      expect(condBreakpointReqs).toHaveLength(1);
      expect(condBreakpointReqs[0].description).toContain('debugpy 1.0+');
      
      const logPointReqs = adapter.getFeatureRequirements(DebugFeature.LOG_POINTS);
      expect(logPointReqs).toHaveLength(1);
      expect(logPointReqs[0].description).toContain('debugpy 1.5+');
    });

    it('should provide comprehensive capabilities', () => {
      const capabilities = adapter.getCapabilities();
      
      expect(capabilities.supportsConfigurationDoneRequest).toBe(true);
      expect(capabilities.supportsFunctionBreakpoints).toBe(true);
      expect(capabilities.supportsConditionalBreakpoints).toBe(true);
      expect(capabilities.supportsLogPoints).toBe(true);
      expect(capabilities.supportsSetVariable).toBe(true);
      expect(capabilities.exceptionBreakpointFilters).toBeDefined();
      expect(capabilities.exceptionBreakpointFilters).toHaveLength(3);
    });
  });

  describe('error handling', () => {
    it('should provide helpful installation instructions', () => {
      const instructions = adapter.getInstallationInstructions();
      expect(instructions).toContain('Python 3.7 or higher');
      expect(instructions).toContain('pip install debugpy');
      expect(instructions).toContain('virtual environment');
    });

    it('should translate error messages appropriately', () => {
      const debugpyError = new Error('ModuleNotFoundError: No module named debugpy');
      expect(adapter.translateErrorMessage(debugpyError)).toContain('pip install debugpy');
      
      const pythonNotFoundError = new Error('python: command not found');
      expect(adapter.translateErrorMessage(pythonNotFoundError)).toContain('Python not found');
      
      const permissionError = new Error('Permission denied: /usr/bin/python');
      expect(adapter.translateErrorMessage(permissionError)).toContain('Permission denied');
      
      const windowsStoreError = new Error('Windows Store Python detected');
      expect(adapter.translateErrorMessage(windowsStoreError)).toContain('https://python.org');
    });
  });

  describe('virtual environment detection', () => {
    it('should detect virtual environment', async () => {
      vi.mocked(pythonUtils.findPythonExecutable).mockResolvedValue('/venv/bin/python');
      vi.mocked(pythonUtils.getPythonVersion).mockResolvedValue('3.9.0');
      
      // Mock venv detection - simpler approach
      const mockProcesses: EventEmitter[] = [];
      vi.mocked(child_process.spawn).mockImplementation(() => {
        const mockProcess = createMockProcess();
        mockProcesses.push(mockProcess);
        
        // Check call arguments to determine which process this is
        const args = vi.mocked(child_process.spawn).mock.lastCall?.[1];
        const isVenvCheck = args?.some(arg => 
          arg.includes('real_prefix') || arg.includes('base_prefix')
        );
        
        // Simulate async responses
        setTimeout(() => {
          if (isVenvCheck) {
            mockProcess.stdout.emit('data', 'True');
          } else {
            mockProcess.stdout.emit('data', '1.6.0');
          }
          mockProcess.emit('exit', 0);
        }, 0);
        
        return mockProcess as never;
      });
      
      await adapter.initialize();
      
      expect(mockDependencies.logger.info).toHaveBeenCalledWith(
        '[PythonDebugAdapter] Virtual environment detected'
      );
    });
  });
});

describe('PythonAdapterFactory', () => {
  let factory: PythonAdapterFactory;
  
  beforeEach(() => {
    factory = new PythonAdapterFactory();
    vi.clearAllMocks();
  });

  it('should create Python debug adapter instances', () => {
    const adapter = factory.createAdapter(mockDependencies as any);
    
    expect(adapter).toBeInstanceOf(PythonDebugAdapter);
    expect(adapter.language).toBe(DebugLanguage.PYTHON);
    expect(adapter.name).toBe('Python Debug Adapter');
  });

  it('should return correct metadata', () => {
    const metadata = factory.getMetadata();
    
    expect(metadata.language).toBe(DebugLanguage.PYTHON);
    expect(metadata.displayName).toBe('Python');
    expect(metadata.version).toBe('2.0.0');
    expect(metadata.author).toBe('mcp-debugger team');
    expect(metadata.description).toContain('debugpy');
    expect(metadata.fileExtensions).toEqual(['.py', '.pyw']);
    expect(metadata.icon).toBeDefined();
  });

  it('should validate environment', async () => {
    // Mock successful Python environment
    vi.mocked(pythonUtils.findPythonExecutable).mockResolvedValue('/usr/bin/python3');
    vi.mocked(pythonUtils.getPythonVersion).mockResolvedValue('3.9.0');
    
    // Mock debugpy installed with immediate response
    vi.mocked(child_process.spawn).mockImplementation(() => {
      const mockProcess = createMockProcess();
      
      // Immediately emit events
      process.nextTick(() => {
        mockProcess.stdout.emit('data', '1.6.0');
        mockProcess.emit('exit', 0);
      });
      
      return mockProcess as never;
    });
    
    const result = await factory.validate();
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.details).toMatchObject({
      pythonPath: '/usr/bin/python3',
      pythonVersion: '3.9.0',
      platform: process.platform
    });
  });

  it('should report validation errors', async () => {
    vi.mocked(pythonUtils.findPythonExecutable).mockRejectedValue(new Error('Python not found'));
    
    const result = await factory.validate();
    
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Python not found');
  });
});

// Create a reference to mockDependencies for the factory test
const mockDependencies = {
  logger: {},
  fileSystem: {},
  environment: {},
  pathUtils: {},
  processLauncher: {}
};
