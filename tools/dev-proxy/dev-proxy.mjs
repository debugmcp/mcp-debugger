#!/usr/bin/env node

/**
 * Dev Proxy MCP Server for mcp-debugger
 *
 * A lightweight MCP proxy that sits between Claude Code (stdio) and mcp-debugger,
 * allowing the backend to be killed and restarted without Claude Code seeing a disconnection.
 *
 * Architecture (two backend transport modes):
 *   Claude Code <--stdio--> dev-proxy.mjs (stable) <--SSE--->  mcp-debugger (restartable)
 *   Claude Code <--stdio--> dev-proxy.mjs (stable) <--stdio--> mcp-debugger (restartable)
 *
 * Configuration (all env vars, all optional):
 *   DEV_PROXY_PORT               - Backend SSE port (default: 3001, SSE mode only)
 *   DEV_PROXY_BUILD_CMD          - Build command (default: "npm run build")
 *   DEV_PROXY_ROOT               - Project root (default: auto-detected)
 *   DEV_PROXY_BACKEND_TRANSPORT  - "sse" (default) or "stdio"
 *   DEV_PROXY_BACKEND_CMD        - Custom backend command override (e.g. "docker run ...")
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_PORT = parseInt(process.env.DEV_PROXY_PORT || '3001', 10);
const BUILD_CMD = process.env.DEV_PROXY_BUILD_CMD || 'npm run build';
const PROJECT_ROOT = process.env.DEV_PROXY_ROOT || path.resolve(__dirname, '..', '..');
const BACKEND_TRANSPORT = process.env.DEV_PROXY_BACKEND_TRANSPORT || 'sse';
const BACKEND_CMD = process.env.DEV_PROXY_BACKEND_CMD || null;
const HEALTH_POLL_INTERVAL_MS = 300;
const HEALTH_POLL_TIMEOUT_MS = 30000;
const KILL_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Logging (all to stderr — stdout is the MCP JSON-RPC channel)
// ---------------------------------------------------------------------------

function log(msg) {
  process.stderr.write(`[dev-proxy] ${msg}\n`);
}

function logBackend(data) {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      process.stderr.write(`[backend] ${line}\n`);
    }
  }
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
    /** @type {number | null} */
    this.startedAt = null;
    /** @type {'sse' | 'stdio'} */
    this.backendTransport = BACKEND_TRANSPORT;
  }

  // ---- Command computation ------------------------------------------------

  _computeBackendCommand() {
    if (BACKEND_CMD) {
      return parseCommandString(BACKEND_CMD);
    }

    const entryPoint = path.join(PROJECT_ROOT, 'dist', 'index.js');

    if (this.backendTransport === 'stdio') {
      return { command: process.execPath, args: [entryPoint, 'stdio'] };
    } else {
      return { command: process.execPath, args: [entryPoint, 'sse', '--port', String(BACKEND_PORT)] };
    }
  }

  // ---- Public API ----------------------------------------------------------

  async start() {
    if (this.state === 'running' || this.state === 'starting') {
      log(`Backend already ${this.state}, skipping start`);
      return;
    }

    this.state = 'starting';
    const { command, args } = this._computeBackendCommand();

    if (this.backendTransport === 'stdio') {
      // Stdio mode: StdioClientTransport spawns the child and owns its stdin/stdout
      log(`Starting backend in stdio mode: ${command} ${args.join(' ')}`);
      await this._connectClient(command, args);
    } else {
      // SSE mode: we spawn the child manually, wait for health, then connect
      log(`Starting backend on port ${BACKEND_PORT}...`);

      // Kill any orphan process holding the port from a previous crash
      await this._ensurePortFree();

      this.child = spawn(command, args, {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      this.child.stdout.on('data', logBackend);
      this.child.stderr.on('data', logBackend);

      this.child.on('exit', (code, signal) => {
        log(`Backend exited (code=${code}, signal=${signal})`);
        this._onChildExit();
      });

      this.child.on('error', (err) => {
        log(`Backend spawn error: ${err.message}`);
        this._onChildExit();
      });

      // Wait for /health to respond, then connect MCP Client over SSE
      // If either fails, kill the child so it doesn't become an orphan holding the port
      try {
        await this._waitForHealth();
        await this._connectClient();
      } catch (err) {
        log(`SSE backend failed during startup: ${err.message}`);
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

  async stop() {
    if (this.state === 'stopped') return;

    log('Stopping backend...');

    // For stdio mode, grab the PID before closing (close clears the process ref)
    const stdioPid = this.stdioTransport?.pid ?? null;

    // Close MCP client first (for stdio, this also kills the child via AbortController)
    await this._disconnectClient();

    if (this.backendTransport === 'sse') {
      // SSE mode: manually kill the child we spawned
      await this._killChild();
    } else if (stdioPid) {
      // stdio mode: extra safety — force-kill on Windows if process lingers
      await this._forceKillPid(stdioPid);
    }

    this.stdioTransport = null;
    this.state = 'stopped';
    this.startedAt = null;
    log('Backend stopped');
  }

  async restart() {
    this.state = 'restarting';
    await this.stop();
    await this.start();
  }

  rebuild() {
    log(`Running build: ${BUILD_CMD}`);
    const result = execSync(BUILD_CMD, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
      env: { ...process.env },
    });
    log('Build succeeded');
    return result;
  }

  async rebuildAndRestart() {
    const buildOutput = this.rebuild();
    await this.restart();
    return buildOutput;
  }

  async callTool(name, args) {
    if (this.state !== 'running' || !this.mcpClient) {
      throw new Error(`Backend is ${this.state} — cannot call tool "${name}". Use dev_restart_debugger to start it.`);
    }
    return await this.mcpClient.callTool({ name, arguments: args });
  }

  getStatus() {
    const pid =
      this.backendTransport === 'stdio'
        ? (this.stdioTransport?.pid ?? null)
        : (this.child?.pid ?? null);

    return {
      state: this.state,
      pid,
      port: this.backendTransport === 'sse' ? BACKEND_PORT : null,
      uptime: this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : null,
      projectRoot: PROJECT_ROOT,
      buildCmd: BUILD_CMD,
      backendTransport: this.backendTransport,
      backendCmd: BACKEND_CMD || null,
    };
  }

  // ---- Internal helpers ----------------------------------------------------

  _onChildExit() {
    // Only used for SSE mode (manually spawned child)
    this.child = null;
    this.mcpClient = null;
    if (this.state !== 'restarting' && this.state !== 'stopped') {
      this.state = 'stopped';
      this.startedAt = null;
      log('Backend crashed — use dev_restart_debugger to restart');
    }
  }

  async _waitForHealth() {
    // Only used for SSE mode
    const url = `http://localhost:${BACKEND_PORT}/health`;
    const deadline = Date.now() + HEALTH_POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      try {
        const resp = await fetch(url);
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
    this.mcpClient = new Client({ name: 'dev-proxy', version: '1.0.0' });

    if (this.backendTransport === 'stdio') {
      // Stdio mode: StdioClientTransport spawns the child
      const transport = new StdioClientTransport({
        command,
        args,
        cwd: PROJECT_ROOT,
        env: { ...process.env },
        stderr: 'pipe',
      });

      this.stdioTransport = transport;

      // Log backend stderr output
      if (transport.stderr) {
        transport.stderr.on('data', logBackend);
      }

      transport.onerror = (err) => {
        log(`Stdio transport error: ${err.message}`);
      };

      transport.onclose = () => {
        log('Stdio transport closed');
        if (this.state === 'running') {
          this.state = 'stopped';
          this.startedAt = null;
          log('Backend crashed — use dev_restart_debugger to restart');
        }
      };

      await this.mcpClient.connect(transport);
      log('MCP Client connected to backend via stdio');
    } else {
      // SSE mode: connect to running HTTP server
      const sseUrl = new URL(`http://localhost:${BACKEND_PORT}/sse`);

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
            const resp = await globalThis.fetch(url, init);
            initialFetchDone = true;
            return resp;
          },
        },
      });

      transport.onerror = (err) => {
        log(`SSE transport error: ${err.message}`);
      };

      transport.onclose = () => {
        log('SSE transport closed');
        if (this.state === 'running') {
          this.state = 'stopped';
          this.startedAt = null;
          log('Killing orphaned child process after SSE transport close');
          this._killChild().catch(() => {});
        }
      };

      await this.mcpClient.connect(transport);
      log('MCP Client connected to backend via SSE');
    }
  }

  async _disconnectClient() {
    if (this.mcpClient) {
      try {
        await this.mcpClient.close();
      } catch (err) {
        log(`Ignoring client close error: ${err.message}`);
      }
      this.mcpClient = null;
    }
  }

  async _killChild() {
    // Only used for SSE mode (manually spawned child)
    if (!this.child) return;

    return new Promise((resolve) => {
      const child = this.child;
      if (!child || child.exitCode !== null) {
        this.child = null;
        resolve();
        return;
      }

      const forceKillTimer = setTimeout(() => {
        try {
          if (process.platform === 'win32') {
            // On Windows, use taskkill to force-terminate the process tree
            execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
          } else {
            child.kill('SIGKILL');
          }
        } catch {
          // Already dead
        }
      }, KILL_TIMEOUT_MS);

      child.once('exit', () => {
        clearTimeout(forceKillTimer);
        this.child = null;
        resolve();
      });

      // Graceful kill (on Windows, use /F immediately — WM_CLOSE is ignored by console Node processes)
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
        } else {
          child.kill('SIGTERM');
        }
      } catch {
        clearTimeout(forceKillTimer);
        this.child = null;
        resolve();
      }
    });
  }

  async _forceKillPid(pid) {
    // Safety net for stdio mode: force-kill the backend PID if it lingers after transport close
    if (!pid) return;
    try {
      // Give the abort signal a moment to propagate
      await new Promise((r) => setTimeout(r, 500));
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        process.kill(pid, 0); // Check if alive (throws if dead)
        process.kill(pid, 'SIGKILL');
      }
    } catch {
      // Process already dead — expected
    }
  }

  async _ensurePortFree() {
    // Only needed for SSE mode — check if BACKEND_PORT is held by an orphan and kill it
    if (this.backendTransport !== 'sse') return;

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
        log(`Port ${BACKEND_PORT} is held by PID ${pid} — killing orphan`);
        await this._forceKillPid(pid);
        // Give OS a moment to release the port
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {
      // No process holding the port, or command not available — proceed
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
      },
    },
  },
  {
    name: 'dev_rebuild_and_restart',
    description:
      `Run "${BUILD_CMD}" then restart the mcp-debugger backend (${BACKEND_TRANSPORT} mode). Use after making code changes.`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'dev_server_status',
    description:
      'Get the current status of the mcp-debugger backend (state, PID, uptime, tool count, port).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

async function handleDevTool(backend, server, name, args) {
  switch (name) {
    case 'dev_restart_debugger': {
      try {
        if (args?.rebuild) {
          const buildOutput = await backend.rebuildAndRestart();
          await server.sendToolListChanged();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    action: 'rebuild_and_restart',
                    buildOutput: buildOutput.substring(0, 2000),
                    status: backend.getStatus(),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
        await backend.restart();
        await server.sendToolListChanged();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, action: 'restart', status: backend.getStatus() }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }, null, 2) }],
          isError: true,
        };
      }
    }

    case 'dev_rebuild_and_restart': {
      try {
        const buildOutput = await backend.rebuildAndRestart();
        await server.sendToolListChanged();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  action: 'rebuild_and_restart',
                  buildOutput: buildOutput.substring(0, 2000),
                  status: backend.getStatus(),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }, null, 2) }],
          isError: true,
        };
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
  const backend = new BackendManager();

  // Create the MCP Server that Claude Code talks to (via stdio)
  const server = new Server(
    { name: 'dev-proxy', version: '1.0.0' },
    { capabilities: { tools: { listChanged: true } } }
  );

  // ListTools: forward live to backend, fall back to dev-tools-only when backend is down
  server.setRequestHandler(ListToolsRequestSchema, async () => {
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
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Dev tools are always handled locally
    if (name.startsWith('dev_')) {
      return await handleDevTool(backend, server, name, args);
    }

    // Forward to backend
    try {
      const result = await backend.callTool(name, args || {});
      return result;
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: err.message,
                hint: 'The mcp-debugger backend may be down. Use dev_server_status to check, or dev_restart_debugger to restart it.',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  });

  // Connect to stdio transport for Claude Code
  const transport = new StdioServerTransport();
  await server.connect(transport);

  log(`Proxy server connected to stdio (backend transport: ${BACKEND_TRANSPORT})`);

  // Start the backend automatically
  try {
    await backend.start();
    // Notify Claude Code that tools changed — initial tools/list arrived before backend was up
    await server.sendToolListChanged();
  } catch (err) {
    log(`Initial backend start failed: ${err.message}`);
    log('Dev tools are still available — use dev_restart_debugger to retry');
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    log('SIGINT received, shutting down...');
    await backend.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    log('SIGTERM received, shutting down...');
    await backend.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  process.stderr.write(`[dev-proxy] Fatal error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
