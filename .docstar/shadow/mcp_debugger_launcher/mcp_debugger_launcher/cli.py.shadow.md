# mcp_debugger_launcher/mcp_debugger_launcher/cli.py
@source-hash: 176a43208f2894d3
@generated: 2026-02-10T00:41:45Z

**Primary Purpose**: CLI entry point for debug-mcp-server launcher that auto-detects and manages Node.js/npm and Docker runtime environments to launch the MCP debugging server in stdio or SSE modes.

## Key Components

### Main CLI Function
- `main()` (L82-199): Core Click-based command that handles mode selection (stdio/sse), runtime detection, and server launching
  - Supports `--docker`, `--npm` flags for runtime forcing
  - Auto-detects available runtimes when no explicit choice made
  - Validates runtime availability before launching
  - Returns exit codes for error handling

### Runtime Status & Diagnostics
- `print_runtime_status()` (L19-51): Displays availability and version info for Node.js and Docker runtimes
  - Shows npx availability and package installation status
  - Indicates Docker daemon status and image availability
  - Provides verbose mode with detailed diagnostics

### Helper Functions
- `print_installation_help()` (L53-62): Prints user-friendly installation instructions for missing runtimes
- `check_debugpy()` (L64-72): Backward compatibility check for Python debugpy package installation

### Import Strategy
- Dual import pattern (L9-14): Handles both package import and direct script execution scenarios
- Falls back to relative imports if package imports fail

## Dependencies & Architecture

**External**: Click for CLI framework, sys/os for system operations
**Internal**: `.launcher.DebugMCPLauncher` for actual server launching, `.detectors.RuntimeDetector` for runtime detection

## Critical Behavior Patterns

1. **Runtime Selection Logic**: Auto-detection prioritizes available runtimes via `RuntimeDetector.get_recommended_runtime()`
2. **Error Handling**: Returns exit code 1 for missing runtimes or conflicting options
3. **Dry Run Mode**: Shows command that would be executed without running it
4. **Port Handling**: Defaults to `DebugMCPLauncher.DEFAULT_SSE_PORT` for SSE mode when no port specified

## Key Constants
- `__version__` (L17): "0.11.1" - should match pyproject.toml
- Default mode: "stdio" if no mode argument provided