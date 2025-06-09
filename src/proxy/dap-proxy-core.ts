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
  IMessageSender,
  ParentCommand, 
  ProxyState 
} from './dap-proxy-interfaces.js';

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
  private messageHandler?: (message: any) => Promise<void>;
  private isRunning = false;

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
        await this.worker.handleCommand(command);
      } catch (error) {
        const errorMsg = MessageParser.getErrorMessage(error);
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
    
    this.messageHandler = async (message: any) => {
      this.logger.debug('[ProxyRunner] IPC message received');
      
      if (typeof message === 'string') {
        await processMessage(message);
      } else if (typeof message === 'object' && message !== null) {
        this.logger.debug('[ProxyRunner] Received object message, stringifying:', message);
        try {
          await processMessage(JSON.stringify(message));
        } catch (e) {
          this.logger.error('[ProxyRunner] Could not process object message:', {
            message,
            error: MessageParser.getErrorMessage(e)
          });
        }
      } else {
        this.logger.warn('[ProxyRunner] Received message of unexpected type:', typeof message, message);
      }
    };

    process.on('message', this.messageHandler);
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
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
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
