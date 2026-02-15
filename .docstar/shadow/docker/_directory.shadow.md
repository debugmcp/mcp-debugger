# docker/
@children-hash: 8db56f822570183e
@generated: 2026-02-15T09:01:23Z

## Purpose
The `docker` directory provides containerization infrastructure for the MCP (Model Context Protocol) server, specifically designed to support development workflows with integrated debugging capabilities.

## Key Components

### docker-entrypoint.sh
Primary orchestration script that manages the startup sequence of a multi-service development environment within the Docker container. This entrypoint coordinates both the main MCP server process and a Python debugging server.

## Architecture & Data Flow

### Container Startup Process
1. **Environment Detection**: Checks for `/workspace` volume mount to enable development mode
2. **Debug Service Launch**: Starts Python debugpy server on port 5679 for remote debugging
3. **Main Service Launch**: Executes the compiled Node.js MCP server with debug logging
4. **Process Management**: Maintains both services with proper signal handling for graceful shutdown

### Development Integration
The container is specifically architected for development use cases:
- **Volume Mounting**: Supports host filesystem integration via `/workspace`
- **Remote Debugging**: External debugger connection through exposed port 5679
- **Hot Reload**: Volume mounting enables code changes without container rebuilds

## Public API Surface

### Container Entry Point
- **Primary**: `docker-entrypoint.sh` - Main container startup orchestrator
- **Debug Port**: `5679` - External debugger attachment point
- **Application Port**: Inherited from MCP server configuration

### Volume Mounts
- **Development**: `/workspace` - Optional development workspace mount
- **Dependencies**: Requires pre-built `dist/index.js` and debug fixtures

## Internal Organization

### Process Architecture
- **Multi-process**: Manages debugpy server (background) and MCP server (foreground)
- **Signal Handling**: SIGINT/SIGTERM trap ensures clean debug server termination
- **PID Tracking**: Maintains debug server process ID for lifecycle management

### Dependencies
- Node.js runtime for MCP server execution
- Python 3 with debugpy for debugging capabilities
- Pre-compiled JavaScript distribution
- Debug server fixtures in test infrastructure

## Important Patterns

### Development-First Design
The entire Docker setup prioritizes developer experience with debugging and hot-reload capabilities over production optimization.

### Service Orchestration
Uses shell scripting for lightweight process management rather than full orchestration frameworks, keeping the container simple and debuggable.

### Graceful Degradation
Container can function without volume mounts, falling back to standard application directory structure.