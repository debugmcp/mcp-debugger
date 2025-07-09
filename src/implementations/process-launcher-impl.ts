/**
 * Production implementations of process launcher interfaces
 * These delegate to the existing ProcessManager for actual process operations
 */

import { EventEmitter } from 'events';
import { 
  IProcess, 
  IProcessLauncher, 
  IProcessOptions,
  IDebugTargetLauncher,
  IDebugTarget,
  IProxyProcessLauncher,
  IProxyProcess
} from '../interfaces/process-interfaces.js';
import { IProcessManager, IChildProcess, INetworkManager } from '../interfaces/external-dependencies.js';
import path from 'path';

/**
 * Adapter to wrap IChildProcess as IProcess
 * Provides a cleaner interface while delegating to the underlying child process
 */
class ProcessAdapter extends EventEmitter implements IProcess {
  private _exitCode: number | null = null;
  private _signalCode: string | null = null;
  protected childProcessListeners: Array<{ event: string; listener: (...args: any[]) => void }> = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  
  constructor(protected childProcess: IChildProcess) {
    super();
    
    // Create event handlers
    const exitHandler = (code: number | null, signal: string | null) => {
      this._exitCode = code;
      this._signalCode = signal;
      this.emit('exit', code, signal);
    };
    
    const closeHandler = (code: number | null, signal: string | null) => {
      this.emit('close', code, signal);
    };
    
    const errorHandler = (error: Error) => {
      this.emit('error', error);
    };
    
    const spawnHandler = () => {
      this.emit('spawn');
    };
    
    const messageHandler = (message: unknown) => {
      this.emit('message', message);
    };
    
    // Add listeners and track them
    childProcess.on('exit', exitHandler);
    childProcess.on('close', closeHandler);
    childProcess.on('error', errorHandler);
    childProcess.on('spawn', spawnHandler);
    childProcess.on('message', messageHandler);
    
    // Track all listeners for cleanup
    this.childProcessListeners.push(
      { event: 'exit', listener: exitHandler },
      { event: 'close', listener: closeHandler },
      { event: 'error', listener: errorHandler },
      { event: 'spawn', listener: spawnHandler },
      { event: 'message', listener: messageHandler }
    );
    
    // Add a default error handler to prevent unhandled errors
    // This ensures that errors don't throw if no other handlers are attached
    this.on('error', () => {
      // Default error handler - prevents Node.js from throwing
      // Actual error handling should be done by subclasses or external handlers
    });
  }
  
  get pid(): number | undefined {
    return this.childProcess.pid;
  }
  
  get stdin(): NodeJS.WritableStream | null {
    return this.childProcess.stdin;
  }
  
  get stdout(): NodeJS.ReadableStream | null {
    return this.childProcess.stdout;
  }
  
  get stderr(): NodeJS.ReadableStream | null {
    return this.childProcess.stderr;
  }
  
  get killed(): boolean {
    return this.childProcess.killed;
  }
  
  get exitCode(): number | null {
    return this._exitCode;
  }
  
  get signalCode(): string | null {
    return this._signalCode;
  }
  
  send(message: unknown): boolean {
    return this.childProcess.send(message);
  }
  
  kill(signal?: string): boolean {
    return this.childProcess.kill(signal);
  }
}

/**
 * Production implementation of IProcessLauncher
 */
export class ProcessLauncherImpl implements IProcessLauncher {
  constructor(private processManager: IProcessManager) {}
  
  launch(command: string, args: string[], options?: IProcessOptions): IProcess {
    const childProcess = this.processManager.spawn(command, args, options);
    return new ProcessAdapter(childProcess);
  }
}

/**
 * Production implementation of IDebugTargetLauncher
 */
export class DebugTargetLauncherImpl implements IDebugTargetLauncher {
  constructor(
    private processLauncher: IProcessLauncher,
    private networkManager: INetworkManager
  ) {}
  
  async launchPythonDebugTarget(
    scriptPath: string,
    args: string[],
    pythonPath: string = 'python',
    debugPort?: number
  ): Promise<IDebugTarget> {
    // Find a free port if not specified
    const port = debugPort || await this.networkManager.findFreePort();
    
    // Launch Python with debugpy
    const debugArgs = [
      '-m', 'debugpy',
      '--listen', `127.0.0.1:${port}`,
      '--wait-for-client',
      scriptPath,
      ...args
    ];
    
    const process = this.processLauncher.launch(
      pythonPath,
      debugArgs,
      { cwd: path.dirname(scriptPath) }
    );
    
    return {
      process,
      debugPort: port,
      terminate: async () => {
        return new Promise((resolve) => {
          if (process.killed) {
            resolve();
            return;
          }
          
          process.once('exit', () => resolve());
          process.kill('SIGTERM');
          
          // Force kill after timeout
          setTimeout(() => {
            if (!process.killed) {
              process.kill('SIGKILL');
            }
            resolve();
          }, 5000);
        });
      }
    };
  }
}

/**
 * Proxy process adapter that adds proxy-specific functionality
 */
class ProxyProcessAdapter extends ProcessAdapter implements IProxyProcess {
  private initializationPromise?: Promise<void>;
  private initializationResolve?: () => void;
  private initializationReject?: (error: Error) => void;
  private initializationState: 'none' | 'waiting' | 'completed' | 'failed' = 'none';
  private initializationCleanup?: () => void;
  private disposed = false;
  
  constructor(
    childProcess: IChildProcess,
    public readonly sessionId: string
  ) {
    super(childProcess);
    
    // NO promise creation here - wait for waitForInitialization()
    
    // Set up early exit handler
    this.once('exit', this.handleEarlyExit.bind(this));
    
    // Set up error handling immediately to prevent unhandled errors
    // This must be done in the constructor to catch any early errors
    this.setupErrorHandling();
  }
  
  private setupErrorHandling(): void {
    // Override error handling to support DAP spec
    // Note: We must handle errors to prevent Node.js from throwing unhandled errors
    this.on('error', () => {
      if (this.initializationState === 'waiting') {
        // Both reject promise AND emit event (DAP spec requirement)
        // The failInitialization will reject the promise, but the error event
        // will still be emitted for other listeners
        // Don't pass the error directly - this will be handled by exit event
      }
      // Error is handled - prevent default throw behavior
    });
  }
  
  private createInitializationPromise(timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.initializationResolve = resolve;
      this.initializationReject = reject;
      
      // Set up message handler
      const messageHandler = (message: unknown) => {
        const msg = message as { type?: string; status?: string } | null;
        if (msg?.type === 'status' && 
            (msg.status === 'adapter_configured_and_launched' || 
             msg.status === 'dry_run_complete')) {
          this.completeInitialization();
        }
      };
      this.on('message', messageHandler);
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (this.initializationState === 'waiting') {
          this.failInitialization(new Error('Proxy initialization timeout'));
        }
      }, timeout);
      
      // Store cleanup info
      this.initializationCleanup = () => {
        this.removeListener('message', messageHandler);
        clearTimeout(timeoutId);
      };
    });
  }
  
  private completeInitialization(): void {
    if (this.initializationState !== 'waiting') return;
    
    this.initializationState = 'completed';
    if (this.initializationResolve) {
      this.initializationResolve();
      this.initializationResolve = undefined;
      this.initializationReject = undefined;
    }
    this.cleanupInitialization();
  }
  
  private failInitialization(error: Error): void {
    if (this.initializationState !== 'waiting') return;
    
    this.initializationState = 'failed';
    if (this.initializationReject) {
      this.initializationReject(error);
      this.initializationResolve = undefined;
      this.initializationReject = undefined;
    }
    this.cleanupInitialization();
  }
  
  private cleanupInitialization(): void {
    if (this.initializationCleanup) {
      this.initializationCleanup();
      this.initializationCleanup = undefined;
    }
  }
  
  private handleEarlyExit(): void {
    if (this.initializationState === 'waiting' && this.initializationReject) {
      // Only reject if someone is waiting for initialization
      this.failInitialization(new Error('Proxy process exited before initialization'));
    } else if (this.initializationState === 'none') {
      // Process exited without initialization being requested
      // Mark as failed to prevent future initialization attempts
      this.initializationState = 'failed';
    }
    this.dispose();
  }
  
  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    
    // Clean up initialization resources
    this.cleanupInitialization();
    
    // Remove all listeners from this adapter
    this.removeAllListeners();
    
    // Remove listeners from the underlying childProcess
    for (const { event, listener } of this.childProcessListeners) {
      this.childProcess.removeListener(event, listener);
    }
    this.childProcessListeners = [];
  }
  
  sendCommand(command: object): void {
    // Send object directly - Node.js IPC will handle serialization
    this.send(command);
  }
  
  async waitForInitialization(timeout: number = 30000): Promise<void> {
    // Handle completed states
    if (this.initializationState === 'completed') {
      return; // Already initialized
    }
    
    if (this.initializationState === 'failed') {
      throw new Error('Initialization already completed or failed');
    }
    
    // Handle concurrent calls - return existing promise if in progress
    if (this.initializationState === 'waiting' && this.initializationPromise) {
      return this.initializationPromise;
    }
    
    // Create promise only when first requested
    if (!this.initializationPromise) {
      this.initializationState = 'waiting';
      this.initializationPromise = this.createInitializationPromise(timeout);
    }
    
    return this.initializationPromise;
  }
  
  kill(signal?: string): boolean {
    if (this.killed || this.disposed) {
      return false; // Already killed or disposed
    }
    
    // If waiting for initialization, fail it
    if (this.initializationState === 'waiting') {
      this.failInitialization(new Error('Process killed during initialization'));
    }
    
    const result = super.kill(signal);
    
    // Ensure disposal happens after kill
    if (result) {
      this.once('exit', () => this.dispose());
    }
    
    return result;
  }
}

/**
 * Production implementation of IProxyProcessLauncher
 */
export class ProxyProcessLauncherImpl implements IProxyProcessLauncher {
  constructor(private processLauncher: IProcessLauncher) {}
  
  launchProxy(
    proxyScriptPath: string,
    sessionId: string,
    env?: Record<string, string>
  ): IProxyProcess {
    const diagnosticFlags = ['--trace-uncaught', '--trace-exit'];
    const args = [...diagnosticFlags, proxyScriptPath];
    
    // Convert process.env to ensure all values are strings
    // Filter out test-related environment variables to ensure proxy runs normally
    const processEnv: Record<string, string> = {};
    if (env) {
      Object.assign(processEnv, env);
    } else {
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          // Skip test-related environment variables
          if (key === 'NODE_ENV' || key === 'VITEST' || key === 'JEST_WORKER_ID') {
            continue;
          }
          processEnv[key] = value;
        }
      }
    }
    
    // Ensure the proxy knows it's not in test mode
    delete processEnv.NODE_ENV;
    delete processEnv.VITEST;
    delete processEnv.JEST_WORKER_ID;
    
    const options: IProcessOptions = {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'] as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Required for Node.js StdioOptions IPC compatibility
      env: processEnv
    };
    
    const launchedProcess = this.processLauncher.launch(
      process.execPath,
      args,
      options
    );
    
    // Cast to ProcessAdapter to access the underlying child process
    const processAdapter = launchedProcess as ProcessAdapter;
    return new ProxyProcessAdapter(processAdapter['childProcess'], sessionId);
  }
}

/**
 * Production implementation of IProcessLauncherFactory
 */
export class ProcessLauncherFactoryImpl {
  constructor(
    private processManager: IProcessManager,
    private networkManager: INetworkManager
  ) {}
  
  createProcessLauncher(): IProcessLauncher {
    return new ProcessLauncherImpl(this.processManager);
  }
  
  createDebugTargetLauncher(): IDebugTargetLauncher {
    const processLauncher = this.createProcessLauncher();
    return new DebugTargetLauncherImpl(processLauncher, this.networkManager);
  }
  
  createProxyProcessLauncher(): IProxyProcessLauncher {
    const processLauncher = this.createProcessLauncher();
    return new ProxyProcessLauncherImpl(processLauncher);
  }
}
