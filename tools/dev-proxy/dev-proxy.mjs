#!/usr/bin/env node

/**
 * Dev Proxy MCP Server for mcp-debugger
 *
 * A lightweight MCP proxy that sits between Claude Code (stdio) and mcp-debugger,
 * allowing the backend to be killed and restarted without Claude Code seeing a disconnection.
 *
 * Architecture (two backend transport modes):
 *   Claude Code <--stdio--> dev-proxy.mjs (stable) <--HTTP---> mcp-debugger (Streamable HTTP, default)
 *   Claude Code <--stdio--> dev-proxy.mjs (stable) <--stdio--> mcp-debugger (restartable)
 *
 * Configuration (all env vars, all optional):
 *   DEV_PROXY_PORT               - Backend HTTP port (default: 3001, http mode only)
 *   DEV_PROXY_BUILD_CMD          - Build command (default: "npm run build")
 *   DEV_PROXY_BUILD_TIMEOUT_MS   - Build timeout in milliseconds (default: 120000)
 *   DEV_PROXY_ROOT               - Project root (default: auto-detected)
 *   DEV_PROXY_BACKEND_TRANSPORT  - "http" (default) or "stdio"; anything else refuses to start
 *   DEV_PROXY_BACKEND_CMD        - Custom backend command override (e.g. "docker run ...")
 *   DEV_PROXY_DISCOVERY_WAIT_MS  - How long a request waits for a backend start
 *                                  or restart to settle (default: 15000)
 */

import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  installShutdownHandlers,
  isIntentionalTransportAbort,
  killChildGracefully,
} from './shutdown.mjs';
import {
  createBackendLogger,
  sanitizeBackendEnvOverrides,
  sharedUtilsLoaded,
} from './backend-logger.mjs';
import {
  addDockerOwnershipLabel,
  isDockerRunInvocation,
  removeOwnedDockerContainers,
} from './docker-backend.mjs';
import {
  buildBackendEnvironment,
  resolveBackendPort,
  resolveBackendTransport,
  updateBackendEnvOverrides,
  withBackendDefaults,
} from './backend-env.mjs';
import { LifecycleQueue, queueGenerationCleanup } from './lifecycle-queue.mjs';
import { runBuild } from './build-runner.mjs';
import { ensurePortFree, forceKillPid } from './process-cleanup.mjs';
import { backendCallOptions } from './tool-error.mjs';
import { createFront, ObservedStdioServerTransport } from './front-server.mjs';
import { createSubscriptionRelay } from './backend-subscriptions.mjs';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_PORT = resolveBackendPort(process.env.DEV_PROXY_PORT);
const BUILD_CMD = process.env.DEV_PROXY_BUILD_CMD || 'npm run build';
const PROJECT_ROOT = process.env.DEV_PROXY_ROOT || path.resolve(__dirname, '..', '..');
// Validated up front: an unrecognised value used to fall through to the
// since-removed legacy transport's client silently. A throw here exits the
// proxy with the message on stderr.
const BACKEND_TRANSPORT = resolveBackendTransport(process.env.DEV_PROXY_BACKEND_TRANSPORT);
const BACKEND_CMD = process.env.DEV_PROXY_BACKEND_CMD || null;

const parsedTimeout = parseInt(process.env.DEV_PROXY_BUILD_TIMEOUT_MS || '', 10);
const BUILD_TIMEOUT_MS = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 120000;
// How long a request will wait for an in-flight backend start or restart.
// Deliberately NOT tied to HEALTH_POLL_TIMEOUT_MS: that bounds how patient the
// proxy is with its own child, whereas this bounds how long a CLIENT is made to
// wait — and the binding constraint there is the client's MCP startup timeout
// (30s in Claude Code). Staying well under it keeps a stuck backend from
// costing the client its connection.
const parsedDiscoveryWait = parseInt(process.env.DEV_PROXY_DISCOVERY_WAIT_MS || '', 10);
const DISCOVERY_WAIT_MS =
  Number.isFinite(parsedDiscoveryWait) && parsedDiscoveryWait >= 0 ? parsedDiscoveryWait : 15000;

const HEALTH_POLL_INTERVAL_MS = 300;
const HEALTH_POLL_TIMEOUT_MS = 30000;
const KILL_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Logging (all to stderr — stdout is the MCP JSON-RPC channel)
// ---------------------------------------------------------------------------

function log(msg) {
  process.stderr.write(`[dev-proxy] ${msg}\n`);
}

// Backend output is line-buffered and sanitized per stream (issue #154);
// see backend-logger.mjs. One logger per stream, flushed on the stream's
// own 'end'/'close'.
function attachBackendLogger(stream) {
  if (!stream) return;
  const logger = createBackendLogger((text) => process.stderr.write(text));
  stream.on('data', logger.onData);
  stream.on('end', logger.flush);
  stream.on('close', logger.flush);
}

// ---------------------------------------------------------------------------
// Command string parser — splits a shell-like command into { command, args }
// Respects double-quoted and single-quoted substrings for paths with spaces.
// ---------------------------------------------------------------------------

function parseCommandString(cmdStr) {
  const tokens = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < cmdStr.length; i++) {
    const ch = cmdStr[i];
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    tokens.push(current);
  }

  if (tokens.length === 0) {
    throw new Error('BACKEND_CMD is empty');
  }

  return { command: tokens[0], args: tokens.slice(1) };
}

// ---------------------------------------------------------------------------
// BackendManager — manages the mcp-debugger child process lifecycle
// ---------------------------------------------------------------------------

class BackendManager {
  constructor() {
    /** @type {'stopped' | 'starting' | 'running' | 'restarting'} */
    this.state = 'stopped';
    /** @type {import('child_process').ChildProcess | null} */
    this.child = null;
    /** @type {Client | null} */
    this.mcpClient = null;
    /** @type {StdioClientTransport | null} */
    this.stdioTransport = null;
    /** Keep ownership even when the SDK clears transport.pid during close(). */
    this.stdioPid = null;
    /** @type {number | null} */
    this.startedAt = null;
    /** @type {'http' | 'stdio'} */
    this.backendTransport = BACKEND_TRANSPORT;
    /** @type {Record<string, string>} */
    this.backendEnvOverrides = {};
    /** Per-transport intentional-close state; handlers capture their own generation. */
    this.transportCloseState = null;
    /** Child exits requested by stop() are normal, not crashes. */
    this.expectedChildExit = false;
    /** Initial start, restart tools, and shutdown must never overlap. */
    this.lifecycleQueue = new LifecycleQueue();
    /** Shutdown interrupts a build before waiting for the lifecycle queue. */
    this.shutdownController = new AbortController();
    this.buildInProgress = false;
    /** Readers already waiting on the queue can use the old backend during a build. */
    this.buildWaiters = new Set();
    /** Unique owner for Docker containers started by this stable proxy process. */
    this.dockerOwnerId = `${process.pid}-${randomUUID()}`;
    /** The one initial start, once a request has asked for it (issue #1025, step 2). */
    this.initialStart = null;
    /** Announces the inventory after a successful initial start; set by main(). */
    this.onInitialStart = null;
    /** The client's resource subscriptions, expressed in the backend's era; set by main(). */
    /** @type {{ reopen(): Promise<void>, close(): Promise<void> } | null} */
    this.relay = null;
  }

  // ---- Command computation ------------------------------------------------

  _computeBackendCommand() {
    let invocation;
    if (BACKEND_CMD) {
      invocation = parseCommandString(BACKEND_CMD);
    } else {
      const entryPoint = path.join(PROJECT_ROOT, 'dist', 'index.js');

      if (this.backendTransport === 'stdio') {
        invocation = { command: process.execPath, args: [entryPoint, 'stdio'] };
      } else {
        // http (default): Streamable HTTP transport
        invocation = { command: process.execPath, args: [entryPoint, 'http', '--port', String(BACKEND_PORT)] };
      }
    }

    return addDockerOwnershipLabel(invocation, this.dockerOwnerId);
  }

  _buildBackendEnv({ forceStdinClose = false } = {}) {
    return buildBackendEnvironment(
      withBackendDefaults(process.env),
      this.backendEnvOverrides,
      forceStdinClose ? { MCP_EXIT_ON_STDIN_CLOSE: '1' } : {}
    );
  }

  // ---- Public API ----------------------------------------------------------

  start() {
    return this.lifecycleQueue.run(() => this._start());
  }

  /**
   * The initial start, deferred to the first request that reaches a handler
   * (issue #1025, step 2). A v2 client's `auto` negotiation probes server/discover
   * on a disposable sibling process spawned from the same parameters; the SDK's
   * stdio entry answers that probe itself, so a sibling never reaches a handler
   * and never spawns a backend to race this one for the port. One start per
   * process: a failed one is not retried here (dev_restart_debugger is the retry).
   * Callers do not await it — `whenReady` bounds their wait (issue #716).
   */
  ensureStarted() {
    if (this.initialStart) return this.initialStart;
    this.initialStart = this.start().then(
      async () => {
        // Refresh clients whose discovery gave up before the backend was ready.
        await this.onInitialStart?.();
        return true;
      },
      (err) => {
        log(`Initial backend start failed: ${err.message}`);
        log('Dev tools are still available — use dev_restart_debugger to retry');
        return false;
      }
    );
    return this.initialStart;
  }

  async _start() {
    this._assertOpen();
    if (this.state === 'running' || this.state === 'starting') {
      log(`Backend already ${this.state}, skipping start`);
      return;
    }

    this.state = 'starting';
    this.expectedChildExit = false;
    const { command, args } = this._computeBackendCommand();

    if (this.backendTransport === 'stdio') {
      // Stdio mode: StdioClientTransport spawns the child and owns its stdin/stdout
      log(`Starting backend in stdio mode: ${command} ${args.join(' ')}`);
      try {
        await this._connectClient(command, args);
      } catch (err) {
        await this._killDockerContainer();
        await this._disconnectClient();
        await this._forceKillStdioBackend();
        this.stdioPid = null;
        this.state = 'stopped';
        this.startedAt = null;
        throw err;
      }
    } else {
      // HTTP mode: we spawn the child manually, wait for health, then connect
      log(`Starting backend (${this.backendTransport}) on port ${BACKEND_PORT}...`);

      // Kill any orphan process holding the port from a previous crash
      await this._ensurePortFree();
      this._assertOpen();

      // stdin is a pipe + MCP_EXIT_ON_STDIN_CLOSE so the backend can detect
      // our death (pipe closes) and we can ask it to shut down gracefully
      // before force-killing (issue #122).
      this.child = spawn(command, args, {
        windowsHide: true,
        cwd: PROJECT_ROOT,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: this._buildBackendEnv({ forceStdinClose: true }),
      });

      attachBackendLogger(this.child.stdout);
      attachBackendLogger(this.child.stderr);

      const spawnedChild = this.child;
      this.child.on('exit', (code, signal) => {
        log(`Backend exited (code=${code}, signal=${signal})`);
        this._onChildExit(spawnedChild);
      });

      this.child.on('error', (err) => {
        log(`Backend spawn error: ${err.message}`);
        this._onChildExit(spawnedChild);
      });

      // Wait for /health to respond, then connect MCP Client (Streamable HTTP)
      // If either fails, kill the child so it doesn't become an orphan holding the port
      try {
        await this._waitForHealth();
        await this._connectClient();
      } catch (err) {
        log(`Backend (${this.backendTransport}) failed during startup: ${err.message}`);
        await this._killChild();
        this.state = 'stopped';
        this.startedAt = null;
        throw err;
      }
    }

    this.startedAt = Date.now();
    this.state = 'running';

    const pid =
      this.backendTransport === 'stdio'
        ? (this.stdioTransport?.pid ?? null)
        : (this.child?.pid ?? null);
    log(`Backend running (PID=${pid}, transport=${this.backendTransport})`);
  }

  stop() {
    // Terminal: queued restarts must not resurrect a backend after stdin EOF.
    // Aborting the HTTP transport's live stream can close the transport before
    // queued _stop() runs. Mark the intent first so it cannot take the
    // backend-crash path.
    if (this.transportCloseState) this.transportCloseState.expected = true;
    this.shutdownController.abort();
    return this.lifecycleQueue.run(() => this._stop());
  }

  _assertOpen() {
    if (this.shutdownController.signal.aborted) throw new Error('Proxy is shutting down');
  }

  async _stop() {
    if (this.state === 'stopped') {
      await this._killDockerContainer();
      return;
    }

    log('Stopping backend...');
    this.expectedChildExit = true;

    // The outer MCP SDK gives a stdio server roughly two seconds to exit after
    // its stdin closes. The inner StdioClientTransport can itself wait longer
    // than that before killing a detached Docker CLI, so remove the labeled
    // container first and let that close the inner transport promptly.
    if (this.backendTransport === 'stdio') {
      if (this.transportCloseState) this.transportCloseState.expected = true;
      await this._killDockerContainer();
    }

    // Close MCP client first (for stdio, this also kills the child via AbortController)
    await this._disconnectClient();

    if (this.backendTransport === 'http') {
      // HTTP mode: manually kill the child we spawned
      await this._killChild();
    } else {
      // stdio mode: extra safety — force-kill if the process lingers
      await this._forceKillStdioBackend();
    }

    // A killed Docker CLI can detach without stopping its container. Ownership
    // labels give every transport, including stdio, an exact cleanup handle.
    await this._killDockerContainer();

    this.stdioTransport = null;
    this.stdioPid = null;
    this.state = 'stopped';
    this.startedAt = null;
    log('Backend stopped');
  }

  restart(args, onRestart) {
    // Copy/validate now, but apply in queue order (#756). Omission inherits
    // the preceding applied settings, not the map at the time of submission.
    const env = Object.hasOwn(args ?? {}, 'env')
      ? updateBackendEnvOverrides({}, args)
      : undefined;
    const rebuild = args?.rebuild === true;
    return this.lifecycleQueue.run(async () => {
      this._assertOpen();
      const buildOutput = rebuild ? await this.rebuild() : undefined;
      this._assertOpen();
      if (env !== undefined) this.backendEnvOverrides = env;
      this.state = 'restarting';
      try {
        await this._stop();
        await this._start();
        // Capture before releasing the queue, including before the async
        // notification: the next operation cannot rewrite this response.
        return {
          success: true,
          action: rebuild ? 'rebuild_and_restart' : 'restart',
          ...(rebuild ? { buildOutput } : {}),
          status: this.getStatus(),
        };
      } finally {
        // A failed build never gets here: only an attempted restart changes
        // the inventory. A failed startup must announce the loss of tools.
        await onRestart();
      }
    });
  }

  async rebuild() {
    log(`Running build: ${BUILD_CMD}`);
    this.buildInProgress = true;
    for (const wake of this.buildWaiters) wake();
    try {
      const result = await runBuild({
        command: BUILD_CMD,
        cwd: PROJECT_ROOT,
        env: { ...process.env },
        timeoutMs: BUILD_TIMEOUT_MS,
        signal: this.shutdownController.signal,
      });
      log('Build succeeded');
      return result;
    } finally {
      this.buildInProgress = false;
    }
  }

  /**
   * Resolve once no lifecycle operation is in flight, so a request that lands
   * during the initial start or a restart sees the backend it is about to get
   * rather than the one it has (issue #716). Re-arms itself for every restart,
   * because it reads the live queue instead of a one-shot gate.
   * During a build, the existing backend is usable. Wake readers that were
   * already waiting before that build began, without abandoning their bounds.
   *
   * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
   * @returns {Promise<boolean>} true when the backend settled within the bound.
   */
  whenReady({ timeoutMs = DISCOVERY_WAIT_MS, signal } = {}) {
    if (signal?.aborted) return Promise.resolve(false);
    const done = new AbortController();
    const waitSignal = signal ? AbortSignal.any([signal, done.signal]) : done.signal;
    let wake;
    const availableDuringBuild = new Promise((resolve) => {
      wake = () => {
        if (this.buildInProgress && this.state === 'running' && this.mcpClient) resolve(true);
      };
      this.buildWaiters.add(wake);
      wake();
    });
    return Promise.race([
      availableDuringBuild,
      this.lifecycleQueue.idle({ timeoutMs, signal: waitSignal }),
    ]).finally(() => {
      this.buildWaiters.delete(wake);
      done.abort();
    });
  }

  async callTool(name, args, { signal } = {}) {
    if (this.state !== 'running' || !this.mcpClient) {
      // Wait out a start/restart rather than refusing: the old refusal pointed
      // at dev_restart_debugger, and an agent following that hint queued a
      // second restart that tore down the backend about to become healthy.
      await this.whenReady({ signal });
    }
    if (this.state !== 'running' || !this.mcpClient) {
      throw new Error(
        this.needsRestart()
          ? `Backend is stopped — cannot call tool "${name}". Use dev_restart_debugger to start it.`
          : `Backend is ${this.state}${this.lifecycleQueue.pending > 0 ? ` with a ${this.buildInProgress ? 'build' : 'restart'} in progress` : ''} and did not settle within ${DISCOVERY_WAIT_MS}ms — cannot call tool "${name}" yet. Retry once dev_server_status reports "running".`
      );
    }
    // Not the SDK defaults: those cap every call at 60 s and leave a call the
    // client cancelled running in the backend (issue #854).
    return await this.mcpClient.callTool({ name, arguments: args }, backendCallOptions(signal));
  }

  /**
   * Only a stopped backend with no restart already queued wants restarting.
   * Requests are now served while a build runs, so a crashed backend can be
   * "stopped" while dev_rebuild_and_restart is about to replace it; telling
   * the caller to restart then queues a second restart that kills the fresh
   * backend (#716).
   */
  needsRestart() {
    return this.state === 'stopped' && this.lifecycleQueue.pending === 0;
  }

  getStatus() {
    const pid =
      this.backendTransport === 'stdio'
        ? (this.stdioTransport?.pid ?? null)
        : (this.child?.pid ?? null);

    const sanitizedEnv = sanitizeBackendEnvOverrides(this.backendEnvOverrides);
    return {
      state: this.state,
      pid,
      port: this.backendTransport === 'stdio' ? null : BACKEND_PORT,
      uptime: this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : null,
      projectRoot: PROJECT_ROOT,
      buildCmd: BUILD_CMD,
      buildInProgress: this.buildInProgress,
      backendTransport: this.backendTransport,
      protocolEra: this.state === 'running' && this.mcpClient ? (this.mcpClient.getProtocolEra?.() ?? null) : null,
      protocolVersion: this.state === 'running' && this.mcpClient ? (this.mcpClient.getNegotiatedProtocolVersion?.() ?? null) : null,
      backendCmd: BACKEND_CMD || null,
      backendEnvOverrides: sanitizedEnv.values,
      backendEnvRedaction: sanitizedEnv.redaction,
    };
  }

  // ---- Internal helpers ----------------------------------------------------

  _onChildExit(exitedChild) {
    // Used for HTTP mode (manually spawned child)
    if (this.child !== exitedChild) return;
    // Cleared for every exit, not only a crash while 'running' — _waitForHealth
    // reads this to notice a child that died before it ever served /health.
    this.child = null;
    if (!this.expectedChildExit && this.state === 'running') {
      this.mcpClient = null;
      this.state = 'stopped';
      this.startedAt = null;
      log('Backend crashed — use dev_restart_debugger to restart');
    }
  }

  async _waitForHealth() {
    // Used for HTTP mode
    const url = `http://127.0.0.1:${BACKEND_PORT}/health`;
    const deadline = Date.now() + HEALTH_POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      this._assertOpen();
      // A backend that dies at spawn refuses connections exactly like one that
      // has not bound yet, so ECONNREFUSED alone cannot tell them apart. Poll
      // liveness instead: without this a dead child parked the first tools/list
      // for the whole 30s timeout.
      if (!this.child) {
        throw new Error('Backend exited before becoming healthy');
      }
      try {
        const resp = await fetch(url, { signal: this.shutdownController.signal });
        if (resp.ok) {
          log('Backend health check passed');
          return;
        }
      } catch {
        // Not ready yet
      }
      await new Promise((r) => setTimeout(r, HEALTH_POLL_INTERVAL_MS));
    }

    throw new Error(`Backend did not become healthy within ${HEALTH_POLL_TIMEOUT_MS}ms`);
  }

  async _connectClient(command, args) {
    const closeState = { expected: false };
    this.transportCloseState = closeState;
    // The http backend speaks both eras (issue #1025): negotiate. A stdio backend
    // stays legacy — `auto` over stdio would probe on a sibling of the backend.
    this.mcpClient = new Client(
      { name: 'dev-proxy', version: '1.0.0' },
      { versionNegotiation: { mode: this.backendTransport === 'http' ? 'auto' : 'legacy' } }
    );

    // Relay backend resource notifications (resources/updated, list_changed)
    // to the front client (issue #218). Registered as the fallback handler so
    // unknown future notifications are ignored rather than crashing.
    this.mcpClient.fallbackNotificationHandler = async (notification) => {
      if (
        notification?.method === 'notifications/resources/updated' ||
        notification?.method === 'notifications/resources/list_changed'
      ) {
        this.onResourceNotification?.(notification);
      }
    };

    if (this.backendTransport === 'stdio') {
      // Stdio mode: StdioClientTransport spawns the child
      const transport = new StdioClientTransport({
        command,
        args,
        cwd: PROJECT_ROOT,
        env: this._buildBackendEnv(),
        stderr: 'pipe',
      });

      this.stdioTransport = transport;

      // Log backend stderr output
      attachBackendLogger(transport.stderr);

      transport.onerror = (err) => {
        if (!this._shouldSuppressTransportError(closeState, err)) {
          log(`Stdio transport error: ${err.message}`);
        }
      };

      transport.onclose = () => {
        log('Stdio transport closed');
        // The SDK reports close only once the child has exited, so its PID is
        // no longer ours: a later force-kill could hit a process that reused it.
        if (this.stdioTransport === transport) this.stdioPid = null;
        if (!closeState.expected && this.transportCloseState === closeState && this.state === 'running') {
          this.state = 'stopped';
          this.startedAt = null;
          log('Backend crashed — use dev_restart_debugger to restart');
          queueGenerationCleanup(this.lifecycleQueue,
            () => this.transportCloseState === closeState,
            () => this._killDockerContainer()).catch(() => {});
        }
      };

      // connect() starts the transport synchronously, so capture ownership
      // before awaiting initialization. On cancellation the SDK starts an
      // unawaited close() and immediately clears transport.pid; relying on
      // that getter afterward would orphan a backend still initializing.
      const connecting = this.mcpClient.connect(transport, { signal: this.shutdownController.signal });
      this.stdioPid = transport.pid;
      await connecting;
      log('MCP Client connected to backend via stdio');
      await this._reopenRelay();
    } else {
      // Streamable HTTP mode (the only other value resolveBackendTransport
      // admits): SDK handles reconnection internally.
      const mcpUrl = new URL(`http://127.0.0.1:${BACKEND_PORT}/mcp`);
      const transport = new StreamableHTTPClientTransport(mcpUrl);

      transport.onerror = (err) => {
        if (!this._shouldSuppressTransportError(closeState, err)) {
          log(`HTTP transport error: ${err.message}`);
        }
      };

      transport.onclose = () => {
        log('HTTP transport closed');
        if (!closeState.expected && this.transportCloseState === closeState && this.state === 'running') {
          this.state = 'stopped';
          this.startedAt = null;
          log('Killing orphaned child process after HTTP transport close');
          const child = this.child;
          queueGenerationCleanup(this.lifecycleQueue,
            () => this.transportCloseState === closeState,
            () => this._killChild(child)).catch(() => {});
        }
      };

      await this.mcpClient.connect(transport, { signal: this.shutdownController.signal });
      log(`MCP Client connected to backend via Streamable HTTP (${this.mcpClient.getProtocolEra()} era, ${this.mcpClient.getNegotiatedProtocolVersion()})`);
      await this._reopenRelay();
    }
  }

  async _reopenRelay() {
    try {
      await this.relay?.reopen();
    } catch (err) {
      log(`Could not re-express the resource subscriptions to the backend: ${err?.message ?? err}`);
    }
  }

  async _disconnectClient() {
    if (this.mcpClient) {
      const client = this.mcpClient;
      try {
        await this.relay?.close();
      } catch (err) {
        log(`Ignoring relay close error: ${err?.message ?? err}`);
      }
      if (this.transportCloseState) this.transportCloseState.expected = true;
      try {
        await client.close();
      } catch (err) {
        log(`Ignoring client close error: ${err.message}`);
      }
      if (this.mcpClient === client) this.mcpClient = null;
    }
  }

  _shouldSuppressTransportError(closeState, err) {
    return closeState.expected && isIntentionalTransportAbort(err);
  }

  async _killChild(child = this.child) {
    // Used for HTTP mode (manually spawned child)
    if (!child) {
      // Even with no child, a Docker container may be orphaned on our port
      await this._killDockerContainer();
      return;
    }

    // Graceful first (stdin close on Windows, SIGTERM elsewhere) so the
    // backend can run its gracefulShutdown/closeAllSessions; force-kill
    // after KILL_TIMEOUT_MS (issue #122).
    await killChildGracefully(child, { log, killTimeoutMs: KILL_TIMEOUT_MS });
    if (this.child === child) this.child = null;

    // After killing the CLI process, also stop any Docker container on our port
    await this._killDockerContainer();
  }

  async _forceKillPid(pid, { stillOwned } = {}) {
    await forceKillPid(pid, { stillOwned });
  }

  /**
   * Force-kill the stdio backend only while its PID is still ours. stdioPid
   * outlives transport.pid (which the SDK clears as close() begins) and is
   * cleared once the child has exited, so a crashed backend's PID is never
   * reused as a kill target by a later restart.
   */
  async _forceKillStdioBackend() {
    const pid = this.stdioPid;
    await this._forceKillPid(pid, { stillOwned: () => this.stdioPid === pid });
  }

  async _ensurePortFree() {
    if (this.backendTransport === 'stdio') return;
    await this._killDockerContainer();
    await ensurePortFree({ port: BACKEND_PORT, log });
  }

  async _killDockerContainer() {
    if (!BACKEND_CMD) return;
    const invocation = parseCommandString(BACKEND_CMD);
    if (!isDockerRunInvocation(invocation)) return;

    try {
      const removed = await removeOwnedDockerContainers({
        dockerCommand: invocation.command,
        ownerId: this.dockerOwnerId,
        port: BACKEND_PORT,
        includeLegacyPort: this.backendTransport !== 'stdio',
        log,
      });
      return removed.ownedIds.length + removed.legacyIds.length;
    } catch {
      // docker not available or no containers — proceed
      return 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Dev Tools — always available regardless of backend state
// ---------------------------------------------------------------------------

const DEV_TOOLS = [
  {
    name: 'dev_restart_debugger',
    description:
      `Restart the mcp-debugger backend. Use after code changes, rebuilds, or environment changes (e.g., installing new tools). Optionally pass rebuild:true to run "${BUILD_CMD}" first.`,
    inputSchema: {
      type: 'object',
      properties: {
        rebuild: {
          type: 'boolean',
          description: `If true, run "${BUILD_CMD}" before restarting (default: false)`,
        },
        env: {
          type: 'object',
          description:
            'Replace the persistent backend environment overrides. Omit to preserve them; pass {} to clear them.',
          additionalProperties: { type: 'string' },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'dev_rebuild_and_restart',
    description:
      `Run "${BUILD_CMD}" then restart the mcp-debugger backend (${BACKEND_TRANSPORT} mode). Use after making code changes.`,
    inputSchema: {
      type: 'object',
      properties: {
        env: {
          type: 'object',
          description:
            'Replace the persistent backend environment overrides. Omit to preserve them; pass {} to clear them.',
          additionalProperties: { type: 'string' },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'dev_server_status',
    description:
      'Get the current status of the mcp-debugger backend (state, PID, uptime, buildInProgress, transport, protocol era and version, project root, port, and display-safe environment overrides).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/**
 * Announce the inventory change a restart caused, successful or not: a rebuild
 * whose new dist throws at startup leaves the client holding the pre-restart
 * tool list, which no longer exists.
 */
async function notifyToolListChanged(server) {
  try {
    await server.sendToolListChanged();
  } catch (err) {
    log(`Failed to send tools/list_changed: ${err.message}`);
  }
}

/** The failed dev-tool response: the message alone (issue #154). */
function devToolFailure(err) {
  return {
    content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }, null, 2) }],
    isError: true,
  };
}

async function handleDevTool(backend, server, name, args) {
  switch (name) {
    case 'dev_restart_debugger':
    case 'dev_rebuild_and_restart': {
      try {
        const result = await backend.restart(
          { ...args, rebuild: name === 'dev_rebuild_and_restart' || args?.rebuild === true },
          () => notifyToolListChanged(server)
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return devToolFailure(err);
      }
    }

    case 'dev_server_status': {
      return {
        content: [{ type: 'text', text: JSON.stringify(backend.getStatus(), null, 2) }],
      };
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown dev tool: ${name}` }],
        isError: true,
      };
  }
}

// ---------------------------------------------------------------------------
// Main — set up proxy MCP server
// ---------------------------------------------------------------------------

async function main() {
  if (!sharedUtilsLoaded) {
    log('WARNING: @debugmcp/shared dist not found — backend output redaction disabled until the project is built');
  }

  const backend = new BackendManager();

  // The relay expresses the client's resource subscriptions to the backend in
  // whichever era it speaks (issue #1025, step 2); the backend re-expresses the
  // set after every (re)connect and ends its listen before going away.
  const relay = createSubscriptionRelay({ getClient: () => backend.mcpClient, log });
  backend.relay = relay;

  // The client-facing server, one instance per connection, in the era the client
  // opens with (issue #1025, step 2): a probing client (Claude Code's v2 runtime)
  // lands on 2026-07-28, an `initialize` client on the 2025 era. The dev tools
  // are answered locally; everything else forwards to the backend.
  const front = createFront({
    backend,
    relay,
    devTools: DEV_TOOLS,
    handleDevTool: (name, args) => handleDevTool(backend, front, name, args),
    discoveryWaitMs: DISCOVERY_WAIT_MS,
    log,
  });

  // Relay backend resource notifications to the pinned front instance (issue #218).
  backend.onResourceNotification = (notification) => {
    front.notify(notification).catch((err) => {
      log(`Failed to relay ${notification.method}: ${err.message}`);
    });
  };
  // A rebuild whose new dist throws at startup leaves the client holding a tool
  // list that no longer exists; the initial start announces its inventory too.
  backend.onInitialStart = () => notifyToolListChanged(front);

  // Exit when the MCP client goes away — stdin EOF/close/error, the transport
  // closing the wire by itself (a broken stdout, an oversized frame), or
  // SIGINT/SIGTERM — stopping the backend child on the way out. Installed before
  // the wire goes live so a client that dies during a slow backend start still
  // triggers shutdown (backend.stop() handles a backend that never started).
  // Without this, on Windows both the proxy and its backend outlive a dead
  // Claude Code forever (issue #122).
  const shutdown = installShutdownHandlers({ stdin: process.stdin, backend, log });
  const transport = new ObservedStdioServerTransport(() => {
    void shutdown('stdio transport closed (MCP client gone)');
  });

  // The SDK's stdio entry owns the wire and answers server/discover itself. The
  // backend is NOT started here: a v2 client's `auto` negotiation probes on a
  // disposable sibling process spawned from the same parameters, which used to
  // start a backend of its own and race this one for the port (issue #1025,
  // step 2). The first request that reaches a handler starts it.
  serveStdio(front.factory, {
    transport,
    onerror: (err) => log(`Front transport error: ${err?.message ?? err}`),
  });

  log(`Proxy serving stdio in both protocol eras (backend transport: ${BACKEND_TRANSPORT}; the backend starts on first use)`);
}

main().catch((err) => {
  process.stderr.write(`[dev-proxy] Fatal error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
