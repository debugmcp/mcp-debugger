# docker/
@generated: 2026-02-12T21:05:40Z

## Purpose
The `docker` directory provides containerization infrastructure for running an MCP (Model Context Protocol) server in a development environment with integrated debugging capabilities.

## Key Components

### docker-entrypoint.sh
The primary orchestration script that serves as the Docker container's entry point, managing:
- **Development workspace setup** with conditional volume mounting
- **Multi-process service coordination** between debug server and MCP server
- **Remote debugging infrastructure** via Python debugpy server
- **Graceful shutdown handling** with proper process cleanup

## Architecture & Data Flow

The directory implements a **development-oriented containerization pattern**:

1. **Container Bootstrap**: Entrypoint script initializes workspace environment
2. **Debug Service Launch**: Python debugpy server starts on port 5679 for remote debugging
3. **Main Service Start**: Node.js MCP server launches with debug logging
4. **Process Orchestration**: Script maintains both services until termination signal

## Public API Surface

### Container Interface
- **Entry Point**: `docker-entrypoint.sh` (main container command)
- **Debug Port**: `5679` (external debugpy connection point)
- **Volume Mount**: `/workspace` (development filesystem integration)
- **Signal Handling**: SIGINT/SIGTERM for graceful shutdown

### Runtime Dependencies
- Pre-built JavaScript distribution at `dist/index.js`
- Python debugpy package and runtime
- Node.js runtime environment
- Debug server fixture at `tests/fixtures/python/debugpy_server.py`

## Internal Organization

The directory follows Docker best practices with a **single-responsibility entrypoint**:
- **Process Management**: Background debug server + foreground main application
- **Development Support**: Volume mounting, remote debugging, live development workflow
- **Production Readiness**: Signal handling, proper cleanup, multi-service coordination

## Key Patterns

- **Multi-process orchestration** for concurrent debug and application services
- **Development-production bridge** supporting both local development and containerized deployment  
- **Signal-based lifecycle management** ensuring clean resource cleanup
- **Port-based service discovery** with standardized debug port allocation

This directory enables seamless transition between local development and containerized deployment while maintaining full debugging capabilities.