# mcp_debugger_launcher/
@children-hash: 2d0e98cd4a3e5d2d
@generated: 2026-02-15T09:01:43Z

## Overall Purpose and Responsibility

The `mcp_debugger_launcher` directory is a complete Python package providing intelligent runtime detection and management for launching the MCP (Model Context Protocol) debugging server. It serves as a unified CLI tool and library that abstracts the complexity of multi-runtime deployment by automatically selecting the optimal execution environment (Node.js/npx or Docker) and managing the complete server lifecycle.

## Key Components and System Architecture

The package follows a clean three-layer architecture with comprehensive testing:

### Core Package Structure
```
mcp_debugger_launcher/
├── __init__.py          # Package entry point and imports
├── cli.py               # Click-based CLI interface and orchestration
├── detectors.py         # Runtime environment detection utilities
├── launcher.py          # Server process lifecycle management
└── tests/               # Manual integration test suite
```

### Component Interactions and Data Flow
1. **CLI Layer** (`cli.py`) serves as the primary orchestrator, providing user-facing commands and coordinating between detection and launch components
2. **Detection Layer** (`detectors.py`) performs comprehensive environment scanning to identify available runtimes (Node.js, Docker) and their capabilities
3. **Launch Layer** (`launcher.py`) manages the actual server process execution with proper signal handling and resource cleanup
4. **Testing Layer** (`tests/`) provides manual integration validation for real-world deployment scenarios

The data flow follows: `User Input → Runtime Detection → Optimal Runtime Selection → Process Launch → Lifecycle Management`

## Public API Surface

### Primary Entry Points
- **CLI Command**: Main user interface accessible via command line with `stdio` and `sse` modes
- **Package Import**: Programmatic access through standard Python imports
- **Main Function**: `main()` in cli.py serves as the primary entry point

### Key CLI Interface
- **Server Modes**: `stdio` (default) and `sse` with configurable port (default: 3001)
- **Runtime Selection**: Automatic detection with manual override options (`--docker`, `--npm`)
- **Diagnostics**: Built-in status reporting and installation guidance
- **Process Control**: Dry-run capabilities and graceful shutdown handling

### Configuration Constants
- NPM package: "@debugmcp/mcp-debugger"
- Docker image: "debugmcp/mcp-debugger:latest"  
- Package version: "0.11.1"
- Default SSE port: 3001

## Internal Organization and System Design

### Runtime Detection Strategy
The `RuntimeDetector` uses a priority-based selection system:
1. **NPX Detection**: Checks Node.js availability, version compatibility, and package access
2. **Docker Detection**: Validates Docker daemon status and image availability
3. **Recommendation Engine**: Prioritizes npx over Docker for optimal performance

### Process Lifecycle Management
The `DebugMCPLauncher` implements robust process control:
- **Command Construction**: Runtime-specific command building with shared configuration
- **Signal Handling**: Graceful shutdown with 5-second timeout before force termination
- **Output Streaming**: Real-time process output forwarding
- **Resource Cleanup**: Guaranteed cleanup via try/finally blocks

### Testing Philosophy
The test suite employs **manual integration testing** focused on:
- Real system dependency validation
- Command generation verification without execution
- CLI packaging and distribution validation
- Human-readable output for complex scenarios

## Important Patterns and Conventions

### Design Patterns
- **Static Utility Pattern**: Stateless detection operations using static methods
- **Process Builder Pattern**: Runtime-specific command construction with unified interface
- **Lifecycle Management**: Consistent subprocess handling across all runtimes
- **Defensive Programming**: Comprehensive error handling with timeout protection

### Error Handling Strategy
- Graceful degradation with actionable error messages
- Timeout-protected external system calls
- Structured error reporting with installation guidance
- Exit code standardization for scripting integration

### Key System Invariants
- Single active process per launcher instance
- 5-second graceful termination timeout
- Runtime detection performed before launch attempts
- Consistent logging and output patterns

The `mcp_debugger_launcher` serves as a production-ready, intelligent launcher that eliminates the complexity of multi-runtime MCP server deployment while providing comprehensive diagnostics, robust error handling, and flexible deployment options for development and production environments.