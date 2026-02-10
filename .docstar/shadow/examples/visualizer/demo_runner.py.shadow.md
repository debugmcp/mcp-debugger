# examples/visualizer/demo_runner.py
@source-hash: 55b18bb4094f8bec
@generated: 2026-02-10T00:41:45Z

## Primary Purpose
Demo orchestration script that launches and manages both an MCP debug server and a live visualizer for demonstration purposes. Provides a complete end-to-end debugging demo experience with proper process lifecycle management.

## Key Components

### Global Process Tracking (L20-21)
- `server_proc`: Subprocess handle for MCP server
- `viz_proc`: Subprocess handle for visualizer  

### Process Management
- `cleanup()` (L24-38): Graceful shutdown handler that terminates/kills subprocesses with 2-second timeout
- Signal handlers (L42-43): Registered for `atexit` and `SIGTERM` to ensure cleanup

### Main Demo Flow - `main()` (L46-168)

#### Path Resolution (L50-54)
- `project_root`: Three levels up from current file
- `server_path`: Expected at `dist/index.js` (Node.js MCP server)
- `log_path`: Debug logs at `logs/debug-mcp-server.log`
- `visualizer_path`: Local `live_visualizer.py`

#### Server Startup (L79-120)
- Validates server build exists (L56-62)
- Clears existing log files (L64-73)
- Launches Node.js server with command: `node dist/index.js --log-level info --log-file <path>`
- Uses `subprocess.Popen` with pipes to capture startup errors
- 2-second startup validation with process poll check

#### Visualizer Integration (L122-167)
- Launches Python visualizer subprocess with log file path
- Passes through stdin/stdout/stderr for terminal control
- Provides comprehensive user instructions for MCP client interaction
- Waits for visualizer exit with keyboard interrupt handling

### Utility Functions
- `print_usage()` (L171-186): Help documentation with prerequisites and usage

## Dependencies
- **subprocess**: Process management and execution
- **pathlib**: Path manipulation and validation  
- **signal/atexit**: Process cleanup registration
- **time**: Startup delays

## Architecture Patterns
- **Process orchestration**: Manages lifecycle of two dependent services
- **Graceful degradation**: Robust error handling with cleanup guarantees
- **Terminal passthrough**: Visualizer gets direct terminal access while runner manages processes
- **Validation-first**: Checks prerequisites before attempting launches

## Critical Constraints
- Requires pre-built Node.js server at `dist/index.js`
- Expects `live_visualizer.py` in same directory
- Creates `logs/` directory structure as needed
- Server must start within 2-second validation window
- Uses info-level logging for structured log capture