# debug-mcp-server-launcher

A Python launcher for the debug-mcp-server, providing step-through debugging capabilities for LLM agents.

## Overview

This launcher simplifies running the debug-mcp-server by:
- Auto-detecting available runtimes (Node.js/npm or Docker)
- Automatically launching the server with the appropriate runtime
- Handling process lifecycle and graceful shutdowns
- Providing clear error messages and installation guidance

## Installation

```bash
pip install debug-mcp-server-launcher
```

This will install the launcher and ensure `debugpy` (required for Python debugging) is available.

## Usage

### Basic Usage

The launcher takes a single positional `mode` argument: `stdio` (the default),
`http` (Streamable HTTP, recommended for remote use), or `sse` (deprecated).

```bash
# Launch in stdio mode (default, recommended)
debug-mcp-server

# Launch in Streamable HTTP mode
debug-mcp-server http

# HTTP mode with custom port
debug-mcp-server http --port 8080

# Launch in SSE mode (DEPRECATED - use http; prints a warning)
debug-mcp-server sse
```

`--port` affects `http` and `sse`; `stdio` ignores it (default port: 3001).

Any flag the launcher does not recognise is passed to the server as given, as long
as it comes after the mode:

```bash
# Accept the Host header a containerised client sends (server flag, forwarded)
debug-mcp-server http --allowed-host mcp-debugger

# Docker mode reachable from other machines: publish on every interface AND
# tell the server which Host to accept
debug-mcp-server http --docker --bind 0.0.0.0 --allowed-host myhost
```

`--bind ADDR` chooses the address the server is reachable on — with npx it is forwarded as the server's own `--bind` (default 127.0.0.1, debugmcp/mcp-debugger#680); with Docker it is the host address the port is published on;
the default is `127.0.0.1`, so a launched container is only reachable from the
machine that launched it unless you say otherwise. `MCP_HTTP_ALLOWED_HOSTS`, when
set in the launcher's environment, is forwarded into the container.

### Runtime Selection

The launcher automatically detects and uses the best available runtime:
1. **npm/npx** (preferred) - if Node.js is installed
2. **Docker** (fallback) - if Docker is installed and running

You can force a specific runtime:

```bash
# Force Docker mode
debug-mcp-server --docker

# Force npm mode  
debug-mcp-server --npm
```

### Other Options

```bash
# Show what command would be executed
debug-mcp-server --dry-run

# Enable verbose output
debug-mcp-server --verbose

# Show version
debug-mcp-server --version

# Show help
debug-mcp-server --help
```

## Requirements

### For npm/npx mode:
- Node.js 22+ installed
- The launcher will automatically download the server package via npx

### For Docker mode:
- Docker installed and running
- The launcher will automatically pull the image if needed
- For `stdio` the launcher runs
  `docker run -i --rm -v <cwd>:/workspace debugmcp/mcp-debugger:latest stdio`;
  for `http`/`sse` it also inserts `-p 127.0.0.1:<port>:<port>` (or `<bind>:<port>:<port>`
  with `--bind`) before the image, forwards `MCP_HTTP_ALLOWED_HOSTS` with `-e` when it is
  set, and appends `--port <port>` after the mode (the port defaults to 3001). Any
  unrecognised flags follow after that. The current working directory is mounted at
  `/workspace`, so files under it are debuggable inside the container - launch the tool
  from your project root.

### For Python debugging:
- `debugpy` is automatically installed with this package

## Transport Modes

- **stdio**: Standard input/output communication (default)
- **http**: Streamable HTTP transport (recommended for remote/HTTP-based use)
  - Default port: 3001; custom port via `--port`
  - The server only accepts loopback `Host` headers unless told otherwise; pass
    `--allowed-host <name>` (forwarded to the server) or export `MCP_HTTP_ALLOWED_HOSTS`
- **sse**: Server-Sent Events mode
  - > **Deprecated:** SSE transport is deprecated in the debug-mcp-server and will be removed in a future release; both the launcher and the server print a deprecation warning. Use `http` instead.

## Troubleshooting

If you encounter issues:

1. **"No suitable runtime found"**
   - Install Node.js from https://nodejs.org (recommended)
   - Or install Docker from https://docker.com

2. **"Docker daemon is not running"**
   - Start Docker Desktop
   - Or use npm mode: `debug-mcp-server --npm`

3. **"npx command not found"**
   - Ensure Node.js is properly installed
   - npx typically comes with npm (Node.js package manager)

## Development

This is a launcher package for the main debug-mcp-server project. For server development and contributions, see:
https://github.com/debugmcp/mcp-debugger

## License

MIT
