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
import { sanitizePayloadForLogging, toWireSourceBreakpoint, type BreakpointFields } from '@debugmcp/shared';

/** Wait before the first connect attempt: most adapters are not listening yet. */
const INITIAL_CONNECT_DELAY_MS = 500;
/** Wait between connect attempts. */
const CONNECT_RETRY_INTERVAL_MS = 200;
/**
 * The connect window when the caller names none: the historical 60-attempt
 * equivalent (500 ms + 60 × 200 ms). Connect mode — a DAP server that is
 * already listening (remote rdbg/debugpy attach) — and legacy init payloads
 * without the parent's deadline still get exactly this (issue #963).
 */
export const DEFAULT_CONNECT_BUDGET_MS = INITIAL_CONNECT_DELAY_MS + 60 * CONNECT_RETRY_INTERVAL_MS;
/**
 * What spawn mode adds to the parent's init deadline for its connect window:
 * the parent's timer was armed first and its stage-aware message is the one a
 * slow adapter boot should get, so the loop outlives the deadline by this much
 * and ends promptly after it (the parent's stop() kills the worker anyway).
 */
export const PARENT_DEADLINE_TIE_MS = 500;

/**
 * Why the adapter process ended while the connect loop was waiting for it to
 * listen — the `reason` the worker aborts the loop's signal with (issue #963).
 */
export interface AdapterExitReason {
  code: number | null;
  signal: NodeJS.Signals | null;
  /** The adapter's last stderr lines, when it wrote any. */
  stderrTail?: string[];
}

export interface ConnectRetryOptions {
  /**
   * Wall-clock window from the call, in ms; `DEFAULT_CONNECT_BUDGET_MS` when
   * absent. The loop makes at least one attempt however small it is.
   */
  budgetMs?: number;
  /**
   * Aborting ends the loop at once (the adapter process exited: nothing will
   * ever listen). The signal's `reason`, an {@link AdapterExitReason} when the
   * worker aborts it, is quoted in the error.
   */
  abort?: AbortSignal;
}

/** A sleep that ends early when the signal aborts. */
function sleep(ms: number, abort?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (abort?.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      abort?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    abort?.addEventListener('abort', onAbort, { once: true });
  });
}

/** The stderr embedding caps the parent uses for its own init-exit error. */
const QUOTED_STDERR_LINES = 10;
const QUOTED_STDERR_CHARS = 2000;

/**
 * The exit, worded for the error: ` (code N[, signal S])` / ` (signal S)` /
 * nothing, plus the stderr tail sentence. A bare `abort()` carries an
 * AbortError (a DOMException, whose own `code` is 20), not an exit: nothing.
 *
 * The tail is the worker's snapshot at the process's `exit` event; the pipe
 * can still hold the adapter's final line then (issue #897 waits it out for
 * the `adapter_exited` status, this error cannot without losing the race with
 * the parent's generic exit message), so the wording says when it was taken.
 * The whole tail is in the proxy log.
 */
function describeAdapterExit(reason: unknown): { how: string; tail: string } {
  const exit = reason && typeof reason === 'object' && !(reason instanceof Error)
    ? (reason as Partial<AdapterExitReason>)
    : undefined;
  const code = typeof exit?.code === 'number' ? exit.code : null;
  const signal = typeof exit?.signal === 'string' ? exit.signal : null;
  const how = code !== null ? ` (code ${code}${signal ? `, signal ${signal}` : ''})` : signal ? ` (signal ${signal})` : '';
  if (!Array.isArray(exit?.stderrTail) || exit.stderrTail.length === 0) {
    return { how, tail: '' };
  }
  let quoted = exit.stderrTail.slice(-QUOTED_STDERR_LINES).join(' | ');
  if (quoted.length > QUOTED_STDERR_CHARS) {
    quoted = `…${quoted.slice(quoted.length - QUOTED_STDERR_CHARS)}`;
  }
  return { how, tail: `. Its last stderr lines by the time it exited: ${quoted}` };
}

export class DapConnectionManager {
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
   * Connect to the DAP adapter, retrying every 200 ms after a 500 ms first
   * wait, until one of three things happens (issue #963):
   *
   * - the connect succeeds — the client is returned;
   * - `options.abort` fires — the adapter process exited, so the loop ends at
   *   once and the error quotes the exit (code/signal, last stderr lines);
   * - `options.budgetMs` runs out — the error says nothing accepted a
   *   connection on host:port within the window, with the attempt count and
   *   the last socket error.
   *
   * The window is wall clock, not an attempt count: a fixed 60 attempts
   * (~12.5 s) used to fail a launch whose adapter was still booting on a
   * loaded runner, 17.5 s before the parent's own 30 s deadline would have
   * given up. In spawn mode the worker sizes the window from that deadline,
   * so the loop has no budget of its own there; connect mode and legacy
   * payloads keep the historical window as the default.
   */
  async connectWithRetry(host: string, port: number, options: ConnectRetryOptions = {}): Promise<IDapClient> {
    const budgetMs = options.budgetMs ?? DEFAULT_CONNECT_BUDGET_MS;
    const abort = options.abort;
    const startedAt = Date.now();
    const deadline = startedAt + budgetMs;
    const budgetSeconds = (budgetMs / 1000).toFixed(1);

    const initialDelay = Math.min(INITIAL_CONNECT_DELAY_MS, budgetMs);
    this.logger.info(`[ConnectionManager] Waiting ${initialDelay}ms before first DAP connect attempt (window ${budgetSeconds}s).`);
    await sleep(initialDelay, abort);

    // Create client with policy if available
    const client = this.policy
      ? this.dapClientFactory.create(host, port, this.policy)
      : this.dapClientFactory.create(host, port);

    // Temporary error handler to prevent unhandled 'error' event crashes during connect attempts
    const tempErrorHandler = (err: Error) => {
      this.logger.debug(`[ConnectionManager] DAP client emitted 'error' during connection phase (expected for retries): ${err.message}`);
    };
    client.on('error', tempErrorHandler);

    const fail = (reason: string): never => {
      this.logger.error(`[ConnectionManager] ${reason}`);
      client.off('error', tempErrorHandler);
      // The failed connects' sockets have destroyed themselves; this leaves the
      // client itself terminal so nothing can reuse it. Never let it mask the
      // reason (the same guard disconnect() below applies).
      try {
        client.disconnect();
      } catch (e) {
        this.logger.warn(`[ConnectionManager] client.disconnect() after a failed connect threw: ${e instanceof Error ? e.message : String(e)}`);
      }
      throw new Error(`Failed to connect DAP client: ${reason}`);
    };

    const failOnAdapterExit = (): never => {
      const { how, tail } = describeAdapterExit(abort?.reason);
      return fail(`the adapter process exited${how} before it started listening on ${host}:${port}${tail}`);
    };

    let connectAttempts = 0;
    let lastError = 'none';

    for (;;) {
      if (abort?.aborted) {
        failOnAdapterExit();
      }
      connectAttempts++;
      try {
        this.logger.info(`[ConnectionManager] Attempting DAP client connect (attempt ${connectAttempts}, ${Date.now() - startedAt}ms into a ${budgetSeconds}s window) to ${host}:${port}`);
        await client.connect();
        this.logger.info('[ConnectionManager] DAP client connected to adapter successfully.');

        // Remove temporary handler as connection succeeded
        client.off('error', tempErrorHandler);
        return client;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }

      if (abort?.aborted) {
        failOnAdapterExit();
      }
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        // The elapsed time is stated beside the window: one attempt can
        // outlive it (a remote host that drops SYNs answers ETIMEDOUT after
        // the OS's own ~21 s), and the message must not read as if the loop
        // had stopped at the window.
        const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
        fail(`nothing accepted a connection on ${host}:${port} within ${budgetSeconds}s (${elapsedSeconds}s elapsed, ${connectAttempts} attempts; last error: ${lastError})`);
      }

      this.logger.warn(`[ConnectionManager] DAP client connect attempt ${connectAttempts} failed: ${lastError}. Retrying in ${CONNECT_RETRY_INTERVAL_MS}ms...`);
      await sleep(Math.min(CONNECT_RETRY_INTERVAL_MS, remainingMs), abort);
    }
  }

  /**
   * Initialize DAP session. Returns the adapter's advertised capabilities
   * (the initialize response body) when available (issue #243); test stubs
   * and degenerate adapters may yield undefined.
   */
  async initializeSession(
    client: IDapClient,
    sessionId: string,
    adapterId: string = 'python'
  ): Promise<DebugProtocol.Capabilities | undefined> {
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
    const response = await client.sendRequest<DebugProtocol.InitializeResponse>('initialize', initializeArgs);
    this.logger.info('[ConnectionManager] DAP "initialize" request sent and response received.');
    return response?.body;
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
      onBreakpoint?: (body: DebugProtocol.BreakpointEvent['body']) => void;
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

    if (handlers.onBreakpoint) {
      client.on('breakpoint', handlers.onBreakpoint);
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
   * Send a launch request with proper configuration.
   *
   * `options.requestCommand` is the DAP verb the launch goes out as — 'launch'
   * unless the policy's `launchRequestCommand` says otherwise (rdbg honours
   * `nonstop` only on `attach`, issue #798). The arguments are the same
   * either way.
   */
  async sendLaunchRequest(
    client: IDapClient,
    scriptPath: string,
    scriptArgs: string[] = [],
    stopOnEntry: boolean = true,
    justMyCode: boolean = true,
    launchConfig?: Record<string, unknown>,
    options?: { requestCommand?: 'launch' | 'attach' }
  ): Promise<void> {
    const requestCommand = options?.requestCommand ?? 'launch';
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

    // The adapter's own name for the entry stop (netcoredbg: stopAtEntry,
    // issue #973), carrying the same final decision; a caller's value wins.
    const entryStopKey = this.policy?.entryStopLaunchKey;
    if (entryStopKey && !(entryStopKey in baseLaunchArgs)) {
      launchArgs[entryStopKey] = resolvedStopOnEntry;
    }

    if (!('noDebug' in launchArgs)) {
      launchArgs.noDebug = false;
    }

    if (!('console' in launchArgs)) {
      launchArgs.console = 'internalConsole';
    }

    // Sanitized: launch configs can carry the debuggee's full environment
    this.logger.info(`[ConnectionManager] Sending "${requestCommand}" request (launch) to adapter with args:`, sanitizePayloadForLogging(launchArgs));
    await client.sendRequest(requestCommand, launchArgs);
    this.logger.info(`[ConnectionManager] DAP "${requestCommand}" request (launch) sent.`);
  }

  /**
   * Send an attach request to connect to a running process
   */
  async sendAttachRequest(
    client: IDapClient,
    attachConfig: Record<string, unknown>
  ): Promise<void> {
    this.logger.info('[ConnectionManager] Sending "attach" request to adapter with config:', sanitizePayloadForLogging(attachConfig));
    await client.sendRequest('attach', attachConfig);
    this.logger.info('[ConnectionManager] DAP "attach" request sent.');
  }

  /**
   * Set breakpoints for a file. The policy, when given, supplies the wire
   * form (js-debug compiles logpoints into conditions, issue #850).
   */
  async setBreakpoints(
    client: IDapClient,
    sourcePath: string,
    breakpoints: BreakpointFields[],
    policy?: Pick<AdapterPolicy, 'toWireBreakpoint'> | null
  ): Promise<DebugProtocol.SetBreakpointsResponse> {
    const sourceBreakpoints: DebugProtocol.SourceBreakpoint[] = breakpoints.map((bp) => toWireSourceBreakpoint(bp, policy));

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
   * Set exception breakpoints (issue #220). Filters are concrete adapter
   * filter IDs already resolved from the abstract breakOnExceptions mode.
   */
  async setExceptionBreakpoints(
    client: IDapClient,
    filters: string[]
  ): Promise<DebugProtocol.SetExceptionBreakpointsResponse> {
    this.logger.info(`[ConnectionManager] Sending "setExceptionBreakpoints" with filters: ${JSON.stringify(filters)}`);
    const response = await client.sendRequest<DebugProtocol.SetExceptionBreakpointsResponse>(
      'setExceptionBreakpoints',
      { filters }
    );
    this.logger.info('[ConnectionManager] Exception breakpoints set.');
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
