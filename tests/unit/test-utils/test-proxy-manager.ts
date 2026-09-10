/**
 * Test utility for simplified ProxyManager testing
 *
 * This TestProxyManager extends the real ProxyManager but overrides
 * complex initialization to allow synchronous, deterministic testing
 */

import { ProxyManager } from '../../../src/proxy/proxy-manager.js';
import { ProxyConfig } from '../../../src/proxy/proxy-config.js';
import { IFileSystem, ILogger } from '@debugmcp/shared';
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { Stats } from 'fs';
import { createMockFileSystem as createTypedMockFileSystem } from '../../test-utils/helpers/adapter-dependencies.js';

export class TestProxyManager extends ProxyManager {
  private mockResponses: Map<string, any> = new Map();
  private simulatedThreadId: number | null = null;
  public lastSentCommand: any = null;

  /**
   * `sessionId` is private on ProxyManager, but the double must drive the real
   * field so the inherited message handling reads the same value.
   */
  private get internals(): { sessionId: string | null } {
    return this as unknown as { sessionId: string | null };
  }

  constructor(
    logger: ILogger = createMockLogger(),
    fileSystem: IFileSystem = createMockFileSystem()
  ) {
    // Pass null for launcher since we override start() anyway
    super(null, null as any, fileSystem, logger);

    // Initialize pendingRequests map for proper cleanup testing
    (this as any).pendingRequests = new Map();
  }

  /**
   * Override start to skip complex initialization
   */
  async start(config: ProxyConfig): Promise<void> {
    this.internals.sessionId = config.sessionId;
    (this as any).isInitialized = true;
    (this as any).proxyProcess = { pid: 12345 };

    // Initialize DAP state so message handling works
    const { createInitialState } = await import('../../../src/dap-core/index.js');
    (this as any).dapState = createInitialState(config.sessionId);

    // Emit initialized immediately
    this.emit('initialized');
    return Promise.resolve();
  }

  /**
   * Override stop to be synchronous
   */
  async stop(): Promise<void> {
    // Mark as not running first
    (this as any).isInitialized = false;
    (this as any).proxyProcess = null;
    (this as any).dapState = null;

    // Don't try to reject pending requests - they should already be resolved
    const pendingRequests = (this as any).pendingRequests;
    if (pendingRequests) {
      pendingRequests.clear();
    }

    this.emit('exit');
    return Promise.resolve();
  }

  /**
   * Override sendDapRequest to return mock responses
   */
  async sendDapRequest<T extends DebugProtocol.Response>(
    command: string,
    args?: unknown,
    options?: { timeoutMs?: number }
  ): Promise<T> {
    this.lastSentCommand = { command, args, ...(options !== undefined ? { options } : {}) };

    // Check if proxy is running
    if (!this.isRunning()) {
      throw new Error('Proxy not running');
    }

    // Return pre-configured response or default success immediately
    const response = this.mockResponses.get(command) || {
      success: true,
      request_seq: 1,
      seq: 1,
      command,
      type: 'response'
    };

    // For cleanup testing, track pending requests but resolve immediately
    const pendingRequests = (this as any).pendingRequests;
    if (pendingRequests) {
      const requestId = Date.now();
      const pendingPromise = Promise.resolve(response);

      // Store briefly to simulate pending state
      pendingRequests.set(requestId, {
        resolve: () => {},
        reject: () => {},
        promise: pendingPromise
      });

      // Clean up immediately
      process.nextTick(() => {
        pendingRequests.delete(requestId);
      });
    }

    return response;
  }

  /**
   * Set a mock response for a specific DAP command
   */
  setMockResponse(command: string, response: any): void {
    this.mockResponses.set(command, response);
  }

  /**
   * Simulate receiving a message from the proxy process
   */
  simulateMessage(message: any): void {
    // Don't try to modify non-object messages
    if (typeof message !== 'object' || message === null) {
      // Invalid message, just return
      return;
    }

    // Ensure we have sessionId in the message
    if (!message.sessionId && this.internals.sessionId) {
      message.sessionId = this.internals.sessionId;
    }

    // Call the private handleProxyMessage method
    (this as any).handleProxyMessage(message);
  }

  /**
   * Simulate a stopped event
   */
  simulateStoppedEvent(threadId: number, reason: string): void {
    this.simulatedThreadId = threadId;
    this.emit('stopped', threadId, reason, {});
  }

  /**
   * Simulate a continued event
   */
  simulateContinuedEvent(): void {
    this.simulatedThreadId = null;
    this.emit('continued', {});
  }

  /**
   * Override getCurrentThreadId for testing
   */
  getCurrentThreadId(): number | null {
    return this.simulatedThreadId;
  }

  /**
   * Check if running (simplified)
   */
  isRunning(): boolean {
    return (this as any).proxyProcess !== null;
  }
}

/**
 * Create a mock logger for testing
 */
function createMockLogger(): ILogger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  };
}

/**
 * Create a mock file system for testing
 */
function createMockFileSystem(): IFileSystem {
  // The seven behaviours below are the ones ProxyManager (and its tests) rely on;
  // the shared factory supplies inert spies for the other nine IFileSystem members
  // so the double actually satisfies the interface.
  return createTypedMockFileSystem({
    ensureDir: async () => {},
    pathExists: async () => true,
    writeFile: async () => {},
    readFile: async () => '',
    readTail: async () => '',
    stat: async () => ({ isFile: () => true }) as unknown as Stats,
    ensureDirSync: () => {}
  });
}
