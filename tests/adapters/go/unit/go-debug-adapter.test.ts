import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import fs from 'node:fs';
import type { AdapterDependencies } from '@debugmcp/shared';
import { AdapterState, DebugLanguage, DebugFeature } from '@debugmcp/shared';
import { GoDebugAdapter } from '@debugmcp/adapter-go';

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
  }
});

describe('GoDebugAdapter', () => {
  let adapter: GoDebugAdapter;
  let mockDependencies: AdapterDependencies;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDependencies = createMockDependencies();
    adapter = new GoDebugAdapter(mockDependencies);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('basic properties', () => {
    it('should have correct language', () => {
      expect(adapter.language).toBe(DebugLanguage.GO);
    });

    it('should have correct name', () => {
      expect(adapter.name).toBe('Go Debug Adapter (Delve)');
    });

    it('should start in UNINITIALIZED state', () => {
      expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
    });

    it('should not be ready initially', () => {
      expect(adapter.isReady()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should transition to READY when Go and Delve are available', async () => {
      // Mock Go executable found and version check
      vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
      
      mockSpawn.mockImplementation((cmd, args) => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();

        process.nextTick(() => {
          if (args?.[0] === 'version') {
            proc.stdout.emit('data', Buffer.from('go version go1.21.0 darwin/arm64\n'));
          } else if (args?.[0] === 'dap' && args?.[1] === '--help') {
            // DAP support check
          }
          proc.emit('exit', 0);
        });

        return proc;
      });

      await adapter.initialize();
      expect(adapter.getState()).toBe(AdapterState.READY);
      expect(adapter.isReady()).toBe(true);
    });

    it('should emit initialized event on success', async () => {
      vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
      
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          proc.stdout.emit('data', Buffer.from('go version go1.21.0 darwin/arm64\n'));
          proc.emit('exit', 0);
        });
        return proc;
      });

      const initializeSpy = vi.fn();
      adapter.on('initialized', initializeSpy);

      await adapter.initialize();
      expect(initializeSpy).toHaveBeenCalled();
    });

    it('should transition to ERROR when Go is not found', async () => {
      vi.spyOn(fs.promises, 'access').mockRejectedValue(new Error('Not found'));
      const originalPath = process.env.PATH;
      process.env.PATH = '';

      try {
        await expect(adapter.initialize()).rejects.toThrow();
        expect(adapter.getState()).toBe(AdapterState.ERROR);
      } finally {
        process.env.PATH = originalPath;
      }
    });
  });

  describe('dispose', () => {
    it('should clear caches and reset state', async () => {
      vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          proc.stdout.emit('data', Buffer.from('go version go1.21.0\n'));
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
    it('should return Go and Delve as required', () => {
      const deps = adapter.getRequiredDependencies();
      expect(deps).toHaveLength(2);
      expect(deps[0].name).toBe('Go');
      expect(deps[0].required).toBe(true);
      expect(deps[1].name).toBe('Delve (dlv)');
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

    it('should support log points', () => {
      expect(adapter.supportsFeature(DebugFeature.LOG_POINTS)).toBe(true);
    });

    it('should support terminate request', () => {
      expect(adapter.supportsFeature(DebugFeature.TERMINATE_REQUEST)).toBe(true);
    });

    it('should not support step back (requires rr)', () => {
      expect(adapter.supportsFeature(DebugFeature.STEP_BACK)).toBe(false);
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
      expect(caps.supportsLogPoints).toBe(true);
      expect(caps.supportsTerminateRequest).toBe(true);
      expect(caps.supportsStepBack).toBe(false);
    });

    it('should include panic and fatal exception filters', () => {
      const caps = adapter.getCapabilities();
      
      expect(caps.exceptionBreakpointFilters).toBeDefined();
      expect(caps.exceptionBreakpointFilters?.length).toBe(2);
      expect(caps.exceptionBreakpointFilters?.[0].filter).toBe('panic');
      expect(caps.exceptionBreakpointFilters?.[1].filter).toBe('fatal');
    });
  });

  describe('translateErrorMessage', () => {
    it('should translate dlv not found error', () => {
      const error = new Error('dlv: command not found');
      const translated = adapter.translateErrorMessage(error);
      expect(translated).toContain('Delve debugger not found');
    });

    it('should translate go not found error', () => {
      const error = new Error('go: command not found');
      const translated = adapter.translateErrorMessage(error);
      expect(translated).toContain('Go not found');
    });

    it('should translate permission denied error', () => {
      const error = new Error('permission denied');
      const translated = adapter.translateErrorMessage(error);
      expect(translated).toContain('Permission denied');
    });

    it('should translate could not launch process error', () => {
      const error = new Error('could not launch process: exit status 1');
      const translated = adapter.translateErrorMessage(error);
      expect(translated).toContain('Could not launch process');
    });

    it('should translate could not attach error', () => {
      const error = new Error('could not attach to process');
      const translated = adapter.translateErrorMessage(error);
      expect(translated).toContain('Could not attach');
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
      expect(instructions).toContain('go.dev');
      expect(instructions).toContain('delve');
      expect(instructions).toContain('go install');
    });
  });

  describe('getMissingExecutableError', () => {
    it('should return helpful error message', () => {
      const error = adapter.getMissingExecutableError();
      expect(error).toContain('Go not found');
      expect(error).toContain('go.dev');
    });
  });

  describe('handleDapEvent', () => {
    it('should handle stopped event and track threadId', () => {
      const stoppedSpy = vi.fn();
      adapter.on('stopped', stoppedSpy);

      adapter.handleDapEvent({
        event: 'stopped',
        seq: 1,
        type: 'event',
        body: { reason: 'breakpoint', threadId: 7 }
      } as any);

      expect(stoppedSpy).toHaveBeenCalled();
      expect(adapter.getState()).toBe(AdapterState.DEBUGGING);
    });

    it('should handle continued event', () => {
      const continuedSpy = vi.fn();
      adapter.on('continued', continuedSpy);

      adapter.handleDapEvent({
        event: 'continued',
        seq: 2,
        type: 'event',
        body: { threadId: 1 }
      } as any);

      expect(continuedSpy).toHaveBeenCalled();
      expect(adapter.getState()).toBe(AdapterState.DEBUGGING);
    });

    it('should handle terminated event', () => {
      const terminatedSpy = vi.fn();
      adapter.on('terminated', terminatedSpy);

      adapter.handleDapEvent({
        event: 'terminated',
        seq: 3,
        type: 'event'
      } as any);

      expect(terminatedSpy).toHaveBeenCalled();
      expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);
    });

    it('should handle exited event', () => {
      const exitedSpy = vi.fn();
      adapter.on('exited', exitedSpy);

      adapter.handleDapEvent({
        event: 'exited',
        seq: 4,
        type: 'event',
        body: { exitCode: 0 }
      } as any);

      expect(exitedSpy).toHaveBeenCalled();
    });

    it('should handle thread event', () => {
      const threadSpy = vi.fn();
      adapter.on('thread', threadSpy);

      adapter.handleDapEvent({
        event: 'thread',
        seq: 5,
        type: 'event',
        body: { reason: 'started', threadId: 1 }
      } as any);

      expect(threadSpy).toHaveBeenCalled();
    });

    it('should handle output event', () => {
      const outputSpy = vi.fn();
      adapter.on('output', outputSpy);

      adapter.handleDapEvent({
        event: 'output',
        seq: 6,
        type: 'event',
        body: { category: 'stdout', output: 'hello\n' }
      } as any);

      expect(outputSpy).toHaveBeenCalled();
    });

    it('should handle breakpoint event', () => {
      const breakpointSpy = vi.fn();
      adapter.on('breakpoint', breakpointSpy);

      adapter.handleDapEvent({
        event: 'breakpoint',
        seq: 7,
        type: 'event',
        body: { reason: 'changed', breakpoint: { id: 1, verified: true } }
      } as any);

      expect(breakpointSpy).toHaveBeenCalled();
    });
  });

  describe('getFeatureRequirements', () => {
    it('returns Delve 1.6+ requirement for conditional breakpoints', () => {
      const reqs = adapter.getFeatureRequirements(DebugFeature.CONDITIONAL_BREAKPOINTS);
      expect(reqs).toHaveLength(1);
      expect(reqs[0].type).toBe('dependency');
      expect(reqs[0].description).toContain('Delve 1.6');
    });

    it('returns Delve 1.7+ requirement for log points', () => {
      const reqs = adapter.getFeatureRequirements(DebugFeature.LOG_POINTS);
      expect(reqs).toHaveLength(1);
      expect(reqs[0].type).toBe('version');
      expect(reqs[0].description).toContain('Delve 1.7');
    });

    it('returns rr requirement for step back', () => {
      const reqs = adapter.getFeatureRequirements(DebugFeature.STEP_BACK);
      expect(reqs).toHaveLength(1);
      expect(reqs[0].type).toBe('configuration');
      expect(reqs[0].required).toBe(false);
    });

    it('returns empty array for features without special requirements', () => {
      const reqs = adapter.getFeatureRequirements(DebugFeature.FUNCTION_BREAKPOINTS);
      expect(reqs).toEqual([]);
    });
  });

  describe('buildAdapterCommand', () => {
    it('should build correct dlv dap command', async () => {
      vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => {
          proc.stdout.emit('data', Buffer.from('Version: 1.21.0\n'));
          proc.emit('exit', 0);
        });
        return proc;
      });

      const command = await adapter.buildAdapterCommand({
        sessionId: 'test-session',
        executablePath: '/home/user/go/bin/dlv',
        adapterHost: '127.0.0.1',
        adapterPort: 38000,
        logDir: '/tmp/logs',
        scriptPath: '/app/main.go',
        scriptArgs: [],
        launchConfig: {}
      });

      expect(command.command).toBe('/home/user/go/bin/dlv');
      expect(command.args).toContain('dap');
      expect(command.args).toContain('--listen=127.0.0.1:38000');
    });
  });

  describe('transformLaunchConfig', () => {
    it('should transform generic config to Go-specific config', async () => {
      const transformed = await adapter.transformLaunchConfig({
        program: '/app/main.go',
        cwd: '/app',
        args: ['--verbose'],
        env: { DEBUG: 'true' }
      });

      expect(transformed.type).toBe('go');
      expect(transformed.request).toBe('launch');
      expect(transformed.mode).toBe('debug');
      expect(transformed.program).toBe('/app/main.go');
    });

    it('should handle test mode', async () => {
      const transformed = await adapter.transformLaunchConfig({
        program: '/app/main_test.go',
        cwd: '/app',
        args: ['-test.v'],
        mode: 'test'
      } as any);

      expect(transformed.mode).toBe('test');
    });
  });
});
