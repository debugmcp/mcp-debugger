# mcp_debugger_launcher\mcp_debugger_launcher/
@generated: 2026-02-12T21:00:57Z

## Purpose
The `mcp_debugger_launcher` package provides a cross-platform launcher for the MCP (Model Context Protocol) debugging server with automatic runtime detection and management. It abstracts away the complexity of launching debug servers across different execution environments (Node.js/npm and Docker) while providing a unified CLI interface.

## Key Components and Relationships

### Core Architecture
The package follows a layered architecture with clear separation of concerns:

- **CLI Layer** (`cli.py`): User-facing Click-based command interface that orchestrates runtime selection and server launching
- **Detection Layer** (`detectors.py`): Runtime environment discovery and validation engine  
- **Execution Layer** (`launcher.py`): Actual server process management and lifecycle control
- **Package Marker** (`__init__.py`): Standard Python package initialization

### Component Interactions
1. **CLI** invokes **RuntimeDetector** to identify available execution environments
2. **CLI** instantiates **DebugMCPLauncher** based on user preferences or auto-detection
3. **DebugMCPLauncher** manages the actual server subprocess with graceful shutdown handling

## Public API Surface

### Main Entry Point
- `cli.main()`: Primary CLI command supporting stdio/SSE modes with runtime selection
  - `--docker` / `--npm`: Force specific runtime environment  
  - `--dry-run`: Preview commands without execution
  - `--verbose`: Enable detailed diagnostics
  - `--status`: Display runtime availability information

### Key Classes
- `DebugMCPLauncher`: Core launcher with methods for npx and Docker execution
  - `DEFAULT_SSE_PORT = 3001`: Default port for Server-Sent Events mode
  - `launch_with_npx()`: Node.js/npm-based server launching
  - `launch_with_docker()`: Docker-based server launching
- `RuntimeDetector`: Static utility class for environment detection
  - `detect_available_runtimes()`: Comprehensive runtime status analysis
  - `get_recommended_runtime()`: Intelligent runtime selection logic

## Internal Organization and Data Flow

### Runtime Selection Logic
1. User specifies runtime preference OR auto-detection is triggered
2. `RuntimeDetector` validates Node.js/Docker availability and ecosystem readiness
3. Priority order: npx (preferred) → Docker → error if neither available
4. Selected runtime launches debug server in requested mode (stdio/SSE)

### Process Management
- Unified subprocess lifecycle management across both runtimes
- Signal handler installation for graceful shutdown (SIGTERM with 5s timeout)
- Real-time output streaming maintaining server interactivity
- Defensive resource cleanup preventing process leaks

### Error Handling Strategy
- Runtime availability validation before launch attempts
- Environment-specific error detection (FileNotFoundError patterns)
- User-friendly installation guidance for missing dependencies
- Proper exit codes for scripting integration

## Important Patterns and Conventions

### Dual Runtime Support
The launcher maintains feature parity between npx and Docker execution paths:
- Consistent command-line argument handling
- Identical process management and cleanup patterns  
- Equivalent error handling and logging strategies

### Defensive Programming
- Comprehensive timeout handling for all subprocess operations
- Fallback detection strategies (Docker ping → ps fallback)
- Safe package/image checks only when base runtimes are available
- Guaranteed resource cleanup via finally blocks

### Version Compatibility
- Backward compatibility checks for Python debugpy package
- Flexible import patterns supporting both package and direct script execution
- Version string "0.11.1" maintained for package identification

The package serves as a robust, production-ready launcher that abstracts MCP debugging server deployment across heterogeneous development environments while providing excellent observability and error reporting.