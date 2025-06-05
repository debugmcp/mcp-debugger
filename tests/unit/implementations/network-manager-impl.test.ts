/**
 * Unit tests for NetworkManagerImpl
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import net from 'net'; // Import net here to get the mocked version
import { NetworkManagerImpl } from '../../../src/implementations/network-manager-impl.js';

// Create mock server
const mockServer = {
  listen: vi.fn(),
  close: vi.fn(),
  address: vi.fn(),
  on: vi.fn(),
  unref: vi.fn(),
  ref: vi.fn(),
  once: vi.fn(),
  emit: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
  setMaxListeners: vi.fn(),
  getMaxListeners: vi.fn(),
  listeners: vi.fn(),
  rawListeners: vi.fn(),
  listenerCount: vi.fn(),
  prependListener: vi.fn(),
  prependOnceListener: vi.fn(),
  eventNames: vi.fn(),
  off: vi.fn()
};

// Mock net module with proper implementation
vi.mock('net', () => ({
  default: {
    createServer: vi.fn(() => mockServer),
    Server: vi.fn()
  }
}));

describe('NetworkManagerImpl', () => {
  let networkManager: NetworkManagerImpl;

  beforeEach(() => {
    networkManager = new NetworkManagerImpl();
    vi.clearAllMocks();
    
    // Reset mock server methods
    Object.keys(mockServer).forEach(key => {
      if (typeof mockServer[key] === 'function') {
        mockServer[key].mockClear();
      }
    });
  });

  describe('createServer', () => {
    it('should create and return a server', () => {
      const result = networkManager.createServer();
      
      expect((net as any).createServer).toHaveBeenCalled();
      expect(result).toBe(mockServer);
    });

    it('should handle server creation errors', () => {
      (net as any).createServer.mockImplementation(() => {
        throw new Error('Failed to create server');
      });
      
      expect(() => networkManager.createServer()).toThrow('Failed to create server');
    });
  });

  describe('findFreePort', () => {
    it('should find and return a free port', async () => {
      const freePort = 12345;
      
      // Setup mock behavior
      mockServer.listen.mockImplementation(((port: number, callback?: Function) => {
        if (callback) {
          process.nextTick(() => callback());
        }
        return mockServer;
      }) as any);
      
      mockServer.address.mockReturnValue({ port: freePort });
      
      mockServer.close.mockImplementation(((callback?: Function) => {
        if (callback) {
          process.nextTick(() => callback());
        }
        return mockServer;
      }) as any);
      
      const result = await networkManager.findFreePort();
      
      expect(result).toBe(freePort);
      expect((net as any).createServer).toHaveBeenCalled();
      expect(mockServer.unref).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalledWith(0, expect.any(Function));
      expect(mockServer.close).toHaveBeenCalled();
    });

    it('should handle server listen errors', async () => {
      
      const error = new Error('Port already in use');
      mockServer.on.mockImplementation(((event: string, handler: Function) => {
        if (event === 'error') {
          process.nextTick(() => handler(error));
        }
        return mockServer;
      }) as any);
      
      mockServer.listen.mockReturnValue(mockServer);
      
      await expect(networkManager.findFreePort()).rejects.toThrow('Port already in use');
    });

    it('should handle invalid address format', async () => {
      
      mockServer.listen.mockImplementation(((port: number, callback?: Function) => {
        if (callback) {
          process.nextTick(() => callback());
        }
        return mockServer;
      }) as any);
      
      // Return string address instead of object
      mockServer.address.mockReturnValue('/tmp/socket.sock');
      
      mockServer.close.mockImplementation(((callback?: Function) => {
        if (callback) {
          process.nextTick(() => callback(new Error('Failed to get port from server address')));
        }
        return mockServer;
      }) as any);
      
      await expect(networkManager.findFreePort()).rejects.toThrow('Failed to get port from server address');
    });

    it('should handle null address', async () => {
      
      mockServer.listen.mockImplementation(((port: number, callback?: Function) => {
        if (callback) {
          process.nextTick(() => callback());
        }
        return mockServer;
      }) as any);
      
      // Return null address
      mockServer.address.mockReturnValue(null);
      
      mockServer.close.mockImplementation(((callback?: Function) => {
        if (callback) {
          process.nextTick(() => callback(new Error('Failed to get port from server address')));
        }
        return mockServer;
      }) as any);
      
      await expect(networkManager.findFreePort()).rejects.toThrow('Failed to get port from server address');
    });

    it('should clean up server resources on success', async () => {
      const freePort = 54321;
      
      mockServer.listen.mockImplementation(((port: number, callback?: Function) => {
        if (callback) {
          process.nextTick(() => callback());
        }
        return mockServer;
      }) as any);
      
      mockServer.address.mockReturnValue({ port: freePort, family: 'IPv4', address: '0.0.0.0' });
      
      let closeCallbackCalled = false;
      mockServer.close.mockImplementation(((callback?: Function) => {
        closeCallbackCalled = true;
        if (callback) {
          process.nextTick(() => callback());
        }
        return mockServer;
      }) as any);
      
      const result = await networkManager.findFreePort();
      
      expect(result).toBe(freePort);
      expect(closeCallbackCalled).toBe(true);
      expect(mockServer.unref).toHaveBeenCalled();
    });
  });
});
