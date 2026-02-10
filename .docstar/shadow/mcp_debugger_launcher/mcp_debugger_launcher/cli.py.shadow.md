# mcp_debugger_launcher/mcp_debugger_launcher/cli.py
@source-hash: 176a43208f2894d3
@generated: 2026-02-09T18:14:59Z

## Primary Purpose
CLI entry point for the debug-mcp-server launcher that provides a user-friendly command-line interface for launching MCP debug servers using either Node.js/npm or Docker runtimes.

## Key Components

### Main CLI Command (L74-94)
- **`main()`** - Primary Click command handler with comprehensive argument/option parsing
- Supports `stdio` and `sse` modes with optional port configuration
- Provides `--docker`, `--npm`, `--dry-run`, and `--verbose` flags
- Includes version information and help system

### Runtime Status Functions (L19-51, L53-62)
- **`print_runtime_status()`** (L19-51) - Displays availability status of Node.js and Docker runtimes with detailed verbose output including package/image availability
- **`print_installation_help()`** (L53-62) - Provides user-friendly installation guidance for missing dependencies

### Compatibility Checking (L64-72)
- **`check_debugpy()`** (L64-72) - Validates debugpy installation for Python debugging backward compatibility

### Core Execution Logic (L95-199)
- Runtime detection using `RuntimeDetector.detect_available_runtimes()` (L114)
- Smart runtime selection: forced via flags or auto-detection via `get_recommended_runtime()` (L143)
- Command preparation and execution delegation to `DebugMCPLauncher`
- Dry-run capability showing exact commands that would be executed (L163-168, L182-191)

## Dependencies
- **Click** - Command-line interface framework
- **launcher.DebugMCPLauncher** - Core launcher functionality
- **detectors.RuntimeDetector** - Runtime availability detection
- Flexible import system supporting both package and direct execution (L8-14)

## Key Constants
- **`__version__`** (L17) - Package version "0.11.1"
- **Default SSE port** - Retrieved from `DebugMCPLauncher.DEFAULT_SSE_PORT`

## Architecture Patterns
- **Separation of concerns** - CLI logic separated from launcher implementation
- **Runtime abstraction** - Supports multiple execution environments transparently  
- **User experience focus** - Comprehensive error messages, status reporting, and help text
- **Fail-fast validation** - Early detection of conflicting options and missing dependencies