/**
 * Core worker class for DAP Proxy functionality.
 * Uses the Adapter Policy pattern to eliminate language-specific hardcoding
 */

import { ChildProcess } from 'child_process';
import { existsSync } from 'fs';
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
  ErrorMessage,
  BreakpointSyncResult,
  MIRROR_EXPOSE_COMMAND,
  MIRROR_UNEXPOSE_COMMAND
} from './dap-proxy-interfaces.js';
import type { IDapMirrorServer, MirrorEndpoint } from './dap-mirror-server.js';
import { CallbackRequestTracker } from './dap-proxy-request-tracker.js';
import { GenericAdapterManager, AdapterStdioSource } from './dap-proxy-adapter-manager.js';
import { dapTracePathFor, proxyLogPathFor } from './session-log-layout.js';
import { DapConnectionManager } from './dap-proxy-connection-manager.js';
import { 
  validateProxyInitPayload
} from '../utils/type-guards.js';
import { SilentDapCommandPayload } from './dap-extensions.js';
// Import adapter policies from shared package
import type { AdapterPolicy, AdapterSpecificState, BreakpointFields } from '@debugmcp/shared';
import {
  DefaultAdapterPolicy,
  JsDebugAdapterPolicy,
  PythonAdapterPolicy,
  RustAdapterPolicy,
  GoAdapterPolicy,
  JavaAdapterPolicy,
  RubyAdapterPolicy,
  DotnetAdapterPolicy,
  MockAdapterPolicy,
  getPolicyForLanguage,
  resolveExceptionFilters
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

/**
 * Cap for the pre-connect and policy command queues (issue #405). Both are
 * normally drained within one adapter handshake, so a queue this deep means
 * the adapter is wedged — commands past the cap are rejected with an error
 * response on their live requestId (silent eviction would hang the client).
 */
export const MAX_QUEUED_COMMANDS = 256;

/**
 * How long after the 'initialized' event to keep waiting for the initialize
 * response before proceeding without it (issue #492, policies declaring
 * initializeResponseOptional). In every healthy handshake the response
 * precedes the event, so this only delays the recovery path — matched to the
 * Phase-1 initialized wait used by the launch-before-config flow.
 */
export const INITIALIZE_RESPONSE_GRACE_MS = 2000;

export class DapProxyWorker {
  private logger: ILogger | null = null;
  private dapClient: IDapClient | null = null;
  private adapterProcess: ChildProcess | null = null;
  private currentSessionId: string | null = null;
  private currentInitPayload: ProxyInitPayload | null = null;
  private state: ProxyState = ProxyState.UNINITIALIZED;
  private isAttachMode: boolean = false;
  // In-flight shutdown latch (issue #502): natural termination starts
  // shutdown() as a floating promise off a DAP event, so a terminate command
  // arriving mid-shutdown must await the same promise — otherwise
  // handleCommand returns while state is still SHUTTING_DOWN and the runner's
  // post-command exit check never fires, stranding the worker alive forever.
  private shutdownPromise: Promise<void> | null = null;
  /** Once-per-session guard for the adapter_capabilities status message (issue #243). */
  private adapterCapabilitiesSent: boolean = false;
  // Exit-code synthesis bookkeeping (issue #247): a real DAP exited event
  // wins over synthesis, and parent+child terminated events synthesize once
  private exitedEventSeen: boolean = false;
  private exitSynthesisAttempted: boolean = false;
  /** Armed when adapter stdio forwarding is active (issue #222): resolves once both stdio streams close. */
  private adapterStdioDrained: Promise<void> | null = null;
  // Terminal signals (exited/terminated DAP events, socket close, adapter
  // process exit) all await the stdio drain barrier; without a queue their
  // continuations resume in an order set by await counts, not arrival — a
  // codeless dap_connection_closed outrunning terminated makes the parent
  // end the session as an error (issue #258).
  private terminalSignalQueue: Promise<void> = Promise.resolve();
  /** True once an exited/terminated DAP event was forwarded to the parent (issue #258). */
  private terminalDapEventForwarded: boolean = false;
  // Adapter-exit exitCode synthesis (issue #258): armed by policies whose
  // adapter process exit status IS the debuggee's (rdbg -c). The exit is
  // recorded synchronously so the terminated slot can synthesize a DAP
  // exited event even though rdbg never sends one.
  private adapterExitCodeIsDebuggeeExitCode: boolean = false;
  private adapterExitCode: number | null | undefined = undefined;
  private adapterExitSynthesisAttempted: boolean = false;
  private initializedEventPending: boolean = false;
  private deferInitializedHandling: boolean = false;
  private initializedEventHandled: boolean = false;
  private initializedEventPromise: Promise<void> | null = null;
  private initializedEventResolver: (() => void) | null = null;
  private requestTracker: CallbackRequestTracker;
  private processManager: GenericAdapterManager | null = null;
  private connectionManager: DapConnectionManager | null = null;
  
  // Policy-based state management
  private adapterPolicy: AdapterPolicy = DefaultAdapterPolicy;
  private adapterState: AdapterSpecificState;
  private commandQueue: (DapCommandPayload | SilentDapCommandPayload)[] = [];
  private preConnectQueue: DapCommandPayload[] = [];

  // DAP mirror (issue #217): per-session read-only IDE endpoint.
  private mirrorServer: IDapMirrorServer | null = null;
  private mirrorEndpoint: MirrorEndpoint | null = null;
  /** Adapter capabilities retained for the mirror's initialize response. */
  private adapterCapabilities: DebugProtocol.Capabilities | null = null;
  /** Body of the most recent stopped event; null while running. */
  private lastStop: DebugProtocol.StoppedEvent['body'] | null = null;
  // stopped/continued reach mirror clients via the worker's own event
  // handlers (post threadId-backfill); this generic-channel forwarder covers
  // everything else. initialized is per-client handshake, never replicated.
  private readonly mirrorEventForwarder = (evt: DebugProtocol.Event): void => {
    if (evt.event === 'stopped' || evt.event === 'continued' || evt.event === 'initialized') {
      return;
    }
    this.mirrorServer?.broadcastEvent(evt.event, evt.body);
  };

  private readonly exitHook: (code: number) => void;
  private readonly traceFileFactory: (sessionId: string, logDir: string) => string | undefined;

  constructor(
    private dependencies: DapProxyDependencies,
    hooks: DapProxyWorkerHooks = {}
  ) {
    this.requestTracker = new CallbackRequestTracker(
      (requestId, command, timeoutMs) => this.handleRequestTimeout(requestId, command, timeoutMs)
    );
    this.adapterState = DefaultAdapterPolicy.createInitialState();

    this.exitHook = hooks.exit ?? ((code: number) => {
      // Default to preserving existing behaviour in production.
      process.exit(code);
    });

    // Per-frame DAP tracing is opt-in (issue #403): every frame is written
    // synchronously to an uncapped ndjson file, so it must never be the
    // default. DAP_TRACE=1 enables it with the standard per-session path; an
    // explicit DAP_TRACE_FILE (inherited via the spawn env) is honored as-is.
    this.traceFileFactory = hooks.createTraceFile ?? ((sessionId: string, logDir: string) => {
      const explicit = process.env.DAP_TRACE_FILE;
      if (explicit) {
        return explicit;
      }
      const flag = (process.env.DAP_TRACE ?? '').toLowerCase();
      if (flag !== '1' && flag !== 'true') {
        return undefined;
      }
      const tracePath = dapTracePathFor(logDir, sessionId);
      process.env.DAP_TRACE_FILE = tracePath;
      return tracePath;
    });
  }

  /**
   * Select the appropriate adapter policy based on the adapter command
   */
  private selectAdapterPolicy(
    language?: string,
    adapterCommand?: { command: string; args: string[] }
  ): AdapterPolicy {
    // Preferred path: the session's language identifies the policy directly.
    if (language) {
      const policy = getPolicyForLanguage(language);
      if (policy !== DefaultAdapterPolicy) {
        return policy;
      }
    }

    if (!adapterCommand) {
      // Legacy fallback: when no adapter command is specified (pre-monorepo sessions),
      // default to Python adapter policy
      return PythonAdapterPolicy;
    }

    // Legacy fallback: infer the policy from the adapter command shape
    if (JsDebugAdapterPolicy.matchesAdapter(adapterCommand)) {
      return JsDebugAdapterPolicy;
    } else if (PythonAdapterPolicy.matchesAdapter(adapterCommand)) {
      return PythonAdapterPolicy;
    } else if (RustAdapterPolicy.matchesAdapter(adapterCommand)) {
      return RustAdapterPolicy;
    } else if (GoAdapterPolicy.matchesAdapter(adapterCommand)) {
      return GoAdapterPolicy;
    } else if (RubyAdapterPolicy.matchesAdapter(adapterCommand)) {
      return RubyAdapterPolicy;
    } else if (JavaAdapterPolicy.matchesAdapter(adapterCommand)) {
      return JavaAdapterPolicy;
    } else if (DotnetAdapterPolicy.matchesAdapter(adapterCommand)) {
      return DotnetAdapterPolicy;
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
   * Get the current session id (null before initialization).
   * Used by the entry point for error-message context.
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Main command handler
   */
  async handleCommand(command: ParentCommand): Promise<void> {
    this.currentSessionId = command.sessionId || null;

    const sessionTag = this.currentSessionId ?? 'unknown';
    const dapLabel =
      command.cmd === 'dap' && (command as { dapCommand?: string }).dapCommand
        ? (command as DapCommandPayload).dapCommand
        : undefined;
    this.logger?.info(
      `[Worker] handleCommand cmd=${command.cmd}${dapLabel ? `/${dapLabel}` : ''} session=${sessionTag}`
    );

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
      const completionLabel =
        command.cmd === 'dap' && 'dapCommand' in command
          ? `${command.cmd}/${(command as DapCommandPayload).dapCommand}`
          : command.cmd;
      this.logger?.info(
        `[Worker] Completed command ${completionLabel} session=${sessionTag} state=${this.state}`
      );
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
    // If already initializing, just acknowledge and return (idempotent handling for retries)
    if (this.state === ProxyState.INITIALIZING) {
      this.sendStatus('init_received');
      this.logger?.info('[Worker] Duplicate init command received while already initializing, acknowledging');
      return;
    }

    // Only allow init from UNINITIALIZED state for first init
    if (this.state !== ProxyState.UNINITIALIZED) {
      throw new Error(`Invalid state for init: ${this.state}`);
    }

    // Immediately acknowledge receipt of init command
    this.sendStatus('init_received');

    // Validate payload structure
    const validatedPayload = validateProxyInitPayload(payload);
    
    // Select adapter policy
    this.adapterPolicy = this.selectAdapterPolicy(validatedPayload.language, validatedPayload.adapterCommand);
    this.adapterState = this.adapterPolicy.createInitialState();
    this.logger?.info(`[Worker] Selected adapter policy: ${this.adapterPolicy.name}`);
    
    this.state = ProxyState.INITIALIZING;
    this.currentInitPayload = validatedPayload;

    try {
      // Create logger
      const logPath = proxyLogPathFor(payload.logDir, payload.sessionId);
      await this.dependencies.fileSystem.ensureDir(path.dirname(logPath));
      this.logger = await this.dependencies.loggerFactory(payload.sessionId, payload.logDir, payload.logLevel);
      this.logger.info(`[Worker] DAP Proxy worker initialized for session ${payload.sessionId}`);
      this.logger.info(`[Worker] Using adapter policy: ${this.adapterPolicy.name}`);

      // Pull the proxy-layer module loggers (DAP client, child-session
      // manager, CDP bridges) into this session's log file so routing
      // decisions are readable next to the worker's own lines (issue #519)
      const redirected = this.dependencies.redirectProxyLoggers?.({
        file: logPath,
        level: payload.logLevel ?? 'debug'
      });
      if (redirected) {
        this.logger.info(`[Worker] Redirected ${redirected} module logger(s) into ${logPath}`);
      }

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
      await this.startAdapterAndConnect(payload);
    } catch (error) {
      // Roll back for a possible re-init — unless a shutdown already ran
      // (startAdapterAndConnect shuts down before rethrowing): the latched
      // shutdown() below is then a completed no-op, and clobbering its
      // TERMINATED would let a retry re-init a torn-down worker (issue #502).
      if (!this.shutdownPromise) {
        this.state = ProxyState.UNINITIALIZED;
      }
      const message = error instanceof Error ? error.message : String(error);

      // Include adapter spawn config (command + args only, NOT env) for diagnostics
      const adapterCmd = payload.adapterCommand;
      const spawnInfo = adapterCmd
        ? `Adapter command: ${adapterCmd.command} ${(adapterCmd.args ?? []).join(' ')}`
        : `Executable: ${payload.executablePath ?? 'unknown'}`;
      const adapterPid = this.adapterProcess?.pid ?? 'none';
      const adapterExitCode = this.adapterProcess?.exitCode;
      const diagnostics = `${spawnInfo} | adapter PID=${adapterPid} exitCode=${adapterExitCode ?? 'n/a'}`;

      this.logger?.error(`[Worker] Critical initialization error: ${message} [${diagnostics}]`, error);
      this.sendError(`Critical initialization error: ${message} [${diagnostics}]`);
      await this.shutdown();
      // Use setImmediate/setTimeout to allow IPC message to flush before exit
      setImmediate(() => {
        setTimeout(() => {
          this.exitHook(1);
        }, 100);
      });
    }
  }

  /**
   * Handle dry run mode
   * Includes Windows IPC message flushing fixes
   */
  private handleDryRun(payload: ProxyInitPayload): void {
    // Get adapter spawn config from policy
    const spawnConfig = this.adapterPolicy.getAdapterSpawnConfig?.({
      executablePath: payload.executablePath,
      adapterHost: payload.adapterHost,
      adapterPort: payload.adapterPort,
      logDir: payload.logDir,
      scriptPath: payload.scriptPath,
      launchConfig: payload.launchConfig,
      adapterCommand: payload.adapterCommand
    });
    
    if (!spawnConfig) {
      throw new Error(`Cannot determine adapter command for dry run (policy: ${this.adapterPolicy.name})`);
    }
    
    const fullCommand = spawnConfig.mode === 'connect'
      ? `[connect] ${spawnConfig.host}:${spawnConfig.port}`
      : `${spawnConfig.command} ${spawnConfig.args.join(' ')}`;
    
    this.logger!.warn(`[Worker DRY_RUN] Would execute: ${fullCommand}`);
    this.logger!.warn(`[Worker DRY_RUN] Script to debug: ${payload.scriptPath}`);
    
    // Send dry run complete status
    this.sendStatus('dry_run_complete', { 
      command: fullCommand, 
      script: payload.scriptPath 
    });
    
    // For IPC, ensure the message is flushed before terminating
    // Use setImmediate to allow the event loop to process the IPC send
    // This is crucial on Windows where IPC messages can be lost if the process exits too quickly
    setImmediate(() => {
      this.state = ProxyState.TERMINATED;
      this.logger!.info('[Worker DRY_RUN] Dry run complete. State set to TERMINATED after message flush.');

      // Give a bit more time for IPC to flush on Windows
      // Use the exit hook to allow tests to override this behavior
      setTimeout(() => {
        this.exitHook(0);
      }, 100);
    });
  }

  /**
   * Start adapter and establish connection
   */
  private async startAdapterAndConnect(payload: ProxyInitPayload): Promise<void> {
    // Get adapter spawn config from policy
    const spawnConfig = this.adapterPolicy.getAdapterSpawnConfig?.({
      executablePath: payload.executablePath,
      adapterHost: payload.adapterHost,
      adapterPort: payload.adapterPort,
      logDir: payload.logDir,
      scriptPath: payload.scriptPath,
      launchConfig: payload.launchConfig,
      adapterCommand: payload.adapterCommand
    });
    
    if (!spawnConfig) {
      throw new Error(`Adapter policy ${this.adapterPolicy.name} does not provide spawn configuration`);
    }

    if (spawnConfig.mode === 'spawn') {
      // In container mode, default adapter cwd to workspace root so that
      // relative paths in DAP launch args (classpath, cwd, etc.) resolve
      // against the mounted project directory rather than /app. Only when the
      // directory actually exists: in a kubectl-debug ephemeral container
      // nothing mounts /workspace, and spawning with a nonexistent cwd fails
      // with an opaque ENOENT (issue #332).
      if (
        process.env.MCP_WORKSPACE_ROOT &&
        !spawnConfig.cwd &&
        existsSync(process.env.MCP_WORKSPACE_ROOT)
      ) {
        spawnConfig.cwd = process.env.MCP_WORKSPACE_ROOT;
      }

      const spawnResult = await this.processManager!.spawn({
        ...spawnConfig,
        onStdioLine: this.buildStdioForwarder(spawnConfig.forwardStdio)
      });

      this.adapterProcess = spawnResult.process;
      if (spawnConfig.forwardStdio) {
        this.adapterStdioDrained = this.createStdioDrainBarrier(spawnResult.process);
      }
      this.adapterExitCodeIsDebuggeeExitCode = spawnConfig.adapterExitCodeIsDebuggeeExitCode === true;
      this.logger!.info(`[Worker] Adapter spawned with PID: ${spawnResult.pid}`);
      // Init-progress fact for the parent's proxyInitTimeout diagnosis (issue #493).
      this.sendStatus('adapter_spawned', { pid: spawnResult.pid });

      this.adapterProcess.on('error', (err) => {
        this.logger!.error('[Worker] Adapter process error:', err);
        this.sendError(`Adapter process error: ${err.message}`);
      });

      this.adapterProcess.on('exit', (code, signal) => {
        this.logger!.info(`[Worker] Adapter process exited. Code: ${code}, Signal: ${signal}`);
        // Recorded synchronously: the terminated slot's synthesis wait may
        // resolve on this very event (issue #258)
        this.adapterExitCode = code;
        this.enqueueTerminalSignal('adapter_exited', async () => {
          await this.waitForAdapterStdioDrain();
          this.sendStatus('adapter_exited', { code, signal, expected: this.isTerminationExpected() });
        });
      });
    } else {
      // connect mode: an external DAP server is already listening (e.g. remote
      // rdbg attach). There is no adapter process to monitor — termination is
      // detected via socket close (dap_connection_closed), not process exit.
      this.adapterProcess = null;
      this.logger!.info(
        `[Worker] Connecting directly to DAP server at ${spawnConfig.host}:${spawnConfig.port} (no adapter process to monitor)`
      );
    }

    // Connect to adapter
    try {
      this.dapClient = await this.connectionManager!.connectWithRetry(
        spawnConfig.host,
        spawnConfig.port
      );

      // Record the break-on-exception mode on the client so DAP child
      // sessions (js-debug) can apply the same filters (issue #220).
      this.dapClient.setExceptionBreakMode?.(payload.breakOnExceptions ?? 'none');

      // Init-progress fact for the parent's proxyInitTimeout diagnosis (issue
      // #493). Deliberately NOT 'adapter_connected', whose parent handler marks
      // the session initialized to unblock the js-debug queueing handshake.
      this.sendStatus('dap_handshake_stage', { stage: 'transport_connected' });

      // Set up event handlers
      this.setupDapEventHandlers();

      // Detect attach mode from launchConfig. Needed to determine the DAP
      // sequence below AND the shutdown behavior (attach mode must detach
      // with terminateDebuggee=false so the target survives) — including for
      // command-queueing policies (js-debug), whose handshake is driven by
      // the SessionManager rather than this worker.
      const isAttachMode = payload.launchConfig?.request === 'attach' ||
                           payload.launchConfig?.__attachMode === true;
      this.isAttachMode = isAttachMode;

      // Check if adapter requires command queueing
      if (this.adapterPolicy.requiresCommandQueueing()) {
        this.logger!.info(`[Worker] ${this.adapterPolicy.name} adapter detected; command queueing enabled (attachMode=${isAttachMode})`);
        // Queueing policies never reach handleInitializedEvent's config
        // sequence, so seed the pre-launch function breakpoints here — for
        // cdp-delivery policies (js-debug, issue #295) this lands in the CDP
        // bridge's desired set BEFORE the handshake's launch can produce the
        // entry stop the bridge binds at.
        await this.sendInitialFunctionBreakpoints();
        this.state = ProxyState.CONNECTED;
        this.sendStatus('adapter_connected');
        await this.drainPreConnectQueue();
      } else {
        const initBehavior = this.adapterPolicy.getInitializationBehavior();

        // For adapters that send 'initialized' before launch/attach (Go/Delve, Java),
        // set up deferred handling BEFORE sending 'initialize' to avoid a race where
        // both the initialize response and initialized event arrive in the same TCP
        // packet and the event is processed before the flag is set.
        if (isAttachMode || initBehavior.sendLaunchBeforeConfig) {
          this.deferInitializedHandling = true;
          this.initializedEventPromise = new Promise<void>((resolve) => {
            this.initializedEventResolver = resolve;
          });
        }

        // Initialize DAP session with correct adapterId
        const capabilities = await this.awaitInitializeResponse(payload, initBehavior, isAttachMode);
        if (capabilities) {
          this.captureAdapterCapabilities(capabilities);
        }

        if (isAttachMode && initBehavior.sendAttachBeforeInitialized) {
          // ATTACH-FIRST MODE: Send attach immediately, then wait for initialized.
          // Some adapters (debugpy) only send 'initialized' AFTER processing the
          // attach request — and only respond to attach after configurationDone,
          // so the attach response must not be awaited before handleInitializedEvent.
          const attachPayload = payload.launchConfig || {};
          this.logger!.info(`[Worker] Attach-first mode — sending attach. Keys: ${Object.keys(attachPayload).join(', ')}`);
          this.sendStatus('dap_handshake_stage', { stage: 'request_pending', command: 'attach' });
          const attachRequest = this.connectionManager!.sendAttachRequest(
            this.dapClient,
            attachPayload
          ).then((attachResult) => {
            this.sendStatus('dap_handshake_stage', { stage: 'response_received', command: 'attach' });
            return attachResult;
          });
          // Surface early attach failures (connection refused, bad args) instead
          // of waiting out the initialized timeout. Promise.race subscribes to
          // every arm, so this rejection is consumed even when another arm wins.
          const attachFailure = new Promise<never>((_, reject) => {
            attachRequest.catch(reject);
          });

          this.logger!.info('[Worker] Attach sent, waiting for "initialized" event');
          await Promise.race([
            this.initializedEventPromise!,
            attachFailure,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout waiting for initialized event after attach')), 15000)
            )
          ]);

          this.deferInitializedHandling = false;
          await this.handleInitializedEvent();
          // Now that configurationDone is sent, the adapter's attach response
          // can arrive; propagate an attach failure if it rejected instead.
          await attachRequest;
        } else if (isAttachMode) {
          // STANDARD ATTACH MODE: Wait for "initialized" event BEFORE sending attach
          // Some adapters send "initialized" after initialize response, before attach
          this.logger!.info('[Worker] Waiting for "initialized" event before sending attach');
          await Promise.race([
            this.initializedEventPromise!,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout waiting for initialized event')), 5000)
            )
          ]);

          this.logger!.info('[Worker] "initialized" event received, sending attach request');

          await this.trackedHandshakeRequest('attach', () => this.connectionManager!.sendAttachRequest(
            this.dapClient!,
            payload.launchConfig || {}
          ));

          this.deferInitializedHandling = false;
          await this.handleInitializedEvent();
        } else if (initBehavior.sendLaunchBeforeConfig) {
          // TWO-PHASE INITIALIZED HANDLING for adapters like Go/Delve, Java/JDI bridge
          // Phase 1: Brief wait — some adapters send initialized immediately after initialize
          this.logger!.info('[Worker] Phase 1: Waiting briefly for "initialized" event before launch');
          const receivedBeforeLaunch = await Promise.race([
            this.initializedEventPromise!.then(() => true as const),
            new Promise<false>(resolve => setTimeout(() => resolve(false), 2000))
          ]);

          if (receivedBeforeLaunch) {
            this.logger!.info('[Worker] "initialized" event received before launch');
          } else {
            this.logger!.warn('[Worker] "initialized" event not received within 2s — falling back to launch-first flow');
          }

          // Standard two-phase: send launch, wait for response, then configurationDone
          await this.trackedHandshakeRequest('launch', () => this.connectionManager!.sendLaunchRequest(
            this.dapClient!,
            payload.scriptPath,
            payload.scriptArgs,
            payload.stopOnEntry,
            payload.justMyCode,
            payload.launchConfig
          ));

          if (!receivedBeforeLaunch) {
            // Phase 2: Wait for initialized after launch
            this.logger!.info('[Worker] Phase 2: Waiting for "initialized" event after launch');
            await Promise.race([
              this.initializedEventPromise!,
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout waiting for initialized event (after launch fallback)')), 10000)
              )
            ]);
            this.logger!.info('[Worker] "initialized" event received after launch (fallback succeeded)');
          }

          this.deferInitializedHandling = false;
          await this.handleInitializedEvent();
        } else {
          // LAUNCH MODE: Send launch request FIRST, then wait for "initialized"
          // Python/debugpy sends "initialized" AFTER receiving the launch request
          this.logger!.info('[Worker] Sending launch request with scriptPath:', payload.scriptPath);

          await this.trackedHandshakeRequest('launch', () => this.connectionManager!.sendLaunchRequest(
            this.dapClient!,
            payload.scriptPath,
            payload.scriptArgs,
            payload.stopOnEntry,
            payload.justMyCode,
            payload.launchConfig
          ));
        }
      }

      this.logger!.info('[Worker] Waiting for "initialized" event from adapter.');
    } catch (error) {
      await this.shutdown();
      throw error;
    }
  }

  /**
   * Await the adapter's initialize response. For launch-mode policies that
   * declare initializeResponseOptional (rdbg, issue #492), the response is
   * raced against the already-armed 'initialized' event plus a grace period:
   * rdbg can process the request — proving it with the event — yet never send
   * the response, which would otherwise park this await until the parent's
   * 30s deadline kills the session. If the event wins, the launch proceeds
   * with unknown capabilities (a documented-legal value) and a late response
   * still captures them.
   */
  /**
   * Run a blocking init-phase DAP request bracketed by handshake-stage
   * statuses, so the parent knows which request is outstanding if the init
   * deadline fires (issue #493). A rejection leaves the request marked
   * pending — its own error carries the diagnosis then.
   */
  private async trackedHandshakeRequest<T>(command: string, run: () => Promise<T>): Promise<T> {
    this.sendStatus('dap_handshake_stage', { stage: 'request_pending', command });
    const result = await run();
    this.sendStatus('dap_handshake_stage', { stage: 'response_received', command });
    return result;
  }

  private async awaitInitializeResponse(
    payload: ProxyInitPayload,
    initBehavior: ReturnType<AdapterPolicy['getInitializationBehavior']>,
    isAttachMode: boolean
  ): Promise<DebugProtocol.Capabilities | undefined> {
    this.sendStatus('dap_handshake_stage', { stage: 'request_pending', command: 'initialize' });
    // Promise.resolve: initializeSession stubs may return bare undefined
    // (documented-legal for degenerate adapters).
    const initPromise = Promise.resolve(this.connectionManager!.initializeSession(
      this.dapClient!,
      payload.sessionId,
      this.adapterPolicy.getDapAdapterConfiguration().type
    )).then((caps) => {
      this.sendStatus('dap_handshake_stage', { stage: 'response_received', command: 'initialize' });
      return caps;
    });

    if (isAttachMode || !initBehavior.initializeResponseOptional || !this.initializedEventPromise) {
      return initPromise;
    }

    const requestSentAt = Date.now();
    // `settled` gates the grace timer: when the response wins the race, the
    // event's continuation (which may fire later, or in the same tick) must
    // not arm a stray timer.
    let settled = false;
    let graceTimer: NodeJS.Timeout | undefined;
    const eventThenGrace = this.initializedEventPromise.then(
      () => new Promise<'initialize-response-missing'>((resolve) => {
        if (settled) {
          resolve('initialize-response-missing'); // unobserved: the race is already decided
          return;
        }
        graceTimer = setTimeout(() => resolve('initialize-response-missing'), INITIALIZE_RESPONSE_GRACE_MS);
      })
    );

    try {
      const raced = await Promise.race([initPromise, eventThenGrace]);
      if (raced !== 'initialize-response-missing') {
        return raced;
      }
    } finally {
      settled = true;
      if (graceTimer) {
        clearTimeout(graceTimer);
      }
    }

    this.logger!.warn(
      `[Worker] 'initialized' event arrived but the 'initialize' response is still missing ` +
      `${Date.now() - requestSentAt}ms after the request (issue #492: rdbg can silently drop the ` +
      `response frame). Proceeding with the launch without adapter capabilities.`
    );
    // A late response still yields capabilities; the request's own timeout
    // rejection must not become an unhandled rejection.
    initPromise.then((caps) => {
      if (caps) {
        this.captureAdapterCapabilities(caps);
      }
    }).catch(() => {});
    return undefined;
  }

  /**
   * Set up DAP event handlers
   */
  private setupDapEventHandlers(): void {
    if (!this.dapClient || !this.connectionManager) return;

    this.connectionManager.setupEventHandlers(this.dapClient, {
      onInitialized: async () => {
        // Nothing awaits this listener — a rejection escaping it has no
        // handler and surfaces as an unhandled rejection (issue #420), so
        // failures are contained and logged here.
        try {
          // Update adapter state
          if (this.adapterPolicy.updateStateOnEvent) {
            this.adapterPolicy.updateStateOnEvent('initialized', {}, this.adapterState);
          }

          if (this.adapterPolicy.requiresCommandQueueing()) {
            this.logger!.info(`[Worker] DAP "initialized" (${this.adapterPolicy.name}) received; forwarding event and draining queue.`);
            this.sendDapEvent('initialized', {});
            await this.drainCommandQueue();
          } else {
            // If we're deferring initialized handling (e.g., to send launch/attach first),
            // mark the event as pending and resolve the promise to signal it arrived
            if (this.deferInitializedHandling) {
              this.logger!.info('[Worker] DAP "initialized" event received but deferred until after launch/attach');
              this.initializedEventPending = true;
              if (this.initializedEventResolver) {
                this.initializedEventResolver();
              }
            } else {
              await this.handleInitializedEvent();
            }
          }
        } catch (error) {
          this.logger!.error('[Worker] Error handling DAP "initialized" event:', error);
        }
      },
      onOutput: (body) => {
        this.logger!.debug('[Worker] DAP event: output', body);
        this.sendDapEvent('output', body);
      },
      onStopped: async (body) => {
        this.logger!.info(`[Worker] DAP event: stopped reason=${body.reason} threadId=${body.threadId} allThreadsStopped=${body.allThreadsStopped}`);
        // Some adapters (e.g. Delve for Go, JDI bridge for Java) may omit threadId
        // from stopped events or need fresh thread data. When threadId is missing,
        // issue a 'threads' request to discover a valid thread and populate the body.
        if (this.dapClient && typeof body.threadId !== 'number') {
          try {
            const resp = await this.dapClient.sendRequest('threads', {});
            this.logger!.info('[Worker] Auto-discovered threads after stopped event (no threadId)', resp);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const threads = (resp as any)?.body?.threads;
            if (Array.isArray(threads) && threads.length > 0 && typeof threads[0]?.id === 'number') {
              body.threadId = threads[0].id;
              this.logger!.info(`[Worker] Set missing threadId to ${body.threadId} from threads response`);
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger!.warn('[Worker] Failed to auto-discover threads:', msg);
          }
        } else if (this.dapClient && this.adapterPolicy?.name === 'java') {
          // JDI bridge (Java adapter) benefits from a 'threads' request after stopped
          // to ensure thread data is fresh before stackTrace requests.
          try {
            const resp = await this.dapClient.sendRequest('threads', {});
            this.logger!.info('[Worker] Pre-fetched threads after stopped event', resp);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger!.warn('[Worker] Failed to pre-fetch threads:', msg);
          }
        }
        // Mirror clients get the post-backfill body, and a late-joining IDE
        // replays it as its landing stop (issue #217).
        this.lastStop = body;
        this.mirrorServer?.broadcastEvent('stopped', body);
        this.sendDapEvent('stopped', body);
      },
      onContinued: (body) => {
        this.logger!.info('[Worker] DAP event: continued', body);
        this.lastStop = null;
        this.mirrorServer?.broadcastEvent('continued', body ?? {});
        this.sendDapEvent('continued', body);
      },
      onThread: (body) => {
        this.logger!.debug('[Worker] DAP event: thread', body);
        this.sendDapEvent('thread', body);
      },
      onBreakpoint: (body) => {
        // Deferred verification/relocation pushed by the adapter after the
        // setBreakpoints response (issue #236).
        this.logger!.debug('[Worker] DAP event: breakpoint', body);
        this.sendDapEvent('breakpoint', body);
      },
      onExited: (body) => {
        this.logger!.info(`[Worker] DAP event: exited exitCode=${body.exitCode}`);
        // A real exited event stays authoritative - suppress synthesis (issue #247).
        // Set synchronously, before any await, so a racing terminated sees it.
        this.exitedEventSeen = true;
        return this.enqueueTerminalSignal('exited', async () => {
          await this.waitForAdapterStdioDrain();
          await this.waitForChildEventFlush();
          this.terminalDapEventForwarded = true;
          this.sendDapEvent('exited', body);
        });
      },
      onTerminated: (body) => {
        this.logger!.info(`[Worker] DAP event: terminated body=${JSON.stringify(body)}`);
        // When adapter stdio is forwarded as debuggee output, the exit-time
        // flush of a block-buffered pipe arrives milliseconds AFTER the DAP
        // terminated event — but the SessionManager reacts to terminated by
        // stopping the proxy, which drops late messages. Hold terminated
        // until the streams have drained so the output wins the race.
        return this.enqueueTerminalSignal('terminated', async () => {
          await this.waitForAdapterStdioDrain();
          await this.waitForChildEventFlush();
          // Must complete before terminated is forwarded: whichever of
          // exited/terminated reaches the SessionManager first strips the
          // other's handler, and shutdown() below tears down the client
          await this.maybeSynthesizeExitedEvent();
          await this.maybeSynthesizeExitedFromAdapterExit();
          this.terminalDapEventForwarded = true;
          this.sendDapEvent('terminated', body);
          this.shutdown();
        });
      },
      onError: (err) => {
        this.logger!.error('[Worker] DAP client error:', err);
        this.sendError(`DAP client error: ${err.message}`);
      },
      onClose: () => {
        this.logger!.info('[Worker] DAP client connection closed.');
        // Adapters that close the DAP socket at debuggee exit (rdbg) race the
        // exit-time stdio flush exactly like terminated does — the parent
        // reacts to dap_connection_closed by tearing down its listeners, so
        // hold this path behind the same drain barrier (issue #222).
        return this.enqueueTerminalSignal('dap_connection_closed', async () => {
          await this.waitForAdapterStdioDrain();
          await this.waitForChildEventFlush();
          this.sendStatus('dap_connection_closed', { expected: this.isTerminationExpected() });
          this.shutdown();
        });
      }
    });
  }

  /**
   * Handle DAP initialized event
   */
  private async handleInitializedEvent(): Promise<void> {
    if (this.initializedEventHandled) {
      this.logger!.info('[Worker] DAP "initialized" event already handled, skipping duplicate.');
      return;
    }
    this.initializedEventHandled = true;
    this.logger!.info('[Worker] DAP "initialized" event received.');

    if (!this.currentInitPayload || !this.dapClient || !this.connectionManager) {
      throw new Error('Missing required state in initialized handler');
    }

    try {
      // Set initial breakpoints if provided
      if (this.currentInitPayload.initialBreakpoints?.length) {
        this.logger!.info('[Worker] Initial breakpoints payload:', this.currentInitPayload.initialBreakpoints);
        type InitialBreakpointEntry = BreakpointFields & { id?: string; file: string };
        const groupedBreakpoints = new Map<string, InitialBreakpointEntry[]>();

        for (const breakpoint of this.currentInitPayload.initialBreakpoints) {
          const filePath = path.resolve(breakpoint.file);
          if (!groupedBreakpoints.has(filePath)) {
            groupedBreakpoints.set(filePath, []);
          }
          // Full per-breakpoint fields — the connection manager maps them via
          // the shared toSourceBreakpoint, so nothing is dropped here (#235).
          // id/file ride along only for the breakpoints_synced echo below;
          // toSourceBreakpoint whitelists what reaches the adapter (#439).
          groupedBreakpoints.get(filePath)!.push({
            id: breakpoint.id,
            file: breakpoint.file,
            line: breakpoint.line,
            condition: breakpoint.condition,
            logMessage: breakpoint.logMessage,
            suspendPolicy: breakpoint.suspendPolicy
          });
        }

        const syncResults: BreakpointSyncResult[] = [];
        for (const [filePath, breakpoints] of groupedBreakpoints.entries()) {
          const response = await this.connectionManager.setBreakpoints(
            this.dapClient,
            filePath,
            breakpoints
          );
          // DAP guarantees the response breakpoints array is positional per
          // request; zip within each group so the echoed id stays attached.
          const resultBps = response?.body?.breakpoints ?? [];
          breakpoints.forEach((bp, i) => {
            syncResults.push({
              ...(bp.id !== undefined ? { id: bp.id } : {}),
              file: bp.file,
              line: bp.line,
              verified: resultBps[i]?.verified === true,
              ...(typeof resultBps[i]?.id === 'number' ? { adapterId: resultBps[i].id } : {}),
              ...(typeof resultBps[i]?.line === 'number' ? { boundLine: resultBps[i].line } : {}),
              ...(resultBps[i]?.message !== undefined ? { message: resultBps[i].message } : {})
            });
          });
        }
        // Forward the results to the parent (issue #439): for a launch that
        // never pauses, the post-launch re-sync is gated off (STOPPED), so
        // this status is the only path that stamps verified/adapterId in the
        // store. A status failure must never abort the launch;
        // setBreakpoints failures keep their existing abort semantics via
        // the outer catch.
        try {
          this.sendStatus('breakpoints_synced', { breakpoints: syncResults });
        } catch (err) {
          this.logger!.warn(
            `[Worker] breakpoints_synced status failed (continuing): ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }

      // Initial function breakpoints (issue #271 phase 3). Like exception
      // breakpoints below, a failure must not abort the launch — adapters
      // without support reject the request, and the post-launch re-sync
      // surfaces the state honestly.
      await this.sendInitialFunctionBreakpoints();

      // Arm exception breakpoints when requested (issue #220). A failure must
      // not abort the launch — the outer catch tears the session down — so
      // errors are swallowed with a warning.
      const exceptionMode = this.currentInitPayload.breakOnExceptions;
      if (exceptionMode && exceptionMode !== 'none') {
        const exceptionFilters = resolveExceptionFilters(this.adapterPolicy, exceptionMode);
        if (exceptionFilters.length > 0) {
          try {
            await this.connectionManager.setExceptionBreakpoints(this.dapClient, exceptionFilters);
          } catch (err) {
            this.logger!.warn(
              `[Worker] setExceptionBreakpoints failed (continuing without exception breakpoints): ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        } else {
          this.logger!.warn(
            `[Worker] breakOnExceptions '${exceptionMode}' is not supported by adapter policy '${this.adapterPolicy.name}'; skipping setExceptionBreakpoints`
          );
        }
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
   * Send the pre-launch function breakpoints (issue #271 phase 3). A failure
   * must not abort the launch — adapters without support reject the request,
   * and the post-launch re-sync surfaces the state honestly. For cdp-delivery
   * policies (js-debug, issue #295) the request never reaches the adapter:
   * MinimalDapClient routes it to the CDP bridge.
   */
  private async sendInitialFunctionBreakpoints(): Promise<void> {
    if (!this.currentInitPayload?.initialFunctionBreakpoints?.length || !this.dapClient) {
      return;
    }
    try {
      const response = (await this.dapClient.sendRequest('setFunctionBreakpoints', {
        breakpoints: this.currentInitPayload.initialFunctionBreakpoints.map((bp) => ({
          name: bp.name,
          ...(bp.condition !== undefined ? { condition: bp.condition } : {})
        }))
      })) as { body?: { breakpoints?: DebugProtocol.Breakpoint[] } } | undefined;
      // Forward the adapter-assigned ids to the parent (issue #302): the
      // parent's store otherwise learns them only from the post-launch
      // re-sync, which loses the race against a stop that hits a function
      // breakpoint immediately at launch (e.g. a breakpoint on main).
      const results = response?.body?.breakpoints ?? [];
      this.sendStatus('function_breakpoints_synced', {
        functionBreakpoints: this.currentInitPayload.initialFunctionBreakpoints.map((bp, i) => ({
          name: bp.name,
          verified: results[i]?.verified === true,
          ...(typeof results[i]?.id === 'number' ? { id: results[i].id } : {}),
          ...(typeof results[i]?.line === 'number' ? { line: results[i].line } : {}),
          ...(results[i]?.source?.path ? { source: results[i].source.path } : {})
        }))
      });
    } catch (err) {
      this.logger?.warn(
        `[Worker] setFunctionBreakpoints failed (continuing without function breakpoints): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  /**
   * Handle DAP commands from the parent process
   */
  private async handleDapCommand(payload: DapCommandPayload): Promise<void> {
    // Mirror pseudo-commands (issue #217) are intercepted before the
    // connectivity bail and the policy queue decision: they must never be
    // queued to the adapter, and their errors should be mirror-specific.
    if (payload.dapCommand === MIRROR_EXPOSE_COMMAND || payload.dapCommand === MIRROR_UNEXPOSE_COMMAND) {
      await this.handleMirrorCommand(payload);
      return;
    }

    // Check if we're connected
    if (!this.dapClient) {
      if (this.state === ProxyState.INITIALIZING) {
        if (this.preConnectQueue.length >= MAX_QUEUED_COMMANDS) {
          // A wedged adapter never drains this queue; reject instead of
          // growing without bound (issue #405). Every queued command holds a
          // live requestId, so the overflow must answer, not silently drop.
          this.sendDapResponse(
            payload.requestId, false, undefined,
            `pre-connect queue overflow (${MAX_QUEUED_COMMANDS} commands queued; adapter never became ready)`
          );
          return;
        }
        this.preConnectQueue.push(payload);
        this.logger?.info(`[Worker] Queued pre-connect DAP command: ${payload.dapCommand}`);
        return;
      }

      this.sendDapResponse(payload.requestId, false, undefined, 'DAP client not connected');
      return;
    }

    try {
      // CDP-delivered function breakpoints (issue #295): module-scoped names
      // only resolve at a pause, so when function breakpoints were queued
      // pre-launch, make js-debug itself stop on entry. The SessionManager
      // still holds the user's stopOnEntry=false and auto-continues the entry
      // stop — after the bridge's held-event binding completes — so the forced
      // stop is invisible. Mutated here, before the queue decision, so both
      // the direct send and drainCommandQueue paths carry it.
      if (
        payload.dapCommand === 'launch' &&
        this.adapterPolicy.functionBreakpointsVia === 'cdp' &&
        (this.currentInitPayload?.initialFunctionBreakpoints?.length ?? 0) > 0
      ) {
        const launchArgs = (payload.dapArgs ?? {}) as Record<string, unknown>;
        if (launchArgs.stopOnEntry !== true) {
          payload.dapArgs = { ...launchArgs, stopOnEntry: true };
          this.logger?.info('[Worker] Forcing stopOnEntry=true in the js-debug launch config (pending CDP function breakpoints, issue #295)');
        }
      }

      // Check if command should be queued based on policy
      const handling = this.adapterPolicy.shouldQueueCommand(payload.dapCommand, this.adapterState);
      this.logger?.info(
        `[Worker] Queue decision for '${payload.dapCommand}': shouldQueue=${handling.shouldQueue} shouldDefer=${handling.shouldDefer} queueLength=${this.commandQueue.length}`
      );
      
      if (handling.shouldQueue) {
        if (this.commandQueue.length >= MAX_QUEUED_COMMANDS) {
          // Same shape as the pre-connect overflow: reject with an error on
          // the live requestId rather than queueing forever (issue #405).
          this.sendDapResponse(
            payload.requestId, false, undefined,
            `command queue overflow (${MAX_QUEUED_COMMANDS} commands queued; adapter is not draining)`
          );
          return;
        }
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
        this.logger?.info(
          `[Worker] Command queued. queueLength=${this.commandQueue.length} (command='${payload.dapCommand}')`
        );
        await this.drainCommandQueue();
        return;
      }

      // Track request (payload.timeoutMs overrides the tracker default when present)
      this.requestTracker.track(payload.requestId, payload.dapCommand, payload.timeoutMs);

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
      this.logger?.info(`[Worker] Sending '${payload.dapCommand}' to adapter`);
      const response = payload.timeoutMs !== undefined
        ? await this.dapClient.sendRequest(payload.dapCommand, dapArgs, payload.timeoutMs)
        : await this.dapClient.sendRequest(payload.dapCommand, dapArgs);
      
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

      // Command-queueing policies (js-debug) initialize through this path
      // instead of initializeSession, so capture capabilities here (#243).
      // If a queueing policy ever queued 'initialize', drainCommandQueue would
      // bypass this sniff — no policy does today.
      if (payload.dapCommand === 'initialize') {
        const body = (response as DebugProtocol.Response | undefined)?.body as
          | DebugProtocol.Capabilities
          | undefined;
        if (body) {
          this.captureAdapterCapabilities(body);
        }
      }

      // Complete tracking
      this.requestTracker.complete(payload.requestId);

      // Send response
      this.sendDapResponse(payload.requestId, true, response);
      this.noteResumeCommand(payload.dapCommand, payload.dapArgs, response);

      // Ensure initial stop after launch if needed
      if (initBehavior.requiresInitialStop && (payload.dapCommand === 'launch' || payload.dapCommand === 'attach')) {
        await this.drainCommandQueue();
        this.startInitialStopIfNeeded(payload.dapCommand, payload.dapArgs);
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
      ordered = this.adapterPolicy.processQueuedCommands(this.commandQueue, this.adapterState);
    }
    
    // Clear queue after ordering
    this.commandQueue = [];
    
    let remaining = ordered.length;
    for (const payload of ordered) {
      remaining--;
      try {
        const silent = ((payload as SilentDapCommandPayload).__silent === true);
        this.logger?.info(
          `[Worker] Processing queued command '${payload.dapCommand}' silent=${silent} queueRemaining=${remaining}`
        );
        if (silent) {
          await this.dapClient!.sendRequest(payload.dapCommand, payload.dapArgs);
          if (this.adapterPolicy.updateStateOnCommand) {
            this.adapterPolicy.updateStateOnCommand(payload.dapCommand, payload.dapArgs || {}, this.adapterState);
          }
          continue;
        }

        this.requestTracker.track(payload.requestId, payload.dapCommand, payload.timeoutMs);
        const response = payload.timeoutMs !== undefined
          ? await this.dapClient!.sendRequest(payload.dapCommand, payload.dapArgs, payload.timeoutMs)
          : await this.dapClient!.sendRequest(payload.dapCommand, payload.dapArgs);
        
        if (this.adapterPolicy.updateStateOnCommand) {
          this.adapterPolicy.updateStateOnCommand(payload.dapCommand, payload.dapArgs || {}, this.adapterState);
        }
        
        this.requestTracker.complete(payload.requestId);
        this.sendDapResponse(payload.requestId, true, response);
        this.noteResumeCommand(payload.dapCommand, payload.dapArgs, response);

        const initBehavior = this.adapterPolicy.getInitializationBehavior();
        if (initBehavior.requiresInitialStop && (payload.dapCommand === 'launch' || payload.dapCommand === 'attach')) {
          this.startInitialStopIfNeeded(payload.dapCommand, payload.dapArgs, true);
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
   * Gate for the fire-and-forget entry-stop enforcement (issue #520).
   * Attach is excluded entirely: session-manager owns post-attach thread
   * verification and pause (attachToProcess + getAttachBehavior().pauseAfterAttach),
   * and a worker-side unconditional pause would fight stopOnEntry:false attach
   * semantics. Launch runs it only when an entry stop was actually requested.
   */
  private startInitialStopIfNeeded(dapCommand: string, dapArgs: unknown, viaQueue = false): void {
    if (dapCommand !== 'launch') {
      this.logger?.debug?.(
        `[Worker] ensureInitialStop skipped for ${dapCommand} (session manager owns the post-attach pause)`
      );
      return;
    }
    const wantsEntryStop =
      this.currentInitPayload?.stopOnEntry === true ||
      (dapArgs as { stopOnEntry?: boolean } | undefined)?.stopOnEntry === true;
    if (!wantsEntryStop) {
      this.logger?.debug?.('[Worker] ensureInitialStop skipped (stopOnEntry not requested)');
      return;
    }
    this.ensureInitialStop().catch((err) => {
      this.logger?.debug?.(
        `[Worker] ensureInitialStop${viaQueue ? ' (queued)' : ''} encountered error: ${err instanceof Error ? err.message : String(err)}`
      );
    });
  }

  /**
   * Ensure initial stop for JavaScript debugging
   */
  private async ensureInitialStop(timeoutMs: number = 12000): Promise<void> {
    if (!this.dapClient) return;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const threadsResp = await this.dapClient.sendRequest<DebugProtocol.ThreadsResponse>('threads', {});
        const first = threadsResp?.body?.threads?.[0]?.id;
        if (typeof first === 'number') {
          if (first > 0) {
            const pauseTid = first;
            this.logger?.info(`[Worker] ensureInitialStop: pausing threadId=${pauseTid}`);
            try {
              await this.dapClient.sendRequest('pause', { threadId: pauseTid });
            } catch {
              // ignore pause errors
            }
            return;
          }
          // js-debug reports its sole thread as id 0 — a real thread, but DAP
          // pause with threadId 0 means "pause all" on some adapters, so it is
          // not a safe explicit pause target. Threads WERE discovered; say so
          // instead of polling to a false 'no threads' warning (issue #520).
          this.logger?.info(
            `[Worker] ensureInitialStop: threads reported (first id=${first}) — treating as discovered; skipping pause (id ${first} is not a safe pause target)`
          );
          return;
        }
      } catch {
        // ignore threads errors
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    this.logger?.warn('[Worker] ensureInitialStop: no threads discovered within timeout');
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
  private handleRequestTimeout(requestId: string, command: string, timeoutMs: number): void {
    this.logger!.error(`[Worker] DAP request '${command}' (id: ${requestId}) timed out after ${timeoutMs}ms`);
    this.sendDapResponse(
      requestId,
      false,
      undefined,
      `Request '${command}' timed out after ${Math.round(timeoutMs / 1000)}s`
    );
  }

  /**
   * Handle terminate command
   */
  async handleTerminate(): Promise<void> {
    // Already fully terminated: return immediately — the runner's post-command
    // check sees TERMINATED and schedules the process exit.
    if (this.state === ProxyState.TERMINATED) {
      this.logger?.info('[Worker] Already shutting down or terminated.');
      return;
    }

    // Shutdown in flight (issue #502): natural termination runs shutdown() as
    // a floating promise off a DAP event, and the parent's terminate command
    // routinely lands inside that ≥1s window. Returning early here left
    // handleCommand finishing while state was still SHUTTING_DOWN, so the
    // runner's exit check never fired and the worker sat alive forever in
    // TERMINATED. Latch onto the in-flight shutdown instead, so this command
    // completes only once state is TERMINATED and the exit gets scheduled.
    if (this.state === ProxyState.SHUTTING_DOWN) {
      if (this.shutdownPromise) {
        this.logger?.info('[Worker] Terminate received during in-flight shutdown; awaiting completion.');
        await this.shutdownPromise;
        this.sendStatus('terminated', { expected: true });
      } else {
        // State poked without an in-flight shutdown (tests only).
        this.logger?.info('[Worker] Already shutting down or terminated.');
      }
      return;
    }

    // Use optional chaining since logger might be null if not initialized
    this.logger?.info('[Worker] Received terminate command.');

    // Auto-detach for attach mode: send DAP disconnect with terminateDebuggee=false
    // BEFORE shutdown. This prevents killing the debuggee when close_debug_session
    // is called without an explicit detach_from_process first.
    // For launch mode, we let shutdown() handle it with terminateDebuggee=true so
    // the launched process is properly cleaned up.
    if (this.isAttachMode && this.state === ProxyState.CONNECTED && this.connectionManager && this.dapClient) {
      this.logger?.info('[Worker] Attach mode: auto-detaching with terminateDebuggee=false before shutdown.');
      try {
        await this.connectionManager.disconnect(this.dapClient, false);
      } catch (e) {
        this.logger?.warn('[Worker] Auto-detach disconnect failed (best effort):', e);
      }
      this.dapClient = null;
    }

    await this.shutdown();
    this.sendStatus('terminated', { expected: true });
  }

  /**
   * Shutdown the worker. Re-entrant: a second caller gets the same in-flight
   * promise, so awaiting shutdown() always means "shutdown has completed"
   * (issue #502). The worker is single-shot — the promise is never cleared.
   */
  shutdown(): Promise<void> {
    if (this.shutdownPromise) {
      this.logger?.info('[Worker] Shutdown already in progress.');
      return this.shutdownPromise;
    }
    // State poked without a promise (only happens in tests): keep the old
    // early-return contract.
    if (this.state === ProxyState.SHUTTING_DOWN || this.state === ProxyState.TERMINATED) {
      this.logger?.info('[Worker] Shutdown already in progress.');
      return Promise.resolve();
    }

    this.shutdownPromise = this.performShutdown();
    return this.shutdownPromise;
  }

  private async performShutdown(): Promise<void> {
    this.state = ProxyState.SHUTTING_DOWN;
    this.logger?.info('[Worker] Initiating shutdown sequence...');

    // Clear request tracking
    this.requestTracker.clear();

    // Close the mirror before the DAP disconnect so mirror clients receive
    // terminated even if the adapter disconnect eats its 1s cap (#217).
    await this.closeMirror({ notifyClients: true });

    // Graceful DAP disconnect FIRST, while the socket is still alive (#156) —
    // launch-mode adapters only terminate their debuggee when they receive
    // disconnect with terminateDebuggee=true (rdbg keeps it alive and re-arms
    // on a bare socket drop). For attach mode via handleTerminate(), dapClient
    // is already null (handled by auto-detach above); on other paths (signals,
    // crashes, parent death) attach mode uses terminateDebuggee=false to
    // preserve the debuggee. disconnect() caps the request at 1s and a dead
    // socket rejects synchronously, so this cannot stall shutdown.
    if (this.connectionManager && this.dapClient) {
      const terminateDebuggee = !this.isAttachMode;
      await this.connectionManager.disconnect(this.dapClient, terminateDebuggee);
    }

    // THEN reject any in-flight DAP requests and destroy the socket (no-op if
    // connectionManager.disconnect() above already tore the client down).
    if (this.dapClient) {
      this.dapClient.shutdown('worker shutdown');
    }
    this.dapClient = null;

    // Give the adapter time to complete its post-disconnect cleanup before we
    // kill the adapter process. Attach mode: completes detach without
    // terminating the debuggee. Launch mode: gives e.g. JdiDapServer time to
    // destroyForcibly the launched debuggee JVM (otherwise it's orphaned).
    if (this.isAttachMode && this.processManager && this.adapterProcess) {
      this.logger?.info('[Worker] Attach mode: waiting 500ms for adapter to complete detach...');
      await new Promise(resolve => setTimeout(resolve, 500));
    } else if (!this.isAttachMode && this.processManager && this.adapterProcess) {
      this.logger?.info('[Worker] Launch mode: waiting 500ms for adapter to terminate debuggee...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Terminate the adapter process and its descendants. Launch mode owns the
    // debuggee, which may be a grandchild of the adapter (e.g. rdbg -c). In
    // attach mode the debuggee is NOT a descendant of the adapter — so a
    // tree/group kill cannot take it down (the #156 invariant, preserved
    // structurally) — but the adapter's own helpers ARE descendants, and
    // sparing them leaked lldb-server with its ptrace claim on the target
    // after every attach teardown (issue #337). The DAP disconnect with
    // terminateDebuggee=false plus the grace wait above already ran, so the
    // adapter had its chance to detach cleanly.
    if (this.processManager && this.adapterProcess) {
      await this.processManager.shutdown(this.adapterProcess, { killProcessTree: true });
    }
    this.adapterProcess = null;

    this.state = ProxyState.TERMINATED;
    this.logger?.info('[Worker] Shutdown sequence completed.');
  }

  // ===== DAP mirror (issue #217) =====

  /**
   * Handle the mirrorExpose / mirrorUnexpose pseudo-commands. Expose is
   * idempotent (returns the stored endpoint, token unrotated) so agent
   * retries after a lost response cannot invalidate an IDE mid-attach.
   */
  private async handleMirrorCommand(payload: DapCommandPayload): Promise<void> {
    if (payload.dapCommand === MIRROR_UNEXPOSE_COMMAND) {
      const wasExposed = this.mirrorServer !== null;
      const closedClients = this.mirrorServer?.clientCount() ?? 0;
      await this.closeMirror({ notifyClients: true });
      this.sendDapResponse(payload.requestId, true, {
        type: 'response',
        seq: 0,
        request_seq: 0,
        command: payload.dapCommand,
        success: true,
        body: { closed: wasExposed, closedClients }
      });
      return;
    }

    // Expose requires a live adapter connection — a mirror of a session
    // that isn't debugging anything has nothing to forward to.
    if (this.state !== ProxyState.CONNECTED || !this.dapClient) {
      this.sendDapResponse(
        payload.requestId,
        false,
        undefined,
        `Mirror requires a connected debug session (state=${this.state})`
      );
      return;
    }

    if (this.mirrorEndpoint) {
      this.sendMirrorEndpointResponse(payload, this.mirrorEndpoint);
      return;
    }

    const factory = this.dependencies.mirrorServerFactory;
    if (!factory) {
      this.sendDapResponse(payload.requestId, false, undefined, 'Mirror server not configured in this environment');
      return;
    }

    const mirror = factory.create(
      {
        forwardRequest: async (command, args) => {
          // sendRequest throws synchronously on a destroyed socket; the
          // async wrapper converts that into a rejection for the mirror.
          const client = this.dapClient;
          if (!client) {
            throw new Error('DAP client not connected');
          }
          return client.sendRequest<DebugProtocol.Response>(command, args);
        },
        getCapabilities: () => this.adapterCapabilities ?? undefined,
        getLastStop: () => this.lastStop ?? undefined
      },
      { logger: this.logger! }
    );

    try {
      const endpoint = await mirror.start();
      this.mirrorServer = mirror;
      this.mirrorEndpoint = endpoint;
      this.dapClient.on('event', this.mirrorEventForwarder);
      this.sendMirrorEndpointResponse(payload, endpoint);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger?.error(`[Worker] Failed to start mirror endpoint: ${message}`);
      await mirror.stop().catch(() => undefined);
      this.sendDapResponse(payload.requestId, false, undefined, `Failed to start mirror endpoint: ${message}`);
    }
  }

  private sendMirrorEndpointResponse(payload: DapCommandPayload, endpoint: MirrorEndpoint): void {
    // Response-shaped so the parent's `response.body` extraction applies.
    this.sendDapResponse(payload.requestId, true, {
      type: 'response',
      seq: 0,
      request_seq: 0,
      command: payload.dapCommand,
      success: true,
      body: { host: endpoint.host, port: endpoint.port, token: endpoint.token }
    });
  }

  private async closeMirror(opts?: { notifyClients?: boolean }): Promise<void> {
    const mirror = this.mirrorServer;
    this.mirrorServer = null;
    this.mirrorEndpoint = null;
    if (!mirror) {
      return;
    }
    this.dapClient?.off('event', this.mirrorEventForwarder);
    try {
      await mirror.stop(opts);
    } catch (error) {
      this.logger?.warn(
        `[Worker] Mirror shutdown failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * DAP clients may infer resumption from a successful continue/step
   * response, and some adapters skip the continued event — without this a
   * mirror IDE would show stale paused frames after the MCP side resumes.
   * The lastStop check dedupes against a real continued event that arrived
   * first; steps produce a fresh stopped moments later regardless.
   */
  private noteResumeCommand(command: string, args: unknown, response: unknown): void {
    if (!['continue', 'next', 'stepIn', 'stepOut', 'goto'].includes(command)) {
      return;
    }
    if (!this.lastStop) {
      return;
    }
    this.lastStop = null;
    const threadId = (args as { threadId?: number } | undefined)?.threadId;
    const allThreadsContinued =
      ((response as DebugProtocol.ContinueResponse | undefined)?.body?.allThreadsContinued) ?? true;
    this.mirrorServer?.broadcastEvent('continued', {
      ...(typeof threadId === 'number' ? { threadId } : {}),
      allThreadsContinued
    });
  }

  // Message sending helpers

  /**
   * Forward the adapter's advertised initialize capabilities to the parent
   * once per session (issue #243). Called from both initialize paths: the
   * standard initializeSession flow and the command-queueing (js-debug)
   * handleDapCommand flow.
   */
  private captureAdapterCapabilities(capabilities: DebugProtocol.Capabilities): void {
    // Retained for the mirror's initialize response (issue #217) — before
    // the once-only guard, which only gates the parent status message.
    this.adapterCapabilities = capabilities;
    if (this.adapterCapabilitiesSent) {
      return;
    }
    this.adapterCapabilitiesSent = true;
    this.sendStatus('adapter_capabilities', { capabilities });
  }

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

  /**
   * Replay the debuggee's recorded exit code as a DAP 'exited' event
   * (issue #247). js-debug never emits one; the JavaScript adapter's launch
   * transform preloads a shim that writes the code to a per-session file
   * whose path travels in the launch config env. Self-gating: sessions
   * without the env marker (every other adapter) skip instantly, and a
   * missing file (signal kill, user stop) is the normal no-exitCode path.
   */
  private async maybeSynthesizeExitedEvent(): Promise<void> {
    if (this.exitedEventSeen || this.exitSynthesisAttempted) {
      return;
    }
    this.exitSynthesisAttempted = true;

    const env = this.currentInitPayload?.launchConfig?.env as Record<string, string> | undefined;
    const exitFile = env?.MCP_DEBUGGER_EXITCODE_FILE;
    if (!exitFile) {
      return;
    }

    try {
      if (!(await this.dependencies.fileSystem.pathExists(exitFile))) {
        this.logger?.info?.('[Worker] No recorded exit code (signal kill or user stop); exitCode stays unknown');
        return;
      }
      const raw = (await this.dependencies.fileSystem.readFile(exitFile, 'utf8')).trim();
      const exitCode = Number.parseInt(raw, 10);
      if (Number.isFinite(exitCode)) {
        this.logger?.info?.(`[Worker] Synthesizing 'exited' from recorded debuggee exit code ${exitCode}`);
        this.sendDapEvent('exited', { exitCode });
      } else {
        this.logger?.warn?.(`[Worker] Unparseable exit code file content: '${raw}'`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger?.warn?.(`[Worker] Exit code synthesis failed: ${msg}`);
    } finally {
      try {
        await this.dependencies.fileSystem.remove(exitFile);
      } catch {
        // Best effort - a stray ~3-byte temp file is acceptable
      }
    }
  }

  /**
   * Synthesize a DAP 'exited' event from the adapter process's exit status
   * (issue #258). Only for policies that declare
   * adapterExitCodeIsDebuggeeExitCode — rdbg -c runs the debuggee under the
   * adapter process, so its exit status propagates, and rdbg never sends an
   * exited event of its own. The process usually dies moments after the
   * terminated event, so wait briefly for its exit if it hasn't landed yet.
   * On signal kill there is no code and the exitCode simply stays unknown,
   * matching the js synthesis path.
   */
  private async maybeSynthesizeExitedFromAdapterExit(): Promise<void> {
    if (
      this.exitedEventSeen ||
      this.adapterExitSynthesisAttempted ||
      !this.adapterExitCodeIsDebuggeeExitCode ||
      !this.adapterProcess
    ) {
      return;
    }
    this.adapterExitSynthesisAttempted = true;

    if (this.adapterExitCode === undefined) {
      const proc = this.adapterProcess;
      if (typeof proc.exitCode === 'number') {
        this.adapterExitCode = proc.exitCode;
      } else if (proc.signalCode) {
        this.adapterExitCode = null;
      } else {
        await new Promise<void>((resolve) => {
          const onExit = () => {
            clearTimeout(timer);
            resolve();
          };
          const timer = setTimeout(() => {
            proc.removeListener('exit', onExit);
            resolve();
          }, 500);
          // The recording 'exit' listener was registered first, so
          // adapterExitCode is already set when this one resolves
          proc.once('exit', onExit);
        });
      }
    }

    const exitCode = this.adapterExitCode;
    if (typeof exitCode === 'number') {
      this.exitedEventSeen = true;
      this.logger?.info?.(`[Worker] Synthesizing 'exited' from adapter process exit code ${exitCode} (issue #258)`);
      this.sendDapEvent('exited', { exitCode });
    } else {
      this.logger?.info?.('[Worker] Adapter exit code unavailable (signal kill or still running); exitCode stays unknown');
    }
  }

  /**
   * Resolves when both adapter stdio streams have closed — i.e. every byte
   * the debuggee flushed on exit has been read and forwarded (issue #222).
   * Only armed when stdio forwarding is active.
   */
  private createStdioDrainBarrier(adapterProcess: ChildProcess): Promise<void> {
    const streamClosed = (stream: NodeJS.ReadableStream | null): Promise<void> =>
      !stream || (stream as unknown as { closed?: boolean }).closed
        ? Promise.resolve()
        : new Promise(resolve => stream.once('close', () => resolve()));
    return Promise.all([
      streamClosed(adapterProcess.stdout),
      streamClosed(adapterProcess.stderr)
    ]).then(() => undefined);
  }

  /**
   * Hold exited/terminated forwarding until adapter stdio has drained: a
   * debuggee printing to a block-buffered pipe flushes everything at exit,
   * milliseconds after the adapter's terminated event, and the SessionManager
   * stops the proxy on terminated — dropping late messages. Stream 'data'
   * fires before 'close' and IPC is FIFO, so waiting here guarantees the
   * forwarded output reaches the session buffer first. 2s backstop for
   * adapters that never close their pipes. No-op when forwarding is off.
   */
  private async waitForAdapterStdioDrain(): Promise<void> {
    if (!this.adapterStdioDrained) {
      return;
    }
    let timer: NodeJS.Timeout | undefined;
    const backstop = new Promise<void>(resolve => {
      timer = setTimeout(resolve, 2000);
    });
    try {
      await Promise.race([this.adapterStdioDrained, backstop]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  /**
   * Drain the DAP client's child-session event chain before forwarding a
   * terminal signal (issue #366): js-debug delivers debuggee output as CHILD
   * session events, which are microtask-deferred through the CDP-bridge
   * serialization chain. Forwarding terminated/exited ahead of that chain
   * lets the SessionManager tear down its listeners while output is still
   * queued — silently losing it (reliably so under Docker's slower
   * scheduling). Bounded by the same 2s backstop as the stdio drain so a
   * wedged chain cannot hang shutdown.
   */
  private async waitForChildEventFlush(): Promise<void> {
    // An undefined return means the client has no child sessions (issue
    // #378): every adapter shares MinimalDapClient, so the method exists
    // everywhere and only its return value tells child-session adapters
    // apart. Skipping here — not inside the rounds — is what avoids the
    // settle for python/ruby/go/etc.
    const firstFlush = this.dapClient?.flushChildEvents?.();
    if (!firstFlush) {
      return;
    }
    const boundedFlush = async (flush: Promise<void>): Promise<void> => {
      let timer: NodeJS.Timeout | undefined;
      const backstop = new Promise<void>(resolve => {
        timer = setTimeout(resolve, 2000);
      });
      try {
        await Promise.race([flush, backstop]);
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    };
    // Two rounds with a short settle: the parent session's terminated can
    // arrive while child output is still UNREAD in the child socket (not on
    // the chain yet). The settle lets those bytes be read and enqueued; the
    // second flush drains them.
    await boundedFlush(firstFlush);
    await new Promise(resolve => setTimeout(resolve, 150));
    const secondFlush = this.dapClient?.flushChildEvents?.();
    if (secondFlush) {
      await boundedFlush(secondFlush);
    }
  }

  /**
   * Chain a terminal signal onto the FIFO forwarding queue (issue #258).
   * Every producer awaits the drain barrier, so without serialization the
   * signal with the fewest awaits after the barrier wins — not the one that
   * arrived first. Each slot is bounded (drain backstop 2s), and the chain
   * swallows rejections so one failed slot cannot block the next.
   */
  private enqueueTerminalSignal(label: string, task: () => Promise<void>): Promise<void> {
    const tail = this.terminalSignalQueue.then(task).catch((err) => {
      this.logger?.error(`[Worker] Terminal signal '${label}' failed:`, err);
    });
    this.terminalSignalQueue = tail;
    return tail;
  }

  /**
   * Whether a terminal status sent now reflects orderly debuggee termination
   * (issue #258): a terminated/exited DAP event was already forwarded, or the
   * worker itself initiated shutdown. False means the adapter died or dropped
   * the socket mid-run — the parent maps that to a session error.
   */
  private isTerminationExpected(): boolean {
    return (
      this.terminalDapEventForwarded ||
      this.state === ProxyState.SHUTTING_DOWN ||
      this.state === ProxyState.TERMINATED
    );
  }

  /**
   * Build the raw-stdio → DAP 'output' forwarder for adapters whose debuggee
   * inherits the adapter process's stdio (issue #222: rdbg -c on all
   * platforms, CodeLLDB's console mode on Windows). Returns undefined when
   * the policy did not opt in via spawnConfig.forwardStdio — the adapter
   * manager then drains stdio to logs only, exactly as before.
   */
  private buildStdioForwarder(
    forwardConfig: { excludeStderrLinePattern?: RegExp } | undefined
  ): ((source: AdapterStdioSource, line: string) => void) | undefined {
    if (!forwardConfig) {
      return undefined;
    }
    const exclude = forwardConfig.excludeStderrLinePattern;
    return (source, line) => {
      if (source === 'stderr' && exclude?.test(line)) {
        return; // adapter diagnostic banner: log path only
      }
      try {
        // '\n' restores the line ending LineBuffer stripped, and keeps blank
        // lines past handleOutput's empty-output drop.
        this.sendDapEvent('output', { category: source, output: line + '\n' });
      } catch (err) {
        // IPC gone during teardown; a stream 'data' handler must never throw.
        this.logger?.debug?.('[Worker] Failed to forward adapter stdio line', err);
      }
    };
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
