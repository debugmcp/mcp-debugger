# examples/asciinema_demo/
@generated: 2026-02-11T23:47:41Z

## Purpose

Interactive demonstration module showcasing MCP (Model Context Protocol) debugging capabilities through a live terminal UI demo. Provides a complete end-to-end example of debugging Python code with intentional bugs using an MCP debugger server with Rich-based visualization.

## Key Components

**buggy_event_processor.py** - Target application containing intentionally buggy event processing logic designed to demonstrate common copy/reference issues in data transformation pipelines. Includes verification logic to detect when bugs manifest.

**run_rich_demo.py** - Rich-based terminal UI that serves as both MCP client and demo orchestrator, providing split-pane interface showing debug logs alongside syntax-highlighted source code with breakpoint and execution markers.

## Component Interaction

The demo follows this workflow:
1. **Demo Launcher**: `run_rich_demo.py` validates file paths and starts the MCP server subprocess
2. **UI Initialization**: Rich console creates three-panel layout (header/main/footer) with logs and code panes
3. **MCP Communication**: Establishes JSON-RPC communication with Node.js MCP server via stdin/stdout pipes
4. **Debug Session**: Creates debug session targeting `buggy_event_processor.py`
5. **Interactive Debugging**: Sets breakpoints, starts execution, and visualizes debugging state changes
6. **Bug Demonstration**: The buggy event processor exhibits copy/reference issues that are visible through the debugger

## Public API Surface

**Main Entry Point:**
- `run_rich_demo.py` - Execute with `python run_rich_demo.py` to launch interactive demo

**Demo Target:**
- `buggy_event_processor.process_events()` - Primary function containing intentional bugs for debugging demonstration

**Key Configuration:**
- Hardcoded file paths resolve relative to project structure
- MCP server expected at `dist/index.js` 
- Demo script targets `buggy_event_processor.py`

## Internal Organization

**Data Flow:**
```
User Launch → UI Setup → MCP Server Start → Debug Session Creation → 
Breakpoint Setting → Code Execution → Event Processing → Bug Detection → 
UI Visualization → Session Cleanup → Server Shutdown
```

**State Management:**
- MCP communication state (process handle, session ID, request counter)
- UI state (log buffer, execution line, breakpoints)
- Debug state (current line highlight, stack traces)

## Important Patterns

**Error Demonstration Pattern**: The buggy event processor intentionally exhibits shallow copy issues where special revert logic accesses modified state instead of original state, demonstrating common Python reference bugs.

**Interactive Debugging Pattern**: Real-time visualization of debugging state through Rich UI with synchronized log output and source code highlighting showing execution flow and breakpoint hits.

**MCP Client Pattern**: Simplified MCP protocol implementation using synchronous request/response with manual event polling, suitable for demo purposes but not production use.

## Dependencies & Architecture

- **Rich Library**: Terminal UI framework for syntax highlighting and layout management
- **Node.js MCP Server**: External debugger server process managed via subprocess
- **JSON-RPC Protocol**: Communication between Python client and Node.js server
- **Cross-platform Paths**: Uses pathlib for reliable file path resolution

This module serves as both a functional debugging demo and a reference implementation for MCP client integration patterns.