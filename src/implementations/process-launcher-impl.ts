/**
 * Production implementations of process launcher interfaces
 * These delegate to the existing ProcessManager for actual process operations
 */

import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  IProcess, 
  IProcessLauncher, 
  IProcessOptions,
  IDebugTargetLauncher,
  IDebugTarget,
  IProxyProcessLauncher,
  IProxyProcess
} from '@debugmcp/shared';
import { IProcessManager, IChildProcess, INetworkManager } from '@debugmcp/shared';

/**
 * Adapter to wrap IChildProcess as IProcess
 * Provides a cleaner interface while delegating to the underlying child process
 */
class ProcessAdapter extends EventEmitter implements IProcess {
  private _exitCode: number | null = null;
  private _signalCode: string | null = null;
  protected childProcessListeners: Array<{ event: string; listener: (...args: any[]) => void }> = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  
  constructor(public readonly childProcess: IChildProcess) {
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
    try {
      // Check if we're in a container - don't use process groups in containers
      const inContainer = process.env.MCP_CONTAINER === 'true';
      
      // If the process has a pid, try to kill the entire process group (but not in containers)
      if (this.childProcess.pid && process.platform !== 'win32' && !inContainer) {
        try {
          // Kill the process group (negative PID)
          process.kill(-this.childProcess.pid, signal || 'SIGTERM');
        } catch {
          // Fallback to killing just the process
          return this.childProcess.kill(signal);
        }
      }
      return this.childProcess.kill(signal);
    } catch {
      // Process may already be dead
      return false;
    }
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

    // No cwd manipulation - let the process inherit the current working directory
    const debugProcess = this.processLauncher.launch(
      pythonPath,
      debugArgs
    );

    return {
      process: debugProcess,
      debugPort: port,
      terminate: async () => {
        return new Promise((resolve) => {
          if (debugProcess.killed) {
            resolve();
            return;
          }

          debugProcess.once('exit', () => resolve());
          debugProcess.kill('SIGTERM');

          // Force kill after timeout
          setTimeout(() => {
            if (!debugProcess.killed) {
              debugProcess.kill('SIGKILL');
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
 * Does NOT extend ProcessAdapter to avoid double message handling
 */
class ProxyProcessAdapter extends EventEmitter implements IProxyProcess {
  private initializationPromise?: Promise<void>;
  private initializationResolve?: () => void;
  private initializationReject?: (error: Error) => void;
  private initializationState: 'none' | 'waiting' | 'completed' | 'failed' = 'none';
  private initializationCleanup?: () => void;
  private disposed = false;
  private promiseId: string;
  protected childProcessListeners: Array<{ event: string; listener: (...args: any[]) => void }> = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  private _exitCode: number | null = null;
  private _signalCode: string | null = null;

  constructor(
    public readonly childProcess: IChildProcess,
    public readonly sessionId: string
  ) {
    super();

    // Create a unique ID for this adapter's promises for debugging
    this.promiseId = `ProxyProcess-${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Set up event handlers
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
    
    // IMPORTANT: Forward messages from childProcess to ProxyManager
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
    // Log promise creation for debugging
    if (process.env.DEBUG_PROMISES || process.env.DEBUG_PROMISE_LEAKS) {
      console.error(`[DEBUG] Creating initialization promise [ID: ${this.promiseId}, Timeout: ${timeout}ms]`);

      // Enhanced tracking for test debugging
      if (process.env.NODE_ENV === 'test' && process.env.DEBUG_PROMISE_LEAKS) {
        const testName = this.sessionId.match(/session-([^-]+(?:-[^-]+)*)/)?.[1] || 'unknown';
        console.error(`[DEBUG] Promise created by test: ${testName}`);
        console.error(`[DEBUG] Stack trace:`, new Error().stack);
      }
    }

    const promise = new Promise<void>((resolve, reject) => {
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
          this.failInitialization(new Error(`Proxy initialization timeout [Promise ID: ${this.promiseId}]`));
        }
      }, timeout);

      // Store cleanup info
      this.initializationCleanup = () => {
        this.removeListener('message', messageHandler);
        clearTimeout(timeoutId);
      };
    });

    // Add a default catch handler to prevent unhandled rejection
    // This will be overridden when the caller awaits or catches the promise
    // IMPORTANT: We must handle rejections that occur from timeouts or dispose
    promise.catch((error) => {
      // Log the error if debugging is enabled
      if (process.env.DEBUG_PROMISES) {
        console.error(`[DEBUG] Promise rejection handled internally [ID: ${this.promiseId}]:`, error?.message);
      }
      // Silently handle rejection to prevent unhandled rejection warnings
      // The actual error handling is done by the caller
    });

    return promise;
  }
  
  private completeInitialization(): void {
    if (this.initializationState !== 'waiting') return;

    this.initializationState = 'completed';

    if (process.env.DEBUG_PROMISES || process.env.DEBUG_PROMISE_LEAKS) {
      console.error(`[DEBUG] Completing initialization [ID: ${this.promiseId}]`);
    }

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

    if (process.env.DEBUG_PROMISES || process.env.DEBUG_PROMISE_LEAKS) {
      console.error(`[DEBUG] Failing initialization [ID: ${this.promiseId}]: ${error.message}`);
    }

    // Clear references first to prevent any re-entry
    const rejectFn = this.initializationReject;
    this.initializationResolve = undefined;
    this.initializationReject = undefined;

    // Clean up before rejecting to ensure no double-rejection from cleanup
    this.cleanupInitialization();

    // Now safely reject if we had a reject function
    if (rejectFn) {
      rejectFn(error);
    }
  }
  
  private cleanupInitialization(): void {
    if (this.initializationCleanup) {
      this.initializationCleanup();
      this.initializationCleanup = undefined;
    }
  }
  
  private handleEarlyExit(): void {
    if (this.initializationState === 'none') {
      // Process exited without initialization being requested
      // Mark as failed to prevent future initialization attempts
      this.initializationState = 'failed';
    }
    // dispose() will handle the rejection if we're waiting for initialization
    this.dispose();
  }
  
  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // If we're waiting for initialization, fail it gracefully to avoid unhandled rejection
    if (this.initializationState === 'waiting') {
      // Use failInitialization to handle this cleanly
      this.failInitialization(new Error(`Proxy process exited before initialization [Promise ID: ${this.promiseId}]`));
    } else {
      // Clean up initialization resources
      this.cleanupInitialization();
    }

    // Remove all listeners from this adapter
    this.removeAllListeners();

    // Remove listeners from the underlying childProcess
    for (const { event, listener } of this.childProcessListeners) {
      this.childProcess.removeListener(event, listener);
    }
    this.childProcessListeners = [];
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
    // The IChildProcess interface only has send(message) - one parameter
    if (typeof this.childProcess.send === 'function') {
      const result = this.childProcess.send(message);
      return result;
    } else {
      return false;
    }
  }
  
  sendCommand(command: object): void {
    // Send object directly - Node.js IPC will handle serialization
    try {
      const summary = JSON.stringify({
        cmd: (command as { cmd?: string }).cmd,
        requestId: (command as { requestId?: string }).requestId,
        sessionId: (command as { sessionId?: string }).sessionId
      });
      const connectedBefore =
        'connected' in this.childProcess
          ? (this.childProcess as { connected?: boolean }).connected
          : undefined;
      const pid = this.childProcess.pid;
      this.emit('ipc-send-start', {
        pid,
        connectedBefore,
        summary,
        timestamp: Date.now()
      });

      const queueSizeBefore =
        (this.childProcess as unknown as { channel?: { writeQueueSize?: number } }).channel?.writeQueueSize;
      const result = this.send(command);
      const queueSizeAfter =
        (this.childProcess as unknown as { channel?: { writeQueueSize?: number } }).channel?.writeQueueSize;
      // Log the result for debugging
      if (typeof result === 'boolean') {
        if (!result) {
          // Log details about why send failed
          const killed = this.killed;
          const hasChildProcess = !!this.childProcess;
          const childProcessKilled = hasChildProcess ? this.childProcess.killed : 'N/A';
          this.emit('ipc-send-failed', {
            pid,
            killed,
            childProcessKilled,
            summary,
            timestamp: Date.now()
          });
          throw new Error(`Failed to send command via IPC. Send returned false. Adapter killed: ${killed}, Has childProcess: ${hasChildProcess}, Child killed: ${childProcessKilled}`);
        }
        const connectedAfter =
          'connected' in this.childProcess
            ? (this.childProcess as { connected?: boolean }).connected
            : undefined;
        this.emit('ipc-send-complete', {
          pid,
          connectedAfter,
          summary,
          queueSizeBefore,
          queueSizeAfter,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      this.emit('ipc-send-error', {
        pid: this.childProcess.pid,
        error: error instanceof Error ? error.message : String(error),
        summary: JSON.stringify({
          cmd: (command as { cmd?: string }).cmd,
          requestId: (command as { requestId?: string }).requestId,
          sessionId: (command as { sessionId?: string }).sessionId
        }),
        timestamp: Date.now()
      });
      throw new Error(`IPC send threw error: ${error instanceof Error ? error.message : String(error)}`);
    }
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
    
    try {
      return this.childProcess.kill(signal);
    } catch {
      return false;
    }
  }
}

/**
 * Production implementation of IProxyProcessLauncher
 */
export class ProxyProcessLauncherImpl implements IProxyProcessLauncher {
  constructor(
    private processLauncher: IProcessLauncher,
    private processManager: IProcessManager
  ) {}

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

    // Ensure the proxy runs from the project root directory, not VS Code's directory
    // This is critical for IPC and path resolution to work correctly
    const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    
    // Log critical environment variables being passed to proxy worker
    console.log('[ProxyProcessLauncher] Environment check for proxy worker:', {
      NODE_OPTIONS: processEnv.NODE_OPTIONS || '<not set>',
      NODE_DEBUG: processEnv.NODE_DEBUG || '<not set>',
      NODE_ENV: processEnv.NODE_ENV || '<not set>',
      DEBUG: processEnv.DEBUG || '<not set>',
      hasInspectInNodeOptions: processEnv.NODE_OPTIONS?.includes('--inspect') || false,
      launchingFrom: process.cwd(),
      targetCwd: projectRoot,
      sessionId
    });
    
    const options: IProcessOptions = {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'] as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Required for Node.js StdioOptions IPC compatibility
      env: processEnv,
      cwd: projectRoot, // Use project root instead of process.cwd() which might be VS Code's directory
      // Do NOT detach the process - this can interfere with IPC communication
      // especially when the debugged process pauses at a breakpoint
      detached: false
    };

    // Get the raw child process directly to avoid double-wrapping
    const childProcess = this.processManager.spawn(
      process.execPath,
      args,
      options
    );
    
    // Create the proxy process adapter with the raw child process
    return new ProxyProcessAdapter(childProcess, sessionId);
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
    return new ProxyProcessLauncherImpl(processLauncher, this.processManager);
  }
}
