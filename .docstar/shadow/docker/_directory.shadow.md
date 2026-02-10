# docker/
@generated: 2026-02-10T01:19:36Z

## Purpose
This directory contains Docker containerization assets for the MCP (Model Context Protocol) server, providing a complete development environment with integrated debugging capabilities. The primary goal is to enable seamless development workflows through containerized deployment with remote debugging support.

## Key Components

### Container Orchestration
- **docker-entrypoint.sh**: Main entry point script that coordinates the startup of multiple services within the container
- Manages both the primary MCP server and auxiliary debugging infrastructure
- Handles graceful shutdown and cleanup of all processes

### Multi-Service Architecture
The container runs two concurrent services:
1. **MCP Server**: The main Node.js application (from `dist/index.js`) running with debug logging
2. **Debug Server**: Python debugpy server enabling remote debugging on port 5679

### Development Integration
- **Volume mounting**: Supports `/workspace` directory mounting for live development
- **Remote debugging**: Exposes debugpy server on `0.0.0.0:5679` for external IDE connections
- **Signal handling**: Proper SIGINT/SIGTERM handling for clean container shutdown

## Public API Surface

### Container Entry Point
- **Primary command**: Executes `docker-entrypoint.sh` to start the complete development stack
- **Port exposure**: Port 5679 for debugpy connections (container-dependent port mapping)
- **Volume mount**: Optional `/workspace` mount point for development files

### Debugging Interface
- **Debug protocol**: Standard debugpy remote debugging protocol
- **Connection endpoint**: Host-accessible port 5679 when properly mapped
- **Target application**: Node.js MCP server with debug logging enabled

## Internal Organization

### Startup Flow
1. Environment detection (workspace volume mounting)
2. Background debugpy server launch with PID tracking
3. Foreground MCP server startup with debug configuration
4. Signal trap installation for graceful shutdown

### Process Management
- **Background services**: debugpy server runs detached with PID tracking
- **Foreground service**: MCP server runs attached to main process
- **Cleanup coordination**: Trapped signals ensure all processes terminate cleanly

## Important Patterns

### Development-First Design
- Prioritizes developer experience with integrated debugging
- Supports both containerized execution and host filesystem integration
- Enables hot-reload workflows through volume mounting

### Container Best Practices
- Single responsibility with clear entry point
- Graceful shutdown handling
- Process lifecycle management
- External service integration (debugging)

## Dependencies
- Node.js runtime with pre-built distribution at `dist/index.js`
- Python 3 runtime with debugpy package
- Debug server fixture at `tests/fixtures/python/debugpy_server.py`
- Container orchestration system (Docker/Podman)

This directory encapsulates the complete containerization strategy for the MCP server, focusing on development productivity while maintaining production deployment capabilities.