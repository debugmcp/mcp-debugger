# mcp_debugger_launcher\mcp_debugger_launcher/
@children-hash: 3192bb02ab913890
@generated: 2026-02-15T09:01:25Z

## Overall Purpose
The `mcp_debugger_launcher` module is a comprehensive CLI tool and Python package that auto-detects and manages runtime environments to launch the MCP (Model Context Protocol) debugging server. It provides a unified interface for running the debug server in either stdio or SSE modes using the most appropriate available runtime (Node.js/npx or Docker).

## Key Components and Relationships

### Core Architecture
The module follows a clean separation of concerns across three main components:

1. **CLI Interface (`cli.py`)**: User-facing Click-based command-line interface that orchestrates the entire launch process
2. **Runtime Detection (`detectors.py`)**: Static utility class that discovers and validates available execution environments  
3. **Server Launcher (`launcher.py`)**: Core implementation that manages server process lifecycle with graceful shutdown

### Component Interactions
```
CLI Entry Point → Runtime Detection → Server Launcher
     ↓               ↓                    ↓
  User Commands → Environment Check → Process Management
```

The CLI coordinates between the detector and launcher, using detection results to select the optimal runtime and passing configuration to the launcher for execution.

## Public API Surface

### Primary Entry Points
- **Command Line**: `main()` function in `cli.py` serves as the primary entry point via Click CLI framework
- **Package Import**: Standard `__init__.py` enables package-level imports for programmatic usage

### CLI Interface
- **Modes**: `stdio` (default) and `sse` server modes
- **Runtime Selection**: `--docker` and `--npm` flags for explicit runtime choice, with intelligent auto-detection as default
- **Diagnostics**: Built-in runtime status reporting and installation guidance
- **Process Control**: Dry-run mode and graceful shutdown handling

### Key Configuration
- Default SSE port: 3001
- NPM package: "@debugmcp/mcp-debugger"  
- Docker image: "debugmcp/mcp-debugger:latest"
- Version: "0.11.1"

## Internal Organization and Data Flow

### Detection Phase
1. `RuntimeDetector` performs comprehensive environment scanning:
   - Node.js/npx availability and version checking
   - Docker installation and daemon status validation
   - Package/image accessibility verification

2. Returns structured runtime status with recommendation engine prioritizing npx over Docker

### Launch Phase  
1. `DebugMCPLauncher` provides unified process management:
   - Runtime-specific command construction
   - Signal handler setup for graceful termination
   - Real-time output streaming
   - Automatic resource cleanup

### Error Handling Strategy
- Defensive subprocess execution with timeouts
- Comprehensive error reporting for missing dependencies
- Graceful degradation with helpful installation guidance
- Exit code propagation for scripting integration

## Important Patterns and Conventions

### Design Patterns
- **Static Utility Classes**: `RuntimeDetector` uses static methods for stateless detection operations
- **Process Lifecycle Management**: Consistent subprocess handling with signal handlers and cleanup
- **Dual Import Strategy**: Supports both package imports and direct script execution
- **Command Builder Pattern**: Runtime-specific command construction with shared configuration

### Error Handling Conventions
- Try/except blocks with timeout protection for all external calls
- Structured error reporting with user-friendly messages
- Exit code standardization (1 for errors, 0 for success)
- Resource cleanup guaranteed via finally blocks

### Key Invariants
- Single active process per launcher instance
- 5-second termination timeout before force kill
- Consistent logging patterns across components
- Runtime detection performed before any launch attempts

The module serves as a robust, production-ready launcher that abstracts away the complexity of multi-runtime MCP server deployment while providing comprehensive diagnostics and error handling.