import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockDebugAdapter, MockErrorScenario } from '../../../packages/adapter-mock/src/mock-debug-adapter.js';
import { AdapterState, DebugFeature, type AdapterDependencies } from '@debugmcp/shared';

// buildAdapterCommand probes the filesystem for the bundled .cjs process
// file; the ESM fs namespace is not spy-able, so route existsSync through a
// controllable override that defaults to the real implementation.
const fsControl = vi.hoisted(() => ({
  existsSyncOverride: null as ((p: string) => boolean) | null
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: (p: unknown) =>
      fsControl.existsSyncOverride
        ? fsControl.existsSyncOverride(String(p))
        : actual.existsSync(p as import('fs').PathLike)
  };
});

const createDependencies = (): AdapterDependencies => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  environment: {},
  fileSystem: {} as unknown as AdapterDependencies['fileSystem'],
  networkManager: {} as unknown as AdapterDependencies['networkManager']
});

describe('MockDebugAdapter behaviour', () => {
  let adapter: MockDebugAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new MockDebugAdapter(createDependencies(), {
      supportedFeatures: [DebugFeature.CONDITIONAL_BREAKPOINTS, DebugFeature.LOG_POINTS],
      connectionDelay: 0
    });
  });

  it('transitions through ready, connected and disconnected states', async () => {
    await adapter.initialize();
    expect(adapter.getState()).toBe(AdapterState.READY);

    await adapter.connect('127.0.0.1', 9000);
    expect(adapter.getState()).toBe(AdapterState.CONNECTED);

    await adapter.disconnect();
    expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);
  });

  it('reports feature support based on configuration', () => {
    expect(adapter.supportsFeature(DebugFeature.CONDITIONAL_BREAKPOINTS)).toBe(true);
    expect(adapter.supportsFeature(DebugFeature.DATA_BREAKPOINTS)).toBe(false);
  });

  it('translates filesystem ENOENT errors into user-friendly messages', () => {
    const message = adapter.translateErrorMessage(new Error('ENOENT: file missing'));
    expect(message).toContain('Mock file not found');
  });

  it('surfaces configured error scenarios during connect', async () => {
    adapter.setErrorScenario(MockErrorScenario.CONNECTION_TIMEOUT);
    await expect(adapter.connect('127.0.0.1', 9100)).rejects.toThrow(/Connection timeout/);
  });

  it('fails initialize with ERROR state when the executable scenario is configured', async () => {
    adapter.setErrorScenario(MockErrorScenario.EXECUTABLE_NOT_FOUND);
    await expect(adapter.initialize()).rejects.toThrow(/Mock executable not found/);
    expect(adapter.getState()).toBe(AdapterState.ERROR);
  });

  it('dispose resets state and emits disposed', async () => {
    await adapter.initialize();
    const disposed = vi.fn();
    adapter.on('disposed', disposed);

    await adapter.dispose();

    expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
    expect(adapter.getCurrentThreadId()).toBeNull();
    expect(adapter.isConnected()).toBe(false);
    expect(disposed).toHaveBeenCalled();
  });

  it('rejects invalid state transitions with an AdapterError', async () => {
    await adapter.initialize();
    await adapter.connect('127.0.0.1', 9000);
    await adapter.disconnect();

    // DISCONNECTED -> DEBUGGING is not a valid transition
    expect(() => adapter.handleDapEvent({ seq: 1, type: 'event', event: 'continued' }))
      .toThrow(/Invalid state transition: disconnected/);
  });

  it('honors a configured connection delay before connecting', async () => {
    const delayed = new MockDebugAdapter(createDependencies(), { connectionDelay: 10 });
    const before = Date.now();
    await delayed.connect('127.0.0.1', 9000);
    expect(Date.now() - before).toBeGreaterThanOrEqual(9);
    expect(delayed.getState()).toBe(AdapterState.CONNECTED);
  });

  describe('handleDapEvent state tracking', () => {
    beforeEach(async () => {
      await adapter.initialize();
      await adapter.connect('127.0.0.1', 9000);
    });

    it('captures the thread id and enters DEBUGGING on stopped', () => {
      adapter.handleDapEvent({ seq: 1, type: 'event', event: 'stopped', body: { threadId: 7, reason: 'breakpoint' } });
      expect(adapter.getCurrentThreadId()).toBe(7);
      expect(adapter.getState()).toBe(AdapterState.DEBUGGING);
    });

    it('enters DEBUGGING on continued and forwards the event', () => {
      const seen = vi.fn();
      adapter.on('continued', seen);
      adapter.handleDapEvent({ seq: 2, type: 'event', event: 'continued', body: {} });
      expect(adapter.getState()).toBe(AdapterState.DEBUGGING);
      expect(seen).toHaveBeenCalled();
    });

    it('returns to CONNECTED on terminated while connected', () => {
      adapter.handleDapEvent({ seq: 3, type: 'event', event: 'stopped', body: { threadId: 7 } });
      adapter.handleDapEvent({ seq: 4, type: 'event', event: 'terminated' });
      expect(adapter.getCurrentThreadId()).toBeNull();
      expect(adapter.getState()).toBe(AdapterState.CONNECTED);
    });

    it('falls to DISCONNECTED on exited when no longer connected', async () => {
      adapter.handleDapEvent({ seq: 5, type: 'event', event: 'stopped', body: { threadId: 7 } });
      // Drop the connection flag without changing state (disconnect() would move state itself)
      (adapter as unknown as { connected: boolean }).connected = false;
      adapter.handleDapEvent({ seq: 6, type: 'event', event: 'exited', body: { exitCode: 0 } });
      expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);
    });
  });

  describe('adapter command and configuration surface', () => {
    const adapterConfig = {
      sessionId: 'sess-1',
      adapterHost: '127.0.0.1',
      adapterPort: 4711,
      logDir: '/tmp/logs',
      scriptPath: 'ignored.js'
    };

    it('builds the adapter command around mock-adapter-process.js', () => {
      const cmd = adapter.buildAdapterCommand(adapterConfig);

      expect(cmd.command).toBe(process.execPath);
      expect(cmd.args[0].replace(/\\/g, '/')).toMatch(/mock-adapter-process\.js$/);
      expect(cmd.args).toEqual(expect.arrayContaining(['--port', '4711', '--host', '127.0.0.1', '--session', 'sess-1']));
      expect(cmd.env?.MOCK_ADAPTER_LOG).toBe('/tmp/logs');
    });

    it('falls back to the bundled .cjs process file when the .js is absent (npx bundle)', () => {
      fsControl.existsSyncOverride = (p) => p.endsWith('.cjs');
      try {
        const cmd = adapter.buildAdapterCommand(adapterConfig);
        expect(cmd.args[0].replace(/\\/g, '/')).toMatch(/mock-adapter-process\.cjs$/);
      } finally {
        fsControl.existsSyncOverride = null;
      }
    });

    it('exposes the trivial configuration surface', async () => {
      expect(adapter.getRequiredDependencies()).toEqual([]);
      await expect(adapter.resolveExecutablePath('/custom/node')).resolves.toBe('/custom/node');
      await expect(adapter.resolveExecutablePath()).resolves.toBe(process.execPath);
      expect(adapter.getDefaultExecutableName()).toBe('node');
      expect(Array.isArray(adapter.getExecutableSearchPaths())).toBe(true);
      expect(adapter.getAdapterModuleName()).toBe('mock-adapter');
      expect(adapter.getAdapterInstallCommand()).toContain('built-in');
      expect(adapter.getInstallationInstructions()).toContain('built-in');
      expect(adapter.getMissingExecutableError()).toContain('Mock executable not found');
    });

    it('transformLaunchConfig stamps the mock adapter identity', async () => {
      const transformed = await adapter.transformLaunchConfig({ stopOnEntry: true });
      expect(transformed).toEqual({
        stopOnEntry: true,
        type: 'mock',
        request: 'launch',
        name: 'Mock Debug'
      });
    });

    it('getDefaultLaunchConfig returns the documented defaults', () => {
      expect(adapter.getDefaultLaunchConfig()).toEqual({
        stopOnEntry: false,
        justMyCode: true,
        env: {},
        cwd: process.cwd()
      });
    });

    it('sendDapRequest logs and returns an empty response; handleDapResponse is inert', async () => {
      await expect(adapter.sendDapRequest('threads')).resolves.toEqual({});
      expect(() => adapter.handleDapResponse({ seq: 1, request_seq: 1, type: 'response', command: 'threads', success: true })).not.toThrow();
    });

    it('reports feature requirements for conditional breakpoints only', () => {
      expect(adapter.getFeatureRequirements(DebugFeature.CONDITIONAL_BREAKPOINTS)).toEqual([
        { type: 'version', description: 'Mock adapter version 1.0+', required: true }
      ]);
      expect(adapter.getFeatureRequirements(DebugFeature.LOG_POINTS)).toEqual([]);
    });
  });

  describe('getCapabilities', () => {
    it('reflects configured features inside the full capability surface', () => {
      // Configured with CONDITIONAL_BREAKPOINTS + LOG_POINTS only
      expect(adapter.getCapabilities()).toEqual({
        supportsConfigurationDoneRequest: true,
        supportsFunctionBreakpoints: false,
        supportsConditionalBreakpoints: true,
        supportsHitConditionalBreakpoints: false,
        supportsEvaluateForHovers: false,
        exceptionBreakpointFilters: [
          { filter: 'uncaught', label: 'Uncaught Exceptions', default: false },
          { filter: 'all', label: 'All Exceptions', default: false }
        ],
        supportsStepBack: false,
        supportsSetVariable: false,
        supportsRestartFrame: false,
        supportsGotoTargetsRequest: false,
        supportsStepInTargetsRequest: false,
        supportsCompletionsRequest: false,
        supportsModulesRequest: false,
        supportsRestartRequest: false,
        supportsExceptionOptions: false,
        supportsValueFormattingOptions: false,
        supportsExceptionInfoRequest: true,
        supportTerminateDebuggee: true,
        supportSuspendDebuggee: false,
        supportsDelayedStackTraceLoading: false,
        supportsLoadedSourcesRequest: false,
        supportsLogPoints: true,
        supportsTerminateThreadsRequest: false,
        supportsSetExpression: false,
        supportsTerminateRequest: true,
        supportsDataBreakpoints: false,
        supportsReadMemoryRequest: false,
        supportsWriteMemoryRequest: false,
        supportsDisassembleRequest: false,
        supportsCancelRequest: false,
        supportsBreakpointLocationsRequest: false,
        supportsClipboardContext: false,
        supportsSteppingGranularity: false,
        supportsInstructionBreakpoints: false,
        supportsExceptionFilterOptions: false,
        supportsSingleThreadExecutionRequests: false
      });
    });

    it('enables the feature-gated capabilities when the defaults are used', () => {
      const defaults = new MockDebugAdapter(createDependencies());
      const caps = defaults.getCapabilities();
      expect(caps.supportsFunctionBreakpoints).toBe(true);
      expect(caps.supportsSetVariable).toBe(true);
      expect(caps.supportsLogPoints).toBe(true);
    });
  });
});
