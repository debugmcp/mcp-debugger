# examples\asciinema_demo/
@generated: 2026-02-12T21:00:56Z

## Overall Purpose

Interactive demonstration environment for MCP (Model Context Protocol) debugger functionality using terminal-based UI. This module provides a complete end-to-end debugging workflow demonstration, combining a purposefully buggy Python script with a rich terminal interface that showcases real-time debugging capabilities including breakpoints, execution tracking, and log visualization.

## Key Components & Integration

**Target Application (`buggy_event_processor.py`)**
- Event processing system with intentionally introduced copy/reference bugs
- Demonstrates common data transformation pipeline issues (shallow copying, reference management, state preservation)
- Contains verification logic to detect when bugs manifest during execution
- Serves as realistic debugging target with predictable failure modes

**Demo UI Controller (`run_rich_demo.py`)**
- Rich-based terminal interface providing split-pane debugging environment
- Manages MCP server lifecycle (Node.js subprocess) and communication protocol
- Orchestrates complete debugging workflow from session creation through cleanup
- Provides real-time visualization of debug logs and source code with syntax highlighting

## Public API Surface

**Primary Entry Point:**
- `python run_rich_demo.py` - Launches full interactive debugging demonstration

**Key Configuration:**
- Automatic path resolution to locate target script and MCP server
- Configurable layout with header/main/footer panels
- Breakpoint and execution line visualization

## Internal Organization & Data Flow

**Initialization Flow:**
1. Path validation for target script and MCP server executable
2. Rich UI layout setup (log pane + code pane)
3. MCP server subprocess launch with JSON protocol communication

**Debug Session Workflow:**
1. Create debug session via MCP `create_debug_session` tool
2. Set breakpoints at strategic locations (line 13 - event enrichment logic)
3. Start debugging and monitor for execution events
4. Process stop events, update UI highlights, request stack traces
5. Clean shutdown of debug session and server process

**UI Update Pipeline:**
- Log messages with styled output (different colors for different event types)
- Source code rendering with line numbers, breakpoint markers ("B>"), execution highlights ("H>")
- Real-time refresh coordination between log and code panes

## Important Patterns & Conventions

**MCP Protocol Integration:**
- Synchronous request/response pattern with incremental request IDs
- Asynchronous event handling for debugger state changes (stoppedEvent, breakpointEvent)
- JSON message serialization with stdin/stdout communication to Node.js server

**Error Handling Strategy:**
- Graceful degradation with timeout-based server shutdown
- File existence validation before execution
- Exception handling for subprocess communication and JSON parsing

**Demo-Optimized Design:**
- Hardcoded delays for visualization purposes
- Simplified MCP client (single session, basic event polling)
- Self-contained with automatic path resolution for portability

## System Dependencies

- Rich library for terminal UI components
- Node.js MCP server (external subprocess)
- Python standard library (subprocess, json, pathlib)
- Target debugging environment assumes working MCP debugger server

This module serves as both a functional demonstration and testing environment for MCP debugger capabilities, providing a complete reference implementation for terminal-based debugging workflows.