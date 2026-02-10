# docker/docker-entrypoint.sh
@source-hash: b085bb377cadfdf9
@generated: 2026-02-10T00:41:56Z

## Purpose
Docker container entrypoint script that orchestrates the startup of a development environment with debugging capabilities for an MCP (Model Context Protocol) server.

## Key Components

### Workspace Setup (L5-7)
Conditionally changes to `/workspace` directory if mounted as a volume, enabling development workflow with host filesystem integration.

### Debug Server (L10-11)
Launches Python debugpy server in background:
- **Host**: `0.0.0.0` (accepts external connections)
- **Port**: `5679` (standard debugpy port)
- **Mode**: `--no-wait` (non-blocking startup)
- **Location**: `tests/fixtures/python/debugpy_server.py`
- **PID tracking**: Stored in `$DBG_PID` for cleanup

### MCP Server (L14)
Starts the main Node.js application (`dist/index.js`) with debug logging enabled.

### Process Management (L17-18)
- **Trap handler**: Ensures graceful shutdown of debug server on SIGINT/SIGTERM
- **Wait**: Keeps script alive to maintain both processes

## Architecture Patterns
- **Multi-process orchestration**: Manages two concurrent services
- **Background + foreground**: debugpy runs detached, MCP server runs attached
- **Signal handling**: Proper cleanup on container termination
- **Development-friendly**: Supports volume mounting and remote debugging

## Dependencies
- Python 3 runtime with debugpy package
- Node.js runtime 
- Compiled JavaScript distribution at `dist/index.js`
- Debug server fixture at `tests/fixtures/python/debugpy_server.py`

## Critical Constraints
- Requires pre-built JavaScript distribution
- Assumes debugpy server fixture exists and is executable
- Port 5679 must be available for debug connections