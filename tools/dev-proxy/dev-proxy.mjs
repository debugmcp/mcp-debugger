#!/usr/bin/env node

/**
 * Dev Proxy MCP Server for mcp-debugger
 *
 * A lightweight MCP proxy that sits between Claude Code (stdio) and mcp-debugger (SSE),
 * allowing the backend to be killed and restarted without Claude Code seeing a disconnection.
 *
 * Architecture:
 *   Claude Code <--stdio--> dev-proxy.mjs (stable) <--HTTP/SSE--> mcp-debugger (restartable)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
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
    /** @type {Array<object>} */
    this.cachedTools = [];
    /** @type {number | null} */
    this.startedAt = null;
  }

  // ---- Public API ----------------------------------------------------------

  async start() {
    if (this.state === 'running' || this.state === 'starting') {
      log(`Backend already ${this.state}, skipping start`);
      return;
    }

    this.state = 'starting';
    log(`Starting backend on port ${BACKEND_PORT}...`);

    // Spawn mcp-debugger in SSE mode
    // Note: do NOT use shell:true — it breaks paths with spaces on Windows
    const entryPoint = path.join(PROJECT_ROOT, 'dist', 'index.js');
    this.child = spawn(process.execPath, [entryPoint, 'sse', '--port', String(BACKEND_PORT)], {
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

    // Wait for /health to respond
    await this._waitForHealth();

    // Connect MCP Client
    await this._connectClient();

    // Cache tool list
    await this._cacheTools();

    this.startedAt = Date.now();
    this.state = 'running';
    log(`Backend running (PID=${this.child.pid}, tools=${this.cachedTools.length})`);
  }

  async stop() {
    if (this.state === 'stopped') return;

    log('Stopping backend...');

    // Close MCP client first
    await this._disconnectClient();

    // Kill child process
    await this._killChild();

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
    return {
      state: this.state,
      pid: this.child?.pid ?? null,
      port: BACKEND_PORT,
      uptime: this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : null,
      toolCount: this.cachedTools.length,
      projectRoot: PROJECT_ROOT,
      buildCmd: BUILD_CMD,
    };
  }

  // ---- Internal helpers ----------------------------------------------------

  _onChildExit() {
    this.child = null;
    this.mcpClient = null;
    if (this.state !== 'restarting' && this.state !== 'stopped') {
      this.state = 'stopped';
      this.startedAt = null;
      log('Backend crashed — use dev_restart_debugger to restart');
    }
  }

  async _waitForHealth() {
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

  async _connectClient() {
    this.mcpClient = new Client({ name: 'dev-proxy', version: '1.0.0' });

    const sseUrl = new URL(`http://localhost:${BACKEND_PORT}/sse`);
    const transport = new SSEClientTransport(sseUrl);

    transport.onerror = (err) => {
      log(`SSE transport error: ${err.message}`);
    };

    transport.onclose = () => {
      log('SSE transport closed');
      if (this.state === 'running') {
        this.state = 'stopped';
        this.startedAt = null;
      }
    };

    await this.mcpClient.connect(transport);
    log('MCP Client connected to backend via SSE');
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

  async _cacheTools() {
    if (!this.mcpClient) return;
    try {
      const result = await this.mcpClient.listTools();
      this.cachedTools = result.tools || [];
      log(`Cached ${this.cachedTools.length} tools from backend`);
    } catch (err) {
      log(`Failed to cache tools: ${err.message}`);
      this.cachedTools = [];
    }
  }

  async _killChild() {
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

      // Graceful kill
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${child.pid} /T`, { stdio: 'ignore' });
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
}

// ---------------------------------------------------------------------------
// Dev Tools — always available regardless of backend state
// ---------------------------------------------------------------------------

const DEV_TOOLS = [
  {
    name: 'dev_restart_debugger',
    description:
      'Restart the mcp-debugger backend. Use after code changes, rebuilds, or environment changes (e.g., installing new tools). Optionally pass rebuild:true to run "npm run build" first.',
    inputSchema: {
      type: 'object',
      properties: {
        rebuild: {
          type: 'boolean',
          description: 'If true, run build before restarting (default: false)',
        },
      },
    },
  },
  {
    name: 'dev_rebuild_and_restart',
    description:
      'Run "npm run build" then restart the mcp-debugger backend. Use after making code changes.',
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

async function handleDevTool(backend, name, args) {
  switch (name) {
    case 'dev_restart_debugger': {
      try {
        if (args?.rebuild) {
          const buildOutput = await backend.rebuildAndRestart();
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
    { capabilities: { tools: {} } }
  );

  // ListTools: merge backend tools + dev tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: [...backend.cachedTools, ...DEV_TOOLS] };
  });

  // CallTool: route dev_* locally, forward everything else to backend
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Dev tools are always handled locally
    if (name.startsWith('dev_')) {
      return await handleDevTool(backend, name, args);
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

  log('Proxy server connected to stdio');

  // Start the backend automatically
  try {
    await backend.start();
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
