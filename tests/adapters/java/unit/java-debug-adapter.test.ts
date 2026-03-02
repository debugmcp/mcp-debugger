import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import path from 'path';
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
      expect(adapter.name).toBe('Java Debug Adapter (JDI)');
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

    it('should warn when Java version is old (< 11)', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          // Simulate Java 8 (1.8.0) version string
          proc.stderr.emit('data', Buffer.from('openjdk version "1.8.0_292"\n'));
          proc.emit('exit', 0);
        });
        return proc;
      });

      await adapter.initialize();
      expect(adapter.getState()).toBe(AdapterState.READY);
      // Should have logged a warning about old Java version
      expect(mockDependencies.logger?.warn).toHaveBeenCalledWith(
        expect.stringContaining('Java 11+ recommended')
      );
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
    it('should return JDK as dependency', () => {
      const deps = adapter.getRequiredDependencies();
      expect(deps).toHaveLength(1);
      expect(deps[0].name).toBe('JDK');
      expect(deps[0].required).toBe(true);
    });
  });

  describe('supportsFeature', () => {
    it('should support conditional breakpoints', () => {
      expect(adapter.supportsFeature(DebugFeature.CONDITIONAL_BREAKPOINTS)).toBe(true);
    });

    it('should not support function breakpoints', () => {
      expect(adapter.supportsFeature(DebugFeature.FUNCTION_BREAKPOINTS)).toBe(false);
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
      expect(caps.supportsFunctionBreakpoints).toBe(false);
      expect(caps.supportsConditionalBreakpoints).toBe(true);
      expect(caps.supportsEvaluateForHovers).toBe(true);
      expect(caps.supportsSetVariable).toBe(false);
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
    it('should translate JDI bridge not compiled error', () => {
      const error = new Error('JDI bridge not compiled');
      const translated = adapter.translateErrorMessage(error);
      expect(translated).toContain('JDI bridge not compiled');
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

    it('should translate NoClassDefFoundError', () => {
      const error = new Error('java.lang.NoClassDefFoundError: com/example/Main');
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
    it('should throw when JDI bridge is not compiled', () => {
      // JDI bridge may or may not be compiled depending on environment
      const fn = () => adapter.buildAdapterCommand({
        sessionId: 'test-session',
        executablePath: 'java',
        adapterHost: '127.0.0.1',
        adapterPort: 38000,
        logDir: '/tmp/logs',
        scriptPath: '/app/Main.java',
        scriptArgs: [],
        launchConfig: {}
      });

      try {
        const result = fn();
        // JDI bridge is compiled — verify we got a valid command back
        expect(result.command).toBeTruthy();
        expect(result.args).toBeDefined();
        // Should launch java with JdiDapServer
        expect(result.args).toContain('JdiDapServer');
      } catch (error) {
        // JDI bridge not compiled — verify the error message
        expect((error as Error).message).toMatch(/JDI bridge not compiled/);
      }
    });

    it('should throw when port is 0', () => {
      expect(() => adapter.buildAdapterCommand({
        sessionId: 'test-session',
        executablePath: 'java',
        adapterHost: '127.0.0.1',
        adapterPort: 0,
        logDir: '/tmp/logs',
        scriptPath: '/app/Main.java',
        scriptArgs: [],
        launchConfig: {}
      })).toThrow(/JDI bridge not compiled|Valid TCP port/);
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

    it('should pass through classpath when provided', async () => {
      const transformed = await adapter.transformLaunchConfig({
        classpath: '/app/lib/*:/app/classes',
        cwd: '/app',
      } as any);

      expect(transformed.classpath).toBe('/app/lib/*:/app/classes');
    });

    it('should pass through sourcePath when provided', async () => {
      const transformed = await adapter.transformLaunchConfig({
        sourcePath: '/app/src',
        cwd: '/app',
      } as any);

      expect(transformed.sourcePath).toBe('/app/src');
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

    it('should transition to DEBUGGING on continued event', () => {
      const continuedSpy = vi.fn();
      adapter.on('continued', continuedSpy);

      adapter.handleDapEvent({
        event: 'continued',
        body: { threadId: 1 },
        seq: 1,
        type: 'event'
      });

      expect(adapter.getState()).toBe(AdapterState.DEBUGGING);
      expect(continuedSpy).toHaveBeenCalled();
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

    it('should emit exited event', () => {
      const exitedSpy = vi.fn();
      adapter.on('exited', exitedSpy);

      adapter.handleDapEvent({
        event: 'exited',
        body: { exitCode: 0 },
        seq: 1,
        type: 'event'
      });

      expect(exitedSpy).toHaveBeenCalled();
    });

    it('should emit thread event', () => {
      const threadSpy = vi.fn();
      adapter.on('thread', threadSpy);

      adapter.handleDapEvent({
        event: 'thread',
        body: { reason: 'started', threadId: 1 },
        seq: 1,
        type: 'event'
      });

      expect(threadSpy).toHaveBeenCalled();
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

  describe('sendDapRequest', () => {
    it('should throw as DAP forwarding is not implemented', async () => {
      await expect(adapter.sendDapRequest('stackTrace', { threadId: 1 }))
        .rejects.toThrow('DAP request forwarding not implemented');
    });
  });

  describe('handleDapResponse', () => {
    it('should be a no-op', () => {
      // handleDapResponse is a no-op - responses are handled by ProxyManager
      // Just verify it doesn't throw
      expect(() => adapter.handleDapResponse({
        seq: 1,
        type: 'response',
        request_seq: 1,
        success: true,
        command: 'stackTrace'
      })).not.toThrow();
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
      const customJdkPath = path.join(path.sep, 'custom', 'jdk');
      process.env.JAVA_HOME = customJdkPath;

      try {
        const paths = adapter.getExecutableSearchPaths();
        // Normalize paths for comparison (handles / vs \ on different platforms)
        expect(paths.some(p => p.split(path.sep).join('/').includes('custom/jdk'))).toBe(true);
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
    it('should set host and request to attach', () => {
      const config = adapter.transformAttachConfig({
        request: 'attach',
        host: '192.168.1.10',
        port: 5005,
      });

      expect(config.type).toBe('java');
      expect(config.request).toBe('attach');
      expect(config.host).toBe('192.168.1.10');
      expect(config.port).toBe(5005);
    });

    it('should default host to localhost when not provided', () => {
      const config = adapter.transformAttachConfig({
        request: 'attach',
        port: 5005,
      });

      expect(config.host).toBe('localhost');
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
      // No mandatory timeout — JDI bridge doesn't require it
      expect(config.timeout).toBeUndefined();
    });
  });

  describe('getDefaultAttachConfig', () => {
    it('should return sensible defaults', () => {
      const defaults = adapter.getDefaultAttachConfig();
      expect(defaults.request).toBe('attach');
      expect(defaults.host).toBe('localhost');
      // No mandatory timeout default
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

  describe('handleDapEvent - breakpoint', () => {
    it('should emit breakpoint event', () => {
      const breakpointHandler = vi.fn();
      adapter.on('breakpoint', breakpointHandler);

      const event = {
        event: 'breakpoint',
        body: {
          reason: 'changed',
          breakpoint: { id: 1, verified: true }
        }
      };

      adapter.handleDapEvent(event as any);
      expect(breakpointHandler).toHaveBeenCalledWith(event);
    });
  });

  describe('getFeatureRequirements', () => {
    it('should return JDK requirement for conditional breakpoints', () => {
      const requirements = adapter.getFeatureRequirements(DebugFeature.CONDITIONAL_BREAKPOINTS);
      expect(requirements).toHaveLength(1);
      expect(requirements[0].type).toBe('dependency');
      expect(requirements[0].description).toContain('JDK');
      expect(requirements[0].required).toBe(true);
    });

    it('should return JDI requirement for exception breakpoints', () => {
      const requirements = adapter.getFeatureRequirements(DebugFeature.EXCEPTION_BREAKPOINTS);
      expect(requirements).toHaveLength(1);
      expect(requirements[0].type).toBe('dependency');
      expect(requirements[0].description).toContain('JDI');
      expect(requirements[0].required).toBe(true);
    });

    it('should return empty array for unsupported features', () => {
      const requirements = adapter.getFeatureRequirements(DebugFeature.STEP_BACK);
      expect(requirements).toHaveLength(0);
    });
  });
});
