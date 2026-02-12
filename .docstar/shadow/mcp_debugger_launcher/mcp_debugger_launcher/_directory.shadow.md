# mcp_debugger_launcher\mcp_debugger_launcher/
@generated: 2026-02-12T21:05:49Z

## Overall Purpose

The `mcp_debugger_launcher` package provides a command-line interface and runtime management system for launching the MCP (Model Context Protocol) debugging server across multiple execution environments. It auto-detects available runtimes (Node.js/npm and Docker) and provides a unified interface to launch debug-mcp-server in either stdio or SSE (Server-Sent Events) modes.

## Key Components and Architecture

### Core Component Relationships

The package follows a layered architecture with clear separation of concerns:

1. **CLI Layer** (`cli.py`): User-facing Click-based command interface that orchestrates the entire launch process
2. **Detection Layer** (`detectors.py`): Runtime environment discovery and validation system
3. **Execution Layer** (`launcher.py`): Process management and server launching implementation
4. **Package Structure** (`__init__.py`): Standard Python package initialization

### Data Flow

```
User CLI Command → Runtime Detection → Launcher Selection → Process Management
```

1. **CLI Entry**: `main()` function processes user arguments (mode selection, runtime preferences, debugging options)
2. **Runtime Detection**: `RuntimeDetector` scans system for Node.js/npx and Docker availability
3. **Launcher Orchestration**: `DebugMCPLauncher` executes the appropriate launch strategy based on detected/specified runtime
4. **Process Management**: Signal handling and graceful shutdown for launched debug server processes

## Public API Surface

### Main Entry Point
- **`mcp_debugger_launcher.cli.main()`**: Primary CLI command accepting:
  - Mode selection: `stdio` (default) or `sse`
  - Runtime forcing: `--docker`, `--npm` flags
  - Port configuration for SSE mode
  - Dry-run and verbose modes

### Key Classes
- **`DebugMCPLauncher`**: Core launcher with methods:
  - `launch_with_npx()`: Node.js/npx execution path
  - `launch_with_docker()`: Docker container execution path
  - Automatic cleanup and signal handling

- **`RuntimeDetector`**: Static detection utilities:
  - `detect_available_runtimes()`: Comprehensive runtime status
  - `get_recommended_runtime()`: Intelligent runtime selection
  - Individual component checkers for Node.js, Docker, packages, and images

## Internal Organization

### Runtime Priority Logic
The system implements a preference hierarchy:
1. **NPX Path**: Preferred when Node.js and npx are available with the `@debugmcp/mcp-debugger` package
2. **Docker Path**: Fallback when Docker daemon is running with `debugmcp/mcp-debugger:latest` image
3. **Error Handling**: User-friendly guidance for missing runtime dependencies

### Process Management Patterns
- **Consistent Lifecycle**: Both npx and Docker launchers follow identical process management patterns
- **Graceful Shutdown**: Signal handlers with 5-second timeout before force termination
- **Resource Cleanup**: Defensive cleanup in finally blocks preventing resource leaks
- **Real-time Output**: Live stdout/stderr streaming maintaining user interactivity

### Error Handling Strategy
- **Detection Phase**: Comprehensive environment validation with detailed status reporting
- **Execution Phase**: Runtime-specific error detection and user guidance
- **Process Phase**: Timeout handling and graceful degradation

## Key Constants and Configuration
- **NPM Package**: `@debugmcp/mcp-debugger`
- **Docker Image**: `debugmcp/mcp-debugger:latest` 
- **Default SSE Port**: 3001
- **Package Version**: 0.11.1

## Integration Patterns

The package is designed for:
- **Standalone CLI usage**: Direct command-line invocation for development workflows
- **IDE Integration**: Support for development environment integration via programmatic API
- **CI/CD Integration**: Docker-based execution for containerized development environments
- **Cross-platform compatibility**: Runtime detection handles Windows, macOS, and Linux environments

The architecture prioritizes reliability through comprehensive runtime detection, graceful error handling, and consistent process management across different execution environments.