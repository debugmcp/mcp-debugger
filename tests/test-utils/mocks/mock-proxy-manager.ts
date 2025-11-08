/**
 * Mock implementation of ProxyManager for testing
 */
import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';
import { IProxyManager, ProxyConfig, ProxyManagerEvents } from '../../src/proxy/proxy-manager.js';

/**
 * Mock ProxyManager for unit testing
 */
export class MockProxyManager extends EventEmitter implements IProxyManager {
  private _isRunning = false;
  private _currentThreadId: number | null = null;
  private _config: ProxyConfig | null = null;
  private _dapRequestHandler: ((command: string, args?: any) => Promise<any>) | null = null;
  private _dryRunCompleted = false;
  private _dryRunCommand?: string;
  private _dryRunScript?: string;

  // Track calls for testing
  public startCalls: ProxyConfig[] = [];
  public stopCalls: number = 0;
  public dapRequestCalls: Array<{ command: string; args?: any }> = [];

  // Control behavior for testing
  public shouldFailStart = false;
  public startDelay = 0;
  public shouldFailDapRequests = false;
  public dapRequestDelay = 0;

  constructor() {
    super();
  }

  async start(config: ProxyConfig): Promise<void> {
    this.startCalls.push(config);

    if (this.shouldFailStart) {
      throw new Error('Mock start failure');
    }

    if (this.startDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.startDelay));
    }

    this._config = config;
    this._isRunning = true;
    this._dryRunCompleted = false;
    this._dryRunCommand = undefined;
    this._dryRunScript = undefined;

    // Simulate initialization
    process.nextTick(() => {
      if (config.dryRunSpawn) {
        this._dryRunCompleted = true;
        this._dryRunCommand = 'python';
        this._dryRunScript = config.scriptPath;
        this.emit('dry-run-complete', 'python', config.scriptPath);
      } else {
        this.emit('adapter-configured');
        this.emit('initialized');
        
        // If stopOnEntry is true, simulate stop
        if (config.stopOnEntry) {
          this._currentThreadId = 1;
          this.emit('stopped', 1, 'entry');
        }
      }
    });
  }

  async stop(): Promise<void> {
    this.stopCalls++;
    this._isRunning = false;
    this._currentThreadId = null;
    this._config = null;
    this._dryRunCompleted = false;
    this._dryRunCommand = undefined;
    this._dryRunScript = undefined;
    
    process.nextTick(() => {
      this.emit('exit', 0, undefined);
    });
  }

  async sendDapRequest<T extends DebugProtocol.Response>(
    command: string, 
    args?: any
  ): Promise<T> {
    this.dapRequestCalls.push({ command, args });

    if (!this._isRunning) {
      throw new Error('Proxy not running');
    }

    if (this.shouldFailDapRequests) {
      throw new Error(`Mock DAP request failure: ${command}`);
    }

    if (this.dapRequestDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.dapRequestDelay));
    }

    // Use custom handler if provided
    if (this._dapRequestHandler) {
      const result = await this._dapRequestHandler(command, args);
      return result as T;
    }

    // Default mock responses
    switch (command) {
      case 'setBreakpoints':
        return {
          success: true,
          body: {
            breakpoints: args?.breakpoints?.map((bp: any) => ({
              verified: true,
              line: bp.line
            })) || []
          }
        } as T;

      case 'stackTrace':
        return {
          success: true,
          body: {
            stackFrames: [{
              id: 1,
              name: 'main',
              source: { path: 'test.py' },
              line: 10,
              column: 0
            }]
          }
        } as T;

      case 'scopes':
        return {
          success: true,
          body: {
            scopes: [{
              name: 'Locals',
              variablesReference: 100,
              expensive: false
            }]
          }
        } as T;

      case 'variables':
        return {
          success: true,
          body: {
            variables: [{
              name: 'test_var',
              value: '42',
              type: 'int',
              variablesReference: 0
            }]
          }
        } as T;

      case 'next':
      case 'stepIn':
      case 'stepOut':
        // Simulate step completion
        process.nextTick(() => {
          this.emit('stopped', this._currentThreadId || 1, 'step');
        });
        return { success: true } as T;

      case 'continue':
        process.nextTick(() => {
          this.emit('continued');
        });
        return { success: true } as T;

      default:
        return { success: true } as T;
    }
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  getCurrentThreadId(): number | null {
    return this._currentThreadId;
  }

  // Test helpers
  setDapRequestHandler(handler: (command: string, args?: any) => Promise<any>): void {
    this._dapRequestHandler = handler;
  }

  simulateEvent<K extends keyof ProxyManagerEvents>(
    event: K,
    ...args: Parameters<ProxyManagerEvents[K]>
  ): void {
    if (event === 'dry-run-complete') {
      this._dryRunCompleted = true;
      this._dryRunCommand = args[0] as string | undefined;
      this._dryRunScript = args[1] as string | undefined;
    }
    this.emit(event, ...args);
  }

  simulateStopped(threadId: number, reason: string): void {
    this._currentThreadId = threadId;
    this.emit('stopped', threadId, reason);
  }

  simulateError(error: Error): void {
    this.emit('error', error);
  }

  simulateExit(code: number, signal?: string): void {
    this._isRunning = false;
    this._currentThreadId = null;
    this.emit('exit', code, signal);
  }

  hasDryRunCompleted(): boolean {
    return this._dryRunCompleted;
  }

  getDryRunSnapshot(): { command?: string; script?: string } | undefined {
    if (!this._dryRunCompleted) {
      return undefined;
    }
    return {
      command: this._dryRunCommand,
      script: this._dryRunScript
    };
  }

  reset(): void {
    this.startCalls = [];
    this.stopCalls = 0;
    this.dapRequestCalls = [];
    this.shouldFailStart = false;
    this.startDelay = 0;
    this.shouldFailDapRequests = false;
    this.dapRequestDelay = 0;
    this._isRunning = false;
    this._currentThreadId = null;
    this._config = null;
    this._dapRequestHandler = null;
    this._dryRunCompleted = false;
    this._dryRunCommand = undefined;
    this._dryRunScript = undefined;
    this.removeAllListeners();
  }
}
