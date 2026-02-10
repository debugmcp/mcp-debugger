# examples/asciinema_demo/run_rich_demo.py
@source-hash: 743361c72faeca34
@generated: 2026-02-10T01:19:13Z

## Primary Purpose

Rich-based terminal UI demo for an MCP (Model Context Protocol) debugger server. Demonstrates interactive debugging workflow with split-pane layout showing debug logs and source code with syntax highlighting, breakpoints, and execution line markers.

## Key Configuration & Setup

**File Paths (L14-35):**
- PROJECT_ROOT: Resolves to two levels above script location
- SCRIPT_TO_DEBUG_RELPATH: Points to `examples/asciinema_demo/buggy_event_processor.py`
- MCP_SERVER_JS_ABSPATH: Points to compiled MCP server at `dist/index.js`
- Validates both target script and MCP server existence on startup

**Rich UI Layout (L40-49):**
- Three-panel vertical layout: header, main_row, footer
- Main row splits into left (logs) and right (code) panes
- Console instance for screen management

## Core State Management

**MCP Communication State (L51-57):**
- `mcp_server_process`: Subprocess handle for Node.js MCP server
- `mcp_request_id_counter`: Incremental request IDs
- `current_mcp_session_id`: Active debug session identifier
- `log_lines`: Text buffer for debug log display
- `current_line_highlight`: Line number for execution pointer
- `breakpoint_lines`: List of breakpoint line numbers

## Key Functions

**UI Management:**
- `add_log_message(message, style)` (L61-65): Appends styled text to log with overflow management
- `update_code_pane()` (L67-96): Renders source code with line numbers, breakpoint markers ("B>"), execution highlight ("H>"), and basic Python syntax highlighting

**MCP Server Lifecycle:**
- `start_mcp_server()` (L99-141): Launches Node.js MCP server via subprocess with stdin/stdout pipes
- `stop_mcp_server()` (L227-252): Graceful shutdown with timeout and forced termination fallback

**MCP Communication:**
- `send_mcp_request(tool_name, arguments)` (L143-198): Synchronous request/response with JSON protocol
- `handle_mcp_event(event_payload)` (L200-225): Processes asynchronous events (stoppedEvent, breakpointEvent)

## Demo Workflow (L256-384)

**Main Demo Steps:**
1. **Session Creation (L274-288)**: Creates debug session via `create_debug_session` tool
2. **Breakpoint Setup (L290-309)**: Sets breakpoint at line 13 of target script
3. **Debug Execution (L311-369)**: Starts debugging and attempts to process events
4. **Cleanup (L371-383)**: Closes session and stops server

**Event Processing (L327-343):**
- Attempts non-blocking reads for multiple events after `start_debugging`
- Uses stack trace requests to determine current execution line
- Updates UI highlights based on execution state

## Dependencies

- **Rich Library**: Console, Layout, Panel, Syntax, Text for terminal UI
- **Subprocess**: Node.js MCP server process management
- **JSON**: MCP protocol message serialization
- **Pathlib**: Cross-platform file path handling

## Critical Patterns

**Error Handling:**
- File existence validation before execution
- Graceful server shutdown with progressive escalation (wait → terminate → kill)
- Exception handling for JSON parsing and subprocess communication

**UI Updates:**
- Synchronous UI refresh after each major operation
- Log message styling for different event types
- Code pane highlighting for breakpoints and execution position

## Architectural Notes

- Simplified MCP client implementation (single request/response, basic event handling)
- Demo-focused design with hardcoded delays for visualization
- Mixed synchronous/asynchronous communication patterns with manual event polling