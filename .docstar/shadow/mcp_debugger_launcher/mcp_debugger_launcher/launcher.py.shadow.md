# mcp_debugger_launcher/mcp_debugger_launcher/launcher.py
@source-hash: cc9c327f51e4ca14
@generated: 2026-02-09T18:15:01Z

This module implements the core launcher logic for debug-mcp-server, providing a unified interface to launch the MCP debugger server via either npx/npm or Docker.

## Core Class
**DebugMCPLauncher (L11-152)** - Main launcher class that manages subprocess execution and graceful shutdown handling.

### Key Constants (L14-16)
- `NPM_PACKAGE`: "@debugmcp/mcp-debugger" - Target npm package
- `DOCKER_IMAGE`: "debugmcp/mcp-debugger:latest" - Docker image reference  
- `DEFAULT_SSE_PORT`: 3001 - Default port for SSE mode

### Constructor (L18-20)
- `verbose`: Controls logging verbosity
- `process`: Tracks active subprocess.Popen instance

## Primary Launch Methods

**launch_with_npx() (L28-71)** - Launches server using npx command
- Supports "stdio" and "sse" modes with optional port specification
- Implements real-time stdout streaming (L53-55)
- Handles FileNotFoundError for missing Node.js installations
- Returns process exit code

**launch_with_docker() (L73-132)** - Launches server using Docker
- Auto-pulls missing Docker images (L93-102)
- Maps ports for SSE mode with -p flag (L77-79)
- Uses interactive terminal mode with --rm for cleanup
- Same streaming and error handling patterns as npx method

## Signal Handling & Cleanup

**_signal_handler() (L134-141)** - Graceful shutdown handler
- Terminates process on SIGINT/SIGTERM
- 5-second timeout before force kill
- Registered in both launch methods (L39-40, L90-91)

**_cleanup() (L143-152)** - Resource cleanup
- Ensures process termination in finally blocks
- Implements terminate → wait → kill pattern with timeout

## Architecture Patterns
- Unified interface for multiple deployment methods (npx/Docker)
- Consistent subprocess management with real-time output streaming
- Defensive error handling with specific exception types
- Signal-safe shutdown with resource cleanup guarantees

## Dependencies
- subprocess: Core process management
- signal: Graceful shutdown handling
- Standard library modules for OS operations

The launcher abstracts deployment complexity while maintaining consistent behavior across npx and Docker execution paths.