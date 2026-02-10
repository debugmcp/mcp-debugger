# docker/docker-entrypoint.sh
@source-hash: b085bb377cadfdf9
@generated: 2026-02-09T18:15:08Z

## Docker Entry Point Script

Shell script that serves as the Docker container entry point for an MCP (Model Context Protocol) server with debugging capabilities.

### Primary Purpose
Orchestrates startup of both an MCP server and a Python debugpy adapter, handling workspace mounting and graceful shutdown.

### Key Components

**Workspace Setup (L4-7)**
- Conditionally changes to `/workspace` directory if mounted
- Enables flexible workspace mounting for development containers

**Debug Server Launch (L9-11)**
- Spawns Python debugpy server in background using `debugpy_server.py`
- Configures remote debugging on `0.0.0.0:5679`
- Captures process ID for later cleanup
- Uses `--no-wait` flag to avoid blocking startup

**MCP Server Execution (L14)**
- Launches compiled JavaScript MCP server from `dist/index.js`
- Runs with debug-level logging enabled
- Primary application process (foreground)

**Signal Handling (L16-18)**
- Implements graceful shutdown via trap for INT/TERM signals
- Ensures debug server process cleanup on container termination
- Uses `wait` to maintain container lifecycle

### Dependencies
- Node.js runtime for MCP server
- Python3 for debugpy adapter
- Shell environment with signal handling support

### Architectural Notes
- Dual-process architecture: debug adapter + main application
- Background/foreground process coordination
- Container-aware workspace handling
- Clean shutdown semantics for Docker environments