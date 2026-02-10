# examples/asciinema_demo/run_rich_demo.py
@source-hash: 049bf260eee8c17d
@generated: 2026-02-09T18:15:08Z

## Purpose
Rich-based terminal UI demo for an MCP (Model Context Protocol) debugger client. Creates a split-pane interface showing debug session logs on the left and Python source code with breakpoint/execution highlighting on the right.

## Architecture
The script demonstrates MCP debugger protocol usage through a visual terminal interface:
- Spawns an MCP server as Node.js subprocess communicating via STDIN/STDOUT
- Implements synchronous request/response with basic event handling
- Manages debug session lifecycle: create → set breakpoints → start debugging → get stack trace → cleanup

## Key Components

### Configuration (L14-36)
- `PROJECT_ROOT`: Resolved from script location, assumes `examples/asciinema_demo/` structure
- `SCRIPT_TO_DEBUG_ABSPATH`: Target Python script for debugging (`buggy_event_processor.py`)
- `MCP_SERVER_JS_ABSPATH`: Compiled MCP server at `dist/index.js`
- Validates both target script and MCP server existence before proceeding

### UI Layout (L39-49)
- Rich Layout with header/main_row/footer structure
- Main row split into left pane (logs) and right pane (code viewer)
- Global state: `log_lines`, `current_line_highlight`, `breakpoint_lines`

### MCP Server Management
- `start_mcp_server()` (L106-152): Spawns Node.js subprocess with PIPE communication
- `stop_mcp_server()` (L237-263): Graceful shutdown with timeout handling and forced termination
- Global `mcp_server_process` tracks subprocess state

### MCP Protocol Implementation
- `send_mcp_request()` (L153-209): Synchronous request/response with JSON payloads
- Request format: `{"type": "request", "id": request_id, "tool": tool_name, "arguments": arguments}`
- Handles event messages that arrive before responses (L190-202)
- `handle_mcp_event()` (L210-235): Processes `stoppedEvent` and `breakpointEvent`

### Code Visualization
- `update_code_pane()` (L67-104): Renders source with line numbers, breakpoint markers, execution highlights
- Manual syntax highlighting for Python keywords using Rich Text objects
- Line prefixes: "H>" for current execution, "B>" for breakpoints, "   " for normal lines

### Demo Flow (L266-394)
1. **Session Creation**: `create_debug_session` with language="python"
2. **Breakpoint Setting**: `set_breakpoint` at line 13 of target script  
3. **Debug Start**: `start_debugging` with script path, attempts to read multiple events
4. **Stack Trace**: `get_stack_trace` to determine current execution line
5. **Cleanup**: `close_debug_session` and server shutdown

## Critical Implementation Details

### Event Handling Limitations (L337-354)
Attempts non-blocking reads of stdout for events after `start_debugging`, but implementation is fragile:
- Uses `channel.setblocking(0)` which may not exist on all platforms
- Limited to 5 event reads with basic error handling
- Real implementation would need proper async message loop

### Path Resolution (L365-372)
Stack trace frame matching uses `Path.samefile()` to compare target script with frame files, with fallback to first frame if no match.

## Dependencies
- **Rich**: Console UI, Layout, Panel, Syntax highlighting, Text styling
- **subprocess**: MCP server process management  
- **json**: MCP protocol message serialization
- **pathlib**: File path resolution and validation

## State Management
- `mcp_request_id_counter`: Incremental request IDs
- `current_mcp_session_id`: Active debug session identifier
- `current_line_highlight`: Line number for execution pointer display
- `breakpoint_lines`: List of breakpoint line numbers for UI rendering