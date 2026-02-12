# mcp_debugger_launcher/
@generated: 2026-02-12T21:06:11Z

## Overall Purpose and Responsibility

The `mcp_debugger_launcher` directory contains a complete Python package that provides a unified command-line interface and runtime management system for launching the MCP (Model Context Protocol) debugging server. The package automatically detects available execution environments (Node.js/npm and Docker) and provides seamless launching capabilities across different platforms and runtime configurations.

## Key Components and Integration

### Core Architecture
The package implements a layered architecture with clear separation of concerns:

**CLI Layer (`cli.py`)**: User-facing Click-based command interface that serves as the primary entry point, handling argument parsing and orchestrating the entire launch process.

**Detection Layer (`detectors.py`)**: Runtime environment discovery system that scans for Node.js/npx and Docker availability, providing intelligent runtime selection.

**Execution Layer (`launcher.py`)**: Process management and server launching implementation that handles both NPX and Docker execution paths with consistent lifecycle management.

**Testing Infrastructure (`tests/`)**: Manual integration test suite that validates runtime detection, command generation, and CLI integration without automated assertions, enabling real-world system validation.

### Component Relationships and Data Flow

```
CLI Entry → Runtime Detection → Launcher Selection → Process Management
     ↓              ↓                ↓                    ↓
User Input → System Scanning → Runtime Choice → Debug Server Launch
```

1. **CLI Processing**: Main entry point processes user arguments for mode selection (stdio/SSE), runtime preferences, and debugging options
2. **Runtime Detection**: `RuntimeDetector` performs comprehensive system scanning for available runtimes with fallback logic
3. **Launch Orchestration**: `DebugMCPLauncher` selects and executes appropriate launch strategy based on detected capabilities
4. **Process Management**: Handles signal processing, graceful shutdown, and resource cleanup for launched debug server processes

## Public API Surface

### Primary Entry Points

**Command Line Interface**: 
- `mcp_debugger_launcher.cli.main()` - Main CLI command supporting:
  - Mode selection: `stdio` (default) or `sse` 
  - Runtime forcing: `--docker`, `--npm` flags
  - Port configuration for SSE mode (default: 3001)
  - Dry-run and verbose execution modes

**Programmatic API**:
- `DebugMCPLauncher` - Core launcher class with runtime-specific methods:
  - `launch_with_npx()` - Node.js/npx execution path
  - `launch_with_docker()` - Docker container execution path
- `RuntimeDetector` - Static detection utilities:
  - `detect_available_runtimes()` - Comprehensive runtime status
  - `get_recommended_runtime()` - Intelligent runtime selection

### Integration Points
- **Package References**: `@debugmcp/mcp-debugger` (NPM), `debugmcp/mcp-debugger:latest` (Docker)
- **Standard Python Package**: Proper `__init__.py` structure for importable module usage

## Internal Organization and Patterns

### Runtime Priority Logic
The system implements intelligent runtime selection with fallback hierarchy:
1. **NPX Preferred**: When Node.js, npx, and the required NPM package are available
2. **Docker Fallback**: When Docker daemon is running with the required image
3. **Error Guidance**: Comprehensive user feedback for missing dependencies

### Process Management Consistency
- **Unified Lifecycle**: Both NPX and Docker launchers follow identical process management patterns
- **Graceful Shutdown**: Signal handlers with timeout mechanisms and force termination fallbacks
- **Resource Cleanup**: Defensive cleanup patterns preventing resource leaks
- **Real-time Streaming**: Live output forwarding maintaining user interactivity

### Testing and Validation
- **Manual Integration Testing**: Real-world system validation without mocking
- **Dry-run Capabilities**: Command generation testing without execution side effects
- **Graceful Degradation**: Continues testing even when individual components fail
- **Actionable Reporting**: Provides clear next-step guidance for manual validation

## Key Conventions and Configuration

### Constants and Standards
- **NPM Package**: `@debugmcp/mcp-debugger`
- **Docker Image**: `debugmcp/mcp-debugger:latest`
- **Default SSE Port**: 3001
- **Package Version**: 0.11.1

### Error Handling Strategy
- **Detection Phase**: Comprehensive environment validation with detailed status reporting
- **Execution Phase**: Runtime-specific error detection with user guidance
- **Process Phase**: Timeout handling and graceful degradation patterns

## Usage Context and Integration Scenarios

The package supports multiple integration patterns:
- **Standalone CLI**: Direct command-line invocation for development workflows
- **IDE Integration**: Programmatic API for development environment integration
- **CI/CD Integration**: Docker-based execution for containerized environments
- **Cross-platform Compatibility**: Handles Windows, macOS, and Linux runtime differences

The architecture prioritizes reliability through comprehensive runtime detection, consistent process management, and graceful error handling across different execution environments, making it suitable for both development and production debugging scenarios.