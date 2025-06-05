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
  
  constructor(protected childProcess: IChildProcess) {
    super();
    
    // Forward all events from child process
    childProcess.on('exit', (code: number | null, signal: string | null) => {
      this._exitCode = code;
      this._signalCode = signal;
      this.emit('exit', code, signal);
    });
    
    childProcess.on('close', (code: number | null, signal: string | null) => {
      this.emit('close', code, signal);
    });
    
    childProcess.on('error', (error: Error) => {
      this.emit('error', error);
    });
    
    childProcess.on('spawn', () => {
      this.emit('spawn');
    });
    
    childProcess.on('message', (message: any) => {
      this.emit('message', message);
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
  
  send(message: any): boolean {
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
  
  constructor(
    childProcess: IChildProcess,
    public readonly sessionId: string
  ) {
    super(childProcess);
    
    // Set up initialization promise
    this.initializationPromise = new Promise((resolve, reject) => {
      this.initializationResolve = resolve;
      this.initializationReject = reject;
    });
    
    // Listen for initialization events
    this.on('message', (message: any) => {
      // Consider the proxy initialized if it sends 'adapter_configured_and_launched'
      // OR if it sends 'dry_run_complete' (as it will exit shortly after for dry runs).
      if (message?.type === 'status' && 
          (message.status === 'adapter_configured_and_launched' || message.status === 'dry_run_complete')) {
        if (this.initializationResolve) {
          this.initializationResolve();
          this.initializationResolve = undefined; // Mark as completed
          this.initializationReject = undefined; // Mark as completed
        }
      }
    });
    
    // Handle early exit
    this.once('exit', () => {
      if (this.initializationReject) {
        this.initializationReject(new Error('Proxy process exited before initialization'));
        this.initializationResolve = undefined;
        this.initializationReject = undefined;
      }
    });
  }
  
  sendCommand(command: object): void {
    const messageStr = JSON.stringify(command);
    this.send(messageStr);
  }
  
  async waitForInitialization(timeout: number = 30000): Promise<void> {
    if (!this.initializationPromise) {
      throw new Error('Initialization already completed or failed');
    }
    
    return Promise.race([
      this.initializationPromise,
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Proxy initialization timeout')), timeout);
      })
    ]);
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
    const processEnv: Record<string, string> = {};
    if (env) {
      Object.assign(processEnv, env);
    } else {
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          processEnv[key] = value;
        }
      }
    }
    
    const options: IProcessOptions = {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'] as any,
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
