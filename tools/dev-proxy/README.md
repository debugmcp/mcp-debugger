# Dev Proxy for mcp-debugger

A lightweight MCP proxy that sits between an MCP client and a source checkout of mcp-debugger,
allowing the backend to be rebuilt and restarted without disconnecting the client.

## Why?

When developing mcp-debugger, code changes require rebuilding and restarting the server. MCP
clients normally own the stdio server process, so replacing that process disconnects the active
session. The proxy keeps the client-facing stdio process stable while it replaces the backend.

The backend is a restartable Streamable HTTP child process by default. Legacy SSE and stdio
backends are also supported through `DEV_PROXY_BACKEND_TRANSPORT`.

## Architecture

```
MCP client  <--stdio--> dev-proxy.mjs (stable, never restarts)
                              |
                  Streamable HTTP (MCP protocol)
            (or legacy SSE / stdio, per DEV_PROXY_BACKEND_TRANSPORT)
                              |
                        mcp-debugger (http mode, restartable)
```

## Setup

### 1. Build the project first

```bash
pnpm build
```

### 2. Configure your MCP client with absolute paths

Use absolute paths for both the proxy script and `DEV_PROXY_ROOT`. This keeps the source checkout
unambiguous when a desktop or IDE client launches the server with a different working directory.

#### Codex CLI, desktop, and IDE

The Codex CLI writes the shared MCP configuration used by the ChatGPT desktop app, Codex CLI,
and Codex IDE extension on the same host:

```bash
codex mcp add mcp-debugger --env DEV_PROXY_ROOT=/absolute/path/to/mcp-debugger -- node /absolute/path/to/mcp-debugger/tools/dev-proxy/dev-proxy.mjs
codex mcp list
```

If you prefer to edit `~/.codex/config.toml` (or a trusted project's `.codex/config.toml`), add:

```toml
[mcp_servers.mcp-debugger]
command = "node"
args = ["/absolute/path/to/mcp-debugger/tools/dev-proxy/dev-proxy.mjs"]

[mcp_servers.mcp-debugger.env]
DEV_PROXY_ROOT = "/absolute/path/to/mcp-debugger"
```

You can also add the same stdio command and environment variable through **Settings → MCP
servers** in the desktop app or **gear menu → MCP servers** in the IDE extension. See the
[official Codex MCP documentation](https://developers.openai.com/codex/mcp).

#### Claude Code

```bash
claude mcp add-json mcp-debugger '{"type":"stdio","command":"node","args":["/absolute/path/to/mcp-debugger/tools/dev-proxy/dev-proxy.mjs"],"env":{"DEV_PROXY_ROOT":"/absolute/path/to/mcp-debugger"}}'
```

Quote paths according to your shell when the checkout path contains spaces.

### 3. Restart the MCP client once

Restart the active desktop client or IDE extension, or start a new CLI session. In Codex, use
`/mcp` to verify the live connection. After this one-time client restart, use
`dev_rebuild_and_restart` for source changes without replacing the stable proxy process.

## Dev Tools

Once connected, three additional tools are available:

| Tool | Description |
|------|-------------|
| `dev_restart_debugger` | Kill and restart the backend. Pass `rebuild: true` to build first, and optionally replace backend environment overrides with `env`. |
| `dev_rebuild_and_restart` | Run `npm run build` then restart the backend; also accepts replacement backend `env` overrides. |
| `dev_server_status` | Check backend state, PID, uptime, transport, project root, port, and display-safe environment overrides. |

All regular mcp-debugger tools (create_debug_session, set_breakpoint, etc.) are forwarded transparently to the backend.

## Configuration

Environment variables (all optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `DEV_PROXY_PORT` | `3001` | Port for the backend server (`http` and `sse` modes) |
| `DEV_PROXY_BUILD_CMD` | `npm run build` | Build command to run |
| `DEV_PROXY_ROOT` | Auto-detected | Project root directory |
| `DEV_PROXY_BACKEND_TRANSPORT` | `http` | Backend transport: `http` (default), `sse` (legacy/deprecated), or `stdio` |
| `DEV_PROXY_BACKEND_CMD` | Source CLI | Custom backend command, including `docker run ...` commands |
| `DEBUG_MCP_NO_REDACT` | unset | Set on the stable proxy process to `1` or `true` to disable status-value redaction |

### Backend environment overrides

Both restart tools accept an optional `env` object for diagnostic settings such as `DAP_TRACE=1`
or `DEBUG_MCP_LOG_LEVEL=debug`. Supplying `env` replaces the persistent override set, omitting it
preserves the current set, and passing `{}` clears it. Overrides are merged into every subsequent
backend spawn but are not passed to the build command. Proxy-controlled values required for clean
shutdown take precedence.

`dev_server_status` returns the active set as `backendEnvOverrides`. Display values are passed
through the shared sensitive-name and credential-shape redactors, with details in
`backendEnvRedaction`; the actual values passed to the backend are unchanged. If the shared package
has not been built yet, status fails closed and masks every override. To inspect raw values, start
the stable proxy itself with `DEBUG_MCP_NO_REDACT=1`; setting that variable only in the backend
override map does not disable supervisor-side status redaction.

For a custom `docker run` backend, the proxy injects a reserved ownership label and removes matching
containers during stop and restart. This gives stdio containers, which publish no port, the same
cleanup guarantee as HTTP and SSE backends.

## Workflow

1. Make code changes to mcp-debugger
2. Call `dev_rebuild_and_restart` (or `dev_restart_debugger` with `rebuild: true`), optionally with
   replacement diagnostic `env` overrides
3. Continue using debug tools — they now run the updated code

If the backend crashes:
1. Call `dev_server_status` to confirm it's stopped
2. Call `dev_restart_debugger` to bring it back

## Troubleshooting

- **Backend won't start**: Check that `npm run build` succeeds and port 3001 is free
- **Tools not showing up**: Run `codex mcp list` to verify the saved entry, then restart the active
  desktop client or IDE extension (or start a new CLI session) so it loads the new server.
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
