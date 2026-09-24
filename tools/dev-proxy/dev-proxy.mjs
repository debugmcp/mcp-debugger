#!/usr/bin/env node

/**
 * Dev Proxy MCP Server for mcp-debugger
 *
 * A lightweight MCP proxy that sits between Claude Code (stdio) and mcp-debugger,
 * allowing the backend to be killed and restarted without Claude Code seeing a disconnection.
 *
 * Architecture (three backend transport modes):
 *   Claude Code <--stdio--> dev-proxy.mjs (stable) <--HTTP---> mcp-debugger (Streamable HTTP, default)
 *   Claude Code <--stdio--> dev-proxy.mjs (stable) <--SSE----> mcp-debugger (legacy, deprecated)
 *   Claude Code <--stdio--> dev-proxy.mjs (stable) <--stdio--> mcp-debugger (restartable)
 *
 * Configuration (all env vars, all optional):
 *   DEV_PROXY_PORT               - Backend HTTP port (default: 3001, http/sse modes only)
 *   DEV_PROXY_BUILD_CMD          - Build command (default: "npm run build")
 *   DEV_PROXY_BUILD_TIMEOUT_MS   - Build timeout in milliseconds (default: 120000)
 *   DEV_PROXY_ROOT               - Project root (default: auto-detected)
 *   DEV_PROXY_BACKEND_TRANSPORT  - "http" (default), "sse" (legacy), or "stdio"
 *   DEV_PROXY_BACKEND_CMD        - Custom backend command override (e.g. "docker run ...")
 *   DEV_PROXY_DISCOVERY_WAIT_MS  - How long a request waits for a backend start
 *                                  or restart to settle (default: 15000)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn, execSync } from 'child_process';
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
import { buildBackendEnvironment, resolveBackendPort, updateBackendEnvOverrides } from './backend-env.mjs';
import { LifecycleQueue } from './lifecycle-queue.mjs';
import { runBuild } from './build-runner.mjs';
import { isBackendUnavailableError, dedupeMcpErrorPrefix, assertBackendAvailable } from './tool-error.mjs';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_PORT = resolveBackendPort(process.env.DEV_PROXY_PORT);
const BUILD_CMD = process.env.DEV_PROXY_BUILD_CMD || 'npm run build';
const PROJECT_ROOT = process.env.DEV_PROXY_ROOT || path.resolve(__dirname, '..', '..');
const BACKEND_TRANSPORT = process.env.DEV_PROXY_BACKEND_TRANSPORT || 'http';
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
    /** @type {'http' | 'sse' | 'stdio'} */
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
      } else if (this.backendTransport === 'sse') {
        invocation = { command: process.execPath, args: [entryPoint, 'sse', '--port', String(BACKEND_PORT)] };
      } else {
        // http (default): Streamable HTTP transport
        invocation = { command: process.execPath, args: [entryPoint, 'http', '--port', String(BACKEND_PORT)] };
      }
    }

    return addDockerOwnershipLabel(invocation, this.dockerOwnerId);
  }

  _buildBackendEnv({ forceStdinClose = false } = {}) {
    return buildBackendEnvironment(
      process.env,
      this.backendEnvOverrides,
      forceStdinClose ? { MCP_EXIT_ON_STDIN_CLOSE: '1' } : {}
    );
  }

  // ---- Public API ----------------------------------------------------------

  start() {
    return this.lifecycleQueue.run(() => this._start());
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
      // HTTP / SSE mode: we spawn the child manually, wait for health, then connect
      log(`Starting backend (${this.backendTransport}) on port ${BACKEND_PORT}...`);

      // Kill any orphan process holding the port from a previous crash
      await this._ensurePortFree();
      this._assertOpen();

      // stdin is a pipe + MCP_EXIT_ON_STDIN_CLOSE so the backend can detect
      // our death (pipe closes) and we can ask it to shut down gracefully
      // before force-killing (issue #122).
      this.child = spawn(command, args, {
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

      // Wait for /health to respond, then connect MCP Client (HTTP or SSE)
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
    // Aborting SSE's live fetch can close the transport before queued _stop()
    // runs. Mark the intent first so it cannot take the backend-crash path.
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

    if (this.backendTransport === 'sse' || this.backendTransport === 'http') {
      // HTTP / SSE mode: manually kill the child we spawned
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
    return await this.mcpClient.callTool({ name, arguments: args });
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
      backendCmd: BACKEND_CMD || null,
      backendEnvOverrides: sanitizedEnv.values,
      backendEnvRedaction: sanitizedEnv.redaction,
    };
  }

  // ---- Internal helpers ----------------------------------------------------

  _onChildExit(exitedChild) {
    // Used for HTTP / SSE modes (manually spawned child)
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
    // Used for HTTP / SSE modes
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
    this.mcpClient = new Client({ name: 'dev-proxy', version: '1.0.0' });

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
          this._killDockerContainer().catch(() => {});
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
    } else if (this.backendTransport === 'http') {
      // Streamable HTTP mode: SDK handles reconnection internally; no phantom hack needed
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
          this._killChild().catch(() => {});
        }
      };

      await this.mcpClient.connect(transport, { signal: this.shutdownController.signal });
      log('MCP Client connected to backend via Streamable HTTP');
    } else {
      // SSE mode (legacy): connect to running HTTP server
      const sseUrl = new URL(`http://127.0.0.1:${BACKEND_PORT}/sse`);

      // Block EventSource auto-reconnection: eventsource@4.0.0 reconnects when the
      // SSE stream reader returns done, creating a phantom 2nd session that overwrites
      // the 1st transport in Protocol._transport. Returning 204 on reconnect attempts
      // causes EventSource to permanently close (no further reconnection per SSE spec).
      let initialFetchDone = false;
      const transport = new SSEClientTransport(sseUrl, {
        eventSourceInit: {
          fetch: async (url, init) => {
            if (initialFetchDone) {
              log('Blocking EventSource auto-reconnection (returning 204)');
              return new Response(null, { status: 204 });
            }
            const signal = init?.signal
              ? AbortSignal.any([init.signal, this.shutdownController.signal])
              : this.shutdownController.signal;
            const resp = await globalThis.fetch(url, { ...init, signal });
            initialFetchDone = true;
            return resp;
          },
        },
      });

      transport.onerror = (err) => {
        if (!this._shouldSuppressTransportError(closeState, err)) {
          log(`SSE transport error: ${err.message}`);
        }
      };

      transport.onclose = () => {
        log('SSE transport closed');
        if (!closeState.expected && this.transportCloseState === closeState && this.state === 'running') {
          this.state = 'stopped';
          this.startedAt = null;
          log('Killing orphaned child process after SSE transport close');
          this._killChild().catch(() => {});
        }
      };

      await this.mcpClient.connect(transport, { signal: this.shutdownController.signal });
      log('MCP Client connected to backend via SSE');
    }
  }

  async _disconnectClient() {
    if (this.mcpClient) {
      const client = this.mcpClient;
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

  async _killChild() {
    // Used for HTTP / SSE modes (manually spawned child)
    if (!this.child) {
      // Even with no child, a Docker container may be orphaned on our port
      await this._killDockerContainer();
      return;
    }

    // Graceful first (stdin close on Windows, SIGTERM elsewhere) so the
    // backend can run its gracefulShutdown/closeAllSessions; force-kill
    // after KILL_TIMEOUT_MS (issue #122).
    await killChildGracefully(this.child, { log, killTimeoutMs: KILL_TIMEOUT_MS });
    this.child = null;

    // After killing the CLI process, also stop any Docker container on our port
    await this._killDockerContainer();
  }

  async _forceKillPid(pid, { stillOwned } = {}) {
    // Safety net for stdio mode: force-kill the backend PID if it lingers after transport close
    if (!pid) return;
    try {
      // Give the abort signal a moment to propagate
      await new Promise((r) => setTimeout(r, 500));
      // The child may have exited during that grace period (see stdio onclose).
      if (stillOwned && !stillOwned()) return;
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${pid} /F`, { stdio: 'ignore' });
      } else {
        process.kill(pid, 0); // Check if alive (throws if dead)
        process.kill(pid, 'SIGKILL');
      }
    } catch {
      // Process already dead — expected
    }
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
    // Only needed for network modes — check if BACKEND_PORT is held by an orphan and kill it
    if (this.backendTransport === 'stdio') return;

    // Kill any Docker container publishing on our port (survives CLI process kill)
    await this._killDockerContainer();

    try {
      let pid = null;

      if (process.platform === 'win32') {
        // Use netstat to find the PID holding the port
        const output = execSync(
          `netstat -ano | findstr ":${BACKEND_PORT}" | findstr "LISTENING"`,
          { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
        );
        // Parse last column (PID) from first matching line
        const match = output.trim().split('\n')[0]?.match(/\s(\d+)\s*$/);
        if (match) pid = parseInt(match[1], 10);
      } else {
        // Use lsof on Unix
        const output = execSync(
          `lsof -ti tcp:${BACKEND_PORT} -sTCP:LISTEN`,
          { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
        );
        pid = parseInt(output.trim().split('\n')[0], 10);
      }

      if (pid && pid > 0) {
        // Validate it's a node process before killing (safety: don't kill Docker, etc.)
        if (process.platform === 'win32') {
          try {
            const taskInfo = execSync(`tasklist /fi "PID eq ${pid}" /fo csv /nh`,
              { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
            if (!taskInfo.toLowerCase().includes('node')) {
              log(`Port ${BACKEND_PORT} held by non-node PID ${pid} — skipping kill`);
              return;
            }
          } catch { /* proceed with kill if tasklist fails */ }
        }

        log(`Port ${BACKEND_PORT} is held by PID ${pid} — killing orphan`);
        await this._forceKillPid(pid);
        // Give OS a moment to release the port
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {
      // No process holding the port, or command not available — proceed
    }
  }

  async _killDockerContainer() {
    if (!BACKEND_CMD) return;
    const invocation = parseCommandString(BACKEND_CMD);
    if (!isDockerRunInvocation(invocation)) return;

    try {
      const removed = removeOwnedDockerContainers({
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
      'Get the current status of the mcp-debugger backend (state, PID, uptime, buildInProgress, transport, project root, port, and display-safe environment overrides).',
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

  // Create the MCP Server that Claude Code talks to (via stdio)
  const server = new Server(
    { name: 'dev-proxy', version: '1.0.0' },
    { capabilities: { tools: { listChanged: true }, resources: { subscribe: true, listChanged: true } } }
  );

  // Relay backend resource notifications to the front client (issue #218)
  backend.onResourceNotification = (notification) => {
    server.notification(notification).catch((err) => {
      log(`Failed to relay ${notification.method}: ${err.message}`);
    });
  };

  // ListTools: forward live to backend, fall back to dev-tools-only when backend is down.
  // The wait keeps the first inventory from being taken before the backend has
  // started (issue #716); a cancelled request stops waiting with the client.
  server.setRequestHandler(ListToolsRequestSchema, async (_request, extra) => {
    await backend.whenReady({ signal: extra?.signal });
    if (backend.state === 'running' && backend.mcpClient) {
      try {
        const result = await backend.mcpClient.listTools();
        return { tools: [...(result.tools || []), ...DEV_TOOLS] };
      } catch (err) {
        log(`Live tools/list failed: ${err.message}`);
      }
    }
    return { tools: [...DEV_TOOLS] };
  });

  // CallTool: route dev_* locally, forward everything else to backend
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;

    // Dev tools are always handled locally — status and recovery stay callable
    // while a start or restart is still in flight.
    if (name.startsWith('dev_')) {
      return await handleDevTool(backend, server, name, args);
    }

    // Forward to backend
    try {
      const result = await backend.callTool(name, args || {}, { signal: extra?.signal });
      return result;
    } catch (err) {
      // A well-formed JSON-RPC error from a running backend (e.g. -32602
      // InvalidParams) proves the backend is alive — pass it through without
      // the restart hint, which would send agents on a false detour (#304).
      const body = { error: dedupeMcpErrorPrefix(err.message) };
      if (isBackendUnavailableError(err, backend.state)) {
        // Only a stopped backend wants restarting. Telling an agent to restart
        // one that is mid-start queues a second restart that kills it (#716).
        body.hint =
          backend.needsRestart()
            ? `The mcp-debugger backend is not reachable (state: ${backend.state}). Use dev_server_status to check, or dev_restart_debugger to restart it.`
            : `The mcp-debugger backend is ${backend.state} and did not settle within ${DISCOVERY_WAIT_MS}ms. Retry the call; use dev_server_status to watch it — do NOT restart it.`;
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(body, null, 2) }],
        isError: true,
      };
    }
  });

  // Resources: pure passthrough to the backend (issue #218). Note that
  // subscriptions live in the backend process, so they are lost when the
  // backend is restarted (dev_rebuild_and_restart) — re-subscribe after.
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    if (backend.state === 'running' && backend.mcpClient) {
      try {
        return await backend.mcpClient.listResources();
      } catch (err) {
        log(`Live resources/list failed: ${err.message}`);
      }
    }
    return { resources: [] };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request, extra) => {
    await backend.whenReady({ signal: extra?.signal });
    assertBackendAvailable(backend);
    return await backend.mcpClient.readResource(request.params);
  });

  server.setRequestHandler(SubscribeRequestSchema, async (request, extra) => {
    await backend.whenReady({ signal: extra?.signal });
    assertBackendAvailable(backend);
    return await backend.mcpClient.subscribeResource(request.params);
  });

  server.setRequestHandler(UnsubscribeRequestSchema, async (request, extra) => {
    await backend.whenReady({ signal: extra?.signal });
    assertBackendAvailable(backend);
    return await backend.mcpClient.unsubscribeResource(request.params);
  });

  // Exit when the MCP client goes away — stdin EOF/close/error, protocol-level
  // server close, or SIGINT/SIGTERM — stopping the backend child on the way out.
  // Installed before backend.start() so a client that dies during a slow backend
  // startup still triggers shutdown (backend.stop() handles the 'starting' state).
  // Without this, on Windows both the proxy and its backend outlive a dead
  // Claude Code forever (issue #122). Safe to install before server.connect():
  // only 'end'/'close'/'error' go on stdin, none of which make it flow.
  installShutdownHandlers({ stdin: process.stdin, backend, server, log });

  // Queue the automatic start BEFORE the transport goes live, so the first
  // tools/list finds a lifecycle operation in flight and waits for it rather
  // than racing it to a dev-tools-only inventory (issue #716).
  const initialStart = backend.start().then(
    () => true,
    (err) => {
      log(`Initial backend start failed: ${err.message}`);
      log('Dev tools are still available — use dev_restart_debugger to retry');
      return false;
    }
  );

  // Connect to stdio transport for Claude Code
  const transport = new StdioServerTransport();
  await server.connect(transport);

  log(`Proxy server connected to stdio (backend transport: ${BACKEND_TRANSPORT})`);

  if (await initialStart) {
    // Refresh clients whose discovery gave up before the backend was ready.
    // Swallowing: a client that died during a slow start leaves the transport
    // closed, and `notification()` throws 'Not connected'. Letting that escape
    // would reject main() and hard-exit before the shutdown handler's queued
    // backend.stop() ran, orphaning the child (issue #122).
    await notifyToolListChanged(server);
  }
}

main().catch((err) => {
  process.stderr.write(`[dev-proxy] Fatal error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
