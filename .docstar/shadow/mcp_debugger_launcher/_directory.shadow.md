# mcp_debugger_launcher/
@generated: 2026-02-10T01:20:08Z

## Overall Purpose and Responsibility

The `mcp_debugger_launcher` directory contains a complete CLI tool and runtime orchestration system for launching the MCP (Model Context Protocol) debugging server. This module provides intelligent, cross-platform deployment capabilities with automatic runtime detection, environment management, and unified launching across multiple execution environments (Node.js/npm and Docker). It serves as a production-ready launcher that abstracts away the complexity of multi-runtime MCP server deployment while providing diagnostic capabilities and intelligent environment selection.

## Key Components and How They Relate

### Core Architecture Stack
The module is organized into distinct functional layers:

1. **CLI Layer** (`cli.py`): Click-based command-line interface serving as the primary user entry point
2. **Detection Layer** (`detectors.py`): Runtime environment discovery and validation system that probes for Node.js, npx, Docker availability
3. **Execution Layer** (`launcher.py`): Process lifecycle management and server launching with unified APIs for both NPX and Docker execution paths
4. **Testing Layer** (`tests/`): Manual integration test suite for validation and system capability assessment
5. **Package Structure** (`__init__.py`): Standard Python package initialization

### Component Interactions and Data Flow
- **CLI → Detector → Launcher**: The CLI uses `RuntimeDetector` to discover available environments, then delegates to `DebugMCPLauncher` for execution
- **Auto-Detection Flow**: CLI intelligently auto-selects optimal runtime (npx preferred over Docker) when no explicit choice is made
- **Unified Process Management**: Both npx and Docker execution paths share identical process lifecycle patterns and APIs through the launcher abstraction
- **Test Integration**: The test suite validates the entire pipeline from runtime detection through command generation and CLI accessibility

## Public API Surface and Main Entry Points

### Primary CLI Interface
- **`main()` function in `cli.py`**: Main CLI command supporting:
  - Mode selection: `stdio` (default) or `sse` 
  - Runtime forcing: `--docker`, `--npm` flags for explicit environment selection
  - Diagnostic modes: `--status`, `--dry-run` for system inspection
  - Verbose output: `--verbose` for detailed operation logging

### Core Detection and Launcher Classes
- **`RuntimeDetector`**: Static utility class for comprehensive environment detection
  - `detect_available_runtimes()`: Returns complete environment status assessment
  - `get_recommended_runtime()`: Provides intelligent runtime selection logic
- **`DebugMCPLauncher`**: Server process orchestrator with unified execution interface
  - `launch_with_npx()`: Node.js/npm execution path with package management
  - `launch_with_docker()`: Docker containerized execution path

### Testing and Validation
- **`test_launcher.py`**: Manual integration test framework
  - `main()` function: Complete test suite orchestration
  - Individual test functions for runtime detection, command generation, and CLI module validation

## Internal Organization and Data Flow

### Multi-Phase Execution Model
1. **Detection Phase**: Validates Node.js ecosystem (Node.js, npx, @debugmcp/mcp-debugger package) and Docker environment (installation, daemon, image availability)
2. **Selection Phase**: Applies intelligent runtime recommendation logic with user override capabilities
3. **Execution Phase**: Constructs runtime-specific commands, manages subprocess lifecycle, and provides real-time output streaming
4. **Cleanup Phase**: Ensures graceful shutdown with signal handling and resource cleanup

### Process Management Standards
- **Signal Handling**: Consistent SIGINT/SIGTERM handling across all execution paths
- **Timeout Management**: 5-second graceful shutdown timeout with force termination fallback
- **Output Streaming**: Real-time stdout/stderr forwarding maintaining full interactivity
- **Resource Safety**: Finally blocks ensure cleanup even during unexpected failures

## Important Patterns and Conventions

### Runtime Environment Abstraction
- **Unified Interface**: Both npx and Docker launchers expose identical APIs despite different underlying execution models
- **Defensive Programming**: Extensive error handling with specific detection for missing runtimes and helpful installation guidance
- **Graceful Degradation**: Auto-detection with fallback chains and informative error messages

### Configuration and Constants
- **NPM_PACKAGE**: "@debugmcp/mcp-debugger"
- **DOCKER_IMAGE**: "debugmcp/mcp-debugger:latest"
- **DEFAULT_SSE_PORT**: 3001
- **Package Version**: "0.11.1"

### Testing Philosophy
- **Manual Integration Approach**: Tests real system dependencies rather than mocked environments
- **Human-Readable Validation**: Uses console output and manual verification rather than automated assertions
- **Comprehensive Coverage**: Validates runtime detection, command generation, and module accessibility

This directory provides a production-ready, multi-runtime MCP debugging server launcher that intelligently adapts to available system capabilities while maintaining a simple, consistent user interface across different deployment environments.