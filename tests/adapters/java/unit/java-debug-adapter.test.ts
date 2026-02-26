import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import type { AdapterDependencies } from '@debugmcp/shared';
import { AdapterState, DebugLanguage, DebugFeature } from '@debugmcp/shared';
import { JavaDebugAdapter } from '@debugmcp/adapter-java';

vi.mock('child_process', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    spawn: vi.fn()
  };
});

const mockSpawn = vi.mocked(spawn);

const createMockDependencies = (): AdapterDependencies => ({
  fileSystem: {
    readFile: async () => '',
    writeFile: async () => {},
    exists: async () => false,
    mkdir: async () => {},
    readdir: async () => [],
    stat: async () => ({} as unknown as import('fs').Stats),
    unlink: async () => {},
    rmdir: async () => {},
    ensureDir: async () => {},
    ensureDirSync: () => {},
    pathExists: async () => false,
    existsSync: () => false,
    remove: async () => {},
    copy: async () => {},
    outputFile: async () => {}
  },
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  },
  environment: {
    get: (key: string) => process.env[key],
    getAll: () => ({ ...process.env }),
    getCurrentWorkingDirectory: () => process.cwd()
  },
  processLauncher: {
    launch: vi.fn()
  } as AdapterDependencies['processLauncher']
});

describe('JavaDebugAdapter', () => {
  let adapter: JavaDebugAdapter;
  let mockDependencies: AdapterDependencies;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDependencies = createMockDependencies();
    adapter = new JavaDebugAdapter(mockDependencies);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('basic properties', () => {
    it('should have correct language', () => {
      expect(adapter.language).toBe(DebugLanguage.JAVA);
    });

    it('should have correct name', () => {
      expect(adapter.name).toBe('Java Debug Adapter (KDA)');
    });

    it('should start in UNINITIALIZED state', () => {
      expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
    });

    it('should not be ready initially', () => {
      expect(adapter.isReady()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should transition to READY when Java is available', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();

        process.nextTick(() => {
          proc.stderr.emit('data', Buffer.from('openjdk version "17.0.1" 2021-10-19\n'));
          proc.emit('exit', 0);
        });

        return proc;
      });

      await adapter.initialize();
      expect(adapter.getState()).toBe(AdapterState.READY);
      expect(adapter.isReady()).toBe(true);
    });

    it('should emit initialized event on success', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          proc.stderr.emit('data', Buffer.from('openjdk version "17.0.1"\n'));
          proc.emit('exit', 0);
        });
        return proc;
      });

      const initializeSpy = vi.fn();
      adapter.on('initialized', initializeSpy);

      await adapter.initialize();
      expect(initializeSpy).toHaveBeenCalled();
    });

    it('should transition to ERROR when Java is not found', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => proc.emit('error', new Error('spawn ENOENT')));
        return proc;
      });

      const originalPath = process.env.PATH;
      const originalJavaHome = process.env.JAVA_HOME;
      process.env.PATH = '';
      delete process.env.JAVA_HOME;

      try {
        await expect(adapter.initialize()).rejects.toThrow();
        expect(adapter.getState()).toBe(AdapterState.ERROR);
      } finally {
        process.env.PATH = originalPath;
        if (originalJavaHome) process.env.JAVA_HOME = originalJavaHome;
      }
    });
  });

  describe('dispose', () => {
    it('should reset state to UNINITIALIZED', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          proc.stderr.emit('data', Buffer.from('openjdk version "17.0.1"\n'));
          proc.emit('exit', 0);
        });
        return proc;
      });

      await adapter.initialize();
      expect(adapter.getState()).toBe(AdapterState.READY);

      await adapter.dispose();
      expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
    });

    it('should emit disposed event', async () => {
      const disposeSpy = vi.fn();
      adapter.on('disposed', disposeSpy);

      await adapter.dispose();
      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe('connect/disconnect', () => {
    it('should transition to CONNECTED on connect', async () => {
      await adapter.connect('127.0.0.1', 38000);
      expect(adapter.getState()).toBe(AdapterState.CONNECTED);
      expect(adapter.isConnected()).toBe(true);
    });

    it('should emit connected event', async () => {
      const connectedSpy = vi.fn();
      adapter.on('connected', connectedSpy);

      await adapter.connect('127.0.0.1', 38000);
      expect(connectedSpy).toHaveBeenCalled();
    });

    it('should transition to DISCONNECTED on disconnect', async () => {
      await adapter.connect('127.0.0.1', 38000);
      await adapter.disconnect();
      expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);
      expect(adapter.isConnected()).toBe(false);
    });

    it('should emit disconnected event', async () => {
      const disconnectedSpy = vi.fn();
      adapter.on('disconnected', disconnectedSpy);

      await adapter.connect('127.0.0.1', 38000);
      await adapter.disconnect();
      expect(disconnectedSpy).toHaveBeenCalled();
    });
  });

  describe('getRequiredDependencies', () => {
    it('should return JDK and KDA as dependencies', () => {
      const deps = adapter.getRequiredDependencies();
      expect(deps).toHaveLength(2);
      expect(deps[0].name).toBe('JDK');
      expect(deps[0].required).toBe(true);
      expect(deps[1].name).toBe('kotlin-debug-adapter');
      expect(deps[1].required).toBe(true);
    });
  });

  describe('supportsFeature', () => {
    it('should support conditional breakpoints', () => {
      expect(adapter.supportsFeature(DebugFeature.CONDITIONAL_BREAKPOINTS)).toBe(true);
    });

    it('should support function breakpoints', () => {
      expect(adapter.supportsFeature(DebugFeature.FUNCTION_BREAKPOINTS)).toBe(true);
    });

    it('should support exception breakpoints', () => {
      expect(adapter.supportsFeature(DebugFeature.EXCEPTION_BREAKPOINTS)).toBe(true);
    });

    it('should support evaluate for hovers', () => {
      expect(adapter.supportsFeature(DebugFeature.EVALUATE_FOR_HOVERS)).toBe(true);
    });

    it('should support terminate request', () => {
      expect(adapter.supportsFeature(DebugFeature.TERMINATE_REQUEST)).toBe(true);
    });

    it('should not support step back', () => {
      expect(adapter.supportsFeature(DebugFeature.STEP_BACK)).toBe(false);
    });

    it('should not support data breakpoints', () => {
      expect(adapter.supportsFeature(DebugFeature.DATA_BREAKPOINTS)).toBe(false);
    });
  });

  describe('getCapabilities', () => {
    it('should return comprehensive capabilities object', () => {
      const caps = adapter.getCapabilities();

      expect(caps.supportsConfigurationDoneRequest).toBe(true);
      expect(caps.supportsFunctionBreakpoints).toBe(true);
      expect(caps.supportsConditionalBreakpoints).toBe(true);
      expect(caps.supportsEvaluateForHovers).toBe(true);
      expect(caps.supportsSetVariable).toBe(true);
      expect(caps.supportsTerminateRequest).toBe(true);
      expect(caps.supportsStepBack).toBe(false);
      expect(caps.supportsLogPoints).toBe(false);
    });

    it('should include caught and uncaught exception filters', () => {
      const caps = adapter.getCapabilities();

      expect(caps.exceptionBreakpointFilters).toBeDefined();
      expect(caps.exceptionBreakpointFilters?.length).toBe(2);
      expect(caps.exceptionBreakpointFilters?.[0].filter).toBe('caught');
      expect(caps.exceptionBreakpointFilters?.[1].filter).toBe('uncaught');
    });
  });

  describe('translateErrorMessage', () => {
    it('should translate KDA not found error', () => {
      const error = new Error('kotlin-debug-adapter not found');
      const translated = adapter.translateErrorMessage(error);
      expect(translated).toContain('kotlin-debug-adapter');
      expect(translated).toContain('build:adapter');
    });

    it('should translate Java not found error', () => {
      const error = new Error('java: command not found');
      const translated = adapter.translateErrorMessage(error);
      expect(translated).toContain('Java not found');
    });

    it('should translate permission denied error', () => {
      const error = new Error('permission denied');
      const translated = adapter.translateErrorMessage(error);
      expect(translated).toContain('Permission denied');
    });

    it('should translate ClassNotFoundException', () => {
      const error = new Error('java.lang.ClassNotFoundException: com.example.Main');
      const translated = adapter.translateErrorMessage(error);
      expect(translated).toContain('class not found');
    });

    it('should pass through unknown errors', () => {
      const error = new Error('some unknown error');
      const translated = adapter.translateErrorMessage(error);
      expect(translated).toBe('some unknown error');
    });
  });

  describe('getInstallationInstructions', () => {
    it('should return installation instructions', () => {
      const instructions = adapter.getInstallationInstructions();
      expect(instructions).toContain('JDK');
      expect(instructions).toContain('adoptium');
      expect(instructions).toContain('build:adapter');
    });
  });

  describe('getMissingExecutableError', () => {
    it('should return helpful error message', () => {
      const error = adapter.getMissingExecutableError();
      expect(error).toContain('Java not found');
      expect(error).toContain('adoptium');
    });
  });

  describe('buildAdapterCommand', () => {
    it('should throw when KDA is not vendored', () => {
      // KDA won't be vendored in test environment
      expect(() => adapter.buildAdapterCommand({
        sessionId: 'test-session',
        executablePath: 'java',
        adapterHost: '127.0.0.1',
        adapterPort: 38000,
        logDir: '/tmp/logs',
        scriptPath: '/app/Main.java',
        scriptArgs: [],
        launchConfig: {}
      })).toThrow(/kotlin-debug-adapter not found/);
    });

    it('should throw when port is 0', () => {
      // Even if KDA were found, port 0 should be rejected
      expect(() => adapter.buildAdapterCommand({
        sessionId: 'test-session',
        executablePath: 'java',
        adapterHost: '127.0.0.1',
        adapterPort: 0,
        logDir: '/tmp/logs',
        scriptPath: '/app/Main.java',
        scriptArgs: [],
        launchConfig: {}
      })).toThrow(/kotlin-debug-adapter not found|Valid TCP port/);
    });
  });

  describe('transformLaunchConfig', () => {
    it('should transform generic config to Java-specific config', async () => {
      const transformed = await adapter.transformLaunchConfig({
        cwd: '/app',
        args: ['--verbose'],
        env: { DEBUG: 'true' }
      });

      expect(transformed.type).toBe('java');
      expect(transformed.request).toBe('launch');
    });

    it('should extract mainClass from .java file path', async () => {
      const transformed = await adapter.transformLaunchConfig({
        program: 'src/com/example/Main.java',
        cwd: '/app',
      } as any);

      expect(transformed.mainClass).toBe('Main');
    });

    it('should pass through class name as mainClass', async () => {
      const transformed = await adapter.transformLaunchConfig({
        program: 'com.example.Main',
        cwd: '/app',
      } as any);

      expect(transformed.mainClass).toBe('com.example.Main');
    });

    it('should default stopOnEntry to true', async () => {
      const transformed = await adapter.transformLaunchConfig({
        cwd: '/app',
      });

      expect(transformed.stopOnEntry).toBe(true);
    });

    it('should respect stopOnEntry override', async () => {
      const transformed = await adapter.transformLaunchConfig({
        stopOnEntry: false,
        cwd: '/app',
      });

      expect(transformed.stopOnEntry).toBe(false);
    });
  });

  describe('handleDapEvent', () => {
    it('should transition to DEBUGGING on stopped event', () => {
      const stoppedSpy = vi.fn();
      adapter.on('stopped', stoppedSpy);

      adapter.handleDapEvent({
        event: 'stopped',
        body: { reason: 'breakpoint', threadId: 1 },
        seq: 1,
        type: 'event'
      });

      expect(adapter.getState()).toBe(AdapterState.DEBUGGING);
      expect(adapter.getCurrentThreadId()).toBe(1);
      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('should transition to DISCONNECTED on terminated event', () => {
      const terminatedSpy = vi.fn();
      adapter.on('terminated', terminatedSpy);

      adapter.handleDapEvent({
        event: 'terminated',
        body: {},
        seq: 1,
        type: 'event'
      });

      expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);
      expect(terminatedSpy).toHaveBeenCalled();
    });

    it('should emit output event', () => {
      const outputSpy = vi.fn();
      adapter.on('output', outputSpy);

      adapter.handleDapEvent({
        event: 'output',
        body: { category: 'stdout', output: 'Hello World\n' },
        seq: 1,
        type: 'event'
      });

      expect(outputSpy).toHaveBeenCalled();
    });
  });

  describe('getDefaultLaunchConfig', () => {
    it('should return defaults with stopOnEntry true', () => {
      const defaults = adapter.getDefaultLaunchConfig();
      expect(defaults.stopOnEntry).toBe(true);
      expect(defaults.justMyCode).toBe(true);
    });
  });

  describe('getExecutableSearchPaths', () => {
    it('should return array of search paths', () => {
      const paths = adapter.getExecutableSearchPaths();
      expect(Array.isArray(paths)).toBe(true);
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should include JAVA_HOME when set', () => {
      const originalJavaHome = process.env.JAVA_HOME;
      process.env.JAVA_HOME = '/custom/jdk';

      try {
        const paths = adapter.getExecutableSearchPaths();
        expect(paths.some(p => p.includes('/custom/jdk'))).toBe(true);
      } finally {
        if (originalJavaHome) {
          process.env.JAVA_HOME = originalJavaHome;
        } else {
          delete process.env.JAVA_HOME;
        }
      }
    });
  });

  describe('supportsAttach', () => {
    it('should return true', () => {
      expect(adapter.supportsAttach()).toBe(true);
    });
  });

  describe('transformAttachConfig', () => {
    it('should map host to hostName and set request to attach', () => {
      const config = adapter.transformAttachConfig({
        request: 'attach',
        host: '192.168.1.10',
        port: 5005,
      });

      expect(config.type).toBe('java');
      expect(config.request).toBe('attach');
      expect(config.hostName).toBe('192.168.1.10');
      expect(config.port).toBe(5005);
    });

    it('should default hostName to localhost when host is not provided', () => {
      const config = adapter.transformAttachConfig({
        request: 'attach',
        port: 5005,
      });

      expect(config.hostName).toBe('localhost');
    });

    it('should pass through sourcePaths, stopOnEntry, cwd, env, timeout', () => {
      const config = adapter.transformAttachConfig({
        request: 'attach',
        host: '127.0.0.1',
        port: 5005,
        sourcePaths: ['/src'],
        stopOnEntry: true,
        cwd: '/app',
        env: { JAVA_HOME: '/jdk' },
        timeout: 60000,
      });

      expect(config.sourcePaths).toEqual(['/src']);
      expect(config.stopOnEntry).toBe(true);
      expect(config.cwd).toBe('/app');
      expect(config.env).toEqual({ JAVA_HOME: '/jdk' });
      expect(config.timeout).toBe(60000);
    });

    it('should omit optional fields when not provided', () => {
      const config = adapter.transformAttachConfig({
        request: 'attach',
        port: 5005,
      });

      expect(config.sourcePaths).toBeUndefined();
      expect(config.stopOnEntry).toBeUndefined();
      expect(config.cwd).toBeUndefined();
      expect(config.env).toBeUndefined();
      expect(config.timeout).toBeUndefined();
    });
  });

  describe('getDefaultAttachConfig', () => {
    it('should return sensible defaults', () => {
      const defaults = adapter.getDefaultAttachConfig();
      expect(defaults.request).toBe('attach');
      expect(defaults.host).toBe('localhost');
      expect(defaults.timeout).toBe(30000);
    });
  });

  describe('getDefaultExecutableName', () => {
    it('should return platform-appropriate name', () => {
      const name = adapter.getDefaultExecutableName();
      if (process.platform === 'win32') {
        expect(name).toBe('java.exe');
      } else {
        expect(name).toBe('java');
      }
    });
  });
});
