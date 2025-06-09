import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import net from 'net';
import { EventEmitter } from 'events';
import { MinimalDapClient } from '../../../src/proxy/minimal-dap.js';
import { DebugProtocol } from '@vscode/debugprotocol';

// Mock the net module
vi.mock('net');

// Mock the logger
vi.mock('../../../src/utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  })
}));

describe('MinimalDapClient', () => {
  let client: MinimalDapClient;
  let mockSocket: any;

  // Helper function to create a mock socket
  const createMockSocket = () => {
    const socket = new EventEmitter() as any;
    socket.write = vi.fn().mockReturnValue(true);
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
      
      // Add error handler to prevent unhandled error
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
      expect(errorHandler).toHaveBeenCalledWith(error);
      
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

      const error = new Error('Socket error');
      mockSocket.emit('error', error);

      expect(errorHandler).toHaveBeenCalledWith(error);
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

      const invalidJson = 'Content-Length: 20\r\n\r\n{invalid json content';
      mockSocket.emit('data', Buffer.from(invalidJson));

      // Should handle the error without crashing
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
      client.sendRequest('setBreakpoints', args);

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
      await client.connect();

      // Spy on setTimeout and immediately trigger 30s timeouts
      const originalSetTimeout = global.setTimeout;
      vi.spyOn(global, 'setTimeout').mockImplementation((callback: any, delay: any, ...args: any[]) => {
        if (delay === 30000) {
          // Use setImmediate for next tick execution
          setImmediate(() => callback());
          return 123 as any; // fake timer ID
        }
        // Use real timers for everything else
        return originalSetTimeout(callback, delay, ...args);
      });

      try {
        // Send request that will timeout
        await expect(
          client.sendRequest('evaluate', { expression: 'test' })
        ).rejects.toThrow("DAP request 'evaluate' (seq 1) timed out");

        // Verify that a late response doesn't cause issues
        // Simulate a late response to ensure it's properly ignored
        const lateResponse: DebugProtocol.Response = {
          seq: 1,
          type: 'response',
          request_seq: 1,
          command: 'evaluate',
          success: true,
          body: { result: 'too late' }
        };

        // This should not throw or cause issues since the request was already rejected
        mockSocket.emit('data', createDapMessage(lateResponse));
      } finally {
        vi.restoreAllMocks();
      }
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
});
