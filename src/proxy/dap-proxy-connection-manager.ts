/**
 * DAP connection management utilities
 */

import * as path from 'path';
import { DebugProtocol } from '@vscode/debugprotocol';
import {
  IDapClient,
  IDapClientFactory,
  ILogger,
  ExtendedInitializeArgs
} from './dap-proxy-interfaces.js';
import type { AdapterPolicy } from '@debugmcp/shared';

export class DapConnectionManager {
  // Increased initial delay to give debugpy more time to start
  // This is especially important in CI/test environments
  private readonly INITIAL_CONNECT_DELAY = 500;  
  private readonly MAX_CONNECT_ATTEMPTS = 60;
  private readonly CONNECT_RETRY_INTERVAL = 200;
  private policy?: AdapterPolicy;

  constructor(
    private dapClientFactory: IDapClientFactory,
    private logger: ILogger
  ) {}
  
  /**
   * Set the adapter policy for creating DAP clients
   */
  setAdapterPolicy(policy: AdapterPolicy): void {
    this.policy = policy;
  }

  /**
   * Connect to DAP adapter with retry logic
   */
  async connectWithRetry(host: string, port: number): Promise<IDapClient> {
    this.logger.info(`[ConnectionManager] Waiting ${this.INITIAL_CONNECT_DELAY}ms before first DAP connect attempt.`);
    await new Promise(resolve => setTimeout(resolve, this.INITIAL_CONNECT_DELAY));

    // Create client with policy if available
    const client = this.policy 
      ? this.dapClientFactory.create(host, port, this.policy)
      : this.dapClientFactory.create(host, port);
    
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
  async initializeSession(client: IDapClient, sessionId: string, adapterId: string = 'python'): Promise<void> {
    const initializeArgs: ExtendedInitializeArgs = {
      clientID: `mcp-proxy-${sessionId}`,
      clientName: 'MCP Debug Proxy',
      adapterID: adapterId,
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsRunInTerminalRequest: false,
      locale: 'en-US'
    };

    this.logger.info('[ConnectionManager] Sending DAP "initialize" request');
    await client.sendRequest('initialize', initializeArgs);
    this.logger.info('[ConnectionManager] DAP "initialize" request sent and response received.');
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
    justMyCode: boolean = true,
    launchConfig?: Record<string, unknown>
  ): Promise<void> {
    this.logger.info('[ConnectionManager] Received scriptPath:', scriptPath);
    
    const baseLaunchArgs = launchConfig ? { ...launchConfig } : {};

    const resolvedProgram =
      typeof baseLaunchArgs.program === 'string' && baseLaunchArgs.program.length > 0
        ? (baseLaunchArgs.program as string)
        : scriptPath;

    const resolvedArgs = Array.isArray(baseLaunchArgs.args)
      ? (baseLaunchArgs.args as unknown[]).filter((arg): arg is string => typeof arg === 'string')
      : scriptArgs;

    const resolvedStopOnEntry =
      typeof baseLaunchArgs.stopOnEntry === 'boolean' ? (baseLaunchArgs.stopOnEntry as boolean) : stopOnEntry;

    const resolvedJustMyCode =
      typeof baseLaunchArgs.justMyCode === 'boolean' ? (baseLaunchArgs.justMyCode as boolean) : justMyCode;

    const launchArgs: Record<string, unknown> = {
      ...baseLaunchArgs,
      program: resolvedProgram,
      args: resolvedArgs,
      stopOnEntry: resolvedStopOnEntry,
      justMyCode: resolvedJustMyCode,
    };

    if (!('noDebug' in launchArgs)) {
      launchArgs.noDebug = false;
    }

    if (!('console' in launchArgs)) {
      launchArgs.console = 'internalConsole';
    }

    this.logger.info('[ConnectionManager] Sending "launch" request to adapter with args:', launchArgs);
    await client.sendRequest('launch', launchArgs);
    this.logger.info('[ConnectionManager] DAP "launch" request sent.');
  }

  /**
   * Send an attach request to connect to a running process
   */
  async sendAttachRequest(
    client: IDapClient,
    attachConfig: Record<string, unknown>
  ): Promise<void> {
    this.logger.info('[ConnectionManager] Sending "attach" request to adapter with config:', attachConfig);
    await client.sendRequest('attach', attachConfig);
    this.logger.info('[ConnectionManager] DAP "attach" request sent.');
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
      source: { path: sourcePath, name: path.basename(sourcePath) },
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
