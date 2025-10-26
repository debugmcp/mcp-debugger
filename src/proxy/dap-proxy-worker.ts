/**
 * Core worker class for DAP Proxy functionality - REFACTORED VERSION
 * Uses the Adapter Policy pattern to eliminate language-specific hardcoding
 */

import { ChildProcess } from 'child_process';
import path from 'path';
import { DebugProtocol } from '@vscode/debugprotocol';
import {
  DapProxyDependencies,
  ParentCommand,
  ProxyInitPayload,
  DapCommandPayload,
  IDapClient,
  ILogger,
  ProxyState,
  StatusMessage,
  DapResponseMessage,
  DapEventMessage,
  ErrorMessage
} from './dap-proxy-interfaces.js';
import { CallbackRequestTracker } from './dap-proxy-request-tracker.js';
import { GenericAdapterManager } from './dap-proxy-adapter-manager.js';
import { DapConnectionManager } from './dap-proxy-connection-manager.js';
import { 
  validateProxyInitPayload
} from '../utils/type-guards.js';
import { SilentDapCommandPayload } from './dap-extensions.js';
// Import adapter policies from shared package
import type { AdapterPolicy, AdapterSpecificState } from '@debugmcp/shared';
import { 
  DefaultAdapterPolicy,
  JsDebugAdapterPolicy,
  PythonAdapterPolicy,
  MockAdapterPolicy
} from '@debugmcp/shared';

export type DapProxyWorkerHooks = {
  /**
   * Custom exit handler used when the worker encounters a fatal error.
   * Defaults to process.exit for production usage.
   */
  exit?: (code: number) => void;

  /**
   * Factory responsible for configuring DAP frame tracing.
   * Should return the path used for logging if tracing is enabled.
   */
  createTraceFile?: (sessionId: string, logDir: string) => string | undefined;
};

export class DapProxyWorker {
  private logger: ILogger | null = null;
  private dapClient: IDapClient | null = null;
  private adapterProcess: ChildProcess | null = null;
  private currentSessionId: string | null = null;
  private currentInitPayload: ProxyInitPayload | null = null;
  private state: ProxyState = ProxyState.UNINITIALIZED;
  private requestTracker: CallbackRequestTracker;
  private processManager: GenericAdapterManager | null = null;
  private connectionManager: DapConnectionManager | null = null;
  
  // Policy-based state management
  private adapterPolicy: AdapterPolicy = DefaultAdapterPolicy;
  private adapterState: AdapterSpecificState;
  private commandQueue: (DapCommandPayload | SilentDapCommandPayload)[] = [];
  private preConnectQueue: DapCommandPayload[] = [];

  private readonly exitHook: (code: number) => void;
  private readonly traceFileFactory: (sessionId: string, logDir: string) => string | undefined;

  constructor(
    private dependencies: DapProxyDependencies,
    hooks: DapProxyWorkerHooks = {}
  ) {
    this.requestTracker = new CallbackRequestTracker(
      (requestId, command) => this.handleRequestTimeout(requestId, command)
    );
    this.adapterState = DefaultAdapterPolicy.createInitialState();

    this.exitHook = hooks.exit ?? ((code: number) => {
      // Default to preserving existing behaviour in production.
      process.exit(code);
    });

    this.traceFileFactory = hooks.createTraceFile ?? ((sessionId: string, logDir: string) => {
      const tracePath = path.join(logDir, `dap-trace-${sessionId}.ndjson`);
      process.env.DAP_TRACE_FILE = tracePath;
      return tracePath;
    });
  }

  /**
   * Select the appropriate adapter policy based on the adapter command
   */
  private selectAdapterPolicy(adapterCommand?: { command: string; args: string[] }): AdapterPolicy {
    if (!adapterCommand) {
      // Legacy Python mode
      return PythonAdapterPolicy;
    }
    
    // Check each policy's matcher
    if (JsDebugAdapterPolicy.matchesAdapter(adapterCommand)) {
      return JsDebugAdapterPolicy;
    } else if (PythonAdapterPolicy.matchesAdapter(adapterCommand)) {
      return PythonAdapterPolicy;
    } else if (MockAdapterPolicy.matchesAdapter(adapterCommand)) {
      return MockAdapterPolicy;
    }
    
    // Fallback to default
    return DefaultAdapterPolicy;
  }

  /**
   * Get current state for testing
   */
  getState(): ProxyState {
    return this.state;
  }

  /**
   * Main command handler
   */
  async handleCommand(command: ParentCommand): Promise<void> {
    this.currentSessionId = command.sessionId || null;

    try {
      switch (command.cmd) {
        case 'init':
          await this.handleInitCommand(command);
          break;
        case 'dap':
          await this.handleDapCommand(command);
          break;
        case 'terminate':
          await this.handleTerminate();
          break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger?.error(`[Worker] Error handling command ${command.cmd}:`, error);
      this.sendError(`Error handling ${command.cmd}: ${message}`);
    }
  }

  /**
   * Handle initialization command
   */
  async handleInitCommand(payload: ProxyInitPayload): Promise<void> {
    if (this.state !== ProxyState.UNINITIALIZED) {
      throw new Error(`Invalid state for init: ${this.state}`);
    }

    // Validate payload structure
    const validatedPayload = validateProxyInitPayload(payload);
    
    // Select adapter policy
    this.adapterPolicy = this.selectAdapterPolicy(validatedPayload.adapterCommand);
    this.adapterState = this.adapterPolicy.createInitialState();
    this.logger?.info(`[Worker] Selected adapter policy: ${this.adapterPolicy.name}`);
    
    this.state = ProxyState.INITIALIZING;
    this.currentInitPayload = validatedPayload;

    try {
      // Create logger
      const logPath = path.join(payload.logDir, `proxy-${payload.sessionId}.log`);
      await this.dependencies.fileSystem.ensureDir(path.dirname(logPath));
      this.logger = await this.dependencies.loggerFactory(payload.sessionId, payload.logDir);
      this.logger.info(`[Worker] DAP Proxy worker initialized for session ${payload.sessionId}`);
      this.logger.info(`[Worker] Using adapter policy: ${this.adapterPolicy.name}`);

      // Enable per-session DAP frame tracing for diagnostics
      try {
        const tracePath = this.traceFileFactory(payload.sessionId, payload.logDir);
        if (tracePath) {
          this.logger?.info(`[Worker] DAP trace enabled at: ${tracePath}`);
        } else {
          this.logger?.debug?.('[Worker] Trace file factory returned no path - tracing disabled');
        }
      } catch (e) {
        this.logger.warn?.('[Worker] Failed to configure DAP trace file', e as Error);
      }

      // Create generic adapter manager
      this.processManager = new GenericAdapterManager(
        this.dependencies.processSpawner,
        this.logger,
        this.dependencies.fileSystem
      );
      
      this.connectionManager = new DapConnectionManager(
        this.dependencies.dapClientFactory,
        this.logger
      );
      // Set the adapter policy for DAP client creation
      this.connectionManager.setAdapterPolicy(this.adapterPolicy);

      this.logger.info(`[Worker] Script path to debug: ${payload.scriptPath}`);

      // Handle dry run
      if (payload.dryRunSpawn) {
        this.handleDryRun(payload);
        return;
      }

      // Start adapter and connect
      await this.startDebugpyAdapterAndConnect(payload);
    } catch (error) {
      this.state = ProxyState.UNINITIALIZED;
      const message = error instanceof Error ? error.message : String(error);
      this.logger?.error(`[Worker] Critical initialization error: ${message}`, error);
      await this.shutdown();
      this.exitHook(1);
    }
  }

  /**
   * Handle dry run mode
   */
  private handleDryRun(payload: ProxyInitPayload): void {
    // Get adapter spawn config from policy
    const spawnConfig = this.adapterPolicy.getAdapterSpawnConfig?.({
      executablePath: payload.executablePath,
      adapterHost: payload.adapterHost,
      adapterPort: payload.adapterPort,
      logDir: payload.logDir,
      scriptPath: payload.scriptPath,
      adapterCommand: payload.adapterCommand
    });
    
    if (!spawnConfig) {
      throw new Error(`Cannot determine adapter command for dry run (policy: ${this.adapterPolicy.name})`);
    }
    
    const fullCommand = `${spawnConfig.command} ${spawnConfig.args.join(' ')}`;
    
    this.logger!.warn(`[Worker DRY_RUN] Would execute: ${fullCommand}`);
    this.logger!.warn(`[Worker DRY_RUN] Script to debug: ${payload.scriptPath}`);
    
    this.sendStatus('dry_run_complete', { command: fullCommand, script: payload.scriptPath });
    
    this.state = ProxyState.TERMINATED;
    this.logger!.info('[Worker DRY_RUN] Dry run complete. State set to TERMINATED.');
  }

  /**
   * Start adapter and establish connection
   */
  private async startDebugpyAdapterAndConnect(payload: ProxyInitPayload): Promise<void> {
    // Get adapter spawn config from policy
    const spawnConfig = this.adapterPolicy.getAdapterSpawnConfig?.({
      executablePath: payload.executablePath,
      adapterHost: payload.adapterHost,
      adapterPort: payload.adapterPort,
      logDir: payload.logDir,
      scriptPath: payload.scriptPath,
      adapterCommand: payload.adapterCommand
    });
    
    if (!spawnConfig) {
      throw new Error(`Adapter policy ${this.adapterPolicy.name} does not provide spawn configuration`);
    }
    
    // Spawn adapter process using the config from the policy
    const spawnResult = await this.processManager!.spawn(spawnConfig);

    this.adapterProcess = spawnResult.process;
    this.logger!.info(`[Worker] Adapter spawned with PID: ${spawnResult.pid}`);

    // Monitor adapter process
    this.adapterProcess.on('error', (err) => {
      this.logger!.error('[Worker] Adapter process error:', err);
      this.sendError(`Adapter process error: ${err.message}`);
    });

    this.adapterProcess.on('exit', (code, signal) => {
      this.logger!.info(`[Worker] Adapter process exited. Code: ${code}, Signal: ${signal}`);
      this.sendStatus('adapter_exited', { code, signal });
    });

    // Connect to adapter
    try {
      this.dapClient = await this.connectionManager!.connectWithRetry(
        payload.adapterHost,
        payload.adapterPort
      );

      // Set up event handlers
      this.setupDapEventHandlers();

      // Check if adapter requires command queueing
      if (this.adapterPolicy.requiresCommandQueueing()) {
        this.logger!.info(`[Worker] ${this.adapterPolicy.name} adapter detected; command queueing enabled`);
        this.state = ProxyState.CONNECTED;
        this.sendStatus('adapter_connected');
        await this.drainPreConnectQueue();
      } else {
        // Initialize DAP session with correct adapterId
        await this.connectionManager!.initializeSession(
          this.dapClient,
          payload.sessionId,
          this.adapterPolicy.getDapAdapterConfiguration().type
        );
        
        // Send automatic launch request for non-queueing adapters
        this.logger!.info('[Worker] Sending launch request with scriptPath:', payload.scriptPath);
        
        await this.connectionManager!.sendLaunchRequest(
          this.dapClient,
          payload.scriptPath,
          payload.scriptArgs,
          payload.stopOnEntry,
          payload.justMyCode
        );
      }

      this.logger!.info('[Worker] Waiting for "initialized" event from adapter.');
    } catch (error) {
      await this.shutdown();
      throw error;
    }
  }

  /**
   * Set up DAP event handlers
   */
  private setupDapEventHandlers(): void {
    if (!this.dapClient || !this.connectionManager) return;

    this.connectionManager.setupEventHandlers(this.dapClient, {
      onInitialized: async () => {
        // Update adapter state
        if (this.adapterPolicy.updateStateOnEvent) {
          this.adapterPolicy.updateStateOnEvent('initialized', {}, this.adapterState);
        }
        
        if (this.adapterPolicy.requiresCommandQueueing()) {
          this.logger!.info(`[Worker] DAP "initialized" (${this.adapterPolicy.name}) received; forwarding event and draining queue.`);
          this.sendDapEvent('initialized', {});
          await this.drainCommandQueue();
        } else {
          await this.handleInitializedEvent();
        }
      },
      onOutput: (body) => {
        this.logger!.debug('[Worker] DAP event: output', body);
        this.sendDapEvent('output', body);
      },
      onStopped: (body) => {
        this.logger!.info('[Worker] DAP event: stopped', body);
        this.sendDapEvent('stopped', body);
      },
      onContinued: (body) => {
        this.logger!.info('[Worker] DAP event: continued', body);
        this.sendDapEvent('continued', body);
      },
      onThread: (body) => {
        this.logger!.debug('[Worker] DAP event: thread', body);
        this.sendDapEvent('thread', body);
      },
      onExited: (body) => {
        this.logger!.info('[Worker] DAP event: exited (debuggee)', body);
        this.sendDapEvent('exited', body);
      },
      onTerminated: (body) => {
        this.logger!.info('[Worker] DAP event: terminated (session)', body);
        this.sendDapEvent('terminated', body);
        this.shutdown();
      },
      onError: (err) => {
        this.logger!.error('[Worker] DAP client error:', err);
        this.sendError(`DAP client error: ${err.message}`);
      },
      onClose: () => {
        this.logger!.info('[Worker] DAP client connection closed.');
        this.sendStatus('dap_connection_closed');
        this.shutdown();
      }
    });
  }

  /**
   * Handle DAP initialized event
   */
  private async handleInitializedEvent(): Promise<void> {
    this.logger!.info('[Worker] DAP "initialized" event received.');

    if (!this.currentInitPayload || !this.dapClient || !this.connectionManager) {
      throw new Error('Missing required state in initialized handler');
    }

    try {
      // Set initial breakpoints if provided
      if (this.currentInitPayload.initialBreakpoints?.length) {
        await this.connectionManager.setBreakpoints(
          this.dapClient,
          this.currentInitPayload.scriptPath,
          this.currentInitPayload.initialBreakpoints
        );
      }

      // Send configuration done
      await this.connectionManager.sendConfigurationDone(this.dapClient);

      // Update state and notify parent
      this.state = ProxyState.CONNECTED;
      this.sendStatus('adapter_configured_and_launched');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger!.error('[Worker] Error in initialized handler:', error);
      this.sendError(`Error in DAP sequence: ${message}`);
      await this.shutdown();
    }
  }

  /**
   * Handle DAP command
   */
  async handleDapCommand(payload: DapCommandPayload): Promise<void> {
    // If shutting down, fail fast
    if (this.state === ProxyState.SHUTTING_DOWN || this.state === ProxyState.TERMINATED) {
      this.sendDapResponse(payload.requestId, false, undefined, 'Proxy is shutting down');
      return;
    }

    // Queue or fail-fast any DAP requests until the transport is connected
    if (!this.dapClient || this.state !== ProxyState.CONNECTED) {
      if (this.adapterPolicy.requiresCommandQueueing()) {
        this.logger?.info(`[Worker] Queuing '${payload.dapCommand}' until DAP client connected (${this.adapterPolicy.name}).`);
        this.preConnectQueue.push(payload);
      } else {
        this.logger?.info(`[Worker] Rejecting '${payload.dapCommand}' before connection: DAP client not connected`);
        this.sendDapResponse(payload.requestId, false, undefined, 'DAP client not connected');
      }
      return;
    }

    try {
      // Check if command should be queued based on policy
      const handling = this.adapterPolicy.shouldQueueCommand(payload.dapCommand, this.adapterState);
      
      if (handling.shouldQueue) {
        this.logger!.info(`[Worker] ${handling.reason || 'Queuing command'}`);
        
        // Check if we need to inject configurationDone
        const initBehavior = this.adapterPolicy.getInitializationBehavior();
        if (handling.shouldDefer && initBehavior.deferConfigDone) {
          const hasQueuedConfigDone = this.commandQueue.some(p => p.dapCommand === 'configurationDone');
          if (!hasQueuedConfigDone) {
            // Inject a silent configurationDone
            const silentCommand: SilentDapCommandPayload = { 
              requestId: `__silent_configDone_${Date.now()}`, 
              dapCommand: 'configurationDone', 
              dapArgs: {},
              sessionId: payload.sessionId,
              cmd: 'dap',
              // Mark as silent so we don't send response
              __silent: true
            };
            this.commandQueue.push(silentCommand);
          }
        }
        
        this.commandQueue.push(payload);
        await this.drainCommandQueue();
        return;
      }

      // Track request
      this.requestTracker.track(payload.requestId, payload.dapCommand);

      // Log setBreakpoints for debugging
      if (payload.dapCommand === 'setBreakpoints') {
        this.logger!.info(`[Worker] Sending 'setBreakpoints' command. Args:`, payload.dapArgs);
      }

      // Add runtimeExecutable from executablePath if needed
      let dapArgs = payload.dapArgs;
      const initBehavior = this.adapterPolicy.getInitializationBehavior();
      if (initBehavior.addRuntimeExecutable && payload.dapCommand === 'launch' && this.currentInitPayload?.executablePath) {
        const launchArgs = dapArgs as Record<string, unknown>;
        if (!launchArgs.runtimeExecutable) {
          launchArgs.runtimeExecutable = this.currentInitPayload.executablePath;
          this.logger!.info(`[Worker] Added runtimeExecutable to launch args: ${launchArgs.runtimeExecutable}`);
          dapArgs = launchArgs;
        }
      }

      // Send request
      const response = await this.dapClient.sendRequest(payload.dapCommand, dapArgs);
      
      // Update adapter state if needed
      if (this.adapterPolicy.updateStateOnCommand) {
        this.adapterPolicy.updateStateOnCommand(payload.dapCommand, dapArgs, this.adapterState);
      }

      // Mark initialize response received if needed
      if (this.adapterPolicy.updateStateOnResponse) {
        this.adapterPolicy.updateStateOnResponse(payload.dapCommand, response, this.adapterState);
      } else if (initBehavior.trackInitializeResponse && payload.dapCommand === 'initialize') {
        // Fallback for policies that rely on worker-managed initialize tracking.
        (this.adapterState as AdapterSpecificState & { initializeResponded?: boolean }).initializeResponded = true;
      }

      // Complete tracking
      this.requestTracker.complete(payload.requestId);

      // Send response
      this.sendDapResponse(payload.requestId, true, response);
      
      // Ensure initial stop after launch if needed
      if (initBehavior.requiresInitialStop && (payload.dapCommand === 'launch' || payload.dapCommand === 'attach')) {
        try {
          await this.drainCommandQueue();
          await this.ensureInitialStop();
        } catch {
          // ignore
        }
      }
    } catch (error) {
      this.requestTracker.complete(payload.requestId);
      const message = error instanceof Error ? error.message : String(error);
      this.logger!.error(`[Worker] DAP command ${payload.dapCommand} failed:`, { error: message });
      this.sendDapResponse(payload.requestId, false, undefined, message);
    }
  }

  /**
   * Drain the command queue
   */
  private async drainCommandQueue(): Promise<void> {
    if (!this.dapClient || this.commandQueue.length === 0) return;
    
    this.logger!.info(`[Worker] Draining command queue. Count: ${this.commandQueue.length}`);
    
    // Process commands through policy if it has a processor
    let ordered = this.commandQueue;
    if (this.adapterPolicy.processQueuedCommands) {
      ordered = this.adapterPolicy.processQueuedCommands(this.commandQueue, this.adapterState) as DapCommandPayload[];
    }
    
    // Clear queue after ordering
    this.commandQueue = [];
    
    for (const payload of ordered) {
      try {
        const silent = ((payload as SilentDapCommandPayload).__silent === true);
        if (silent) {
          await this.dapClient!.sendRequest(payload.dapCommand, payload.dapArgs);
          if (this.adapterPolicy.updateStateOnCommand) {
            this.adapterPolicy.updateStateOnCommand(payload.dapCommand, payload.dapArgs || {}, this.adapterState);
          }
          continue;
        }

        this.requestTracker.track(payload.requestId, payload.dapCommand);
        const response = await this.dapClient!.sendRequest(payload.dapCommand, payload.dapArgs);
        
        if (this.adapterPolicy.updateStateOnCommand) {
          this.adapterPolicy.updateStateOnCommand(payload.dapCommand, payload.dapArgs || {}, this.adapterState);
        }
        
        this.requestTracker.complete(payload.requestId);
        this.sendDapResponse(payload.requestId, true, response);
        
        const initBehavior = this.adapterPolicy.getInitializationBehavior();
        if (initBehavior.requiresInitialStop && (payload.dapCommand === 'launch' || payload.dapCommand === 'attach')) {
          try {
            await this.ensureInitialStop();
          } catch {
            // ignore
          }
        }
      } catch (error) {
        this.requestTracker.complete(payload.requestId);
        const message = error instanceof Error ? error.message : String(error);
        this.logger!.error(`[Worker] Queued DAP command ${payload.dapCommand} failed:`, { error: message });
        this.sendDapResponse(payload.requestId, false, undefined, message);
      }
    }
  }

  /**
   * Ensure initial stop for JavaScript debugging
   */
  private async ensureInitialStop(timeoutMs: number = 12000): Promise<void> {
    if (!this.dapClient) return;
    const start = Date.now();

    try {
      while (Date.now() - start < timeoutMs) {
        try {
          const threadsResp = await this.dapClient.sendRequest<DebugProtocol.ThreadsResponse>('threads', {});
          const first = threadsResp?.body?.threads?.[0]?.id;
          if (typeof first === 'number' && first > 0) {
            const pauseTid = first;
            this.logger?.info(`[Worker] ensureInitialStop: pausing threadId=${pauseTid}`);
            try {
              await this.dapClient.sendRequest('pause', { threadId: pauseTid });
            } catch {
              // ignore pause errors
            }
            return;
          }
        } catch {
          // ignore threads errors
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      this.logger?.warn('[Worker] ensureInitialStop: no threads discovered within timeout');
    } finally {
      // nothing to unsubscribe
    }
  }

  /**
   * Drain pre-connect queue
   */
  private async drainPreConnectQueue(): Promise<void> {
    if (!this.dapClient || !this.preConnectQueue.length) return;
    this.logger!.info('[Worker] Draining pre-connect DAP request queue. Count:', this.preConnectQueue.length);
    const queued = [...this.preConnectQueue];
    this.preConnectQueue = [];
    for (const payload of queued) {
      await this.handleDapCommand(payload);
    }
  }

  /**
   * Handle request timeout
   */
  private handleRequestTimeout(requestId: string, command: string): void {
    this.logger!.error(`[Worker] DAP request '${command}' (id: ${requestId}) timed out`);
    this.sendDapResponse(requestId, false, undefined, `Request '${command}' timed out`);
  }

  /**
   * Handle terminate command
   */
  async handleTerminate(): Promise<void> {
    // Check if already shutting down or terminated for idempotent behavior
    if (this.state === ProxyState.SHUTTING_DOWN || this.state === ProxyState.TERMINATED) {
      this.logger?.info('[Worker] Already shutting down or terminated.');
      return;
    }
    
    // Use optional chaining since logger might be null if not initialized
    this.logger?.info('[Worker] Received terminate command.');
    await this.shutdown();
    this.sendStatus('terminated');
  }

  /**
   * Shutdown the worker
   */
  async shutdown(): Promise<void> {
    if (this.state === ProxyState.SHUTTING_DOWN || this.state === ProxyState.TERMINATED) {
      this.logger?.info('[Worker] Shutdown already in progress.');
      return;
    }

    this.state = ProxyState.SHUTTING_DOWN;
    this.logger?.info('[Worker] Initiating shutdown sequence...');

    // Clear request tracking
    this.requestTracker.clear();

    // Reject any in-flight DAP requests and clear timers immediately
    if (this.dapClient) {
      this.dapClient.shutdown('worker shutdown');
    }

    // Disconnect DAP client
    if (this.connectionManager && this.dapClient) {
      await this.connectionManager.disconnect(this.dapClient);
    }
    this.dapClient = null;

    // Terminate adapter process
    if (this.processManager && this.adapterProcess) {
      await this.processManager.shutdown(this.adapterProcess);
    }
    this.adapterProcess = null;

    this.state = ProxyState.TERMINATED;
    this.logger?.info('[Worker] Shutdown sequence completed.');
  }

  // Message sending helpers

  private sendStatus(status: string, extra: Record<string, unknown> = {}): void {
    const message: StatusMessage = {
      type: 'status',
      status,
      sessionId: this.currentSessionId || 'unknown',
      ...extra
    };
    this.dependencies.messageSender.send(message);
  }

  private sendDapResponse(requestId: string, success: boolean, response?: unknown, error?: string): void {
    const message: DapResponseMessage = {
      type: 'dapResponse',
      requestId,
      success,
      sessionId: this.currentSessionId || 'unknown',
      ...(success && response ? { 
        body: (response as DebugProtocol.Response).body, 
        response: response as DebugProtocol.Response 
      } : { error })
    };
    this.dependencies.messageSender.send(message);
  }

  private sendDapEvent(event: string, body: unknown): void {
    const message: DapEventMessage = {
      type: 'dapEvent',
      event,
      body,
      sessionId: this.currentSessionId || 'unknown'
    };
    this.dependencies.messageSender.send(message);
  }

  private sendError(message: string): void {
    const errorMessage: ErrorMessage = {
      type: 'error',
      message,
      sessionId: this.currentSessionId || 'unknown'
    };
    this.dependencies.messageSender.send(errorMessage);
  }
}
