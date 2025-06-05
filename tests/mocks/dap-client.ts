// @ts-nocheck
/**
 * Mock implementation of the Debug Adapter Protocol (DAP) client
 * 
 * This provides a consistent mock implementation for the DAP client
 * used throughout the debugger tests.
 */
import { vi } from 'vitest';
import { EventEmitter } from 'events';

// Events tracked by the client
export type DapEvent = 
  | 'initialized' 
  | 'stopped' 
  | 'continued' 
  | 'exited' 
  | 'terminated' 
  | 'thread' 
  | 'output'
  | 'breakpoint'
  | 'module'
  | 'loadedSource'
  | 'process'
  | 'capabilities'
  | 'progressStart'
  | 'progressUpdate'
  | 'progressEnd'
  | 'invalidated'
  | 'memory'
  | 'error'
  | 'close';

/**
 * Mock implementation of DebugAdapterClient used in tests
 */
export class MockDapClient extends EventEmitter {
  // Client methods
  public connect = vi.fn().mockResolvedValue(undefined);
  public disconnect = vi.fn().mockResolvedValue(undefined);
  public sendRequest = vi.fn().mockResolvedValue({});
  
  // Event handlers
  private eventHandlers: Map<string, Function[]> = new Map();
  
  constructor() {
    super();
    
    // Create a wrapper around the on method to track registered handlers
    this.on = vi.fn().mockImplementation((event: string, handler: Function) => {
      if (!this.eventHandlers.has(event)) {
        this.eventHandlers.set(event, []);
      }
      
      this.eventHandlers.get(event)?.push(handler);
      return super.on(event, handler);
    });
  }
  
  /**
   * Reset all mocks and clear event state
   */
  reset(): void {
    this.connect.mockReset();
    this.disconnect.mockReset();
    this.sendRequest.mockReset();
    (this.on as any).mockClear();
    
    // Clear all registered event handlers
    this.eventHandlers.clear();
    this.removeAllListeners();
    
    // Reset default implementations
    this.connect.mockResolvedValue(undefined);
    this.sendRequest.mockResolvedValue({});
  }
  
  /**
   * Set specific mock implementations for different request types
   */
  mockRequest(command: string, response: any): void {
    this.sendRequest.mockImplementation((cmd: string, ...args: any[]) => {
      if (cmd === command) {
        return Promise.resolve(response);
      }
      return Promise.resolve({}); // Default response
    });
  }
  
  /**
   * Simulate a DAP event
   */
  simulateEvent(event: DapEvent, data: any = {}): void {
    this.emit(event, data);
  }
  
  /**
   * Simulate an error during a DAP request
   */
  simulateRequestError(command: string, error: Error): void {
    this.sendRequest.mockImplementation((cmd: string, ...args: any[]) => {
      if (cmd === command) {
        return Promise.reject(error);
      }
      return Promise.resolve({}); // Default response
    });
  }
  
  /**
   * Simulate a connection error
   */
  simulateConnectionError(error: Error): void {
    this.connect.mockRejectedValueOnce(error);
  }
  
  /**
   * Get event handlers for a specific event
   */
  getEventHandlers(event: DapEvent): Function[] {
    return this.eventHandlers.get(event) || [];
  }
}

// Export a singleton instance
export const mockDapClient = new MockDapClient();

// Helper function to reset the mock client state
export const resetMockDapClient = (): void => {
  mockDapClient.reset();
};

// Export default for use with vi.mock
export default {
  DebugAdapterClient: vi.fn().mockImplementation(() => mockDapClient)
};
