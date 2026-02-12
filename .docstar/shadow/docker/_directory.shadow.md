# docker/
@generated: 2026-02-12T21:00:51Z

## Purpose
The `docker` directory contains containerization infrastructure for running an MCP (Model Context Protocol) server in a development environment with integrated debugging capabilities. It provides a Docker-based development workflow that supports both production deployment and developer debugging scenarios.

## Key Components

### Container Entrypoint (`docker-entrypoint.sh`)
The primary orchestration script that manages the startup sequence of a multi-service development environment:
- **Development Workspace Setup**: Conditionally configures `/workspace` volume mounting for host filesystem integration
- **Debug Server Management**: Launches Python debugpy server for remote debugging capabilities
- **MCP Server Execution**: Starts the main Node.js MCP server application
- **Process Lifecycle**: Handles graceful shutdown and cleanup of all services

## Architecture & Data Flow

### Multi-Service Orchestration
The container runs two concurrent services:
1. **Background Debug Service**: Python debugpy server listening on port 5679 for IDE connections
2. **Foreground MCP Service**: Node.js server running the compiled MCP application

### Development Integration Points
- **Volume Mounting**: Supports `/workspace` directory for live code editing
- **Remote Debugging**: Exposes debug interface for IDE attachment
- **Signal Handling**: Proper cleanup on container termination
- **Logging**: Debug-enabled MCP server output

## Public API Surface

### Container Interface
- **Entry Point**: `docker-entrypoint.sh` as the primary container command
- **Debug Port**: 5679 exposed for remote debugging connections
- **Volume Mount**: `/workspace` for development file access
- **Signal Handling**: SIGINT/SIGTERM for graceful shutdown

### Dependencies & Prerequisites
- Pre-compiled JavaScript distribution at `dist/index.js`
- Python debugpy package installation
- Node.js runtime environment
- Debug server fixture at `tests/fixtures/python/debugpy_server.py`

## Internal Organization

### Process Management Pattern
- **Background Process**: debugpy server runs detached with PID tracking
- **Foreground Process**: MCP server runs attached for container lifecycle
- **Cleanup Handler**: Trap-based cleanup ensures proper resource deallocation

### Development Workflow Support
The directory enables a containerized development environment where developers can:
- Mount local code via volumes for live editing
- Attach debuggers remotely via the exposed debug port
- Run the full MCP server stack in an isolated environment
- Maintain proper process lifecycle management

This infrastructure bridges production containerization with development debugging needs, providing a unified Docker-based workflow for MCP server development and deployment.