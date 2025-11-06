import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import net from 'net';
import fs from 'fs';
import { EventEmitter } from 'events';
import { MinimalDapClient } from '../../../src/proxy/minimal-dap.js';
import type { ChildSessionManager } from '../../../src/proxy/child-session-manager.js';
import { DebugProtocol } from '@vscode/debugprotocol';
import { JsDebugAdapterPolicy } from '@debugmcp/shared';
import type { DapClientBehavior, ReverseRequestResult, AdapterPolicy } from '@debugmcp/shared';

// Mock the net module
vi.mock('net');

// Track logger instances for assertions using hoisted storage so mocks can access it safely
type MockLoggerInstance = {
  info: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
};

const loggerInstances = vi.hoisted(() => [] as MockLoggerInstance[]);

// Mock the logger
vi.mock('../../../src/utils/logger.js', () => ({
  createLogger: vi.fn(() => {
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    };
    loggerInstances.push(logger);
    return logger;
  })
}));

describe('MinimalDapClient', () => {
  let client: MinimalDapClient;
  let mockSocket: any;

  type ChildSessionManagerStub = ChildSessionManager & EventEmitter & {
    createChildSession: ReturnType<typeof vi.fn>;
    getActiveChild: ReturnType<typeof vi.fn>;
    hasActiveChildren: ReturnType<typeof vi.fn>;
    shouldRouteToChild: ReturnType<typeof vi.fn>;
    storeBreakpoints: ReturnType<typeof vi.fn>;
    isAdoptionInProgress: ReturnType<typeof vi.fn>;
  };

  const createChildSessionManagerStub = (): ChildSessionManagerStub => {
    const emitter = new EventEmitter() as unknown as ChildSessionManagerStub;
    emitter.createChildSession = vi.fn().mockResolvedValue(undefined);
    emitter.getActiveChild = vi.fn().mockReturnValue(null);
    emitter.hasActiveChildren = vi.fn().mockReturnValue(false);
    emitter.shouldRouteToChild = vi.fn().mockReturnValue(false);
    emitter.storeBreakpoints = vi.fn();
    emitter.isAdoptionInProgress = vi.fn().mockReturnValue(false);
    return emitter;
  };

  // Helper function to create a mock socket
  const createMockSocket = () => {
    const socket = new EventEmitter() as any;
    socket.write = vi.fn((_: string, cb?: (err?: Error | null) => void) => {
      cb?.(null);
      return true;
    });
    socket.end = vi.fn((callback?: () => void) => {
      if (callback) callback();
    });
    socket.destroy = vi.fn();
    socket.destroyed = false;
    return socket;
  };

  // Helper function to create DAP protocol messages
  function createDapMessage(content: any): Buffer {
    const json = JSON.stringify(content);
    const header = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n`;
    return Buffer.concat([Buffer.from(header), Buffer.from(json)]);
  }

  // Helper to simulate data chunks
  function splitBuffer(buffer: Buffer, chunkSizes: number[]): Buffer[] {
    const chunks: Buffer[] = [];
    let offset = 0;
    for (const size of chunkSizes) {
      chunks.push(buffer.slice(offset, offset + size));
      offset += size;
    }
    if (offset < buffer.length) {
      chunks.push(buffer.slice(offset));
    }
    return chunks;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    vi.mocked(net.createConnection).mockImplementation((options: any, callback?: () => void) => {
      // Simulate async connection
      if (callback) {
        setImmediate(callback);
      }
      return mockSocket;
    });
    client = new MinimalDapClient('localhost', 5678);
  });

  afterEach(() => {
    // Shut down the client to clear any pending timers
    if (client) {
      client.shutdown();
    }
    vi.restoreAllMocks();
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      const connectPromise = client.connect();
      await connectPromise;

      expect(net.createConnection).toHaveBeenCalledWith(
        { host: 'localhost', port: 5678 },
        expect.any(Function)
      );
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection refused');
      
      // Add error handler - it should NOT be called during connection phase
      const errorHandler = vi.fn();
      client.on('error', errorHandler);
      
      // Setup mock to emit error instead of calling success callback
      vi.mocked(net.createConnection).mockImplementation((options: any, callback?: () => void) => {
        // Don't call the success callback
        // Instead, emit error after the socket is returned and handlers are attached
        setImmediate(() => {
          mockSocket.emit('error', error);
        });
        return mockSocket;
      });

      await expect(client.connect()).rejects.toThrow('Connection refused');
      // Error handler should NOT be called during connection phase
      // This prevents uncaught exceptions in the proxy process
      expect(errorHandler).not.toHaveBeenCalled();
      
      // Clean up
      client.off('error', errorHandler);
    });

    it('should emit close event when socket closes', async () => {
      await client.connect();
      const closeHandler = vi.fn();
      client.on('close', closeHandler);

      mockSocket.emit('close');

      expect(closeHandler).toHaveBeenCalled();
    });

    it('should emit error event on socket error after connection', async () => {
      await client.connect();
      const errorHandler = vi.fn();
      client.on('error', errorHandler);
      const logger = loggerInstances.at(-1)!;
      logger.error.mockClear();

      const error = new Error('Socket error');
      mockSocket.emit('error', error);

      expect(errorHandler).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith('[MinimalDapClient] Socket error:', error);
    });

    it('cleans up when socket closes after connecting', async () => {
      await client.connect();
      const cleanupSpy = vi.spyOn(client as any, 'cleanup');
      const logger = loggerInstances.at(-1)!;
      logger.info.mockClear();

      mockSocket.emit('close');

      expect(logger.info).toHaveBeenCalledWith('[MinimalDapClient] Socket closed');
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Message Parsing', () => {
    it('should parse a complete DAP message', async () => {
      await client.connect();

      const response: DebugProtocol.Response = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'initialize',
        success: true,
        body: { supportsConfigurationDoneRequest: true }
      };

      const message = createDapMessage(response);
      mockSocket.emit('data', message);

      // Message should be processed without errors
      expect(mockSocket.write).not.toHaveBeenCalled(); // No response expected for incoming data
    });

    it('should handle partial messages across multiple data events', async () => {
      await client.connect();

      const response: DebugProtocol.Response = {
        seq: 2,
        type: 'response',
        request_seq: 1,
        command: 'setBreakpoints',
        success: true,
        body: { breakpoints: [] }
      };

      const message = createDapMessage(response);
      const chunks = splitBuffer(message, [20, 30, 40]); // Split into 3 chunks

      // Send chunks
      for (const chunk of chunks) {
        mockSocket.emit('data', chunk);
      }

      // Message should be processed correctly despite being split
    });

    it('should handle multiple messages in one data event', async () => {
      await client.connect();

      const response1: DebugProtocol.Response = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'initialize',
        success: true
      };

      const response2: DebugProtocol.Response = {
        seq: 2,
        type: 'response',
        request_seq: 2,
        command: 'launch',
        success: true
      };

      const message1 = createDapMessage(response1);
      const message2 = createDapMessage(response2);
      const combined = Buffer.concat([message1, message2]);

      mockSocket.emit('data', combined);

      // Both messages should be processed
    });

    it('should handle malformed headers gracefully', async () => {
      await client.connect();

      // Send data with invalid header
      const invalidData = Buffer.from('Invalid-Header: test\r\n\r\n{"type":"event"}');
      mockSocket.emit('data', invalidData);

      // Should skip the malformed header and continue
    });

    it('should handle invalid JSON gracefully', async () => {
      await client.connect();
      const logger = loggerInstances.at(-1)!;
      logger.error.mockClear();

      const invalidJson = 'Content-Length: 20\r\n\r\n{invalid json content';
      mockSocket.emit('data', Buffer.from(invalidJson));

      expect(logger.error).toHaveBeenCalledWith('[MinimalDapClient] Error parsing message:', expect.any(Error));
    });

    it('logs a warning and drops payload when Content-Length header is non-numeric', async () => {
      await client.connect();
      const logger = loggerInstances.at(-1)!;
      logger.warn.mockClear();
      const protocolSpy = vi.spyOn(client as any, 'handleProtocolMessage');

      const payload = Buffer.from('Content-Length: abc\r\n\r\n{"type":"event","seq":1,"event":"output"}');
      (client as unknown as { handleData(data: Buffer): void }).handleData(payload);

      expect(logger.warn).toHaveBeenCalledWith(
        '[MinimalDapClient] Invalid Content-Length header encountered; discarding payload'
      );
      expect(protocolSpy).not.toHaveBeenCalled();
      expect((client as unknown as { rawData: Buffer }).rawData.length).toBe(0);
      protocolSpy.mockRestore();
    });

    it('logs a warning and drops payload for zero or negative Content-Length values', async () => {
      await client.connect();
      const logger = loggerInstances.at(-1)!;
      logger.warn.mockClear();

      const zeroHeader = Buffer.from('Content-Length: 0\r\n\r\n{}');
      const negativeHeader = Buffer.from('Content-Length: -5\r\n\r\n{}');

      (client as unknown as { handleData(data: Buffer): void }).handleData(zeroHeader);
      (client as unknown as { handleData(data: Buffer): void }).handleData(negativeHeader);

      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenNthCalledWith(
        1,
        '[MinimalDapClient] Invalid Content-Length header encountered; discarding payload'
      );
      expect(logger.warn).toHaveBeenNthCalledWith(
        2,
        '[MinimalDapClient] Invalid Content-Length header encountered; discarding payload'
      );
      expect((client as unknown as { rawData: Buffer }).rawData.length).toBe(0);
    });

    it('should handle incomplete message body', async () => {
      await client.connect();

      // Send header but incomplete body
      const incompleteStart = '{"type":"response"';
      const incompleteMessage = `Content-Length: 100\r\n\r\n${incompleteStart}`;
      mockSocket.emit('data', Buffer.from(incompleteMessage));

      // Should wait for more data
      // Send the rest
      const restOfMessage = ',"seq":1,"request_seq":1,"command":"test","success":true}';
      const fullJson = incompleteStart + restOfMessage;
      const padding = ' '.repeat(100 - fullJson.length); // Pad to match Content-Length
      mockSocket.emit('data', Buffer.from(restOfMessage + padding));
    });
  });

  describe('Request/Response Handling', () => {
    it('should send requests with correct format', async () => {
      await client.connect();

      const args = { source: { path: 'test.py' }, breakpoints: [] };
      // Don't await - we're testing the request format, not the response
      // But we need to handle the promise to avoid unhandled rejection
      const requestPromise = client.sendRequest('setBreakpoints', args);
      
      // Handle the promise but don't await it yet
      requestPromise.catch(() => {}); // Prevent unhandled rejection

      expect(mockSocket.write).toHaveBeenCalled();
      const writeCall = mockSocket.write.mock.calls[0][0];
      
      // Verify header format
      expect(writeCall).toMatch(/^Content-Length: \d+\r\n\r\n/);
      
      // Extract and verify JSON
      const jsonStart = writeCall.indexOf('\r\n\r\n') + 4;
      const json = JSON.parse(writeCall.substring(jsonStart));
      expect(json).toMatchObject({
        seq: 1,
        type: 'request',
        command: 'setBreakpoints',
        arguments: args
      });
    });

    it('should correlate responses with requests', async () => {
      await client.connect();

      // Send request
      const requestPromise = client.sendRequest('initialize', { clientID: 'test' });

      // Simulate response
      const response: DebugProtocol.Response = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'initialize',
        success: true,
        body: { supportsConfigurationDoneRequest: true }
      };

      mockSocket.emit('data', createDapMessage(response));

      const result = await requestPromise;
      expect(result).toEqual(response);
    });

    it('should handle request failure', async () => {
      await client.connect();

      const requestPromise = client.sendRequest('launch', { program: 'test.py' });

      const errorResponse: DebugProtocol.Response = {
        seq: 2,
        type: 'response',
        request_seq: 1,
        command: 'launch',
        success: false,
        message: 'Failed to launch'
      };

      mockSocket.emit('data', createDapMessage(errorResponse));

      await expect(requestPromise).rejects.toThrow('Failed to launch');
    });

    it('should handle concurrent requests', async () => {
      await client.connect();

      // Send multiple requests
      const request1 = client.sendRequest('threads');
      const request2 = client.sendRequest('stackTrace', { threadId: 1 });
      const request3 = client.sendRequest('scopes', { frameId: 1 });

      // Respond out of order
      const response2: DebugProtocol.Response = {
        seq: 2,
        type: 'response',
        request_seq: 2,
        command: 'stackTrace',
        success: true,
        body: { stackFrames: [] }
      };

      const response3: DebugProtocol.Response = {
        seq: 3,
        type: 'response',
        request_seq: 3,
        command: 'scopes',
        success: true,
        body: { scopes: [] }
      };

      const response1: DebugProtocol.Response = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'threads',
        success: true,
        body: { threads: [] }
      };

      mockSocket.emit('data', createDapMessage(response2));
      mockSocket.emit('data', createDapMessage(response3));
      mockSocket.emit('data', createDapMessage(response1));

      const [result1, result2, result3] = await Promise.all([request1, request2, request3]);
      expect(result1.command).toBe('threads');
      expect(result2.command).toBe('stackTrace');
      expect(result3.command).toBe('scopes');
    });

    it('should timeout requests after 30 seconds', async () => {
      // Recreate client with deterministic timers so the 30s timeout fires immediately
      client.shutdown();
      const fakeTimers = {
        setTimeout: ((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
          if (delay === 30000) {
            return setTimeout(() => callback(...args), 0);
          }
          return setTimeout(callback, delay, ...args);
        }) as typeof setTimeout,
        clearTimeout: ((timer: NodeJS.Timeout) => {
          clearTimeout(timer);
        }) as typeof clearTimeout
      };
      client = new MinimalDapClient('localhost', 5678, undefined, { timers: fakeTimers });

      await client.connect();

      await expect(
        client.sendRequest('evaluate', { expression: 'test' })
      ).rejects.toThrow("DAP request 'evaluate' (seq 1) timed out");

      const lateResponse: DebugProtocol.Response = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'evaluate',
        success: true,
        body: { result: 'too late' }
      };

      mockSocket.emit('data', createDapMessage(lateResponse));
    });

    it('should handle unknown response sequences', async () => {
      await client.connect();

      const response: DebugProtocol.Response = {
        seq: 99,
        type: 'response',
        request_seq: 999, // Unknown request_seq
        command: 'unknown',
        success: true
      };

      // Should not throw, just warn
      mockSocket.emit('data', createDapMessage(response));
    });

    it('should reject request if socket is destroyed', async () => {
      await client.connect();
      mockSocket.destroyed = true;

      await expect(client.sendRequest('test')).rejects.toThrow('Socket not connected or destroyed');
    });
  });

  describe('Event Handling', () => {
    it('should emit DAP events', async () => {
      await client.connect();

      const outputHandler = vi.fn();
      const genericHandler = vi.fn();
      client.on('output', outputHandler);
      client.on('event', genericHandler);

      const outputEvent: DebugProtocol.OutputEvent = {
        seq: 1,
        type: 'event',
        event: 'output',
        body: {
          category: 'console',
          output: 'Hello, world!\n'
        }
      };

      mockSocket.emit('data', createDapMessage(outputEvent));

      expect(outputHandler).toHaveBeenCalledWith(outputEvent.body);
      expect(genericHandler).toHaveBeenCalledWith(outputEvent);
    });

    it('should emit multiple event types', async () => {
      await client.connect();

      const stoppedHandler = vi.fn();
      const threadHandler = vi.fn();
      client.on('stopped', stoppedHandler);
      client.on('thread', threadHandler);

      const stoppedEvent: DebugProtocol.StoppedEvent = {
        seq: 1,
        type: 'event',
        event: 'stopped',
        body: {
          reason: 'breakpoint',
          threadId: 1,
          preserveFocusHint: false,
          allThreadsStopped: true
        }
      };

      const threadEvent: DebugProtocol.ThreadEvent = {
        seq: 2,
        type: 'event',
        event: 'thread',
        body: {
          reason: 'started',
          threadId: 1
        }
      };

      mockSocket.emit('data', createDapMessage(stoppedEvent));
      mockSocket.emit('data', createDapMessage(threadEvent));

      expect(stoppedHandler).toHaveBeenCalledWith(stoppedEvent.body);
      expect(threadHandler).toHaveBeenCalledWith(threadEvent.body);
    });
  });

  describe('Disconnection', () => {
    it('should disconnect gracefully', async () => {
      await client.connect();

      client.disconnect();

      expect(mockSocket.end).toHaveBeenCalled();
      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    it('should reject pending requests on disconnect', async () => {
      await client.connect();

      const request1 = client.sendRequest('threads');
      const request2 = client.sendRequest('evaluate', { expression: 'test' });

      client.disconnect();

      await expect(request1).rejects.toThrow('DAP client disconnected');
      await expect(request2).rejects.toThrow('DAP client disconnected');
    });

    it('should handle multiple disconnect calls', async () => {
      await client.connect();

      client.disconnect();
      client.disconnect(); // Second call should be idempotent

      expect(mockSocket.end).toHaveBeenCalledTimes(1);
      expect(mockSocket.destroy).toHaveBeenCalledTimes(1);
    });

    it('should remove all event listeners on disconnect', async () => {
      await client.connect();

      const handler = vi.fn();
      client.on('output', handler);
      client.on('stopped', handler);
      
      client.disconnect();

      // Verify no listeners remain
      expect(client.listenerCount('output')).toBe(0);
      expect(client.listenerCount('stopped')).toBe(0);
    });

    it('should handle disconnect when socket already destroyed', async () => {
      await client.connect();
      mockSocket.destroyed = true;

      client.disconnect();

      // Should not throw
      expect(mockSocket.end).not.toHaveBeenCalled();
    });
  });

  describe('Socket Backpressure', () => {
    it('should handle socket write returning false', async () => {
      await client.connect();
      
      // Simulate backpressure
      mockSocket.write.mockReturnValue(false);

      // Should still accept the request (current implementation doesn't handle backpressure)
      const promise = client.sendRequest('test');
      
      expect(mockSocket.write).toHaveBeenCalled();
      
      // Simulate response
      const response: DebugProtocol.Response = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'test',
        success: true
      };
      
      mockSocket.emit('data', createDapMessage(response));
      await expect(promise).resolves.toEqual(response);
    });
  });

  describe('Large Message Handling', () => {
    it('should handle large messages split across chunks', async () => {
      await client.connect();

      // Create a large body
      const largeBody = {
        data: 'x'.repeat(10000),
        items: Array(100).fill({ id: 1, name: 'test' })
      };

      const response: DebugProtocol.Response = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'variables',
        success: true,
        body: largeBody
      };

      const message = createDapMessage(response);
      
      // Split into many small chunks
      const chunkSize = 100;
      const chunks: Buffer[] = [];
      for (let i = 0; i < message.length; i += chunkSize) {
        chunks.push(message.slice(i, Math.min(i + chunkSize, message.length)));
      }

      // Send all chunks
      for (const chunk of chunks) {
        mockSocket.emit('data', chunk);
      }

      // Message should be processed correctly
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data events', async () => {
      await client.connect();

      mockSocket.emit('data', Buffer.from(''));

      // Should not crash
    });

    it('should handle messages with no command in response', async () => {
      await client.connect();

      const malformedResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        success: true
        // Missing command field
      };

      mockSocket.emit('data', createDapMessage(malformedResponse));

      // Should handle gracefully
    });

    it('should handle unknown message types', async () => {
      await client.connect();

      const unknownMessage = {
        seq: 1,
        type: 'unknown',
        data: 'test'
      };

      mockSocket.emit('data', createDapMessage(unknownMessage));

      // Should log warning but not crash
    });
  });


  describe('Shutdown behaviour', () => {
    it('clears pending requests when socket write callback reports an error', async () => {
      await client.connect();
      const originalWrite = mockSocket.write;
      mockSocket.write = vi.fn((_message: string, cb?: (err?: Error | null) => void) => {
        cb?.(new Error('write failed'));
        return false;
      });

      await expect(client.sendRequest('threads')).rejects.toThrow('write failed');
      expect((client as unknown as { pendingRequests: Map<number, unknown> }).pendingRequests.size).toBe(0);
      mockSocket.write = originalWrite;
    });

    it('logs an error when writeMessage executes without an active socket', () => {
      const orphanClient = new MinimalDapClient('localhost', 4500);
      const logger = loggerInstances.at(-1)!;
      const errorSpy = vi.spyOn(logger, 'error');

      (orphanClient as unknown as { socket: net.Socket | null }).socket = {
        destroyed: true,
        write: vi.fn()
      } as unknown as net.Socket;

      (orphanClient as unknown as { writeMessage(message: DebugProtocol.ProtocolMessage): void }).writeMessage({
        type: 'request',
        seq: 1,
        command: 'evaluate',
        arguments: {}
      } as DebugProtocol.Request);

      expect(errorSpy).toHaveBeenCalledWith('[MinimalDapClient] Cannot write message, socket not connected/destroyed');
      orphanClient.shutdown();
      errorSpy.mockRestore();
    });

    it('logs a warning when child shutdown throws during parent shutdown', () => {
      const child = {
        shutdown: vi.fn().mockImplementation(() => {
          throw new Error('child boom');
        })
      } as unknown as MinimalDapClient;

      (client as unknown as { childSessions: Map<string, MinimalDapClient> }).childSessions.set('child', child);
      (client as unknown as { activeChild: MinimalDapClient | null }).activeChild = child;

      const logger = loggerInstances.at(-1)!;
      logger.warn.mockClear();

      client.shutdown('test');

      expect(logger.warn).toHaveBeenCalledWith(
        '[MinimalDapClient] Error shutting down child sessions:',
        'child boom'
      );
      expect((client as unknown as { childSessions: Map<string, MinimalDapClient> }).childSessions.size).toBe(0);
      expect((client as unknown as { activeChild: MinimalDapClient | null }).activeChild).toBeNull();
    });

    it('logs debug when shutdown is invoked after disconnect has begun', () => {
      const logger = loggerInstances.at(-1)!;
      client.shutdown('initial');
      logger.debug.mockClear();

      client.shutdown('duplicate');

      expect(logger.debug).toHaveBeenCalledWith('[MinimalDapClient] Already disconnecting or disconnected');
    });
  });

  describe('Configuration deferral', () => {
    it('should defer configurationDone when deferral is active and flush on timeout', async () => {
      client.shutdown();

      const realSetTimeout = global.setTimeout;
      const fakeSetTimeout: typeof setTimeout = ((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
        const actualDelay = delay ?? 0;
        if (actualDelay === 1500) {
          return realSetTimeout(() => {
            callback(...args);
          }, 0);
        }
        return realSetTimeout(callback as (...cbArgs: unknown[]) => void, actualDelay, ...args);
      }) as typeof setTimeout;
      const fakeClearTimeout: typeof clearTimeout = ((timer: NodeJS.Timeout) => {
        clearTimeout(timer);
      }) as typeof clearTimeout;

      client = new MinimalDapClient('localhost', 5678, undefined, {
        timers: {
          setTimeout: fakeSetTimeout,
          clearTimeout: fakeClearTimeout
        }
      });

      const requests: DebugProtocol.Request[] = [];
      const fakeSocket = Object.assign(new EventEmitter(), {
        destroyed: false,
        write: vi.fn((raw: string, cb?: (err?: Error | null) => void) => {
          const [, body] = raw.split('\r\n\r\n');
          const request = JSON.parse(body) as DebugProtocol.Request;
          requests.push(request);
          cb?.(null);
          setImmediate(() => {
            void (client as any).handleProtocolMessage({
              seq: request.seq,
              type: 'response',
              request_seq: request.seq,
              command: request.command,
              success: true
            } satisfies DebugProtocol.Response);
          });
          return true;
        }),
        end: vi.fn(),
        destroy: vi.fn()
      }) as unknown as net.Socket;

      (client as any).socket = fakeSocket;
      (client as any).deferParentConfigDoneActive = true;

      const result = await client.sendRequest<DebugProtocol.Response>('configurationDone', { foo: 'bar' });

      expect(result.command).toBe('configurationDone');
      expect(fakeSocket.write).toHaveBeenCalledTimes(1);
      expect(requests[0]?.command).toBe('configurationDone');
      expect((client as any).parentConfigDoneDeferred).toBeNull();
      expect((client as any).suppressNextConfigDoneDeferral).toBe(false);
    });
  });

  describe('Child session integration', () => {
    it('tracks child lifecycle events reported by ChildSessionManager', () => {
      const stubManager = createChildSessionManagerStub();
      const client = new MinimalDapClient(
        'localhost',
        5678,
        JsDebugAdapterPolicy,
        {
          childSessionManagerFactory: () => stubManager as unknown as ChildSessionManager
        }
      );

      const fakeChild = {} as unknown as MinimalDapClient;
      stubManager.emit('childCreated', 'child-1', fakeChild);

      expect((client as any).childSessions.get('child-1')).toBe(fakeChild);
      expect((client as any).activeChild).toBe(fakeChild);

      const specificHandler = vi.fn();
      const genericHandler = vi.fn();
      client.on('initialized', specificHandler);
      client.on('event', genericHandler);

      const evt: DebugProtocol.Event = { seq: 1, type: 'event', event: 'initialized', body: { ready: true } };
      stubManager.emit('childEvent', evt);

      expect(specificHandler).toHaveBeenCalledWith({ ready: true });
      expect(genericHandler).toHaveBeenCalledWith(evt);

      stubManager.emit('childClosed');
      expect((client as any).childSessions.size).toBe(0);
      expect((client as any).activeChild).toBeNull();
    });

    it('appends trace output when DAP_TRACE_FILE is set', async () => {
      const originalTrace = process.env.DAP_TRACE_FILE;
      process.env.DAP_TRACE_FILE = 'trace.ndjson';
      const appendSpy = vi.spyOn(fs, 'appendFileSync').mockImplementation(() => undefined);

      const client = new MinimalDapClient('localhost', 5678);
      const fakeSocket = {
        destroyed: false,
        write: vi.fn((raw: string, cb?: (err?: Error | null) => void) => {
          cb?.(null);
          setImmediate(() => {
            const [, body] = raw.split('\r\n\r\n');
            const request = JSON.parse(body) as DebugProtocol.Request;
            void (client as any).handleProtocolMessage({
              seq: request.seq,
              type: 'response',
              request_seq: request.seq,
              command: request.command,
              success: true
            } satisfies DebugProtocol.Response);
          });
          return true;
        }),
        end: vi.fn(),
        destroy: vi.fn()
      } as unknown as net.Socket;

      (client as any).socket = fakeSocket;

      await client.sendRequest('threads');

      expect(appendSpy).toHaveBeenCalled();

      appendSpy.mockRestore();
      client.shutdown();
      if (originalTrace === undefined) {
        delete process.env.DAP_TRACE_FILE;
      } else {
        process.env.DAP_TRACE_FILE = originalTrace;
      }
    });

    it('should delegate startDebugging adoption to ChildSessionManager when policy requests it', async () => {
      const stubManager = createChildSessionManagerStub();
      const client = new MinimalDapClient(
        'localhost',
        5678,
        JsDebugAdapterPolicy,
        {
          childSessionManagerFactory: () => stubManager as unknown as ChildSessionManager
        }
      );

      const request: DebugProtocol.Request = {
        seq: 1,
        type: 'request',
        command: 'startDebugging',
        arguments: {
          configuration: {
            __pendingTargetId: 'pending-target-1'
          }
        }
      };

      await (client as any).handleProtocolMessage(request);

      expect(stubManager.createChildSession).toHaveBeenCalledWith(
        expect.objectContaining({ pendingId: 'pending-target-1' })
      );
    });

    it('should mirror breakpoints to ChildSessionManager during sendRequest', async () => {
      const stubManager = createChildSessionManagerStub();
      const client = new MinimalDapClient(
        'localhost',
        5678,
        JsDebugAdapterPolicy,
        {
          childSessionManagerFactory: () => stubManager as unknown as ChildSessionManager
        }
      );

      const fakeSocket = {
        write: vi.fn((_: string, cb?: (err?: Error | null) => void) => {
          if (cb) cb(null);
          return true;
        }),
        destroyed: false
      } as unknown as net.Socket;

      (client as any).socket = fakeSocket;

      const breakpointArgs = {
        source: { path: './foo.js' },
        breakpoints: [{ line: 10 }]
      };

      const sendPromise = client.sendRequest('setBreakpoints', breakpointArgs);

      await (client as any).handleProtocolMessage({
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'setBreakpoints',
        success: true
      });

      await expect(sendPromise).resolves.toEqual(
        expect.objectContaining({ command: 'setBreakpoints', success: true })
      );

      expect(stubManager.storeBreakpoints).toHaveBeenCalledWith(
        expect.stringContaining('foo.js'),
        expect.arrayContaining([expect.objectContaining({ line: 10 })])
      );
    });

    it('should route child-scoped commands to the active child session', async () => {
      const stubManager = createChildSessionManagerStub();
      stubManager.shouldRouteToChild.mockReturnValue(true);

      const childResponse: DebugProtocol.Response = {
        seq: 42,
        type: 'response',
        request_seq: 1,
        command: 'threads',
        success: true
      };

      const childClient = {
        sendRequest: vi.fn().mockResolvedValue(childResponse)
      } as unknown as MinimalDapClient;

      const routedClient = new MinimalDapClient(
        'localhost',
        5678,
        JsDebugAdapterPolicy,
        {
          childSessionManagerFactory: () => stubManager as unknown as ChildSessionManager
        }
      );

      (routedClient as any).socket = {
        destroyed: false,
        write: vi.fn()
      } as unknown as net.Socket;
      (routedClient as any).activeChild = childClient;

      const result = await routedClient.sendRequest<DebugProtocol.Response>('threads');

      expect(stubManager.shouldRouteToChild).toHaveBeenCalledWith('threads');
      expect(childClient.sendRequest).toHaveBeenCalledWith('threads', undefined, 30000);
      expect(result).toEqual(childResponse);
    });

    it('waits for child session before sending stackTrace when policy requires child', async () => {
      const stubManager = createChildSessionManagerStub();
      stubManager.shouldRouteToChild.mockReturnValue(true);
      let pollCount = 0;
      const childClient = {
        sendRequest: vi.fn().mockResolvedValue({
          seq: 7,
          type: 'response',
          request_seq: 1,
          command: 'stackTrace',
          success: true,
          body: { stackFrames: [{ id: 1 }] }
        } as DebugProtocol.Response)
      } as unknown as MinimalDapClient;

      stubManager.getActiveChild.mockImplementation(() => {
        pollCount += 1;
        return pollCount >= 3 ? childClient : null;
      });
      stubManager.isAdoptionInProgress.mockImplementation(() => pollCount < 3);

      const routedClient = new MinimalDapClient(
        'localhost',
        5678,
        JsDebugAdapterPolicy,
        {
          childSessionManagerFactory: () => stubManager as unknown as ChildSessionManager
        }
      );

      (routedClient as any).socket = {
        destroyed: false,
        write: vi.fn().mockReturnValue(true)
      } as unknown as net.Socket;
      (routedClient as any).sleep = vi.fn().mockImplementation(async () => {});

      const result = await routedClient.sendRequest<DebugProtocol.Response>('stackTrace', { threadId: 1 });

      expect(stubManager.shouldRouteToChild).toHaveBeenCalledWith('stackTrace');
      expect((routedClient as any).sleep).toHaveBeenCalled();
      expect(childClient.sendRequest).toHaveBeenCalledWith('stackTrace', { threadId: 1 }, 30000);
      expect(result.success).toBe(true);
      expect((routedClient as any).socket.write).not.toHaveBeenCalled();
    });

    it('returns a synthetic error when stackTrace child session never becomes ready', async () => {
      const stubManager = createChildSessionManagerStub();
      stubManager.shouldRouteToChild.mockReturnValue(true);
      stubManager.isAdoptionInProgress.mockReturnValue(true);
      stubManager.getActiveChild.mockReturnValue(null);

      const routedClient = new MinimalDapClient(
        'localhost',
        5678,
        JsDebugAdapterPolicy,
        {
          childSessionManagerFactory: () => stubManager as unknown as ChildSessionManager
        }
      );

      (routedClient as any).dapBehavior.childInitTimeout = 100;
      (routedClient as any).socket = {
        destroyed: false,
        write: vi.fn().mockReturnValue(true)
      } as unknown as net.Socket;
      (routedClient as any).sleep = vi.fn().mockImplementation(async () => {});

      const response = await routedClient.sendRequest<DebugProtocol.Response>('stackTrace');

      expect(response.success).toBe(false);
      expect(response.command).toBe('stackTrace');
      expect(response.message).toContain('Child session not ready');
      expect((routedClient as any).socket.write).not.toHaveBeenCalled();
    });
  });

  describe('Reverse request handling', () => {
    it('acknowledges runInTerminal requests when no policy handler is registered', async () => {
      const client = new MinimalDapClient('localhost', 5678);

      (client as any).dapBehavior = {} as DapClientBehavior;
      (client as any).socket = { destroyed: false, write: vi.fn().mockReturnValue(true) } as unknown as net.Socket;
      const responseSpy = vi.spyOn(client as any, 'sendResponse');

      const request = {
        seq: 1,
        type: 'request',
        command: 'runInTerminal'
      } as DebugProtocol.Request;

      await (client as any).handleProtocolMessage(request);

      expect(responseSpy).toHaveBeenCalledWith(request, {});
    });

    it('responds to unknown reverse requests with success when unhandled', async () => {
      const client = new MinimalDapClient('localhost', 5678);

      (client as any).dapBehavior = { handleReverseRequest: undefined } as DapClientBehavior;
      (client as any).socket = { destroyed: false, write: vi.fn().mockReturnValue(true) } as unknown as net.Socket;
      const responseSpy = vi.spyOn(client as any, 'sendResponse');

      const request = {
        seq: 2,
        type: 'request',
        command: 'customAdapterCommand'
      } as DebugProtocol.Request;

      await (client as any).handleProtocolMessage(request);

      expect(responseSpy).toHaveBeenCalledWith(request, {});
    });

    it('delegates to policy handler and respects handled responses', async () => {
      const childSessionManager = createChildSessionManagerStub();

      expect(typeof (childSessionManager as any).on).toBe('function');

      const handledBehavior: DapClientBehavior = {
        handleReverseRequest: vi.fn().mockResolvedValue({ handled: true })
      };

      const client = new MinimalDapClient('localhost', 5678);

      (client as any).childSessionManager = childSessionManager;

      (client as any).dapBehavior = handledBehavior;
      (client as any).sendResponse = vi.fn();
      (client as any).socket = { destroyed: false, write: vi.fn() } as unknown as net.Socket;

      const request = {
        seq: 1,
        type: 'request',
        command: 'startDebugging'
      } as DebugProtocol.Request;

      await (client as any).handleProtocolMessage(request);

      expect(handledBehavior.handleReverseRequest).toHaveBeenCalled();
      expect(childSessionManager.createChildSession).not.toHaveBeenCalled();
      expect((client as any).sendResponse).not.toHaveBeenCalled();
    });

    it('invokes child creation and defers configuration when policy demands', async () => {
      const child = Object.assign(new EventEmitter(), {
        sendRequest: vi.fn().mockResolvedValue({})
      }) as unknown as MinimalDapClient;

      const childSessionManager = createChildSessionManagerStub();
      childSessionManager.getActiveChild.mockReturnValue(child);

      const deferBehavior: DapClientBehavior = {
        handleReverseRequest: vi.fn().mockResolvedValue({
          handled: true,
          createChildSession: true,
          childConfig: { pendingId: 'child-1', parentConfig: { __pendingTargetId: 'child-1' } }
        } as ReverseRequestResult),
        deferParentConfigDone: true
      };

      const client = new MinimalDapClient('localhost', 5678);

      (client as any).dapBehavior = deferBehavior;
      (client as any).socket = { destroyed: false, write: vi.fn() } as unknown as net.Socket;
      (client as any).childSessionManager = childSessionManager;

      const request = {
        seq: 1,
        type: 'request',
        command: 'startDebugging',
        arguments: { configuration: { __pendingTargetId: 'child-1' } }
      } as DebugProtocol.Request;

      await (client as any).handleProtocolMessage(request);

      expect(childSessionManager.createChildSession).toHaveBeenCalledWith({
        pendingId: 'child-1',
        parentConfig: { __pendingTargetId: 'child-1' }
      });
      expect((client as any).deferParentConfigDoneActive).toBe(true);
      expect((client as any).activeChild).toBe(child);
    });

    it('falls back to default response when policy throws', async () => {
      const childSessionManager = createChildSessionManagerStub();
      const failingBehavior: DapClientBehavior = {
        handleReverseRequest: vi.fn().mockRejectedValue(new Error('boom'))
      };

      const client = new MinimalDapClient('localhost', 5678);

      const responseSpy = vi.spyOn(client as any, 'sendResponse');
      (client as any).dapBehavior = failingBehavior;
      (client as any).socket = { destroyed: false, write: vi.fn().mockReturnValue(true) } as unknown as net.Socket;
      (client as any).childSessionManager = childSessionManager;

      const request = {
        seq: 1,
        type: 'request',
        command: 'runInTerminal'
      } as DebugProtocol.Request;

      await (client as any).handleProtocolMessage(request);

      expect(failingBehavior.handleReverseRequest).toHaveBeenCalled();
      expect(responseSpy).toHaveBeenCalledWith(request, {});
    });

    it('responds with default ack when policy reports unhandled request', async () => {
      const childSessionManager = createChildSessionManagerStub();
      const behavior: DapClientBehavior = {
        handleReverseRequest: vi.fn().mockResolvedValue({ handled: false })
      };

      const client = new MinimalDapClient('localhost', 5678, JsDebugAdapterPolicy, {
        childSessionManagerFactory: () => childSessionManager
      });

      const responseSpy = vi.spyOn(client as any, 'sendResponse');
      (client as any).dapBehavior = behavior;
      (client as any).socket = { destroyed: false, write: vi.fn().mockReturnValue(true) } as unknown as net.Socket;

      const request = {
        seq: 1,
        type: 'request',
        command: 'runInTerminal'
      } as DebugProtocol.Request;

      await (client as any).handleProtocolMessage(request);

      expect(behavior.handleReverseRequest).toHaveBeenCalled();
      expect(responseSpy).toHaveBeenCalledWith(request, {});
    });

    it('logs child session creation errors without throwing', async () => {
      const childSessionManager = createChildSessionManagerStub();
      childSessionManager.createChildSession.mockRejectedValue(new Error('no child'));
      const behavior: DapClientBehavior = {
        handleReverseRequest: vi.fn().mockResolvedValue({
          handled: true,
          createChildSession: true,
          childConfig: { pendingId: 'child-err', parentConfig: {} }
        } as ReverseRequestResult),
        deferParentConfigDone: true
      };

      const client = new MinimalDapClient('localhost', 5678, JsDebugAdapterPolicy, {
        childSessionManagerFactory: () => childSessionManager
      });

      (client as any).dapBehavior = behavior;
      (client as any).socket = { destroyed: false, write: vi.fn().mockReturnValue(true) } as unknown as net.Socket;

      const request = {
        seq: 1,
        type: 'request',
        command: 'startDebugging',
        arguments: { configuration: { __pendingTargetId: 'child-err' } }
      } as DebugProtocol.Request;

      await expect((client as any).handleProtocolMessage(request)).resolves.toBeUndefined();

      expect(childSessionManager.createChildSession).toHaveBeenCalledWith({
        pendingId: 'child-err',
        parentConfig: {}
      });
      expect((client as any).deferParentConfigDoneActive).toBe(false);
      expect(behavior.handleReverseRequest).toHaveBeenCalled();
    });
  });

  describe('Initialization helpers', () => {
    it('resolves waitInitialized quietly when timeout elapses', async () => {
      const scheduled: Array<() => void> = [];
      const fakeTimers = {
        setTimeout: vi.fn((cb: (...args: unknown[]) => void) => {
          scheduled.push(cb as () => void);
          return Symbol('timer') as unknown as NodeJS.Timeout;
        }),
        clearTimeout: vi.fn()
      };

      const timeoutClient = new MinimalDapClient('localhost', 9000, undefined, {
        timers: fakeTimers
      });

      const waitPromise = (timeoutClient as any).waitInitialized(25);

      expect(fakeTimers.setTimeout).toHaveBeenCalled();
      expect(scheduled).toHaveLength(1);
      scheduled[0]!();

      await expect(waitPromise).resolves.toBeUndefined();
      timeoutClient.shutdown();
    });
  });

  describe('Request error handling and resilience', () => {
    it('rejects sendRequest when socket write fails and clears pending entry', async () => {
      const failingClient = new MinimalDapClient('localhost', 8787);
      const socket = {
        destroyed: false,
        end: vi.fn(),
        destroy: vi.fn(),
        write: vi.fn((_payload: string, cb?: (err?: Error | null) => void) => {
          cb?.(new Error('write failed'));
        })
      } as unknown as net.Socket;
      (failingClient as any).socket = socket;

      await expect(failingClient.sendRequest('threads', undefined, 50)).rejects.toThrow('write failed');
      expect(socket.write).toHaveBeenCalled();
      expect((failingClient as any).pendingRequests.size).toBe(0);

      failingClient.shutdown();
    });

    it('rejects sendRequest when socket is missing', async () => {
      const missingSocketClient = new MinimalDapClient('localhost', 8788);

      await expect(missingSocketClient.sendRequest('initialize')).rejects.toThrow('Socket not connected or destroyed');
      expect((missingSocketClient as any).pendingRequests.size).toBe(0);

      missingSocketClient.shutdown();
    });

    it('logs when writeMessage is invoked without an active socket', () => {
      const loggingClient = new MinimalDapClient('localhost', 8789);
      (loggingClient as any).socket = { destroyed: true } as net.Socket;

      const logger = loggerInstances.at(-1);
      expect(logger).toBeDefined();
      const errorSpy = vi.spyOn(logger as MockLoggerInstance, 'error');

      (loggingClient as any).writeMessage({
        type: 'event',
        seq: 1,
        event: 'terminated'
      } as DebugProtocol.Event);

      expect(errorSpy).toHaveBeenCalledWith(
        '[MinimalDapClient] Cannot write message, socket not connected/destroyed'
      );

      loggingClient.shutdown();
    });
  });

});
