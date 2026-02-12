# mcp_debugger_launcher/mcp_debugger_launcher/
@generated: 2026-02-11T23:47:41Z

## Overall Purpose
The `mcp_debugger_launcher` package provides a comprehensive CLI tool for launching the MCP (Model Context Protocol) debugging server across different runtime environments. It automatically detects available execution contexts (Node.js/npx and Docker) and launches the debug server in either stdio or Server-Sent Events (SSE) modes with graceful process management and error handling.

## Key Components and Architecture

### Core Module Structure
- **`__init__.py`**: Standard package initialization enabling importable package structure
- **`cli.py`**: Primary CLI entry point with Click-based command interface
- **`detectors.py`**: Runtime environment detection and validation system
- **`launcher.py`**: Core process management and server launching implementation

### Component Relationships
The package follows a layered architecture:

1. **CLI Layer** (`cli.py`): User-facing interface handling command-line arguments, mode selection, and coordination
2. **Detection Layer** (`detectors.py`): Environment analysis providing runtime availability and recommendation logic
3. **Execution Layer** (`launcher.py`): Process lifecycle management with unified interface across runtime environments

**Data Flow**: CLI → RuntimeDetector (environment analysis) → DebugMCPLauncher (process execution) → MCP Debug Server

## Public API Surface

### Primary Entry Points
- **`main()` function in `cli.py`**: Core CLI command supporting:
  - Mode selection: `stdio` (default) or `sse`
  - Runtime control: `--docker`, `--npm` flags for explicit runtime selection
  - Diagnostics: `--status` for runtime availability reporting
  - Dry-run capabilities and installation help

### Key Classes
- **`RuntimeDetector`**: Static utility class for environment detection
  - `detect_available_runtimes()`: Comprehensive runtime status analysis
  - `get_recommended_runtime()`: Intelligent runtime selection logic
- **`DebugMCPLauncher`**: Process management with dual runtime support
  - `launch_with_npx()`: Node.js/npm-based execution
  - `launch_with_docker()`: Docker-based execution with auto-pull capabilities

## Internal Organization and Data Flow

### Runtime Detection Strategy
1. **Node.js Ecosystem**: Validates Node.js installation → npx availability → npm package accessibility
2. **Docker Ecosystem**: Checks Docker installation → daemon status → image availability
3. **Recommendation Engine**: Prioritizes npx over Docker based on availability and readiness

### Process Management Patterns
- **Unified Interface**: Both npx and Docker launchers implement identical process lifecycle management
- **Signal Handling**: Graceful shutdown with SIGTERM followed by 5-second timeout before SIGKILL
- **Resource Cleanup**: Defensive cleanup ensuring no process leaks
- **Real-time Output**: Live stdout/stderr streaming maintaining interactive debugging experience

## Important Patterns and Conventions

### Error Handling Strategy
- **Layered Validation**: Environment checks before process launching prevent runtime failures
- **Graceful Degradation**: Automatic runtime fallback when preferred option unavailable
- **User Guidance**: Installation help and status reporting for troubleshooting

### Configuration Management
- **Constants**: Centralized package/image references in `launcher.py`
- **Defaults**: Sensible fallbacks (stdio mode, port 3001 for SSE)
- **Runtime Selection**: Auto-detection with manual override capabilities

### Extensibility Points
- **Runtime Abstraction**: New execution environments can be added following the detector/launcher pattern
- **Mode Support**: Additional communication modes beyond stdio/SSE can be integrated
- **Package Configuration**: NPM package and Docker image references easily configurable

This package serves as a runtime-agnostic bridge enabling developers to debug MCP implementations regardless of their local development environment setup.