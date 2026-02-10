# mcp_debugger_launcher/mcp_debugger_launcher/
@generated: 2026-02-10T21:26:19Z

## Module Purpose
The `mcp_debugger_launcher` package provides a unified command-line interface for launching debug-mcp-server instances across multiple runtime environments. It abstracts away the complexity of runtime detection, server configuration, and process management to deliver a seamless debugging experience for MCP (Model Context Protocol) applications.

## Architecture Overview

### Component Relationships
The module follows a layered architecture with clear separation of concerns:

1. **CLI Layer** (`cli.py`): User-facing Click-based command interface
2. **Detection Layer** (`detectors.py`): Runtime environment discovery and validation  
3. **Execution Layer** (`launcher.py`): Process lifecycle management and server launching
4. **Package Structure** (`__init__.py`): Standard Python package initialization

### Data Flow
```
User Command → CLI Parser → Runtime Detection → Server Launch → Process Management
```

The CLI orchestrates runtime detection to determine available environments (Node.js/npx vs Docker), then delegates to the appropriate launcher method while providing real-time feedback and graceful shutdown capabilities.

## Public API Surface

### Primary Entry Point
- **`main()`** (cli.py): Click command supporting:
  - Mode selection: `--stdio` (default) or `--sse [PORT]`
  - Runtime forcing: `--docker` or `--npm` flags
  - Diagnostics: `--status` for runtime availability
  - Dry run: `--dry-run` for command preview

### Key Configuration
- **Default SSE Port**: 3001 (configurable via CLI)
- **Supported Runtimes**: 
  - NPX: `@debugmcp/mcp-debugger` package
  - Docker: `debugmcp/mcp-debugger:latest` image

## Internal Organization

### Runtime Detection Strategy
The `RuntimeDetector` implements a comprehensive discovery process:
- **Node.js Ecosystem**: Validates Node.js, npx, and package availability with version checking
- **Docker Environment**: Checks installation, daemon status, and image availability
- **Recommendation Engine**: Prioritizes npx over Docker when both are available

### Process Management Patterns
The `DebugMCPLauncher` provides consistent process lifecycle management:
- **Signal Handling**: Graceful shutdown with SIGINT/SIGTERM handling
- **Resource Cleanup**: Guaranteed process termination with 5-second timeout
- **Output Streaming**: Real-time stdout/stderr forwarding
- **Error Isolation**: Runtime-specific error handling and user feedback

## Key Conventions

### Error Handling
- Exit code 1 for missing runtimes or invalid configurations
- Graceful degradation with helpful installation instructions
- Timeout protection on all external command executions

### Logging Strategy
- Verbose mode support across all components
- Error messages routed to stderr, status to stdout
- Structured diagnostic output for troubleshooting

### Runtime Selection Logic
1. Explicit user choice (--docker/--npm flags) takes precedence
2. Auto-detection prefers npx when Node.js ecosystem is complete
3. Falls back to Docker if daemon is available
4. Fails with helpful guidance if no runtimes are functional

## Integration Points
The module is designed for both standalone CLI usage and programmatic integration, with import fallbacks supporting both package installation and direct script execution scenarios. The clean separation between detection, launching, and CLI concerns enables flexible usage patterns while maintaining a consistent user experience.