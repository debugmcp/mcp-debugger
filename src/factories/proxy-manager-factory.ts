/**
 * Factory for creating ProxyManager instances
 * Enables dependency injection and easy mocking for tests
 */
import { IProxyManager, ProxyManager } from '../proxy/proxy-manager.js';
import { IProxyProcessLauncher } from '../interfaces/process-interfaces.js';
import { IFileSystem, ILogger } from '../interfaces/external-dependencies.js';

/**
 * Interface for ProxyManager factory
 */
export interface IProxyManagerFactory {
  create(): IProxyManager;
}

/**
 * Production implementation of ProxyManager factory
 */
export class ProxyManagerFactory implements IProxyManagerFactory {
  constructor(
    private proxyProcessLauncher: IProxyProcessLauncher,
    private fileSystem: IFileSystem,
    private logger: ILogger
  ) {}
  
  create(): IProxyManager {
    return new ProxyManager(
      this.proxyProcessLauncher,
      this.fileSystem,
      this.logger
    );
  }
}

/**
 * Mock implementation of ProxyManager factory for testing
 */
export class MockProxyManagerFactory implements IProxyManagerFactory {
  public createdManagers: MockProxyManager[] = [];
  
  create(): IProxyManager {
    const manager = new MockProxyManager();
    this.createdManagers.push(manager);
    return manager;
  }
}

/**
 * Mock ProxyManager for testing
 * Implements the IProxyManager interface with mock behavior
 */
export class MockProxyManager implements IProxyManager {
  public sessionId: string | null = null;
  public isRunningState = false;
  public currentThreadId: number | null = null;
  
  // Track method calls
  public startCalls: Array<{ config: any }> = [];
  public stopCalls: number = 0;
  public sendDapRequestCalls: Array<{ command: string; args?: any }> = [];
  
  // Event emitter methods
  private events: Map<string, Function[]> = new Map();
  private maxListeners = 10;
  
  on(event: string, listener: Function): this {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
    return this;
  }
  
  once(event: string, listener: Function): this {
    const wrappedListener = (...args: any[]) => {
      this.removeListener(event, wrappedListener);
      listener(...args);
    };
    return this.on(event, wrappedListener);
  }
  
  emit(event: string, ...args: any[]): boolean {
    const listeners = this.events.get(event);
    if (!listeners) return false;
    listeners.forEach(listener => listener(...args));
    return true;
  }
  
  removeListener(event: string, listener: Function): this {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }
  
  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }
  
  // Additional EventEmitter methods for full compatibility
  addListener(event: string, listener: Function): this {
    return this.on(event, listener);
  }
  
  off(event: string, listener: Function): this {
    return this.removeListener(event, listener);
  }
  
  setMaxListeners(n: number): this {
    this.maxListeners = n;
    return this;
  }
  
  getMaxListeners(): number {
    return this.maxListeners;
  }
  
  listeners(event: string): Function[] {
    return this.events.get(event) || [];
  }
  
  rawListeners(event: string): Function[] {
    return this.listeners(event);
  }
  
  eventNames(): (string | symbol)[] {
    return Array.from(this.events.keys());
  }
  
  listenerCount(event: string): number {
    const listeners = this.events.get(event);
    return listeners ? listeners.length : 0;
  }
  
  prependListener(event: string, listener: Function): this {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.unshift(listener);
    return this;
  }
  
  prependOnceListener(event: string, listener: Function): this {
    const wrappedListener = (...args: any[]) => {
      this.removeListener(event, wrappedListener);
      listener(...args);
    };
    return this.prependListener(event, wrappedListener);
  }
  
  async start(config: any): Promise<void> {
    this.startCalls.push({ config });
    this.sessionId = config.sessionId;
    this.isRunningState = true;
    
    // Simulate initialization
    setTimeout(() => {
      this.emit('initialized');
      this.emit('adapter-configured');
    }, 10);
  }
  
  async stop(): Promise<void> {
    this.stopCalls++;
    this.isRunningState = false;
    this.emit('exit', 0, null);
  }
  
  async sendDapRequest<T>(command: string, args?: any): Promise<T> {
    this.sendDapRequestCalls.push({ command, args });
    
    // Return mock responses based on command
    const mockResponse: any = {
      success: true,
      command,
      body: {}
    };
    
    return mockResponse as T;
  }
  
  isRunning(): boolean {
    return this.isRunningState;
  }
  
  getCurrentThreadId(): number | null {
    return this.currentThreadId;
  }
  
  // Helper methods for testing
  simulateStopped(threadId: number, reason: string): void {
    this.currentThreadId = threadId;
    this.emit('stopped', threadId, reason);
  }
  
  simulateContinued(): void {
    this.emit('continued');
  }
  
  simulateError(error: Error): void {
    this.emit('error', error);
  }
}
