# examples/visualizer/demo_runner.py
@source-hash: 55b18bb4094f8bec
@generated: 2026-02-09T18:14:58Z

## Purpose
Demo orchestration script that launches and coordinates both an MCP debug server and live visualizer to provide a complete debugging demonstration environment.

## Architecture & Control Flow
- **Process Management**: Tracks two subprocesses (`server_proc`, `viz_proc`) globally (L20-21)
- **Cleanup Orchestration**: Registers cleanup handlers for graceful shutdown (L24-43)
- **Sequential Startup**: Starts server first, validates it's running, then launches visualizer (L46-169)
- **Terminal Handoff**: Passes terminal control to visualizer for interactive display

## Key Functions

### cleanup() (L24-39)
Process termination handler that gracefully shuts down both server and visualizer subprocesses. Uses terminate() first, falls back to kill() after 2-second timeout.

### main() (L46-169)
Primary orchestration logic:
- **Path Resolution** (L50-54): Locates server binary, log file, and visualizer script relative to project structure
- **Server Validation** (L56-62): Checks if MCP server is built at expected location
- **Log Management** (L64-73): Clears existing logs and ensures log directory exists  
- **Server Launch** (L79-120): Starts Node.js MCP server with info-level logging, validates startup success
- **Visualizer Launch** (L122-162): Starts Python visualizer with terminal control, provides user instructions

### print_usage() (L171-187)
Help text showing prerequisites, usage, and command-line options.

## Dependencies & File Structure
- **Server Binary**: `dist/index.js` (Node.js MCP server)
- **Visualizer**: `live_visualizer.py` (Python script in same directory)
- **Log Output**: `logs/debug-mcp-server.log` (structured debug events)
- **Project Root**: Resolved relative to script location (`../../..`)

## Error Handling Patterns
- **Subprocess Monitoring**: Polls server process after startup to detect early failures
- **Graceful Degradation**: Captures and displays subprocess stdout/stderr on failures
- **Resource Cleanup**: Uses atexit and signal handlers to ensure process cleanup
- **Timeout Management**: 2-second timeout for graceful termination before force-kill

## Critical Behavior
- Server must start successfully before visualizer launches
- Log file is cleared on each run for fresh debugging session
- Visualizer inherits terminal control for interactive display
- Demo provides example MCP commands for user guidance