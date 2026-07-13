/**
 * DAP Proxy Core - Proxy runner with process lifecycle and communication management
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
import { sanitizePayloadForLogging } from '@debugmcp/shared';
import type { ProcessLike } from '../interfaces/process-interfaces.js';

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

  /**
   * Process-like handle used for IPC, signals, exit, and stdio. Defaults to
   * the global `process`; injectable so unit tests never mutate the real
   * process object (issue #183).
   */
  proc?: ProcessLike;
}

/**
 * Core proxy runner that encapsulates proxy logic
 * with configurable communication channels
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
  private disconnectHandler?: () => void;
  private errorHandler?: (err: Error) => void;
  private readonly proc: ProcessLike;

  constructor(
    private dependencies: DapProxyDependencies,
    logger: ILogger,
    private options: ProxyRunnerOptions = {}
  ) {
    this.proc = options.proc ?? process;
    this.worker = new DapProxyWorker(dependencies, { exit: (code) => this.proc.exit(code) });
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
      if (this.options.useIPC !== false && typeof this.proc.send === 'function') {
        this.setupIPCCommunication(processMessage);
      } else if (this.options.useStdin !== false) {
        this.setupStdinCommunication(processMessage);
      } else {
        this.logger.warn('[ProxyRunner] No communication channel configured');
      }

      this.logger.info('[ProxyRunner] Ready to receive commands');

      if (typeof this.proc.send === 'function') {
        this.heartbeatInterval = setInterval(() => {
          try {
            this.heartbeatTickCounter += 1;
            this.logger.debug(
              `[ProxyRunner] Heartbeat tick #${this.heartbeatTickCounter} send attempt (process.connected=${this.proc.connected})`
            );
            this.proc.send?.({
              type: 'ipc-heartbeat-tick',
              timestamp: Date.now(),
              counter: this.heartbeatTickCounter
            });
          } catch (tickError) {
            // proc.send throws only when the IPC channel is closed (the
            // payload is static, so serialization cannot fail) — the parent is
            // unreachable. Shut down instead of lingering. This replaces the
            // self-SIGTERM the old proxy-bootstrap heartbeat performed (#123).
            this.logger.warn(
              '[ProxyRunner] Failed to send heartbeat tick — parent unreachable, shutting down:',
              tickError
            );
            this.stop().finally(() => {
              this.proc.exit(1);
            });
          }
        }, 5000);
      }

      // Exit if no initialization command received within timeout (prevents orphaned processes)
      const timeoutDuration = 10000; // 10 seconds - should be enough for normal initialization
      const initTimeout = setTimeout(() => {
        this.logger.warn(`[ProxyRunner] No initialization received within ${timeoutDuration / 1000} seconds, exiting...`);
        this.proc.exit(1);
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

    // Mark as stopped immediately so channel-close handlers triggered by the
    // teardown below (e.g. readline 'close' when we close the interface) do
    // not treat it as a parent death and exit the process.
    this.isRunning = false;

    this.logger.info('[ProxyRunner] Stopping proxy runner...');

    if (this._initTimeout) {
      clearTimeout(this._initTimeout);
      this._initTimeout = undefined;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    // Shutdown worker
    await this.worker.shutdown();
    
    // Clean up communication channels
    if (this.messageHandler && this.proc.removeListener) {
      this.proc.removeListener('message', this.messageHandler);
    }

    if (this.disconnectHandler) {
      this.proc.removeListener('disconnect', this.disconnectHandler);
      this.disconnectHandler = undefined;
    }

    if (this.errorHandler) {
      this.proc.removeListener('error', this.errorHandler);
      this.errorHandler = undefined;
    }

    if (this.rl) {
      this.rl.close();
    }

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
      this.logger.info(`[ProxyRunner] Received message (first 200 chars): ${messageStr.substring(0, 200)}${messageStr.length > 200 ? '...' : ''}`);

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
          this.proc.exit(0);
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
    if (typeof this.proc.send !== 'function') {
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
        `[ProxyRunner] IPC listener count=${this.proc.listenerCount('message')}`
      );
      this.logger.debug(`[ProxyRunner] Raw message snapshot:`, sanitizePayloadForLogging(message));
      this.logger.debug('[ProxyRunner] IPC message received (raw):', JSON.stringify(sanitizePayloadForLogging(message)).substring(0, 200));
      this.logger.debug(`[ProxyRunner] IPC channel status on receive: connected=${this.proc.connected}`);
      if (typeof this.proc.send === 'function') {
        try {
          this.proc.send({
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
              message: sanitizePayloadForLogging(message),
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

    this.proc.on('message', this.messageHandler);
    this.logger.info('[ProxyRunner] IPC message handler attached');

    this.disconnectHandler = () => {
      this.logger.warn('[ProxyRunner] IPC channel disconnected — parent process died');
      // Trigger full stop so attach-mode auto-detach and cleanup run before exit.
      // Use the same pattern as SIGTERM in setupGlobalErrorHandlers().
      this.stop().finally(() => {
        this.proc.exit(0);
      });
    };
    this.proc.on('disconnect', this.disconnectHandler);

    this.errorHandler = (err: Error) => {
      this.logger.error('[ProxyRunner] IPC channel error:', err);
    };
    this.proc.on('error', this.errorHandler);
  }

  /**
   * Set up stdin/readline communication channel
   */
  private setupStdinCommunication(processMessage: (message: string) => Promise<void>): void {
    this.logger.info('[ProxyRunner] Setting up stdin/readline communication');
    
    this.rl = readline.createInterface({
      input: this.proc.stdin,
      output: this.proc.stdout,
      terminal: false
    });

    this.rl.on('line', (line: string) => processMessage(line));

    // stdin closing (EOF) means the parent is gone — mirror the IPC
    // 'disconnect' handling so stdin-mode proxies do not linger as orphans.
    // Guarded by isRunning: a normal stop() closes the interface after
    // marking the runner stopped, which must not re-enter or exit.
    this.rl.on('close', () => {
      if (!this.isRunning) {
        return;
      }
      this.logger.warn('[ProxyRunner] stdin closed — parent process gone, shutting down');
      this.stop().finally(() => {
        this.proc.exit(0);
      });
    });
  }

  /**
   * Set up global error handlers
   */
  setupGlobalErrorHandlers(
    errorShutdown: () => Promise<void>,
    getCurrentSessionId: () => string | null
  ): void {
    // Uncaught exception handler
    this.proc.on('uncaughtException', (error: Error) => {
      this.logger.error('[ProxyRunner] Uncaught exception:', error);
      const sessionId = getCurrentSessionId() || 'unknown';

      this.dependencies.messageSender.send({
        type: 'error',
        message: `Proxy uncaught exception: ${error.message}`,
        sessionId
      });

      errorShutdown().finally(() => {
        this.proc.exit(1);
      });
    });

    // Unhandled rejection handler
    this.proc.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      this.logger.error('[ProxyRunner] Unhandled rejection:', { reason, promise });
      const sessionId = getCurrentSessionId() || 'unknown';
      
      this.dependencies.messageSender.send({
        type: 'error',
        message: `Proxy unhandled rejection: ${reason}`,
        sessionId
      });
    });

    // SIGTERM handler
    this.proc.on('SIGTERM', () => {
      this.logger.info('[ProxyRunner] Received SIGTERM, shutting down gracefully');
      errorShutdown().finally(() => {
        this.proc.exit(0);
      });
    });

    // SIGINT handler
    this.proc.on('SIGINT', () => {
      this.logger.info('[ProxyRunner] Received SIGINT, shutting down gracefully');
      errorShutdown().finally(() => {
        this.proc.exit(0);
      });
    });
  }
}

/**
 * Detect if the module is being run directly or as a worker
 *
 * @param proc injectable process handle (issue #183); `require.main === module`
 * stays module-scoped and cannot be injected.
 */
export function detectExecutionMode(proc: Pick<ProcessLike, 'send' | 'env' | 'argv'> = process): {
  isDirectRun: boolean;
  hasIPC: boolean;
  isWorkerEnv: boolean;
} {
  const isDirectRun =
    (typeof require !== 'undefined' && require.main === module) ||
    (typeof import.meta !== 'undefined' && import.meta.url === `file://${proc.argv[1]}`);

  const hasIPC = typeof proc.send === 'function';
  const isWorkerEnv = proc.env.DAP_PROXY_WORKER === 'true';

  return { isDirectRun, hasIPC, isWorkerEnv };
}

/**
 * Check if the module should auto-execute based on execution mode
 */
export function shouldAutoExecute(mode: ReturnType<typeof detectExecutionMode>): boolean {
  return mode.isDirectRun || mode.hasIPC || mode.isWorkerEnv;
}
