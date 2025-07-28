/**
 * DAP connection management utilities
 */

import { DebugProtocol } from '@vscode/debugprotocol';
import {
  IDapClient,
  IDapClientFactory,
  ILogger,
  ExtendedInitializeArgs
} from './dap-proxy-interfaces.js';

export class DapConnectionManager {
  private readonly INITIAL_CONNECT_DELAY = 500;
  private readonly MAX_CONNECT_ATTEMPTS = 60;
  private readonly CONNECT_RETRY_INTERVAL = 200;

  constructor(
    private dapClientFactory: IDapClientFactory,
    private logger: ILogger
  ) {}

  /**
   * Connect to DAP adapter with retry logic
   */
  async connectWithRetry(host: string, port: number): Promise<IDapClient> {
    this.logger.info(`[ConnectionManager] Waiting ${this.INITIAL_CONNECT_DELAY}ms before first DAP connect attempt.`);
    await new Promise(resolve => setTimeout(resolve, this.INITIAL_CONNECT_DELAY));

    const client = this.dapClientFactory.create(host, port);
    
    // Temporary error handler to prevent unhandled 'error' event crashes during connect attempts
    const tempErrorHandler = (err: Error) => {
      this.logger.debug(`[ConnectionManager] DAP client emitted 'error' during connection phase (expected for retries): ${err.message}`);
    };
    client.on('error', tempErrorHandler);

    let connectAttempts = 0;

    while (connectAttempts < this.MAX_CONNECT_ATTEMPTS) {
      try {
        this.logger.info(`[ConnectionManager] Attempting DAP client connect (attempt ${connectAttempts + 1}/${this.MAX_CONNECT_ATTEMPTS}) to ${host}:${port}`);
        await client.connect();
        this.logger.info('[ConnectionManager] DAP client connected to adapter successfully.');
        
        // Remove temporary handler as connection succeeded
        client.off('error', tempErrorHandler);
        return client;
      } catch (err) {
        connectAttempts++;
        const errMessage = err instanceof Error ? err.message : String(err);
        
        if (connectAttempts >= this.MAX_CONNECT_ATTEMPTS) {
          this.logger.error(`[ConnectionManager] Failed to connect DAP client after ${this.MAX_CONNECT_ATTEMPTS} attempts. Last error: ${errMessage}`);
          client.off('error', tempErrorHandler);
          throw new Error(`Failed to connect DAP client: ${errMessage}`);
        }
        
        this.logger.warn(`[ConnectionManager] DAP client connect attempt ${connectAttempts} failed: ${errMessage}. Retrying in ${this.CONNECT_RETRY_INTERVAL}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.CONNECT_RETRY_INTERVAL));
      }
    }

    // This should never be reached due to the throw above, but TypeScript needs it
    throw new Error('Connection retry loop exited unexpectedly');
  }

  /**
   * Initialize DAP session
   */
  async initializeSession(client: IDapClient, sessionId: string): Promise<void> {
    const initializeArgs: ExtendedInitializeArgs = {
      clientID: `mcp-proxy-${sessionId}`,
      clientName: 'MCP Debug Proxy',
      adapterID: 'python',
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsRunInTerminalRequest: false,
      locale: 'en-US'
    };

    this.logger.info('[ConnectionManager] Sending DAP "initialize" request');
    const initResponse = await client.sendRequest('initialize', initializeArgs);
    this.logger.info('[ConnectionManager] DAP "initialize" request sent and response received.');
    
    // TEMPORARY DEBUG: Log capabilities to check for breakpointLocations support
    console.error('[DEBUG-DAP] Initialize response capabilities:', JSON.stringify(initResponse, null, 2));
    if (initResponse && typeof initResponse === 'object' && 'body' in initResponse) {
      const typedResponse = initResponse as DebugProtocol.InitializeResponse;
      const capabilities = typedResponse.body;
      if (capabilities) {
        console.error('[DEBUG-DAP] Breakpoint-related capabilities:', {
          supportsBreakpointLocationsRequest: capabilities.supportsBreakpointLocationsRequest,
          supportsConditionalBreakpoints: capabilities.supportsConditionalBreakpoints,
          supportsHitConditionalBreakpoints: capabilities.supportsHitConditionalBreakpoints,
          supportsLogPoints: capabilities.supportsLogPoints,
          supportsDataBreakpoints: capabilities.supportsDataBreakpoints,
          supportsFunctionBreakpoints: capabilities.supportsFunctionBreakpoints,
          supportsInstructionBreakpoints: capabilities.supportsInstructionBreakpoints,
          supportsExceptionInfoRequest: capabilities.supportsExceptionInfoRequest,
          supportsExceptionOptions: capabilities.supportsExceptionOptions,
          supportsExceptionConditions: (capabilities as unknown as Record<string, unknown>).supportsExceptionConditions,
          supportsExceptionFilterOptions: capabilities.supportsExceptionFilterOptions
        });
      }
    }
  }

  /**
   * Set up event handlers for a DAP client
   */
  setupEventHandlers(
    client: IDapClient,
    handlers: {
      onInitialized?: () => void | Promise<void>;
      onOutput?: (body: DebugProtocol.OutputEvent['body']) => void;
      onStopped?: (body: DebugProtocol.StoppedEvent['body']) => void;
      onContinued?: (body: DebugProtocol.ContinuedEvent['body']) => void;
      onThread?: (body: DebugProtocol.ThreadEvent['body']) => void;
      onExited?: (body: DebugProtocol.ExitedEvent['body']) => void;
      onTerminated?: (body: DebugProtocol.TerminatedEvent['body']) => void;
      onError?: (err: Error) => void;
      onClose?: () => void;
    }
  ): void {
    if (handlers.onInitialized) {
      client.on('initialized', handlers.onInitialized);
    }
    
    if (handlers.onOutput) {
      client.on('output', handlers.onOutput);
    }
    
    if (handlers.onStopped) {
      client.on('stopped', handlers.onStopped);
    }
    
    if (handlers.onContinued) {
      client.on('continued', handlers.onContinued);
    }
    
    if (handlers.onThread) {
      client.on('thread', handlers.onThread);
    }
    
    if (handlers.onExited) {
      client.on('exited', handlers.onExited);
    }
    
    if (handlers.onTerminated) {
      client.on('terminated', handlers.onTerminated);
    }
    
    if (handlers.onError) {
      client.on('error', handlers.onError);
    }
    
    if (handlers.onClose) {
      client.on('close', handlers.onClose);
    }

    this.logger.info('[ConnectionManager] DAP event handlers set up');
  }

  /**
   * Disconnect DAP client gracefully
   */
  async disconnect(client: IDapClient | null, terminateDebuggee: boolean = true): Promise<void> {
    if (!client) {
      this.logger.info('[ConnectionManager] No active DAP client to disconnect.');
      return;
    }

    this.logger.info('[ConnectionManager] Attempting graceful DAP disconnect.');
    
    try {
      this.logger.info('[ConnectionManager] Sending "disconnect" request to DAP adapter...');
      await Promise.race([
        client.sendRequest('disconnect', { terminateDebuggee }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('DAP disconnect request timed out after 1000ms')), 1000)
        )
      ]);
      this.logger.info('[ConnectionManager] DAP "disconnect" request completed.');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`[ConnectionManager] Error or timeout during DAP "disconnect" request: ${message}`);
    }

    // Always call the client's disconnect method to clean up
    try {
      this.logger.info('[ConnectionManager] Calling client.disconnect() for final cleanup.');
      client.disconnect();
      this.logger.info('[ConnectionManager] Client disconnected.');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`[ConnectionManager] Error calling client.disconnect(): ${message}`, e);
    }
  }

  /**
   * Send a launch request with proper configuration
   */
  async sendLaunchRequest(
    client: IDapClient,
    scriptPath: string,
    scriptArgs: string[] = [],
    stopOnEntry: boolean = true,
    justMyCode: boolean = true
  ): Promise<void> {
    // DIAGNOSTIC: Log the incoming scriptPath
    this.logger.info('[ConnectionManager] DIAGNOSTIC: Received scriptPath:', scriptPath);
    this.logger.info('[ConnectionManager] DIAGNOSTIC: scriptPath type:', typeof scriptPath);
    this.logger.info('[ConnectionManager] DIAGNOSTIC: scriptPath length:', scriptPath.length);
    
    // Pass paths exactly as provided - no manipulation
    const launchArgs = {
      program: scriptPath,
      stopOnEntry,
      noDebug: false,
      args: scriptArgs,
      // Don't set cwd - let debugpy use its inherited working directory
      console: "internalConsole",
      justMyCode,
    };

    // DIAGNOSTIC: Log the launch args object before sending
    this.logger.info('[ConnectionManager] DIAGNOSTIC: launchArgs object:', JSON.stringify(launchArgs, null, 2));
    this.logger.info('[ConnectionManager] DIAGNOSTIC: launchArgs.program value:', launchArgs.program);
    
    this.logger.info('[ConnectionManager] Sending "launch" request to adapter with args:', launchArgs);
    await client.sendRequest('launch', launchArgs);
    this.logger.info('[ConnectionManager] DAP "launch" request sent.');
  }

  /**
   * Set breakpoints for a file
   */
  async setBreakpoints(
    client: IDapClient,
    sourcePath: string,
    breakpoints: { line: number; condition?: string }[]
  ): Promise<DebugProtocol.SetBreakpointsResponse> {
    const sourceBreakpoints: DebugProtocol.SourceBreakpoint[] = breakpoints.map(bp => ({
      line: bp.line,
      condition: bp.condition
    }));

    const setBreakpointsArgs: DebugProtocol.SetBreakpointsArguments = {
      source: { path: sourcePath },
      breakpoints: sourceBreakpoints
    };

    this.logger.info(`[ConnectionManager] Setting ${breakpoints.length} breakpoint(s) for ${sourcePath}`);
    const response = await client.sendRequest<DebugProtocol.SetBreakpointsResponse>(
      'setBreakpoints', 
      setBreakpointsArgs
    );
    this.logger.info('[ConnectionManager] Breakpoints set. Response:', response);
    
    return response;
  }

  /**
   * Send configuration done notification
   */
  async sendConfigurationDone(client: IDapClient): Promise<void> {
    this.logger.info('[ConnectionManager] Sending "configurationDone" to adapter.');
    await client.sendRequest('configurationDone', {});
    this.logger.info('[ConnectionManager] "configurationDone" sent.');
  }
}
