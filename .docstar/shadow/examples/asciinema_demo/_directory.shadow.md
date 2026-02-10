# examples/asciinema_demo/
@generated: 2026-02-10T01:19:41Z

## Overall Purpose

This directory provides a complete asciinema-compatible demo environment showcasing debugging capabilities through an interactive MCP (Model Context Protocol) debugger. It combines a deliberately buggy Python script with a rich terminal UI demo to demonstrate real-time debugging workflows, breakpoint management, and code inspection.

## Key Components & Integration

**buggy_event_processor.py** - Demo Target Script
- Event processing pipeline with intentional copy/reference bugs
- Designed specifically for debugging demonstrations
- Contains shallow copy logic and special revert functionality that creates observable bugs
- Provides realistic debugging scenarios with data transformation edge cases

**run_rich_demo.py** - Interactive Demo Controller  
- Rich-based terminal UI that launches and controls the debugging session
- Manages MCP server subprocess communication
- Provides split-pane interface showing debug logs and syntax-highlighted source code
- Orchestrates the complete demo workflow from session creation to cleanup

## Public API Surface

**Primary Entry Point:**
- `run_rich_demo.py` - Main executable that runs the complete interactive debugging demo

**Demo Configuration:**
- Configurable target script path (`SCRIPT_TO_DEBUG_RELPATH`)
- MCP server location (`MCP_SERVER_JS_ABSPATH`)
- Rich UI layout with customizable panes

**Key Demo Functions:**
- Session management (create/close debug sessions)
- Breakpoint operations (set breakpoints, execution control)
- Real-time code visualization with execution highlighting
- Event-driven UI updates based on debug state changes

## Internal Organization & Data Flow

**Demo Execution Flow:**
1. **Validation Phase**: Verify target script and MCP server exist
2. **UI Initialization**: Set up Rich terminal interface with split panes
3. **MCP Server Startup**: Launch Node.js MCP server subprocess with stdio pipes
4. **Debug Session Creation**: Establish debugging session for target script
5. **Interactive Debugging**: Set breakpoints, start execution, handle debug events
6. **Cleanup**: Graceful session termination and server shutdown

**Communication Architecture:**
- JSON-based MCP protocol for client-server communication
- Synchronous request/response pattern with incremental request IDs
- Asynchronous event handling for debug state changes (breakpoints, execution stops)
- Real-time UI updates synchronized with debug events

**State Management:**
- Debug session state (session ID, current line, breakpoints)
- Log buffer management with overflow handling
- Code pane rendering with syntax highlighting and execution markers

## Important Patterns & Conventions

**Error Handling Strategy:**
- Progressive server shutdown (wait → terminate → kill)
- File existence validation before execution
- Graceful degradation for communication failures

**UI Design Patterns:**
- Split-pane layout for simultaneous log/code viewing
- Color-coded markers: "B>" for breakpoints, "H>" for execution highlight
- Styled log messages for different event types
- Automatic text overflow management

**Demo Architecture:**
- Self-contained demo environment with minimal external dependencies
- Hardcoded delays for visualization purposes
- Simplified MCP client implementation focused on demo clarity
- Realistic but controlled debugging scenarios

This module serves as both a functional debugging demo and a reference implementation for MCP-based debugging workflows, providing a complete example of interactive debugging session management through terminal UI.