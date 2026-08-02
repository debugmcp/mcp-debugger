/**
 * Debuggee-output resource tests (issue #218):
 * resources/list, resources/read, subscribe/unsubscribe bookkeeping,
 * and debounced resources/updated pings driven by 'output-captured'.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies } from '../../../../src/container/dependencies.js';
import { OutputRingBuffer } from '../../../../src/session/output-buffer.js';
import {
  createMockDependencies,
  createMockServer,
  createMockSessionManager,
  createMockStdioTransport,
  getResourceHandlers
} from './server-test-helpers.js';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

describe('Server Output Resources Tests', () => {
  let debugServer: DebugMcpServer;
  let mockServer: any;
  let mockSessionManager: any;
  let mockDependencies: any;
  let outputCapturedListener: ((sessionId: string, entry: unknown) => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();

    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);

    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function() { return mockServer as any; });

    const mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(function() { return mockStdioTransport as any; });

    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    // Capture the server's 'output-captured' subscription so tests can drive it
    mockSessionManager.on.mockImplementation((event: string, listener: (...args: any[]) => void) => {
      if (event === 'output-captured') {
        outputCapturedListener = listener;
      }
    });
    vi.mocked(SessionManager).mockImplementation(function() { return mockSessionManager as any; });

    debugServer = new DebugMcpServer();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
    outputCapturedListener = undefined;
  });

  function mockSession(overrides: Record<string, unknown> = {}) {
    const buffer = new OutputRingBuffer();
    return {
      id: 'sess-1',
      name: 'test session',
      language: 'python',
      outputBuffer: buffer,
      ...overrides
    };
  }

  async function subscribe(uri: string) {
    const { subscribeHandler } = getResourceHandlers(mockServer);
    return subscribeHandler({ method: 'resources/subscribe', params: { uri } });
  }

  describe('resources/list', () => {
    it('lists one output resource per session', async () => {
      mockSessionManager.getAllSessions.mockReturnValue([
        { id: 'sess-1', name: 'alpha', language: 'python' },
        { id: 'sess-2', name: 'beta', language: 'mock' }
      ]);

      const { listResourcesHandler } = getResourceHandlers(mockServer);
      const result = await listResourcesHandler({ method: 'resources/list', params: {} });

      expect(result.resources).toHaveLength(2);
      expect(result.resources[0]).toMatchObject({
        uri: 'debug://sessions/sess-1/output',
        mimeType: 'text/plain'
      });
      expect(result.resources[0].name).toContain('alpha');
    });
  });

  describe('resources/read', () => {
    it('returns the verbatim transcript', async () => {
      const session = mockSession();
      (session.outputBuffer as OutputRingBuffer).push('stdout', 'hello\n');
      (session.outputBuffer as OutputRingBuffer).push('stderr', 'oops\n');
      mockSessionManager.getSession.mockReturnValue(session);

      const { readResourceHandler } = getResourceHandlers(mockServer);
      const result = await readResourceHandler({
        method: 'resources/read',
        params: { uri: 'debug://sessions/sess-1/output' }
      });

      expect(result.contents).toEqual([{
        uri: 'debug://sessions/sess-1/output',
        mimeType: 'text/plain',
        text: 'hello\noops\n'
      }]);
    });

    it('returns empty text for a session that never launched', async () => {
      mockSessionManager.getSession.mockReturnValue(mockSession({ outputBuffer: undefined }));

      const { readResourceHandler } = getResourceHandlers(mockServer);
      const result = await readResourceHandler({
        method: 'resources/read',
        params: { uri: 'debug://sessions/sess-1/output' }
      });

      expect(result.contents[0].text).toBe('');
    });

    it('rejects unknown URIs and unknown sessions', async () => {
      mockSessionManager.getSession.mockReturnValue(undefined);
      const { readResourceHandler } = getResourceHandlers(mockServer);

      await expect(readResourceHandler({
        method: 'resources/read',
        params: { uri: 'debug://sessions/ghost/output' }
      })).rejects.toBeInstanceOf(McpError);

      await expect(readResourceHandler({
        method: 'resources/read',
        params: { uri: 'file:///etc/passwd' }
      })).rejects.toBeInstanceOf(McpError);
    });
  });

  describe('subscriptions and updated pings', () => {
    it('debounces a burst of output into a single resources/updated ping', async () => {
      mockSessionManager.getSession.mockReturnValue(mockSession());
      await subscribe('debug://sessions/sess-1/output');
      expect(outputCapturedListener).toBeDefined();

      for (let i = 0; i < 50; i++) {
        outputCapturedListener!('sess-1', { seq: i + 1, category: 'stdout', output: `${i}\n`, timestamp: 1 });
      }

      expect(mockServer.sendResourceUpdated).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(200);

      expect(mockServer.sendResourceUpdated).toHaveBeenCalledTimes(1);
      expect(mockServer.sendResourceUpdated).toHaveBeenCalledWith({ uri: 'debug://sessions/sess-1/output' });

      // A later burst gets its own ping
      outputCapturedListener!('sess-1', { seq: 51, category: 'stdout', output: 'more\n', timestamp: 2 });
      await vi.advanceTimersByTimeAsync(200);
      expect(mockServer.sendResourceUpdated).toHaveBeenCalledTimes(2);
    });

    it('does not ping for unsubscribed sessions', async () => {
      expect(outputCapturedListener).toBeDefined();
      outputCapturedListener!('sess-1', { seq: 1, category: 'stdout', output: 'x\n', timestamp: 1 });
      await vi.advanceTimersByTimeAsync(500);

      expect(mockServer.sendResourceUpdated).not.toHaveBeenCalled();
    });

    it('rejects subscribing to an unknown session', async () => {
      mockSessionManager.getSession.mockReturnValue(undefined);
      await expect(subscribe('debug://sessions/ghost/output')).rejects.toBeInstanceOf(McpError);
    });

    it('stops pinging after unsubscribe, cancelling any pending timer', async () => {
      mockSessionManager.getSession.mockReturnValue(mockSession());
      await subscribe('debug://sessions/sess-1/output');

      outputCapturedListener!('sess-1', { seq: 1, category: 'stdout', output: 'x\n', timestamp: 1 });

      const { unsubscribeHandler } = getResourceHandlers(mockServer);
      await unsubscribeHandler({ method: 'resources/unsubscribe', params: { uri: 'debug://sessions/sess-1/output' } });

      await vi.advanceTimersByTimeAsync(500);
      expect(mockServer.sendResourceUpdated).not.toHaveBeenCalled();
    });

    it('cleans up pending timers and the session-manager listener on stop()', async () => {
      mockSessionManager.getSession.mockReturnValue(mockSession());
      mockSessionManager.closeAllSessions.mockResolvedValue(undefined);
      await subscribe('debug://sessions/sess-1/output');

      outputCapturedListener!('sess-1', { seq: 1, category: 'stdout', output: 'x\n', timestamp: 1 });

      await debugServer.stop();
      expect(mockSessionManager.removeListener).toHaveBeenCalledWith('output-captured', expect.any(Function));

      await vi.advanceTimersByTimeAsync(500);
      expect(mockServer.sendResourceUpdated).not.toHaveBeenCalled();
    });
  });
});
