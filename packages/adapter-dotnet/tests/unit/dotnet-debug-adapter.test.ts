import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AdapterDependencies } from '@debugmcp/shared';
import {
  DebugLanguage,
  AdapterState,
  DebugFeature,
  AdapterErrorCode
} from '@debugmcp/shared';
import { DotnetDebugAdapter } from '../../src/DotnetDebugAdapter.js';
import { findNetcoredbgExecutable } from '../../src/utils/dotnet-utils.js';

vi.mock('../../src/utils/dotnet-utils.js', () => ({
  findNetcoredbgExecutable: vi.fn(),
  findDotnetBackend: vi.fn(),
  listDotnetProcesses: vi.fn(),
  findPdb2PdbExecutable: vi.fn(),
  convertPdbsToTemp: vi.fn()
}));

const findNetcoredbgExecutableMock = vi.mocked(findNetcoredbgExecutable);

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

describe('DotnetDebugAdapter', () => {
  let adapter: DotnetDebugAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    findNetcoredbgExecutableMock.mockReset();
    adapter = new DotnetDebugAdapter(createDependencies());
  });

  // ===== Identity =====

  describe('identity', () => {
    it('has language set to DOTNET', () => {
      expect(adapter.language).toBe(DebugLanguage.DOTNET);
    });

    it('has descriptive name', () => {
      expect(adapter.name).toContain('.NET Debug Adapter');
    });
  });

  // ===== Lifecycle =====

  describe('lifecycle', () => {
    it('starts in UNINITIALIZED state', () => {
      expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
    });

    it('transitions to READY after successful initialize', async () => {
      findNetcoredbgExecutableMock.mockResolvedValue('/path/to/netcoredbg');

      await adapter.initialize();

      expect(adapter.getState()).toBe(AdapterState.READY);
      expect(adapter.isReady()).toBe(true);
    });

    it('emits initialized event on success', async () => {
      findNetcoredbgExecutableMock.mockResolvedValue('/path/to/netcoredbg');
      const handler = vi.fn();
      adapter.on('initialized', handler);

      await adapter.initialize();

      expect(handler).toHaveBeenCalledOnce();
    });

    it('transitions to ERROR when no debugger found', async () => {
      findNetcoredbgExecutableMock.mockRejectedValue(new Error('not found'));

      await expect(adapter.initialize()).rejects.toThrow();
      expect(adapter.getState()).toBe(AdapterState.ERROR);
    });

    it('resets state on dispose', async () => {
      findNetcoredbgExecutableMock.mockResolvedValue('/path/to/netcoredbg');
      await adapter.initialize();

      await adapter.dispose();

      expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getCurrentThreadId()).toBeNull();
    });
  });

  // ===== State Management =====

  describe('state management', () => {
    it('isReady returns true for READY, CONNECTED, and DEBUGGING states', async () => {
      findNetcoredbgExecutableMock.mockResolvedValue('/path/to/netcoredbg');
      await adapter.initialize();
      expect(adapter.isReady()).toBe(true);

      await adapter.connect('127.0.0.1', 12345);
      expect(adapter.isReady()).toBe(true);
    });

    it('isReady returns false for UNINITIALIZED and ERROR', () => {
      expect(adapter.isReady()).toBe(false);
    });

    it('getCurrentThreadId returns null initially', () => {
      expect(adapter.getCurrentThreadId()).toBeNull();
    });

    it('emits stateChanged events', async () => {
      findNetcoredbgExecutableMock.mockResolvedValue('/path/to/netcoredbg');
      const transitions: Array<[AdapterState, AdapterState]> = [];
      adapter.on('stateChanged', (from, to) => transitions.push([from, to]));

      await adapter.initialize();

      expect(transitions).toEqual([
        [AdapterState.UNINITIALIZED, AdapterState.INITIALIZING],
        [AdapterState.INITIALIZING, AdapterState.READY]
      ]);
    });
  });

  // ===== Environment Validation =====

  describe('environment validation', () => {
    it('returns valid when netcoredbg is found', async () => {
      findNetcoredbgExecutableMock.mockResolvedValue('/path/to/netcoredbg');

      const result = await adapter.validateEnvironment();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error when no debugger found', async () => {
      findNetcoredbgExecutableMock.mockRejectedValue(new Error('netcoredbg not found'));

      const result = await adapter.validateEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('DEBUGGER_NOT_FOUND');
    });

    it('lists required dependencies', () => {
      const deps = adapter.getRequiredDependencies();

      expect(deps).toHaveLength(2);
      expect(deps[0].name).toBe('netcoredbg');
      expect(deps[0].required).toBe(true);
    });
  });

  // ===== Executable Management =====

  describe('executable management', () => {
    it('resolves executable path via findNetcoredbgExecutable', async () => {
      findNetcoredbgExecutableMock.mockResolvedValue('/path/to/netcoredbg.exe');

      const result = await adapter.resolveExecutablePath();

      expect(result).toBe('/path/to/netcoredbg.exe');
    });

    it('caches resolved path for 60 seconds', async () => {
      findNetcoredbgExecutableMock.mockResolvedValue('/path/to/netcoredbg.exe');

      await adapter.resolveExecutablePath();
      await adapter.resolveExecutablePath();

      expect(findNetcoredbgExecutableMock).toHaveBeenCalledTimes(1);
    });

    it('returns netcoredbg as default executable name', () => {
      expect(adapter.getDefaultExecutableName()).toBe('netcoredbg');
    });

    it('returns platform-specific search paths', () => {
      const paths = adapter.getExecutableSearchPaths();
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  // ===== Adapter Configuration =====

  describe('adapter configuration', () => {
    it('builds adapter command using bridge with netcoredbg', () => {
      const config = {
        sessionId: 'test-session',
        executablePath: '/path/to/netcoredbg.exe',
        adapterHost: '127.0.0.1',
        adapterPort: 12345,
        logDir: '/tmp/logs',
        scriptPath: '/path/to/app.dll',
        launchConfig: {}
      };

      const command = adapter.buildAdapterCommand(config);

      // Bridge runs under node
      expect(command.command).toBe(process.execPath);
      // Args: [bridge-path, netcoredbg-path, port]
      expect(command.args[0]).toContain('netcoredbg-bridge');
      expect(command.args[1]).toBe('/path/to/netcoredbg.exe');
      expect(command.args[2]).toBe('12345');
    });

    it('returns netcoredbg as adapter module name', () => {
      expect(adapter.getAdapterModuleName()).toBe('netcoredbg');
    });

    it('returns netcoredbg install instructions', () => {
      const cmd = adapter.getAdapterInstallCommand();
      expect(cmd).toContain('netcoredbg');
    });
  });

  // ===== Launch Configuration =====

  describe('launch configuration', () => {
    it('transforms generic config to coreclr launch config', async () => {
      const result = await adapter.transformLaunchConfig({
        stopOnEntry: false,
        justMyCode: true,
        cwd: '/app'
      });

      expect(result).toMatchObject({
        type: 'coreclr',
        request: 'launch',
        justMyCode: true,
        stopOnEntry: false
      });
    });

    it('defaults stopOnEntry to true', async () => {
      const result = await adapter.transformLaunchConfig({});

      expect(result.stopOnEntry).toBe(true);
    });

    it('defaults justMyCode to true', async () => {
      const result = await adapter.transformLaunchConfig({});

      expect(result.justMyCode).toBe(true);
    });

    it('returns sensible default launch config', () => {
      const defaults = adapter.getDefaultLaunchConfig();

      expect(defaults.stopOnEntry).toBe(true);
      expect(defaults.justMyCode).toBe(true);
    });
  });

  // ===== Attach Configuration =====

  describe('attach configuration', () => {
    it('supports attach', () => {
      expect(adapter.supportsAttach()).toBe(true);
    });

    it('supports detach', () => {
      expect(adapter.supportsDetach()).toBe(true);
    });

    it('transforms attach config with coreclr type', () => {
      const result = adapter.transformAttachConfig({
        request: 'attach',
        processId: 1234,
        justMyCode: true
      });

      expect(result).toMatchObject({
        type: 'coreclr',
        request: 'attach',
        processId: 1234,
        justMyCode: true
      });
    });

    it('CRITICAL: always sets terminateDebuggee to false', () => {
      const result = adapter.transformAttachConfig({
        request: 'attach',
        processId: 9999
      });

      expect(result.terminateDebuggee).toBe(false);
    });

    it('converts string processId to number', () => {
      const result = adapter.transformAttachConfig({
        request: 'attach',
        processId: '5678'
      });

      expect(result.processId).toBe(5678);
    });

    it('returns default attach config', () => {
      const defaults = adapter.getDefaultAttachConfig();
      expect(defaults).toBeDefined();
      expect(defaults!.justMyCode).toBe(true);
    });
  });

  // ===== Connection Management =====

  describe('connection management', () => {
    it('transitions to CONNECTED on connect', async () => {
      await adapter.connect('127.0.0.1', 12345);

      expect(adapter.isConnected()).toBe(true);
      expect(adapter.getState()).toBe(AdapterState.CONNECTED);
    });

    it('emits connected event', async () => {
      const handler = vi.fn();
      adapter.on('connected', handler);

      await adapter.connect('127.0.0.1', 12345);

      expect(handler).toHaveBeenCalledOnce();
    });

    it('transitions to DISCONNECTED on disconnect', async () => {
      await adapter.connect('127.0.0.1', 12345);
      await adapter.disconnect();

      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);
    });

    it('clears thread ID on disconnect', async () => {
      await adapter.connect('127.0.0.1', 12345);
      adapter.handleDapEvent({ event: 'stopped', body: { threadId: 42 }, seq: 1, type: 'event' });
      expect(adapter.getCurrentThreadId()).toBe(42);

      await adapter.disconnect();
      expect(adapter.getCurrentThreadId()).toBeNull();
    });
  });

  // ===== DAP Events =====

  describe('DAP event handling', () => {
    it('updates thread ID on stopped event', () => {
      adapter.handleDapEvent({
        event: 'stopped',
        body: { threadId: 7 },
        seq: 1,
        type: 'event'
      });

      expect(adapter.getCurrentThreadId()).toBe(7);
    });

    it('does not crash on events without threadId', () => {
      adapter.handleDapEvent({
        event: 'output',
        body: { output: 'hello' },
        seq: 1,
        type: 'event'
      });

      expect(adapter.getCurrentThreadId()).toBeNull();
    });
  });

  // ===== DAP Requests =====

  describe('DAP request validation', () => {
    it('validates .NET exception filters', async () => {
      await expect(
        adapter.sendDapRequest('setExceptionBreakpoints', {
          filters: ['invalid-filter']
        })
      ).rejects.toThrow('Invalid .NET exception filters');
    });

    it('accepts valid exception filters', async () => {
      await expect(
        adapter.sendDapRequest('setExceptionBreakpoints', {
          filters: ['all', 'user-unhandled']
        })
      ).resolves.toBeDefined();
    });

    it('passes through non-exception requests', async () => {
      await expect(
        adapter.sendDapRequest('continue', { threadId: 1 })
      ).resolves.toBeDefined();
    });
  });

  // ===== Feature Support =====

  describe('feature support', () => {
    it('supports conditional breakpoints', () => {
      expect(adapter.supportsFeature(DebugFeature.CONDITIONAL_BREAKPOINTS)).toBe(true);
    });

    it('supports function breakpoints', () => {
      expect(adapter.supportsFeature(DebugFeature.FUNCTION_BREAKPOINTS)).toBe(true);
    });

    it('supports exception breakpoints', () => {
      expect(adapter.supportsFeature(DebugFeature.EXCEPTION_BREAKPOINTS)).toBe(true);
    });

    it('supports set variable', () => {
      expect(adapter.supportsFeature(DebugFeature.SET_VARIABLE)).toBe(true);
    });

    it('supports evaluate for hovers', () => {
      expect(adapter.supportsFeature(DebugFeature.EVALUATE_FOR_HOVERS)).toBe(true);
    });

    it('does not support step back', () => {
      expect(adapter.supportsFeature(DebugFeature.STEP_BACK)).toBe(false);
    });

    it('does not support log points', () => {
      expect(adapter.supportsFeature(DebugFeature.LOG_POINTS)).toBe(false);
    });

    it('does not support data breakpoints', () => {
      expect(adapter.supportsFeature(DebugFeature.DATA_BREAKPOINTS)).toBe(false);
    });
  });

  // ===== Capabilities =====

  describe('capabilities', () => {
    it('returns capabilities object', () => {
      const caps = adapter.getCapabilities();

      expect(caps.supportsConfigurationDoneRequest).toBe(true);
      expect(caps.supportsConditionalBreakpoints).toBe(true);
      expect(caps.supportsFunctionBreakpoints).toBe(true);
      expect(caps.supportsSetVariable).toBe(true);
      expect(caps.supportsEvaluateForHovers).toBe(true);
      expect(caps.supportsModulesRequest).toBe(true);
      expect(caps.supportsLoadedSourcesRequest).toBe(true);
    });

    it('CRITICAL: does not support terminate debuggee', () => {
      const caps = adapter.getCapabilities();
      expect(caps.supportTerminateDebuggee).toBe(false);
    });

    it('does not support step back', () => {
      const caps = adapter.getCapabilities();
      expect(caps.supportsStepBack).toBe(false);
    });

    it('includes exception breakpoint filters', () => {
      const caps = adapter.getCapabilities();

      expect(caps.exceptionBreakpointFilters).toHaveLength(2);
      expect(caps.exceptionBreakpointFilters![0].filter).toBe('all');
      expect(caps.exceptionBreakpointFilters![1].filter).toBe('user-unhandled');
      expect(caps.exceptionBreakpointFilters![1].default).toBe(true);
    });
  });

  // ===== Error Handling =====

  describe('error handling', () => {
    it('provides installation instructions', () => {
      const instructions = adapter.getInstallationInstructions();

      expect(instructions).toContain('netcoredbg');
    });

    it('provides missing executable error message', () => {
      const msg = adapter.getMissingExecutableError();

      expect(msg).toContain('netcoredbg not found');
    });

    it('translates netcoredbg not found errors', () => {
      const msg = adapter.translateErrorMessage(new Error('netcoredbg not found on this system'));
      expect(msg).toContain('NETCOREDBG_PATH');
    });

    it('translates permission denied errors', () => {
      const msg = adapter.translateErrorMessage(new Error('attach denied by OS'));
      expect(msg).toContain('Administrator');
    });

    it('translates process not found errors', () => {
      const msg = adapter.translateErrorMessage(new Error('target process not found'));
      expect(msg).toContain('PID');
    });

    it('passes through unrecognized errors', () => {
      const msg = adapter.translateErrorMessage(new Error('something unexpected'));
      expect(msg).toBe('something unexpected');
    });
  });

  // ===== Feature Requirements =====

  describe('feature requirements', () => {
    it('returns requirements for conditional breakpoints', () => {
      const reqs = adapter.getFeatureRequirements(DebugFeature.CONDITIONAL_BREAKPOINTS);
      expect(reqs.length).toBeGreaterThan(0);
      expect(reqs[0].type).toBe('dependency');
    });

    it('returns empty array for features with no special requirements', () => {
      const reqs = adapter.getFeatureRequirements(DebugFeature.SET_VARIABLE);
      expect(reqs).toEqual([]);
    });
  });
});
