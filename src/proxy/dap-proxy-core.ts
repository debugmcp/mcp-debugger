/**
 * DAP Proxy Core - Pure business logic without side effects
 * 
 * This module contains the core proxy runner functionality that can be
 * instantiated and controlled programmatically without auto-execution.
 */

import readline from 'readline';
import { DapProxyWorker } from './dap-proxy-worker.js';
import { MessageParser } from './dap-proxy-message-parser.js';
import { 
  DapProxyDependencies,
  ILogger,
  ParentCommand, 
  ProxyState 
} from './dap-proxy-interfaces.js';
import { getErrorMessage } from '../errors/debug-errors.js';
import { sanitizePayloadForLogging } from '../utils/env-sanitizer.js';

export interface ProxyRunnerOptions {
  /**
   * Whether to use IPC for communication (when available)
   */
  useIPC?: boolean;
  
  /**
   * Whether to use stdin/readline as fallback
   */
  useStdin?: boolean;
  
  /**
   * Custom message handler for testing
   */
  onMessage?: (message: string) => Promise<void>;
}

/**
 * Core proxy runner that encapsulates all proxy logic
 * without auto-execution or environment detection
 */
export class ProxyRunner {
  private worker: DapProxyWorker;
  private logger: ILogger;
  private rl?: readline.Interface;
  private messageHandler?: (message: unknown) => Promise<void>;
  private isRunning = false;
  private _initTimeout?: NodeJS.Timeout;
  private ipcMessageCounter = 0;
  private heartbeatInterval?: NodeJS.Timeout;
  private heartbeatTickCounter = 0;

  constructor(
    private dependencies: DapProxyDependencies,
    logger: ILogger,
    private options: ProxyRunnerOptions = {}
  ) {
    this.worker = new DapProxyWorker(dependencies);
    this.logger = logger;
  }

  /**
   * Start the proxy runner and set up communication channels
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Proxy runner is already running');
    }

    this.isRunning = true;
    this.logger.info('[ProxyRunner] Starting proxy runner...');

    try {
      // Set up message processing
      const processMessage = this.options.onMessage || this.createMessageProcessor();

      // Set up communication channels based on options and availability
      if (this.options.useIPC !== false && typeof process.send === 'function') {
        this.setupIPCCommunication(processMessage);
      } else if (this.options.useStdin !== false) {
        this.setupStdinCommunication(processMessage);
      } else {
        this.logger.warn('[ProxyRunner] No communication channel configured');
      }

      this.logger.info('[ProxyRunner] Ready to receive commands');

      if (typeof process.send === 'function') {
        this.heartbeatInterval = setInterval(() => {
          try {
            this.heartbeatTickCounter += 1;
            this.logger.debug(
              `[ProxyRunner] Heartbeat tick #${this.heartbeatTickCounter} send attempt (process.connected=${process.connected})`
            );
            process.send?.({
              type: 'ipc-heartbeat-tick',
              timestamp: Date.now(),
              counter: this.heartbeatTickCounter
            });
          } catch (tickError) {
            this.logger.warn('[ProxyRunner] Failed to send heartbeat tick:', tickError);
          }
        }, 5000);
      }

      // Set up initialization timeout - exit if no init command received
      // This prevents orphaned processes from consuming resources
      // Use much shorter timeout to prevent resource consumption
      const timeoutDuration = 10000; // 10 seconds - should be enough for normal initialization
      const initTimeout = setTimeout(() => {
        this.logger.warn(`[ProxyRunner] No initialization received within ${timeoutDuration / 1000} seconds, exiting...`);
        process.exit(1);
      }, timeoutDuration);

      // Store timeout so we can clear it when init is received
      this._initTimeout = initTimeout;
    } catch (error) {
      this.isRunning = false;
      this.logger.error('[ProxyRunner] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop the proxy runner and clean up resources
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('[ProxyRunner] Stopping proxy runner...');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    // Shutdown worker
    await this.worker.shutdown();
    
    // Clean up communication channels
    if (this.messageHandler && process.removeListener) {
      process.removeListener('message', this.messageHandler);
    }
    
    if (this.rl) {
      this.rl.close();
    }

    this.isRunning = false;
    this.logger.info('[ProxyRunner] Stopped');
  }

  /**
   * Get the current worker state
   */
  getWorkerState(): ProxyState {
    return this.worker.getState();
  }

  /**
   * Get the worker instance (for testing)
   */
  getWorker(): DapProxyWorker {
    return this.worker;
  }

  /**
   * Create the default message processor
   */
  private createMessageProcessor(): (messageStr: string) => Promise<void> {
    return async (messageStr: string) => {
      this.logger.info(`[ProxyRunner] Received message (first 200 chars): ${messageStr.substring(0, 200)}...`);

      let command: ParentCommand | null = null;
      try {
        command = MessageParser.parseCommand(messageStr);

        // Clear initialization timeout when init command is received
        if (command.cmd === 'init' && this._initTimeout) {
          clearTimeout(this._initTimeout);
          this._initTimeout = undefined;
          this.logger.info('[ProxyRunner] Initialization timeout cleared');
        }

        await this.worker.handleCommand(command);
      } catch (error) {
        const errorMsg = getErrorMessage(error);
        this.logger.error('[ProxyRunner] Error processing message:', { error: errorMsg });
        this.dependencies.messageSender.send({
          type: 'error',
          message: `Proxy error processing command: ${errorMsg}`,
          sessionId: command?.sessionId || 'unknown'
        });
      }

      // Check if we should exit after handling the command
      if (this.worker.getState() === ProxyState.TERMINATED) {
        const isDryRun = command?.cmd === 'init' && command.dryRunSpawn;
        const exitDelay = isDryRun ? 500 : 0;

        this.logger.info(`[ProxyRunner] Worker state is TERMINATED. Exiting in ${exitDelay}ms.`);
        setTimeout(() => {
          process.exit(0);
        }, exitDelay);
      }
    };
  }

  /**
   * Set up IPC communication channel
   */
  private setupIPCCommunication(processMessage: (message: string) => Promise<void>): void {
    this.logger.info('[ProxyRunner] Setting up IPC communication');
    
    // Test if IPC channel exists
    if (typeof process.send !== 'function') {
      this.logger.error('[ProxyRunner] ERROR: process.send is not a function - IPC channel not available!');
      return;
    }
    
    this.logger.info('[ProxyRunner] IPC channel confirmed available');

    this.messageHandler = async (message: unknown) => {
      this.ipcMessageCounter += 1;
      this.logger.info(
        `[ProxyRunner] IPC message #${this.ipcMessageCounter} received type=${typeof message}`
      );
      this.logger.debug(
        `[ProxyRunner] IPC listener count=${process.listenerCount('message')}`
      );
      this.logger.debug(`[ProxyRunner] Raw message snapshot:`, sanitizePayloadForLogging(message));
      this.logger.debug('[ProxyRunner] IPC message received (raw):', JSON.stringify(sanitizePayloadForLogging(message)).substring(0, 200));
      this.logger.debug(`[ProxyRunner] IPC channel status on receive: connected=${process.connected}`);
      if (typeof process.send === 'function') {
        try {
          process.send({
            type: 'ipc-heartbeat',
            counter: this.ipcMessageCounter,
            timestamp: Date.now()
          });
        } catch (heartbeatError) {
          this.logger.warn('[ProxyRunner] Failed to send heartbeat:', heartbeatError);
        }
      }
      try {
        if (typeof message === 'string') {
          await processMessage(message);
          this.logger.debug(`[ProxyRunner] IPC message #${this.ipcMessageCounter} processed successfully (string)`);
        } else if (typeof message === 'object' && message !== null) {
          this.logger.debug('[ProxyRunner] Received object message, stringifying');
          try {
            await processMessage(JSON.stringify(message));
            this.logger.debug(`[ProxyRunner] IPC message #${this.ipcMessageCounter} processed successfully (object)`);
          } catch (e) {
            this.logger.error('[ProxyRunner] Could not process object message:', {
              message,
              error: getErrorMessage(e)
            });
            throw e;
          }
        } else {
          this.logger.warn('[ProxyRunner] Received message of unexpected type:', typeof message, message);
        }
      } catch (handlerError) {
        this.logger.error('[ProxyRunner] Error handling IPC message:', handlerError);
      }
    };

    process.on('message', this.messageHandler);
    this.logger.info('[ProxyRunner] IPC message handler attached');

    process.on('disconnect', () => {
      this.logger.warn('[ProxyRunner] IPC channel disconnected');
    });

    process.on('error', (err: Error) => {
      this.logger.error('[ProxyRunner] IPC channel error:', err);
    });
  }

  /**
   * Set up stdin/readline communication channel
   */
  private setupStdinCommunication(processMessage: (message: string) => Promise<void>): void {
    this.logger.info('[ProxyRunner] Setting up stdin/readline communication');
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    
    this.rl.on('line', (line: string) => processMessage(line));
  }

  /**
   * Set up global error handlers
   */
  setupGlobalErrorHandlers(
    errorShutdown: () => Promise<void>,
    getCurrentSessionId: () => string | null
  ): void {
    // Uncaught exception handler
    process.on('uncaughtException', (error: Error) => {
      this.logger.error('[ProxyRunner] Uncaught exception:', error);
      const sessionId = getCurrentSessionId() || 'unknown';
      
      this.dependencies.messageSender.send({
        type: 'error',
        message: `Proxy uncaught exception: ${error.message}`,
        sessionId
      });

      errorShutdown().finally(() => {
        process.exit(1);
      });
    });

    // Unhandled rejection handler
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      this.logger.error('[ProxyRunner] Unhandled rejection:', { reason, promise });
      const sessionId = getCurrentSessionId() || 'unknown';
      
      this.dependencies.messageSender.send({
        type: 'error',
        message: `Proxy unhandled rejection: ${reason}`,
        sessionId
      });
    });

    // SIGTERM handler
    process.on('SIGTERM', () => {
      this.logger.info('[ProxyRunner] Received SIGTERM, shutting down gracefully');
      errorShutdown().finally(() => {
        process.exit(0);
      });
    });

    // SIGINT handler
    process.on('SIGINT', () => {
      this.logger.info('[ProxyRunner] Received SIGINT, shutting down gracefully');
      errorShutdown().finally(() => {
        process.exit(0);
      });
    });
  }
}

/**
 * Detect if the module is being run directly or as a worker
 */
export function detectExecutionMode(): {
  isDirectRun: boolean;
  hasIPC: boolean;
  isWorkerEnv: boolean;
} {
  const isDirectRun = 
    (typeof require !== 'undefined' && require.main === module) ||
    (typeof import.meta !== 'undefined' && import.meta.url === `file://${process.argv[1]}`);

  const hasIPC = typeof process.send === 'function';
  const isWorkerEnv = process.env.DAP_PROXY_WORKER === 'true';

  return { isDirectRun, hasIPC, isWorkerEnv };
}

/**
 * Check if the module should auto-execute based on execution mode
 */
export function shouldAutoExecute(mode: ReturnType<typeof detectExecutionMode>): boolean {
  return mode.isDirectRun || mode.hasIPC || mode.isWorkerEnv;
}
