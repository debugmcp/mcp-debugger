# mcp_debugger_launcher/mcp_debugger_launcher/launcher.py
@source-hash: cc9c327f51e4ca14
@generated: 2026-02-10T00:41:50Z

## Primary Purpose
Core launcher implementation for the debug-mcp-server, providing unified interface to launch MCP debugging servers via either npx/Node.js or Docker runtime environments.

## Key Classes and Components

### DebugMCPLauncher (L11-152)
Main orchestrator class handling server process lifecycle management with graceful shutdown capabilities.

**Class Constants:**
- `NPM_PACKAGE` (L14): "@debugmcp/mcp-debugger" - npm package identifier
- `DOCKER_IMAGE` (L15): "debugmcp/mcp-debugger:latest" - Docker image reference  
- `DEFAULT_SSE_PORT` (L16): 3001 - fallback port for SSE mode

**Core State:**
- `verbose` (L19): Controls logging verbosity
- `process` (L20): Tracks active subprocess for cleanup

**Key Methods:**

#### log() (L22-26)
Conditional logging utility supporting error/verbose modes with appropriate stream routing.

#### launch_with_npx() (L28-71)
NPX-based launcher supporting stdio/sse modes with:
- Command construction with optional port configuration (L30-34)
- Signal handler setup for graceful shutdown (L38-40)
- Real-time output streaming (L52-55)
- Comprehensive error handling for missing Node.js/process failures (L61-66)

#### launch_with_docker() (L73-132)
Docker-based launcher with automatic image management:
- Port mapping for SSE mode (L77-79)
- Image availability checking and auto-pull (L93-102)
- Identical process management patterns to npx variant
- Docker-specific error handling (L122-127)

#### _signal_handler() (L134-141)
Graceful shutdown handler implementing termination with 5-second timeout before force kill.

#### _cleanup() (L143-152)
Resource cleanup ensuring process termination and handle release.

## Architecture Patterns

**Process Management**: Consistent subprocess lifecycle with signal handling across both launch methods
**Error Handling**: Runtime-specific error detection (FileNotFoundError for missing tools)
**Resource Cleanup**: Defensive cleanup in finally blocks preventing resource leaks
**Output Streaming**: Real-time stdout/stderr forwarding maintaining interactivity

## Dependencies
- `subprocess`: Process execution and management
- `signal`: Graceful shutdown handling  
- `sys`: Stream routing for logging
- Standard library utilities for typing and OS operations

## Critical Invariants
- Only one active process per launcher instance
- Signal handlers always configured before process start
- 5-second termination timeout before force kill
- Process cleanup guaranteed via finally blocks