/**
 * Core worker class for DAP Proxy functionality
 * Encapsulates all business logic in a testable form
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
import { GenericAdapterManager, DebugpyAdapterManager } from './dap-proxy-adapter-manager.js';
import { DapConnectionManager } from './dap-proxy-connection-manager.js';
import { 
  validateProxyInitPayload, 
  validateAdapterCommand,
  logAdapterCommandValidation 
} from '../utils/type-guards.js';

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

  constructor(private dependencies: DapProxyDependencies) {
    this.requestTracker = new CallbackRequestTracker(
      (requestId, command) => this.handleRequestTimeout(requestId, command)
    );
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
    
    this.state = ProxyState.INITIALIZING;
    this.currentInitPayload = validatedPayload;

    try {
      // Create logger
      const logPath = path.join(payload.logDir, `proxy-${payload.sessionId}.log`);
      await this.dependencies.fileSystem.ensureDir(path.dirname(logPath));
      this.logger = await this.dependencies.loggerFactory(payload.sessionId, payload.logDir);
      this.logger.info(`[Worker] DAP Proxy worker initialized for session ${payload.sessionId}`);

      // Create managers with logger
      // Use generic adapter manager if adapter command is provided, otherwise fall back to Python
      if (payload.adapterCommand) {
        this.processManager = new GenericAdapterManager(
          this.dependencies.processSpawner,
          this.logger,
          this.dependencies.fileSystem
        );
      } else {
        // Backward compatibility - use Python adapter manager
        this.processManager = new DebugpyAdapterManager(
          this.dependencies.processSpawner,
          this.logger,
          this.dependencies.fileSystem
        );
      }
      
      this.connectionManager = new DapConnectionManager(
        this.dependencies.dapClientFactory,
        this.logger
      );

      // No path validation - let debugpy handle it
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
      // For any initialization error, ensure we shut down
      await this.shutdown();
      // Exit the process to trigger the 'exit' event in ProxyManager
      process.exit(1);
    }
  }

  /**
   * Handle dry run mode
   */
  private handleDryRun(payload: ProxyInitPayload): void {
    let command: string;
    let args: string[];
    
    if (payload.adapterCommand) {
      // Use provided adapter command
      command = payload.adapterCommand.command;
      args = payload.adapterCommand.args;
    } else if (this.processManager instanceof DebugpyAdapterManager) {
      // Use Python-specific command building
      const spawnCommand = this.processManager.buildSpawnCommand(
        payload.executablePath,
        payload.adapterHost,
        payload.adapterPort,
        payload.logDir
      );
      command = spawnCommand.command;
      args = spawnCommand.args;
    } else {
      throw new Error('Cannot determine adapter command for dry run');
    }
    
    const fullCommand = `${command} ${args.join(' ')}`;
    
    this.logger!.warn(`[Worker DRY_RUN] Would execute: ${fullCommand}`);
    this.logger!.warn(`[Worker DRY_RUN] Script to debug: ${payload.scriptPath}`);
    
    this.sendStatus('dry_run_complete', { command: fullCommand, script: payload.scriptPath });
    
    // Indicate that the process should terminate
    this.state = ProxyState.TERMINATED;
    this.logger!.info('[Worker DRY_RUN] Dry run complete. State set to TERMINATED.');
  }

  /**
   * Start debugpy adapter and establish connection
   */
  private async startDebugpyAdapterAndConnect(payload: ProxyInitPayload): Promise<void> {
    // Spawn adapter process
    let spawnResult;
    
    if (payload.adapterCommand) {
      // Validate adapter command with detailed logging
      try {
        const validatedCommand = validateAdapterCommand(payload.adapterCommand, 'proxy-worker-init');
        logAdapterCommandValidation(validatedCommand, 'proxy-worker-init', true, {
          executablePath: payload.executablePath,
          scriptPath: payload.scriptPath
        });
        
        this.logger!.info('[Worker] Adapter command validated successfully:', {
          command: validatedCommand.command,
          argsLength: validatedCommand.args.length,
          hasEnv: !!validatedCommand.env
        });
      } catch (validationError) {
        logAdapterCommandValidation(payload.adapterCommand, 'proxy-worker-init', false, {
          error: validationError instanceof Error ? validationError.message : String(validationError),
          rawPayload: payload
        });
        throw validationError;
      }
      
      // Use validated adapter command
      const validatedCommand = validateAdapterCommand(payload.adapterCommand, 'proxy-worker-spawn');
      
      spawnResult = await this.processManager!.spawn({
        command: validatedCommand.command,
        args: validatedCommand.args,
        host: payload.adapterHost,
        port: payload.adapterPort,
        logDir: payload.logDir,
        env: validatedCommand.env
      });
    } else if (this.processManager instanceof DebugpyAdapterManager) {
      // Use Python-specific spawning
      spawnResult = await this.processManager.spawnDebugpy({
        pythonPath: payload.executablePath,
        host: payload.adapterHost,
        port: payload.adapterPort,
        logDir: payload.logDir
      });
    } else {
      throw new Error('Cannot determine how to spawn adapter');
    }

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

      // Initialize DAP session
      await this.connectionManager!.initializeSession(this.dapClient, payload.sessionId);

      // Send launch request
      // DIAGNOSTIC: Log the scriptPath before sending to connection manager
      this.logger!.info('[Worker] DIAGNOSTIC: About to send launch request with scriptPath:', payload.scriptPath);
      this.logger!.info('[Worker] DIAGNOSTIC: scriptPath type:', typeof payload.scriptPath);
      this.logger!.info('[Worker] DIAGNOSTIC: scriptPath length:', payload.scriptPath.length);
      this.logger!.info('[Worker] DIAGNOSTIC: Full payload object:', JSON.stringify(payload, null, 2));
      
      await this.connectionManager!.sendLaunchRequest(
        this.dapClient,
        payload.scriptPath,
        payload.scriptArgs,
        payload.stopOnEntry,
        payload.justMyCode
      );

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
        await this.handleInitializedEvent();
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
    if (this.state !== ProxyState.CONNECTED || !this.dapClient) {
      this.sendDapResponse(payload.requestId, false, undefined, 'DAP client not connected');
      return;
    }

    try {
      // Track request
      this.requestTracker.track(payload.requestId, payload.dapCommand);

      // Log setBreakpoints for debugging
      if (payload.dapCommand === 'setBreakpoints') {
        this.logger!.info(`[Worker] Sending 'setBreakpoints' command. Args:`, payload.dapArgs);
      }

      // Send request
      const response = await this.dapClient.sendRequest(payload.dapCommand, payload.dapArgs);

      // Complete tracking
      this.requestTracker.complete(payload.requestId);

      // Log setBreakpoints response with full details
      if (payload.dapCommand === 'setBreakpoints') {
        this.logger!.info(`[Worker] Response from adapter for 'setBreakpoints':`, response);
        
        // TEMPORARY DEBUG: Log complete response structure
        console.error('[DEBUG-DAP] Full setBreakpoints response:', JSON.stringify(response, null, 2));
        
        // Log individual breakpoint details if available
        if (response && typeof response === 'object' && 'body' in response) {
          const typedResponse = response as DebugProtocol.SetBreakpointsResponse;
          const body = typedResponse.body;
          if (body && body.breakpoints && Array.isArray(body.breakpoints)) {
            body.breakpoints.forEach((bp: DebugProtocol.Breakpoint, index: number) => {
              console.error(`[DEBUG-DAP] Breakpoint ${index}:`, {
                id: bp.id,
                verified: bp.verified,
                message: bp.message,
                line: bp.line,
                column: bp.column,
                source: bp.source,
                instructionReference: bp.instructionReference
              });
            });
          }
        }
      }

      // Send response
      this.sendDapResponse(payload.requestId, true, response);
    } catch (error) {
      this.requestTracker.complete(payload.requestId);
      const message = error instanceof Error ? error.message : String(error);
      this.logger!.error(`[Worker] DAP command ${payload.dapCommand} failed:`, { error: message });
      this.sendDapResponse(payload.requestId, false, undefined, message);
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
    this.logger!.info('[Worker] Received terminate command.');
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
