# mcp_debugger_launcher/mcp_debugger_launcher/
@generated: 2026-02-09T18:16:14Z

## Overall Purpose
The `mcp_debugger_launcher` package provides a comprehensive command-line tool for launching MCP (Model Context Protocol) debug servers with support for multiple runtime environments. It abstracts the complexity of deploying debug servers across Node.js/npm and Docker platforms, offering users a unified interface with automatic environment detection and intelligent runtime selection.

## Key Components and Architecture

### Core Components
- **`cli.py`** - Primary entry point providing Click-based command-line interface with comprehensive argument parsing, runtime status reporting, and user guidance
- **`launcher.py`** - Core execution engine implementing `DebugMCPLauncher` class for subprocess management and graceful shutdown handling
- **`detectors.py`** - Runtime environment detection via `RuntimeDetector` class, providing comprehensive availability checking for Node.js, npm, Docker, and associated packages/images
- **`__init__.py`** - Standard package marker enabling Python import functionality

### Component Integration
The components form a layered architecture:
1. **CLI Layer** (`cli.py`) handles user interaction and command parsing
2. **Detection Layer** (`detectors.py`) analyzes runtime availability 
3. **Execution Layer** (`launcher.py`) manages actual server launching
4. **Package Layer** (`__init__.py`) enables module imports

## Public API Surface

### Main Entry Point
- **`main()`** function in `cli.py` - Primary Click command supporting:
  - Server modes: `stdio` and `sse` (with optional port configuration)
  - Runtime selection: `--docker`, `--npm` flags or automatic detection
  - Utility options: `--dry-run`, `--verbose`, version display

### Key Classes
- **`DebugMCPLauncher`** - Core launcher with methods:
  - `launch_with_npx()` - npm/npx execution path
  - `launch_with_docker()` - Docker containerized execution
  - Built-in signal handling and graceful shutdown
- **`RuntimeDetector`** - Static detection utilities:
  - `detect_available_runtimes()` - Comprehensive environment analysis
  - `get_recommended_runtime()` - Intelligent runtime selection logic

## Internal Organization and Data Flow

### Execution Flow
1. CLI parses arguments and validates options compatibility
2. Runtime detection analyzes Node.js/Docker availability 
3. Smart runtime selection (forced via flags or auto-detected)
4. Command preparation with appropriate parameters
5. Launcher execution with real-time output streaming
6. Graceful shutdown handling with resource cleanup

### Data Structures
- Standardized runtime information dictionaries from detection layer
- Process management through subprocess.Popen instances
- Signal-safe shutdown with timeout-based cleanup patterns

## Key Patterns and Conventions

### Design Patterns
- **Runtime Abstraction** - Unified interface across npm and Docker deployment methods
- **Defensive Programming** - Comprehensive error handling with specific exception types and timeout protection
- **Fail-Fast Validation** - Early detection of conflicting options and missing dependencies
- **User Experience Focus** - Rich status reporting, installation guidance, and verbose logging

### Technical Conventions
- Hardcoded constants for package names (`@debugmcp/mcp-debugger`) and Docker images (`debugmcp/mcp-debugger:latest`)
- Consistent subprocess timeout patterns (5s for version checks, 10s for package validation)
- Real-time output streaming for launched processes
- Signal handler registration for graceful termination

## Dependencies and Environment
- **Click** framework for CLI functionality
- **Standard library** modules (subprocess, signal, shutil) for process and system operations
- **Runtime requirements**: Node.js/npm or Docker for actual server execution
- **Optional**: debugpy for Python debugging backward compatibility

This package serves as a developer tool that simplifies MCP server debugging by abstracting deployment complexity while maintaining flexibility across different runtime environments.