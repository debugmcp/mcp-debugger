# mcp_debugger_launcher/
@generated: 2026-02-11T23:48:01Z

## Overall Purpose

The `mcp_debugger_launcher` directory contains a complete CLI package that provides runtime-agnostic launching capabilities for the MCP (Model Context Protocol) debugging server. This module serves as a bridge between different development environments, automatically detecting and utilizing available execution contexts (Node.js/npx and Docker) to launch debug servers in either stdio or Server-Sent Events (SSE) modes with robust process management.

## Key Components and Integration

The directory is organized into two main components that work together to provide a reliable debugging launch experience:

### Core Package (`mcp_debugger_launcher/`)
- **CLI Interface** (`cli.py`): Primary user entry point providing Click-based command interface
- **Runtime Detection** (`detectors.py`): Environment analysis system that validates Node.js, npx, and Docker availability
- **Process Management** (`launcher.py`): Unified execution layer handling both npm and Docker-based server launches
- **Package Structure** (`__init__.py`): Standard Python package initialization

### Test Suite (`tests/`)
- **Manual Integration Tests** (`test_launcher.py`): Comprehensive validation framework for runtime detection, command generation, and CLI functionality
- **Real-world Testing**: Integration tests against actual system dependencies rather than mocked components

## Component Interaction Flow

1. **CLI Entry**: User invokes CLI with mode selection (stdio/SSE) and optional runtime preferences
2. **Environment Analysis**: `RuntimeDetector` performs comprehensive system analysis and provides runtime recommendations
3. **Process Execution**: `DebugMCPLauncher` handles process lifecycle management with unified interface across runtime environments
4. **Graceful Management**: Signal handling and resource cleanup ensure clean process termination

## Public API Surface

### Primary Entry Points
- **`main()` in `cli.py`**: Core CLI command supporting:
  - Mode selection: `stdio` (default) or `sse` 
  - Runtime control: `--docker`, `--npm` flags for explicit selection
  - Diagnostics: `--status` for environment reporting
  - Installation guidance and dry-run capabilities

### Key Classes
- **`RuntimeDetector`**: Static utility for environment detection and runtime recommendation
- **`DebugMCPLauncher`**: Process manager with dual runtime support (npx and Docker execution)

### Testing Interface
- **`test_launcher.py`**: Manual test framework for validation and diagnostics
- Provides real-world integration testing with console-based verification

## Internal Architecture

### Runtime Detection Strategy
The package implements intelligent runtime selection with fallback capabilities:
- Node.js ecosystem validation (Node.js → npx → npm package access)
- Docker ecosystem validation (Docker installation → daemon status → image availability)  
- Recommendation engine prioritizing npx over Docker based on readiness

### Process Management Patterns
- **Unified Interface**: Consistent process lifecycle across runtime environments
- **Signal Handling**: SIGTERM with 5-second timeout before SIGKILL
- **Live Output Streaming**: Real-time stdout/stderr for interactive debugging
- **Defensive Cleanup**: Resource management preventing process leaks

## Important Design Patterns

### Error Handling and Resilience
- Layered validation preventing runtime failures
- Automatic fallback between available runtimes
- User-friendly error messages with installation guidance

### Extensibility Architecture
- Runtime abstraction pattern supporting additional execution environments
- Mode-agnostic design allowing new communication protocols beyond stdio/SSE
- Configurable package/image references for different deployment scenarios

### Testing Strategy
- Manual verification approach with human-readable diagnostics
- Real system integration testing over mocked dependencies
- Dry-run capabilities for safe command validation

This directory provides a complete, production-ready solution for launching MCP debugging servers across diverse development environments, with comprehensive testing and robust error handling to ensure reliable operation regardless of the underlying system configuration.