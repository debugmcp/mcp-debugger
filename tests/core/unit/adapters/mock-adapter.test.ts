/**
 * Unit tests for MockDebugAdapter
 * 
 * @since 2.0.0
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MockDebugAdapter, MockErrorScenario } from '../../../../src/adapters/mock/mock-debug-adapter.js';
import { AdapterState, AdapterError, DebugFeature } from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { createProductionDependencies } from '../../../../src/container/dependencies.js';

describe('MockDebugAdapter', () => {
  let adapter: MockDebugAdapter;
  let dependencies: ReturnType<typeof createProductionDependencies>;

  beforeEach(() => {
    // Create minimal dependencies for testing
    dependencies = createProductionDependencies();
    adapter = new MockDebugAdapter(dependencies, { defaultDelay: 0 });
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe('basic properties', () => {
    it('should have correct language and name', () => {
      expect(adapter.language).toBe(DebugLanguage.MOCK);
      expect(adapter.name).toBe('Mock Debug Adapter');
    });
  });

  describe('lifecycle management', () => {
    it('should initialize successfully', async () => {
      await adapter.initialize();
      
      expect(adapter.getState()).toBe(AdapterState.READY);
      expect(adapter.isReady()).toBe(true);
    });

    it('should emit initialized event', async () => {
      const initializedSpy = vi.fn();
      adapter.on('initialized', initializedSpy);
      
      await adapter.initialize();
      
      expect(initializedSpy).toHaveBeenCalled();
    });

    it('should dispose successfully', async () => {
      await adapter.initialize();
      const disposedSpy = vi.fn();
      adapter.on('disposed', disposedSpy);
      
      await adapter.dispose();
      
      expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
      expect(disposedSpy).toHaveBeenCalled();
    });

    it('should fail initialization with error scenario', async () => {
      adapter.setErrorScenario(MockErrorScenario.EXECUTABLE_NOT_FOUND);
      
      await expect(adapter.initialize()).rejects.toThrow(AdapterError);
    });
  });

  describe('state management', () => {
    it('should track state transitions', async () => {
      const stateChangeSpy = vi.fn();
      adapter.on('stateChanged', stateChangeSpy);
      
      await adapter.initialize();
      
      expect(stateChangeSpy).toHaveBeenCalledWith(
        AdapterState.UNINITIALIZED,
        AdapterState.INITIALIZING
      );
      expect(stateChangeSpy).toHaveBeenCalledWith(
        AdapterState.INITIALIZING,
        AdapterState.READY
      );
    });

    it('should prevent invalid state transitions', async () => {
      // First, get to INITIALIZING state
      // @ts-expect-error - accessing private method for testing
      adapter.transitionTo(AdapterState.INITIALIZING);
      
      // Now try an invalid transition from INITIALIZING to DISCONNECTED
      // This should still fail as it's not a valid transition
      expect(() => {
        // @ts-expect-error - accessing private method for testing
        adapter.transitionTo(AdapterState.DISCONNECTED);
      }).toThrow(/Invalid state transition/);
    });

    it('should report current thread ID only when debugging', async () => {
      expect(adapter.getCurrentThreadId()).toBeNull();
      
      await adapter.initialize();
      expect(adapter.getCurrentThreadId()).toBeNull();
      
      // Connect and simulate debugging state
      await adapter.connect('localhost', 1234);
      expect(adapter.getCurrentThreadId()).toBeNull();
      
      // Simulate stopped event to transition to debugging
      adapter.handleDapEvent({
        type: 'event',
        event: 'stopped',
        seq: 1,
        body: { reason: 'breakpoint', threadId: 42 }
      });
      
      expect(adapter.getCurrentThreadId()).toBe(42);
    });
  });

  describe('environment validation', () => {
    it('should validate environment successfully', async () => {
      const result = await adapter.validateEnvironment();
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation with error scenario', async () => {
      adapter.setErrorScenario(MockErrorScenario.EXECUTABLE_NOT_FOUND);
      
      const result = await adapter.validateEnvironment();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MOCK_NOT_FOUND');
    });

    it('should return no required dependencies', () => {
      const deps = adapter.getRequiredDependencies();
      
      expect(deps).toHaveLength(0);
    });
  });

  describe('executable management', () => {
    it('should resolve executable path', async () => {
      const path = await adapter.resolveExecutablePath();
      
      expect(path).toBe(process.execPath);
    });

    it('should use preferred path if provided', async () => {
      const preferredPath = '/custom/node';
      const path = await adapter.resolveExecutablePath(preferredPath);
      
      expect(path).toBe(preferredPath);
    });

    it('should return default executable name', () => {
      expect(adapter.getDefaultExecutableName()).toBe('node');
    });

    it('should return executable search paths', () => {
      const paths = adapter.getExecutableSearchPaths();
      
      expect(Array.isArray(paths)).toBe(true);
    });
  });

  describe('adapter configuration', () => {
    it('should build adapter command', () => {
      const config = {
        sessionId: 'test-session',
        executablePath: 'node',
        adapterHost: 'localhost',
        adapterPort: 1234,
        logDir: 'logs',
        scriptPath: 'test.js',
        launchConfig: {}
      };
      
      const command = adapter.buildAdapterCommand(config);
      
      expect(command.command).toBe(process.execPath);
      expect(command.args).toContain('--port');
      expect(command.args).toContain('1234');
      expect(command.args).toContain('--session');
      expect(command.args).toContain('test-session');
      expect(command.env?.MOCK_ADAPTER_LOG).toBe('logs');
    });

    it('should return adapter module name', () => {
      expect(adapter.getAdapterModuleName()).toBe('mock-adapter');
    });

    it('should return install command', () => {
      expect(adapter.getAdapterInstallCommand()).toContain('echo');
    });
  });

  describe('debug configuration', () => {
    it('should transform launch config', () => {
      const genericConfig = {
        stopOnEntry: true,
        justMyCode: false,
        env: { TEST: 'value' }
      };
      
      const transformed = adapter.transformLaunchConfig(genericConfig);
      
      expect(transformed).toMatchObject({
        ...genericConfig,
        type: 'mock',
        request: 'launch',
        name: 'Mock Debug'
      });
    });

    it('should provide default launch config', () => {
      const defaults = adapter.getDefaultLaunchConfig();
      
      expect(defaults.stopOnEntry).toBe(false);
      expect(defaults.justMyCode).toBe(true);
      expect(defaults.env).toEqual({});
      expect(defaults.cwd).toBe(process.cwd());
    });
  });


  describe('DAP operations', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should delegate DAP requests (returns empty response)', async () => {
      // The adapter doesn't handle DAP requests directly anymore
      // It just validates and delegates to ProxyManager
      const response = await adapter.sendDapRequest('setBreakpoints', {
        source: { path: 'test.js' },
        breakpoints: [{ line: 10 }, { line: 20 }]
      });
      
      // Should return empty object as ProxyManager handles the actual communication
      expect(response).toEqual({});
    });
  });

  describe('event handling', () => {
    it('should handle DAP events and update state', () => {
      const stopSpy = vi.fn();
      adapter.on('stopped', stopSpy);
      
      adapter.handleDapEvent({
        type: 'event',
        event: 'stopped',
        seq: 1,
        body: { reason: 'breakpoint', threadId: 1 }
      });
      
      expect(stopSpy).toHaveBeenCalledWith({ reason: 'breakpoint', threadId: 1 });
      expect(adapter.getCurrentThreadId()).toBe(1);
      expect(adapter.getState()).toBe(AdapterState.DEBUGGING);
    });

    it('should handle continued event', () => {
      const continuedSpy = vi.fn();
      adapter.on('continued', continuedSpy);
      
      adapter.handleDapEvent({
        type: 'event',
        event: 'continued',
        seq: 1
      });
      
      expect(continuedSpy).toHaveBeenCalled();
      expect(adapter.getState()).toBe(AdapterState.DEBUGGING);
    });

    it('should handle terminated event', async () => {
      const terminatedSpy = vi.fn();
      adapter.on('terminated', terminatedSpy);
      
      // Need to be connected first
      await adapter.initialize();
      await adapter.connect('localhost', 1234);
      
      adapter.handleDapEvent({
        type: 'event',
        event: 'terminated',
        seq: 1
      });
      
      expect(terminatedSpy).toHaveBeenCalled();
      expect(adapter.getCurrentThreadId()).toBeNull();
      expect(adapter.getState()).toBe(AdapterState.CONNECTED);
    });
  });

  describe('error handling', () => {
    it('should provide installation instructions', () => {
      const instructions = adapter.getInstallationInstructions();
      
      expect(instructions).toContain('built-in');
    });

    it('should provide missing executable error', () => {
      const error = adapter.getMissingExecutableError();
      
      expect(error).toContain('Mock executable not found');
    });

    it('should translate error messages', () => {
      const error = new Error('ENOENT: file not found');
      const translated = adapter.translateErrorMessage(error);
      
      expect(translated).toContain('Mock file not found');
    });
  });

  describe('feature support', () => {
    it('should support configured features', () => {
      const adapter = new MockDebugAdapter(dependencies, {
        defaultDelay: 0,
        supportedFeatures: [DebugFeature.CONDITIONAL_BREAKPOINTS]
      });
      
      expect(adapter.supportsFeature(DebugFeature.CONDITIONAL_BREAKPOINTS)).toBe(true);
      expect(adapter.supportsFeature(DebugFeature.STEP_BACK)).toBe(false);
    });

    it('should return feature requirements', () => {
      const requirements = adapter.getFeatureRequirements(DebugFeature.CONDITIONAL_BREAKPOINTS);
      
      expect(requirements).toHaveLength(1);
      expect(requirements[0].type).toBe('version');
    });

    it('should return capabilities', () => {
      const capabilities = adapter.getCapabilities();
      
      expect(capabilities.supportsConfigurationDoneRequest).toBe(true);
      expect(capabilities.supportTerminateDebuggee).toBe(true);
    });
  });

  describe('connection management', () => {
    it('should connect successfully', async () => {
      await adapter.initialize();
      
      const connectSpy = vi.fn();
      adapter.on('connected', connectSpy);
      
      await adapter.connect('localhost', 1234);
      
      expect(adapter.isConnected()).toBe(true);
      expect(adapter.getState()).toBe(AdapterState.CONNECTED);
      expect(connectSpy).toHaveBeenCalled();
    });

    it('should handle connection timeout', async () => {
      await adapter.initialize();
      adapter.setErrorScenario(MockErrorScenario.CONNECTION_TIMEOUT);
      
      await expect(adapter.connect('localhost', 1234))
        .rejects.toThrow(AdapterError);
    });

    it('should disconnect successfully', async () => {
      await adapter.initialize();
      await adapter.connect('localhost', 1234);
      
      const disconnectSpy = vi.fn();
      adapter.on('disconnected', disconnectSpy);
      
      await adapter.disconnect();
      
      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('configuration options', () => {
    it('should respect timing configuration', async () => {
      const adapter = new MockDebugAdapter(dependencies, {
        defaultDelay: 0,
        connectionDelay: 20,
        stepDelay: 5
      });
      
      await adapter.initialize();
      
      const start = Date.now();
      await adapter.connect('localhost', 1234);
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(19); // Allow for small timing variations
    });

    it('should respect max variable depth', () => {
      const adapter = new MockDebugAdapter(dependencies, {
        defaultDelay: 0,
        maxVariableDepth: 5
      });
      
      expect(adapter['config'].maxVariableDepth).toBe(5);
    });

    it('should respect error scenarios', () => {
      const adapter = new MockDebugAdapter(dependencies, {
        defaultDelay: 0,
        errorScenarios: [MockErrorScenario.CONNECTION_TIMEOUT]
      });
      
      expect(adapter['config'].errorScenarios).toContain(MockErrorScenario.CONNECTION_TIMEOUT);
    });
  });
});
