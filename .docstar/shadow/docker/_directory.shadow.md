# docker/
@generated: 2026-02-10T21:26:14Z

## Purpose
The `docker` directory contains containerization infrastructure for deploying and developing an MCP (Model Context Protocol) server in a Docker environment. It provides a development-oriented container setup with integrated debugging capabilities and flexible workspace management.

## Key Components

### Container Orchestration
- **docker-entrypoint.sh**: Main entrypoint script that coordinates the startup of multiple services within a single container
- Manages both the primary MCP server and auxiliary development tools

### Multi-Service Architecture
The directory implements a dual-service container pattern:
1. **Debug Service**: Python debugpy server for remote debugging capabilities
2. **Main Service**: Node.js MCP server application

### Development Integration
- **Volume Mount Support**: Conditional workspace detection for host filesystem integration
- **Remote Debugging**: Exposes debugpy on port 5679 for IDE integration
- **Debug Logging**: Enables verbose logging for development workflows

## Public API Surface

### Container Entry Points
- **Primary entrypoint**: `docker-entrypoint.sh` - main container startup script
- **Debug endpoint**: Port 5679 exposed for remote debugging connections
- **MCP server**: Runs compiled JavaScript application from `dist/index.js`

### Runtime Requirements
- Pre-built JavaScript distribution at `dist/index.js`
- Python debugpy server fixture at `tests/fixtures/python/debugpy_server.py`
- Node.js and Python 3 runtimes available

## Internal Organization

### Process Management
- **Parallel execution**: Debug server runs in background, MCP server in foreground
- **Signal handling**: Graceful shutdown coordination via SIGINT/SIGTERM traps
- **PID tracking**: Maintains process references for proper cleanup

### Data Flow
1. Container startup → entrypoint script execution
2. Workspace detection and directory change (if volume mounted)
3. Background debug server launch
4. Foreground MCP server startup with debug logging
5. Signal-based coordinated shutdown

## Important Patterns

### Development-First Design
- Prioritizes debugging and development workflows over production optimization
- Supports both local development (volume mounts) and debugging (remote debugpy)
- Maintains development tooling alongside production services

### Container Orchestration
- Single-container, multi-process pattern for simplified development deployment
- Proper process lifecycle management with cleanup on termination
- Flexible workspace handling for different deployment scenarios