# examples/visualizer/live_visualizer.py
@source-hash: 2e76aa790b21ae62
@generated: 2026-02-10T00:41:44Z

## Purpose
Live debugger visualizer that connects to MCP server logs to provide real-time TUI visualization of debugging sessions. Acts as an integration layer between log file monitoring and visualization components.

## Key Components

### Main Entry Point
- **main() (L20-101)**: Primary orchestration function that sets up log monitoring, event parsing, and visualization
  - Handles command-line log path argument (defaults to "../../logs/debug-mcp-server.log")
  - Creates log file if it doesn't exist with proper error handling
  - Coordinates LogWatcher, LogEventParser, and DebugVisualizer components
  - Registers comprehensive event handlers for MCP debugging events
  - Manages application lifecycle with graceful shutdown

### Event Handler Registration
- **Event handlers mapping (L52-62)**: Maps MCP debug event types to parser methods
  - `tool:call/response/error` - Tool execution tracking
  - `session:created/closed` - Session lifecycle management  
  - `debug:state/breakpoint/variables/output` - Debug state tracking
- **Convenience handlers (L69-75)**: Lambda handlers for stack traces and scopes without dedicated parsers

## Dependencies
- **DebugVisualizer**: TUI interface for real-time debugging visualization
- **LogWatcher**: File monitoring component that watches for log changes
- **LogEventParser**: Parses structured log events and updates visualizer state
- **Path manipulation**: Uses pathlib for cross-platform file path handling

## Architecture Patterns
- **Event-driven architecture**: Uses callback registration for decoupled event handling
- **Integration layer**: Bridges file I/O monitoring with UI visualization
- **Error resilience**: Comprehensive exception handling for file operations and runtime errors
- **Graceful lifecycle**: Proper cleanup in finally block with KeyboardInterrupt handling

## Critical Behaviors
- Clears log watcher position on startup to start fresh (L79)
- 500ms initialization delay after watcher start (L85-86)
- Blocking visualization run until Ctrl+C (L89)
- Automatic log file creation with parent directory structure
- Command-line log path override capability

## Usage Context
Designed to be run as a standalone script for live MCP server debugging sessions. Expects MCP server to be writing structured debug events to the monitored log file.