# Dev Proxy for mcp-debugger

A lightweight MCP proxy that sits between Claude Code and mcp-debugger, allowing the backend to be restarted without losing your Claude Code conversation.

## Why?

When developing mcp-debugger, code changes require rebuilding and restarting the server. Claude Code spawns MCP servers as child processes with no restart/reconnect capability — the only option is restarting Claude Code entirely, losing conversation context.

This proxy solves that by maintaining a stable stdio connection to Claude Code while managing the mcp-debugger backend as a restartable SSE child process.

## Architecture

```
Claude Code <--stdio--> dev-proxy.mjs (stable, never restarts)
                              |
                         HTTP/SSE (MCP protocol)
                              |
                        mcp-debugger (SSE mode, restartable)
```

## Setup

### 1. Build the project first

```bash
npm run build
```

### 2. Configure Claude Code to use the proxy

```bash
claude mcp add-json mcp-debugger '{"type":"stdio","command":"node","args":["tools/dev-proxy/dev-proxy.mjs"]}'
```

### 3. Restart Claude Code once

After this one-time restart, all future restarts happen via the `dev_rebuild_and_restart` tool — no more restarting Claude Code.

## Dev Tools

Once connected, three additional tools are available:

| Tool | Description |
|------|-------------|
| `dev_restart_debugger` | Kill and restart the backend. Pass `rebuild: true` to build first. |
| `dev_rebuild_and_restart` | Run `npm run build` then restart the backend. |
| `dev_server_status` | Check backend state, PID, uptime, tool count, port. |

All regular mcp-debugger tools (create_debug_session, set_breakpoint, etc.) are forwarded transparently to the backend.

## Configuration

Environment variables (all optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `DEV_PROXY_PORT` | `3001` | Port for the backend SSE server |
| `DEV_PROXY_BUILD_CMD` | `npm run build` | Build command to run |
| `DEV_PROXY_ROOT` | Auto-detected | Project root directory |

## Workflow

1. Make code changes to mcp-debugger
2. Call `dev_rebuild_and_restart` (or `dev_restart_debugger` with `rebuild: true`)
3. Continue using debug tools — they now run the updated code

If the backend crashes:
1. Call `dev_server_status` to confirm it's stopped
2. Call `dev_restart_debugger` to bring it back

## Troubleshooting

- **Backend won't start**: Check that `npm run build` succeeds and port 3001 is free
- **Tools not showing up**: The proxy caches the tool list on startup. Restart to refresh.
- **Port conflict**: Set `DEV_PROXY_PORT` to a different port
- **All logs go to stderr**: stdout is reserved for the MCP JSON-RPC protocol. Backend logs are prefixed with `[backend]`, proxy logs with `[dev-proxy]`.

## Running Manually (for testing)

```bash
node tools/dev-proxy/dev-proxy.mjs
```

Or via the npm script:

```bash
npm run dev:proxy
```
