# docker/
@generated: 2026-02-11T23:47:34Z

## Purpose
Docker containerization module for running MCP (Model Context Protocol) server in a development environment with integrated debugging capabilities. Provides a complete containerized development workflow with remote debugging support and filesystem integration.

## Key Components

### Container Orchestration
- **docker-entrypoint.sh**: Primary entrypoint script that manages multi-process container startup
- Coordinates between debugging infrastructure and main application service
- Handles development workspace mounting and process lifecycle management

### Development Environment Features
- **Remote Debugging**: Embedded Python debugpy server on port 5679 for external IDE integration
- **Workspace Integration**: Conditional `/workspace` mounting for live development with host filesystem
- **Multi-Process Management**: Concurrent operation of debug server and MCP application

## Public API Surface

### Container Entry Points
- **Main Entrypoint**: `docker-entrypoint.sh` - Primary container startup orchestrator
- **Debug Port**: `5679` - Standard debugpy remote debugging endpoint
- **Application Port**: Inherited from MCP server configuration

### Volume Mount Points
- **Workspace**: `/workspace` - Development directory for live code editing
- **Distribution**: Expects compiled JavaScript at `dist/index.js`

## Internal Organization

### Process Architecture
1. **Initialization**: Workspace detection and directory setup
2. **Debug Server Launch**: Background Python debugpy server startup
3. **Main Application**: Foreground Node.js MCP server execution
4. **Signal Handling**: Graceful shutdown coordination for both processes

### Dependencies Flow
- Requires pre-built JavaScript distribution bundle
- Depends on Python debugpy package and test fixtures
- Assumes Node.js runtime and MCP server dependencies

## Important Patterns

### Development Workflow Support
- **Live Development**: Volume mounting enables real-time code changes
- **Remote Debugging**: IDE integration through standardized debugpy protocol
- **Process Isolation**: Clean separation between debug infrastructure and application logic

### Container Best Practices
- **Signal Handling**: Proper SIGINT/SIGTERM cleanup
- **Non-blocking Startup**: Debug server runs in background to avoid blocking main application
- **PID Tracking**: Process management for reliable cleanup

This module transforms the MCP server into a development-ready containerized service with full debugging capabilities while maintaining production deployment compatibility.