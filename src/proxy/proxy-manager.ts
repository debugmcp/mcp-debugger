/**
 * ProxyManager - Handles spawning and communication with debug proxy processes
 */
import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  IFileSystem,
  ILogger
} from '@debugmcp/shared';
import { IProxyProcessLauncher, IProxyProcess } from '@debugmcp/shared';
import { 
  createInitialState, 
  handleProxyMessage, 
  isValidProxyMessage,
  DAPSessionState,
  addPendingRequest,
  removePendingRequest,
  clearPendingRequests
} from '../dap-core/index.js';
import { ErrorMessages } from '../utils/error-messages.js';
import { ProxyConfig } from './proxy-config.js';
import { IDebugAdapter } from '@debugmcp/shared';

/**
 * Events emitted by ProxyManager
 */
export interface ProxyManagerEvents {
  // DAP events
  'stopped': (threadId: number, reason: string, data?: DebugProtocol.StoppedEvent['body']) => void;
  'continued': () => void;
  'terminated': () => void;
  'exited': () => void;
  
  // Proxy lifecycle events
  'initialized': () => void;
  'error': (error: Error) => void;
  'exit': (code: number | null, signal?: string) => void;
  
  // Status events
  'dry-run-complete': (command: string, script: string) => void;
  'adapter-configured': () => void;
  'dap-event': (event: string, body: unknown) => void;
}

/**
 * Interface for proxy managers
 */
export interface IProxyManager extends EventEmitter {
  start(config: ProxyConfig): Promise<void>;
  stop(): Promise<void>;
  sendDapRequest<T extends DebugProtocol.Response>(
    command: string, 
    args?: unknown
  ): Promise<T>;
  isRunning(): boolean;
  getCurrentThreadId(): number | null;
  
  // Typed event emitter methods
  on<K extends keyof ProxyManagerEvents>(
    event: K, 
    listener: ProxyManagerEvents[K]
  ): this;
  emit<K extends keyof ProxyManagerEvents>(
    event: K, 
    ...args: Parameters<ProxyManagerEvents[K]>
  ): boolean;
  hasDryRunCompleted(): boolean;
  getDryRunSnapshot(): { command?: string; script?: string } | undefined;
}

// Message types from proxy
type ProxyStatusMessage =
  | { type: 'status'; sessionId: string; status: 'proxy_minimal_ran_ipc_test'; message?: string }
  | { type: 'status'; sessionId: string; status: 'init_received'; data?: unknown }
  | { type: 'status'; sessionId: string; status: 'dry_run_complete'; command: string; script: string; data?: unknown }
  | { type: 'status'; sessionId: string; status: 'adapter_configured_and_launched'; data?: unknown }
  | { type: 'status'; sessionId: string; status: 'adapter_connected'; data?: unknown }
  | { type: 'status'; sessionId: string; status: 'adapter_exited' | 'dap_connection_closed' | 'terminated'; code?: number | null; signal?: NodeJS.Signals | null; data?: unknown };

type ProxyDapEventMessage = { 
  type: 'dapEvent'; 
  sessionId: string; 
  event: string; 
  body?: unknown; 
  data?: unknown 
};

type ProxyDapResponseMessage = { 
  type: 'dapResponse'; 
  sessionId: string; 
  requestId: string; 
  success: boolean; 
  response?: DebugProtocol.Response; 
  body?: unknown; 
  error?: string;
  data?: unknown;
};

type ProxyErrorMessage = { 
  type: 'error'; 
  sessionId: string; 
  message: string; 
  data?: unknown 
};

type ProxyMessage = ProxyStatusMessage | ProxyDapEventMessage | ProxyDapResponseMessage | ProxyErrorMessage;

interface ProxyRuntimeEnvironment {
  moduleUrl: string;
  cwd: () => string;
}

const DEFAULT_RUNTIME_ENVIRONMENT: ProxyRuntimeEnvironment = {
  moduleUrl: import.meta.url,
  cwd: () => process.cwd()
};

/**
 * Concrete implementation of ProxyManager
 */
export class ProxyManager extends EventEmitter implements IProxyManager {
  private proxyProcess: IProxyProcess | null = null;
  private sessionId: string | null = null;
  private currentThreadId: number | null = null;
  private pendingDapRequests = new Map<string, {
    resolve: (response: DebugProtocol.Response) => void;
    reject: (error: Error) => void;
    command: string;
  }>();
  private isInitialized = false;
  private isDryRun = false;
  private dryRunCompleteReceived = false;
  private dryRunCommandSnapshot?: string;
  private dryRunScriptPath?: string;
  private adapterConfigured = false;
  private dapState: DAPSessionState | null = null;
  private stderrBuffer: string[] = [];
  private lastExitDetails:
    | {
        code: number | null;
        signal: string | null;
        timestamp: number;
        capturedStderr: string[];
      }
    | undefined;
  private readonly runtimeEnv: ProxyRuntimeEnvironment;
  
  // Track js-debug launch state for proper synchronization
  private jsDebugLaunchPending = false;
  private jsDebugLaunchResolvers: Array<() => void> = [];
  private proxyMessageCounter = 0;

  constructor(
    private adapter: IDebugAdapter | null,  // Optional adapter for language-agnostic support
    private proxyProcessLauncher: IProxyProcessLauncher,
    private fileSystem: IFileSystem,
    private logger: ILogger,
    runtimeEnv: ProxyRuntimeEnvironment = DEFAULT_RUNTIME_ENVIRONMENT
  ) {
    super();
    this.runtimeEnv = runtimeEnv;
  }

  async start(config: ProxyConfig): Promise<void> {
    if (this.proxyProcess) {
      throw new Error('Proxy already running');
    }

    this.sessionId = config.sessionId;
    this.isDryRun = config.dryRunSpawn === true;
    this.dryRunCompleteReceived = false;
    this.dryRunCommandSnapshot = undefined;
    this.dryRunScriptPath = config.scriptPath;
    this.lastExitDetails = undefined;
    if (config.adapterCommand?.command) {
      const parts = [config.adapterCommand.command, ...(config.adapterCommand.args ?? [])]
        .filter((part) => typeof part === 'string' && part.length > 0);
      if (parts.length > 0) {
        this.dryRunCommandSnapshot = parts.join(' ');
      }
    } else if (!this.dryRunCommandSnapshot && config.executablePath) {
      this.dryRunCommandSnapshot = config.executablePath;
    }
    
    // Initialize functional core state
    this.dapState = createInitialState(config.sessionId);
    
    const { executablePath, proxyScriptPath, env } = await this.prepareSpawnContext(config);

    this.logger.info(`[ProxyManager] Spawning proxy for session ${config.sessionId}. Path: ${proxyScriptPath}`);
    
    try {
      this.proxyProcess = this.proxyProcessLauncher.launchProxy(
        proxyScriptPath,
        config.sessionId,
        env
      );
    } catch (error) {
      this.logger.error(`[ProxyManager] Failed to spawn proxy:`, error);
      throw error;
    }

    if (!this.proxyProcess || typeof this.proxyProcess.pid === 'undefined') {
      throw new Error('Proxy process is invalid or PID is missing');
    }

    this.logger.info(`[ProxyManager] Proxy spawned with PID: ${this.proxyProcess.pid}`);

    // Set up event handlers
    this.setupEventHandlers();

    // Wait a brief moment for the process to start before sending init
    await new Promise(resolve => setTimeout(resolve, 50));

    // Send initialization command with retry logic
    const initCommand = {
      cmd: 'init',
      sessionId: config.sessionId,
      executablePath: executablePath,  // Using resolved executable path
      adapterHost: config.adapterHost,
      adapterPort: config.adapterPort,
      logDir: config.logDir,
      scriptPath: config.scriptPath,
      scriptArgs: config.scriptArgs,
      stopOnEntry: config.stopOnEntry,
      justMyCode: config.justMyCode,
      initialBreakpoints: config.initialBreakpoints,
      dryRunSpawn: config.dryRunSpawn,
      // Pass adapter command info for language-agnostic adapter spawning
      adapterCommand: config.adapterCommand
    };

    // Debug log the command being sent
    this.logger.info(`[ProxyManager] Sending init command with adapterCommand:`, {
      hasAdapterCommand: !!config.adapterCommand,
      adapterCommand: config.adapterCommand ? {
        command: config.adapterCommand.command,
        args: config.adapterCommand.args,
        hasEnv: !!config.adapterCommand.env
      } : null
    });

    // Send init command with retry logic
    await this.sendInitWithRetry(initCommand);

    // Wait for initialization or dry run completion
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(ErrorMessages.proxyInitTimeout(30)));
      }, 30000);

      const cleanup = () => {
        clearTimeout(timeout);
        this.removeListener('initialized', handleInitialized);
        this.removeListener('dry-run-complete', handleDryRun);
        this.removeListener('error', handleError);
        this.removeListener('exit', handleExit);
      };

      const handleInitialized = () => {
        this.isInitialized = true;
        cleanup();
        resolve();
      };

      const handleDryRun = () => {
        cleanup();
        resolve();
      };

      const handleError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const handleExit = (code: number | null, signal?: string) => {
        cleanup();
        if (this.isDryRun && code === 0) {
          // Normal exit for dry run
          resolve();
        } else {
          let errorMessage = `Proxy exited during initialization. Code: ${code}, Signal: ${signal}`;
          if (this.stderrBuffer.length > 0) {
            errorMessage += `\nStderr output:\n${this.stderrBuffer.join('\n')}`;
          }
          reject(new Error(errorMessage));
        }
      };

      this.once('initialized', handleInitialized);
      this.once('dry-run-complete', handleDryRun);
      this.once('error', handleError);
      this.once('exit', handleExit);
    });
  }

  async stop(): Promise<void> {
    if (!this.proxyProcess) {
      return;
    }

    this.logger.info(`[ProxyManager] Stopping proxy for session ${this.sessionId}`);

    // Mark as shutting down to stop processing new messages
    const process = this.proxyProcess;
    
    // Immediately cleanup to prevent "unknown request" warnings
    this.cleanup();

    // Send terminate command if process is still running
    try {
      if (!process.killed) {
        process.send({ cmd: 'terminate', sessionId: this.sessionId });
      }
    } catch (error) {
      this.logger.error(`[ProxyManager] Error sending terminate command:`, error);
    }

    // Wait for graceful exit or force kill after timeout
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.logger.warn(`[ProxyManager] Timeout waiting for proxy exit. Force killing.`);
        if (!process.killed) {
          process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      process.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      // If already killed/exited, resolve immediately
      if (process.killed || process.exitCode !== null) {
        clearTimeout(timeout);
        resolve();
      }
    });
  }

  async sendDapRequest<T extends DebugProtocol.Response>(
    command: string, 
    args?: unknown
  ): Promise<T> {
    if (!this.proxyProcess || !this.isInitialized) {
      throw new Error('Proxy not initialized');
    }
    
    // For js-debug, implement proper synchronization for launch command
    const isJsDebug =
      !!this.adapter &&
      typeof (this.adapter as IDebugAdapter).getAdapterModuleName === 'function' &&
      (this.adapter as IDebugAdapter).getAdapterModuleName() === 'js-debug';
    
    if (isJsDebug && command === 'launch') {
      const requestId = uuidv4();
      const commandToSend = {
        cmd: 'dap',
        sessionId: this.sessionId,
        requestId,
        dapCommand: command,
        dapArgs: args
      };
      
      this.logger.info(`[ProxyManager] (js-debug) Sending launch command with proper synchronization: ${command}, requestId: ${requestId}`);
      
      // Mark that we're waiting for js-debug to be ready
      this.jsDebugLaunchPending = true;
      
      try {
        this.sendCommand(commandToSend);
      } catch (error) {
        this.jsDebugLaunchPending = false;
        throw error;
      }
      
      // Wait for either a stopped event (indicating ready) or a timeout
      const LAUNCH_READY_TIMEOUT = 5000; // 5 seconds should be enough
      
      return new Promise<T>((resolve) => {
        let resolved = false;
        
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.jsDebugLaunchPending = false;
            // Don't reject, just resolve with empty response
            // The adapter might still be initializing
            this.logger.warn(`[ProxyManager] js-debug launch timeout after ${LAUNCH_READY_TIMEOUT}ms, proceeding anyway`);
            resolve({} as T);
          }
        }, LAUNCH_READY_TIMEOUT);
        
        // Store resolver to be called when we detect readiness
        const resolveWhenReady = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.jsDebugLaunchPending = false;
            this.logger.info(`[ProxyManager] js-debug launch confirmed ready`);
            resolve({} as T);
          }
        };
        
        this.jsDebugLaunchResolvers.push(resolveWhenReady);
      });
    }

    const requestId = uuidv4();
    const commandToSend = {
      cmd: 'dap',
      sessionId: this.sessionId,
      requestId,
      dapCommand: command,
      dapArgs: args
    };

    this.logger.info(`[ProxyManager] Sending DAP command: ${command}, requestId: ${requestId}`);

    return new Promise<T>((resolve, reject) => {
      this.pendingDapRequests.set(requestId, {
        resolve: resolve as (value: DebugProtocol.Response) => void,
        reject,
        command
      });

      // Mirror into functional core for observability (ProxyManager remains authoritative)
      if (this.dapState) {
        this.dapState = addPendingRequest(this.dapState, {
          requestId,
          command,
          seq: 0,
          timestamp: Date.now()
        });
      }

      try {
        this.sendCommand(commandToSend);
      } catch (error) {
        this.pendingDapRequests.delete(requestId);
        reject(error);
      }

      // Timeout handler
      setTimeout(() => {
        if (this.pendingDapRequests.has(requestId)) {
          this.pendingDapRequests.delete(requestId);
          reject(new Error(ErrorMessages.dapRequestTimeout(command, 35)));
        }
      }, 35000);
    });
  }

  isRunning(): boolean {
    return this.proxyProcess !== null && !this.proxyProcess.killed;
  }

  getCurrentThreadId(): number | null {
    return this.currentThreadId;
  }

  private async prepareSpawnContext(config: ProxyConfig): Promise<{
    executablePath: string;
    proxyScriptPath: string;
    env: Record<string, string>;
  }> {
    let executablePath = config.executablePath;

    if (this.adapter) {
      const validation = await this.adapter.validateEnvironment();
      if (!validation.valid) {
        throw new Error(
          `Invalid environment for ${this.adapter.language}: ${validation.errors[0].message}`
        );
      }

      if (!executablePath) {
        executablePath = await this.adapter.resolveExecutablePath();
        this.logger.info(`[ProxyManager] Adapter resolved executable path: ${executablePath}`);
      }
    } else if (!executablePath) {
      throw new Error('No executable path provided and no adapter available to resolve it');
    }

    const proxyScriptPath = await this.findProxyScript();

    if (!executablePath) {
      throw new Error('Executable path could not be determined after validation');
    }

    const env = this.cloneProcessEnv();

    return {
      executablePath,
      proxyScriptPath,
      env
    };
  }

  private cloneProcessEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }
    return env;
  }

  private async findProxyScript(): Promise<string> {
    const modulePath = fileURLToPath(this.runtimeEnv.moduleUrl);
    const moduleDir = path.dirname(modulePath);
    const dirParts = moduleDir.split(path.sep);
    const cwd = this.runtimeEnv.cwd();
    const lastPart = dirParts[dirParts.length - 1];
    const secondLast = dirParts[dirParts.length - 2];

    let distPath: string;
    if (lastPart === 'dist') {
      distPath = path.join(moduleDir, 'proxy', 'proxy-bootstrap.js');
    } else if (lastPart === 'proxy' && secondLast === 'dist') {
      distPath = path.join(moduleDir, 'proxy-bootstrap.js');
    } else {
      // Fallback to development layout
      distPath = path.resolve(moduleDir, '../../dist/proxy/proxy-bootstrap.js');
    }

    this.logger.info(`[ProxyManager] Checking for proxy script at: ${distPath}`);

    if (!(await this.fileSystem.pathExists(distPath))) {
      throw new Error(
        `Bootstrap worker script not found at: ${distPath}\n` +
        `Module directory: ${moduleDir}\n` +
        `Current working directory: ${cwd}\n` +
        `This usually means:\n` +
        `  1. You need to run 'npm run build' first\n` +
        `  2. The build failed to copy proxy files\n` +
        `  3. The TypeScript compilation structure is unexpected`
      );
    }

    return distPath;
  }

  private async sendInitWithRetry(initCommand: object): Promise<void> {
    const maxRetries = 5;
    const delays = [100, 200, 400, 800, 1600]; // Exponential backoff
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Send init command
        this.sendCommand(initCommand);

        // Wait for init_received acknowledgment
        const received = await Promise.race([
          new Promise<boolean>((resolve) => {
            const handler = () => {
              this.removeListener('init-received', handler);
              resolve(true);
            };
            this.on('init-received', handler);
          }),
          new Promise<boolean>((resolve) =>
            setTimeout(() => resolve(false), delays[Math.min(attempt, delays.length - 1)])
          )
        ]);

        if (received) {
          this.logger.info(`[ProxyManager] Init command acknowledged on attempt ${attempt + 1}`);
          return;
        }

        // If not received, will retry
        this.logger.warn(`[ProxyManager] Init not acknowledged, attempt ${attempt + 1}/${maxRetries + 1}`);
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`[ProxyManager] Error sending init on attempt ${attempt + 1}: ${lastError.message}`);
      }

      // Wait before retry (except on last attempt)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delays[Math.min(attempt, delays.length - 1)]));
      }
    }

    let detailMessage = `Failed to initialize proxy after ${maxRetries + 1} attempts. ${
      lastError ? `Last error: ${lastError.message}` : 'Init command not acknowledged'
    }`;

    if (this.lastExitDetails) {
      const { code, signal, capturedStderr } = this.lastExitDetails;
      const stderrSnippet = capturedStderr.length
        ? capturedStderr.slice(-10).join('\n')
        : '<<no stderr captured>>';
      detailMessage += ` Proxy exit details -> code=${code} signal=${signal} stderr:\n${stderrSnippet}`;
    }

    throw new Error(detailMessage);
  }

  private sendCommand(command: object): void {
    if (!this.proxyProcess || this.proxyProcess.killed) {
      if (this.lastExitDetails) {
        this.logger.error(
          `[ProxyManager] Attempted to send command after proxy unavailable. Last exit -> code=${this.lastExitDetails.code} signal=${this.lastExitDetails.signal}`,
          this.lastExitDetails.capturedStderr
        );
      } else {
        this.logger.error('[ProxyManager] Attempted to send command but proxy process is not available (no exit details recorded).');
      }
      throw new Error('Proxy process not available');
    }

    const rawChild =
      (this.proxyProcess as unknown as { childProcess?: { connected?: boolean; pid?: number; killed?: boolean } })
        .childProcess;
    const requestId = (command as { requestId?: string }).requestId;
    const cmd = (command as { cmd?: string }).cmd;
    const dapCommand = (command as { dapCommand?: string }).dapCommand;

    const connectedBefore =
      rawChild && typeof rawChild.connected === 'boolean' ? rawChild.connected : undefined;
    const childPid = rawChild?.pid;

    this.logger.debug(
      `[ProxyManager] IPC pre-send pid=${childPid ?? 'unknown'} connected=${connectedBefore} cmd=${cmd}${
        dapCommand ? `/${dapCommand}` : ''
      } requestId=${requestId ?? 'n/a'}`
    );

    this.logger.info(`[ProxyManager] Sending command to proxy: ${JSON.stringify(command).substring(0, 500)}`);

    try {
      this.proxyProcess.sendCommand(command);
      this.logger.info(`[ProxyManager] Command dispatched via proxy process`);

      const connectedAfter =
        rawChild && typeof rawChild.connected === 'boolean' ? rawChild.connected : undefined;
      this.logger.debug(
        `[ProxyManager] IPC post-send pid=${childPid ?? 'unknown'} connected=${connectedAfter} cmd=${cmd}${
          dapCommand ? `/${dapCommand}` : ''
        } requestId=${requestId ?? 'n/a'}`
      );
    } catch (error) {
      const connectedAfter =
        rawChild && typeof rawChild.connected === 'boolean' ? rawChild.connected : undefined;
      this.logger.error(
        `[ProxyManager] Failed to send command (pid=${childPid ?? 'unknown'} connected=${connectedAfter} cmd=${cmd}${
          dapCommand ? `/${dapCommand}` : ''
        } requestId=${requestId ?? 'n/a'})`,
        error
      );
      this.logger.error(`[ProxyManager] Failed to send command:`, error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.proxyProcess) return;

    // Handle IPC messages
    this.proxyProcess.on('message', (rawMessage: unknown) => {
      this.handleProxyMessage(rawMessage);
    });

    this.proxyProcess.on('ipc-send-start', (data: { pid?: number; connectedBefore?: boolean; summary?: string; timestamp?: number }) => {
      this.logger.debug(
        `[ProxyManager] IPC send start pid=${data?.pid ?? 'unknown'} connected=${data?.connectedBefore} summary=${data?.summary ?? 'n/a'}`
      );
    });

    this.proxyProcess.on('ipc-send-complete', (data: { pid?: number; connectedAfter?: boolean; summary?: string; timestamp?: number; queueSizeBefore?: number; queueSizeAfter?: number }) => {
      this.logger.debug(
        `[ProxyManager] IPC send complete pid=${data?.pid ?? 'unknown'} connected=${data?.connectedAfter} summary=${data?.summary ?? 'n/a'} queueBefore=${data?.queueSizeBefore ?? 'n/a'} queueAfter=${data?.queueSizeAfter ?? 'n/a'}`
      );
    });

    this.proxyProcess.on('ipc-send-failed', (data: { pid?: number; killed?: boolean; childProcessKilled?: boolean | string; summary?: string; timestamp?: number }) => {
      this.logger.warn(
        `[ProxyManager] IPC send returned false pid=${data?.pid ?? 'unknown'} killed=${data?.killed} childKilled=${data?.childProcessKilled} summary=${data?.summary ?? 'n/a'}`
      );
    });

    this.proxyProcess.on('ipc-send-error', (data: { pid?: number; error?: string; summary?: string; timestamp?: number }) => {
      this.logger.error(
        `[ProxyManager] IPC send error pid=${data?.pid ?? 'unknown'} error=${data?.error ?? 'unknown'} summary=${data?.summary ?? 'n/a'}`
      );
    });

    // Handle stderr
    this.proxyProcess.stderr?.on('data', (data: Buffer | string) => {
      const output = data.toString().trim();
      this.logger.error(`[ProxyManager STDERR] ${output}`);
      // Capture stderr for error reporting during initialization
      if (!this.isInitialized) {
        this.stderrBuffer.push(output);
      }
    });

    // Handle exit
    this.proxyProcess.on('exit', (code: number | null, signal: string | null) => {
      this.logger.info(`[ProxyManager] Proxy exited. Code: ${code}, Signal: ${signal}`);

      this.lastExitDetails = {
        code,
        signal,
        timestamp: Date.now(),
        capturedStderr: [...this.stderrBuffer],
      };

      if (!this.isInitialized) {
        this.logger.error(
          `[ProxyManager] Proxy exited before initialization. code=${code} signal=${signal} stderrLines=${this.stderrBuffer.length}`,
          this.stderrBuffer
        );
      }

      this.handleProxyExit(code, signal);
    });

    // Handle errors
    this.proxyProcess.on('error', (err: Error) => {
      this.logger.error(`[ProxyManager] Proxy error:`, err);
      this.emit('error', err);
      this.cleanup();
    });
  }

  private handleProxyMessage(rawMessage: unknown): void {
    if ((rawMessage as { type?: string })?.type === 'ipc-heartbeat') {
      const heartbeat = rawMessage as { counter?: number; timestamp?: number };
      this.logger.debug(
        `[ProxyManager] Received worker heartbeat counter=${heartbeat.counter ?? 'n/a'} timestamp=${heartbeat.timestamp ?? 'n/a'}`
      );
      return;
    }
    if ((rawMessage as { type?: string })?.type === 'ipc-heartbeat-tick') {
      const heartbeatTick = rawMessage as { timestamp?: number };
      this.logger.debug(
        `[ProxyManager] Received worker heartbeat tick timestamp=${heartbeatTick.timestamp ?? 'n/a'}`
      );
      return;
    }
    this.proxyMessageCounter += 1;
    this.logger.debug(
      `[ProxyManager] Received message #${this.proxyMessageCounter}:`,
      rawMessage
    );

    // Validate message format
    if (!isValidProxyMessage(rawMessage)) {
      this.logger.warn(`[ProxyManager] Invalid message format:`, rawMessage);
      return;
    }

    const message = rawMessage as ProxyMessage;

    // Fast-path: always forward DAP events to consumers to avoid missing stops/output
    if (message.type === 'dapEvent') {
      this.handleDapEvent(message as ProxyDapEventMessage);
    }
    
    // Handle status messages
    if (message.type === 'status') {
      this.handleStatusMessage(message as ProxyStatusMessage);
    }

    // Use functional core if state is initialized
    if (this.dapState) {
      const result = handleProxyMessage(this.dapState, message);
      
      // Execute commands from functional core
      for (const command of result.commands) {
        switch (command.type) {
          case 'log':
            this.logger[command.level](command.message, command.data);
            break;
            
          case 'emitEvent':
            {
              const args = (command.args as unknown[]) ?? [];
              this.emit(command.event as keyof ProxyManagerEvents, ...(args as never[]));
            }
            break;
            
          case 'killProcess':
            this.proxyProcess?.kill();
            break;
            
          case 'sendToProxy':
            this.sendCommand(command.command);
            break;
            
          // Note: sendToClient is not used in ProxyManager context
        }
      }
      
      // Update state if changed
      if (result.newState) {
        this.dapState = result.newState;
        
        // Sync local state with functional core state
        this.isInitialized = result.newState.initialized;
        this.adapterConfigured = result.newState.adapterConfigured;
        // Only update currentThreadId if the core provided a concrete number.
        // Avoid overwriting the value we set in the fast-path dapEvent handler with null/undefined.
        const coreTid = (result.newState as { currentThreadId?: number | null }).currentThreadId;
        if (typeof coreTid === 'number') {
          this.currentThreadId = coreTid;
        }
      }
      
      // Handle pending DAP responses (still done imperatively for now)
      if (message.type === 'dapResponse') {
        this.handleDapResponse(message as ProxyDapResponseMessage);
      }
    } else {
      // Fallback if state not initialized (shouldn't happen)
      this.logger.error(`[ProxyManager] DAP state not initialized`);
    }
  }

  private handleDapResponse(message: ProxyDapResponseMessage): void {
    const pending = this.pendingDapRequests.get(message.requestId);
    if (!pending) {
      // During shutdown, it's normal to receive responses for requests that were cancelled
      if (this.proxyProcess) {
        this.logger.debug(`[ProxyManager] Received response for unknown/cancelled request: ${message.requestId}`);
      }
      return;
    }

    this.pendingDapRequests.delete(message.requestId);
    // Mirror completion into functional core
    if (this.dapState) {
      this.dapState = removePendingRequest(this.dapState, message.requestId);
    }

    if (message.success) {
      // If this was a 'threads' response, opportunistically capture a usable thread id
      try {
        if (pending.command === 'threads') {
          const resp = (message.response || message.body) as DebugProtocol.ThreadsResponse | undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const threads = (resp && (resp as any).body && Array.isArray((resp as any).body.threads)) ? (resp as any).body.threads : [];
          const first = threads.length ? threads[0]?.id : undefined;
          if (typeof first === 'number') {
            this.currentThreadId = first;
          }
        }
      } catch {
        // ignore capture errors
      }
      pending.resolve((message.response || message.body) as DebugProtocol.Response);
    } else {
      pending.reject(new Error(message.error || `DAP request '${pending.command}' failed`));
    }
  }

  private handleDapEvent(message: ProxyDapEventMessage): void {
    this.logger.info(`[ProxyManager] DAP event: ${message.event}`, message.body);

    switch (message.event) {
      case 'stopped':
        const stoppedBody = message.body as { threadId?: number; reason?: string } | undefined;
        const threadIdMaybe = (typeof stoppedBody?.threadId === 'number') ? stoppedBody!.threadId! : undefined;
        const reason = stoppedBody?.reason || 'unknown';
        if (typeof threadIdMaybe === 'number') {
          this.currentThreadId = threadIdMaybe;
        }
        
        // If js-debug launch is pending, resolve it now
        if (this.jsDebugLaunchPending && this.jsDebugLaunchResolvers.length > 0) {
          this.logger.info(`[ProxyManager] js-debug stopped event received, resolving pending launch`);
          const resolvers = this.jsDebugLaunchResolvers;
          this.jsDebugLaunchResolvers = [];
          resolvers.forEach(resolve => resolve());
        }
        
        // Do not fabricate a threadId; emit undefined if adapter omitted it
        this.emit('stopped', threadIdMaybe as unknown as number, reason, stoppedBody as DebugProtocol.StoppedEvent['body']);
        break;
      
      case 'continued':
        this.emit('continued');
        break;
      
      case 'terminated':
        this.emit('terminated');
        break;
      
      case 'exited':
        this.emit('exited');
        break;
      
      // Forward other events as generic DAP events
      default:
        this.emit('dap-event', message.event, message.body);
    }
  }

  private handleStatusMessage(message: ProxyStatusMessage): void {
    switch (message.status) {
      case 'proxy_minimal_ran_ipc_test':
        this.logger.info(`[ProxyManager] IPC test message received`);
        this.proxyProcess?.kill();
        break;

      case 'init_received':
        this.logger.info(`[ProxyManager] Init command acknowledged by proxy`);
        this.emit('init-received');
        break;

      case 'dry_run_complete':
        this.logger.info(`[ProxyManager] Dry run complete`);
        this.dryRunCompleteReceived = true;
        if (typeof message.command === 'string' && message.command.trim().length > 0) {
          this.dryRunCommandSnapshot = message.command;
        }
        if (typeof message.script === 'string' && message.script.trim().length > 0) {
          this.dryRunScriptPath = message.script;
        }
        this.emit('dry-run-complete', message.command, message.script);
        break;
      
      case 'adapter_configured_and_launched':
        this.logger.info(`[ProxyManager] Adapter configured and launched`);
        this.adapterConfigured = true;
        this.emit('adapter-configured');
        if (!this.isInitialized) {
          this.isInitialized = true;
          this.emit('initialized');
        }
        break;
      
      case 'adapter_connected':
        // JS adapter transport is up; allow client to proceed with DAP handshake.
        this.logger.info(`[ProxyManager] Adapter transport connected (JS). Marking initialized to unblock client handshake.`);
        if (!this.isInitialized) {
          this.isInitialized = true;
          this.emit('initialized');
        }
        
        // If js-debug launch is pending and we haven't gotten a stopped event, 
        // consider the adapter ready after connection
        if (this.jsDebugLaunchPending && this.jsDebugLaunchResolvers.length > 0) {
          // Give it a small delay to ensure adapter is fully ready
          setTimeout(() => {
            if (this.jsDebugLaunchPending && this.jsDebugLaunchResolvers.length > 0) {
              this.logger.info(`[ProxyManager] js-debug adapter connected, resolving pending launch`);
              const resolvers = this.jsDebugLaunchResolvers;
              this.jsDebugLaunchResolvers = [];
              resolvers.forEach(resolve => resolve());
            }
          }, 500);
        }
        break;
      
      case 'adapter_exited':
      case 'dap_connection_closed':
      case 'terminated':
        this.logger.info(`[ProxyManager] Status: ${message.status}`);
        this.emit('exit', message.code || 1, message.signal || undefined);
        break;
    }
  }

  private handleProxyExit(code: number | null, signal: string | null): void {
    if (this.isDryRun && code === 0 && !this.dryRunCompleteReceived) {
      const fallbackCommand = this.dryRunCommandSnapshot ?? '(command unavailable)';
      const fallbackScript = this.dryRunScriptPath ?? '';
      this.logger.warn(
        `[ProxyManager] Dry run proxy exited without reporting completion; synthesizing dry-run-complete event.`
      );
      this.dryRunCompleteReceived = true;
      this.dryRunCommandSnapshot = fallbackCommand;
      this.dryRunScriptPath = fallbackScript;
      this.emit('dry-run-complete', fallbackCommand, fallbackScript);
    }

    // Clean up pending requests
    this.pendingDapRequests.forEach(pending => {
      pending.reject(new Error('Proxy exited'));
    });
    this.pendingDapRequests.clear();

    // Emit exit event
    this.emit('exit', code, signal || undefined);

    // Clean up
    this.cleanup();
  }

  private cleanup(): void {
    // Clear pending DAP requests to avoid "unknown request" warnings during shutdown
    if (this.pendingDapRequests.size > 0) {
      this.logger.debug(`[ProxyManager] Clearing ${this.pendingDapRequests.size} pending DAP requests during cleanup`);
      for (const pending of this.pendingDapRequests.values()) {
        pending.reject(new Error(`Request cancelled during proxy shutdown: ${pending.command}`));
      }
      this.pendingDapRequests.clear();
    }
    // Clear functional core mirror
    if (this.dapState) {
      this.dapState = clearPendingRequests(this.dapState);
    }
    
    // Clear js-debug launch state
    this.jsDebugLaunchPending = false;
    this.jsDebugLaunchResolvers = [];
    
    this.proxyProcess = null;
    this.isInitialized = false;
    this.adapterConfigured = false;
    this.currentThreadId = null;
  }

  hasDryRunCompleted(): boolean {
    return this.dryRunCompleteReceived;
  }

  getDryRunSnapshot(): { command?: string; script?: string } | undefined {
    if (!this.dryRunCommandSnapshot && !this.dryRunScriptPath) {
      return undefined;
    }
    return {
      command: this.dryRunCommandSnapshot,
      script: this.dryRunScriptPath
    };
  }
}
