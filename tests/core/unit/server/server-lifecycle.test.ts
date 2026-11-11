/**
 * Server lifecycle tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { Server } from '@modelcontextprotocol/server';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies, type Dependencies } from '../../../../src/container/dependencies.js';
import {
  createMockDependencies,
  createMockServer,
  createMockSessionManager,
  createMockStdioTransport,
  type MockServer,
  type MockSessionManager,
  createDebugServerWithFacade
} from './server-test-helpers.js';

// Mock dependencies
vi.mock('@modelcontextprotocol/server', async () =>
  (await import('../../../test-utils/mocks/sdk-server-module.js')).sdkServerModuleMock());
vi.mock('@modelcontextprotocol/server/stdio');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

describe('Server Lifecycle Tests', () => {
  let debugServer: DebugMcpServer;
  let mockServer: MockServer;
  let mockSessionManager: MockSessionManager;
  let mockDependencies: Dependencies;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);
    
    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function() { return mockServer as any; });

    const mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(function() { return mockStdioTransport as any; });

    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function() { return mockSessionManager as any; });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Server Start', () => {
    it('should start server with stdio transport', async () => {
      debugServer = createDebugServerWithFacade();

      await debugServer.start();

      expect(mockDependencies.logger.info).toHaveBeenCalledWith(expect.stringContaining('[MCP Server] Started at'));
    });
  });

  describe('Server Stop', () => {
    it('should stop server and close all sessions', async () => {
      debugServer = createDebugServerWithFacade();
      mockSessionManager.closeAllSessions.mockResolvedValue(undefined);

      await debugServer.stop();

      expect(mockSessionManager.closeAllSessions).toHaveBeenCalled();
      expect(mockDependencies.logger.info).toHaveBeenCalledWith('Debug MCP Server stopped');
    });

    it('stop() disposes the container logger so churning HTTP sessions do not leak (issue #404)', async () => {
      mockDependencies.disposeLogger = vi.fn();
      debugServer = createDebugServerWithFacade();
      mockSessionManager.closeAllSessions.mockResolvedValue(undefined);

      await debugServer.stop();

      expect(mockDependencies.disposeLogger).toHaveBeenCalledTimes(1);
    });

    it('should propagate closeAllSessions errors from stop', async () => {
      debugServer = createDebugServerWithFacade();
      mockSessionManager.closeAllSessions.mockRejectedValue(new Error('Close sessions failed'));

      // stop() awaits closeAllSessions() without catching, so the rejection propagates
      await expect(debugServer.stop()).rejects.toThrow('Close sessions failed');

      expect(mockSessionManager.closeAllSessions).toHaveBeenCalled();
    });

  });
});

describe('the debug-session idle policy on the core (issue #1025, step 2)', () => {
  let debugServer: DebugMcpServer | undefined;
  let mockServer: MockServer;
  let mockSessionManager: MockSessionManager;
  let mockDependencies: Dependencies;

  beforeEach(() => {
    vi.useFakeTimers();
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);
    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function() { return mockServer as any; });
    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    mockSessionManager.closeAllSessions.mockResolvedValue(undefined);
    vi.mocked(SessionManager).mockImplementation(function() { return mockSessionManager as any; });
    debugServer = undefined;
  });

  afterEach(async () => {
    await debugServer?.stop();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  /** What the last sweep's attended supplier answers right now. */
  const attendedAnswer = (): boolean => {
    const last = vi.mocked(mockSessionManager.sweepIdle).mock.lastCall;
    const options = last?.[1] as { attended?: boolean | (() => boolean) } | undefined;
    return typeof options?.attended === 'function' ? options.attended() : Boolean(options?.attended);
  };

  /** A core with the policy turned on the only way it can be: by the operator's variable. */
  const coreWithWindow = (ms: number): DebugMcpServer => {
    vi.stubEnv('MCP_DEBUG_SESSION_IDLE_MS', String(ms));
    return new DebugMcpServer();
  };

  it('the policy is off unless the operator sets it, on every transport: nothing is armed and start() says so', async () => {
    debugServer = new DebugMcpServer();
    expect(debugServer.idlePolicy).toEqual({ idleMs: 0, sweepMs: 60_000 });

    await debugServer.start();
    await vi.advanceTimersByTimeAsync(3_600_000);

    expect(mockSessionManager.sweepIdle).not.toHaveBeenCalled();
    expect(mockDependencies.logger.info).toHaveBeenCalledWith(
      expect.stringMatching(/Debug-session idle policy: off .*MCP_DEBUG_SESSION_IDLE_MS.*until it is closed, its program ends, or the server exits/)
    );
  });

  it('MCP_DEBUG_SESSION_IDLE_MS turns it on: start() arms a sweep at the default cadence, says the window, and stop() clears it', async () => {
    debugServer = coreWithWindow(30 * 60_000);
    expect(debugServer.idlePolicy).toEqual({ idleMs: 1_800_000, sweepMs: 60_000 });

    await debugServer.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockSessionManager.sweepIdle).toHaveBeenCalledTimes(1);
    // The supplier itself travels, so the sweep can ask again before each close.
    expect(mockSessionManager.sweepIdle).toHaveBeenCalledWith(1_800_000, { attended: expect.any(Function) });
    expect(attendedAnswer()).toBe(false);
    expect(mockDependencies.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Debug-session idle policy: a tree with no tool call for 30 min is closed')
    );

    await debugServer.stop();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(mockSessionManager.sweepIdle).toHaveBeenCalledTimes(1);
  });

  it('an explicit 0 is off, the same as unset', async () => {
    debugServer = coreWithWindow(0);
    expect(debugServer.idlePolicy.idleMs).toBe(0);
    await debugServer.start();
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(mockSessionManager.sweepIdle).not.toHaveBeenCalled();
  });

  it('an invalid window warns and leaves the policy off', () => {
    vi.stubEnv('MCP_DEBUG_SESSION_IDLE_MS', 'soon');
    debugServer = new DebugMcpServer();

    expect(debugServer.idlePolicy.idleMs).toBe(0);
    expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
      'Ignoring invalid MCP_DEBUG_SESSION_IDLE_MS; using default 0ms.'
    );
  });

  it.each([
    ['MCP_DEBUG_SESSION_IDLE_MS', 0],
    ['MCP_DEBUG_SESSION_IDLE_SWEEP_MS', 60_000]
  ] as const)('does not log rejected environment contents for %s', (name, fallback) => {
    vi.stubEnv(name, 'synthetic-secret-value\nforged-log-entry');
    debugServer = new DebugMcpServer();

    expect(debugServer.idlePolicy).toEqual({ idleMs: 0, sweepMs: 60_000 });
    const warnings = vi.mocked(mockDependencies.logger.warn).mock.calls;
    expect(warnings).toEqual([[`Ignoring invalid ${name}; using default ${fallback}ms.`]]);
    expect(warnings.flat().join(' ')).not.toContain('synthetic-secret-value');
    expect(warnings.flat().join(' ')).not.toContain('forged-log-entry');
  });

  it('MCP_DEBUG_SESSION_IDLE_SWEEP_MS sets the cadence; a non-positive value warns and keeps 60 s', async () => {
    vi.stubEnv('MCP_DEBUG_SESSION_IDLE_SWEEP_MS', '1000');
    debugServer = coreWithWindow(30 * 60_000);
    await debugServer.start();
    await vi.advanceTimersByTimeAsync(2_100);
    expect(mockSessionManager.sweepIdle).toHaveBeenCalledTimes(2);
    await debugServer.stop();

    vi.stubEnv('MCP_DEBUG_SESSION_IDLE_SWEEP_MS', '0');
    debugServer = coreWithWindow(30 * 60_000);
    expect(debugServer.idlePolicy.sweepMs).toBe(60_000);
    expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
      'Ignoring invalid MCP_DEBUG_SESSION_IDLE_SWEEP_MS; using default 60000ms.'
    );
  });

  it('each sweep asks the attended supplier and passes its answer', async () => {
    debugServer = coreWithWindow(30 * 60_000);
    let attended = true;
    debugServer.setAttendedSupplier(() => attended);
    await debugServer.start();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(attendedAnswer()).toBe(true);
    attended = false;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(attendedAnswer()).toBe(false);
  });

  it('a sweep that rejects is logged and the next tick still runs', async () => {
    debugServer = coreWithWindow(30 * 60_000);
    mockSessionManager.sweepIdle.mockRejectedValueOnce(new Error('store exploded'));
    await debugServer.start();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockDependencies.logger.error).toHaveBeenCalledWith('Idle sweep failed', expect.objectContaining({ error: expect.any(Error) }));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockSessionManager.sweepIdle).toHaveBeenCalledTimes(2);
  });
});
