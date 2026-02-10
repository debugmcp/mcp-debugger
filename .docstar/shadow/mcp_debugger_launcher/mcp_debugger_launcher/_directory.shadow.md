# mcp_debugger_launcher/mcp_debugger_launcher/
@generated: 2026-02-10T01:19:45Z

## Overall Purpose and Responsibility

The `mcp_debugger_launcher` module is a complete CLI tool and runtime orchestration system for launching the MCP (Model Context Protocol) debugging server. It provides automatic runtime detection, environment management, and unified launching capabilities across multiple execution environments (Node.js/npm and Docker).

## Key Components and Relationships

### Core Architecture Stack
1. **CLI Layer** (`cli.py`): Click-based command-line interface serving as the primary user entry point
2. **Detection Layer** (`detectors.py`): Runtime environment discovery and validation system
3. **Execution Layer** (`launcher.py`): Process lifecycle management and server launching
4. **Package Structure** (`__init__.py`): Standard Python package initialization

### Component Interactions
- **CLI → Detector → Launcher**: The CLI uses `RuntimeDetector` to discover available environments, then delegates to `DebugMCPLauncher` for execution
- **Auto-Detection Flow**: CLI auto-selects optimal runtime (npx preferred over Docker) when no explicit choice is made
- **Unified Process Management**: Both npx and Docker execution paths share identical process lifecycle patterns through the launcher

## Public API Surface

### Primary Entry Points
- **`main()` function in `cli.py`**: Main CLI command supporting:
  - Mode selection: `stdio` (default) or `sse`
  - Runtime forcing: `--docker`, `--npm` flags
  - Diagnostic modes: `--status`, `--dry-run`
  - Verbose output: `--verbose`

### Key Classes
- **`RuntimeDetector`**: Static utility class for environment detection
  - `detect_available_runtimes()`: Comprehensive environment status
  - `get_recommended_runtime()`: Intelligent runtime selection
- **`DebugMCPLauncher`**: Server process orchestrator
  - `launch_with_npx()`: Node.js/npm execution path
  - `launch_with_docker()`: Docker execution path

## Internal Organization and Data Flow

### Detection Phase
1. **Node.js Ecosystem Check**: Validates Node.js, npx, and @debugmcp/mcp-debugger package availability
2. **Docker Environment Check**: Verifies Docker installation, daemon status, and debugmcp/mcp-debugger:latest image
3. **Runtime Recommendation**: Prioritizes npx over Docker based on availability and functionality

### Execution Phase
1. **Command Construction**: Builds runtime-specific command arrays with mode and port configuration
2. **Process Lifecycle**: Manages subprocess execution with signal handling for graceful shutdown
3. **Output Streaming**: Provides real-time stdout/stderr forwarding maintaining interactivity
4. **Resource Cleanup**: Ensures proper process termination and handle release

## Important Patterns and Conventions

### Runtime Environment Abstraction
- **Unified Interface**: Both npx and Docker launchers expose identical APIs despite different underlying execution models
- **Defensive Programming**: Extensive error handling with specific detection for missing runtimes
- **Graceful Degradation**: Auto-detection with fallback chains and helpful error messages

### Process Management Standards
- **Signal Handling**: Consistent SIGINT/SIGTERM handling across execution paths
- **Timeout Management**: 5-second graceful shutdown timeout before force termination
- **Resource Safety**: Finally blocks ensure cleanup even on unexpected failures

### Configuration Constants
- **NPM_PACKAGE**: "@debugmcp/mcp-debugger"
- **DOCKER_IMAGE**: "debugmcp/mcp-debugger:latest"  
- **DEFAULT_SSE_PORT**: 3001
- **Version**: "0.11.1"

### Error Handling Philosophy
- **Runtime Validation**: Pre-flight checks prevent execution with missing dependencies
- **User-Friendly Messages**: Clear installation instructions for missing runtimes
- **Exit Code Semantics**: Returns 1 for errors, 0 for success, enabling shell integration

This module serves as a comprehensive launcher ecosystem that abstracts away the complexity of multi-runtime MCP server deployment while providing diagnostic capabilities and intelligent environment selection.