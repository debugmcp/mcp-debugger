# examples/visualizer/log_parser.py
@source-hash: 21175d030c7c399f
@generated: 2026-02-10T00:41:45Z

**Primary Purpose**: Log event parser for MCP debugger visualizer that processes structured log events and updates visualizer state according to logging specification.

**Core Class**: 
- `LogEventParser` (L16-452): Main parser class that processes various debug-related log events and updates a `DebugState` instance

**Key Dependencies**:
- `.state.DebugState` and `.state.CodeLocation`: State management classes
- Standard libraries: `typing`, `pathlib`, `os`, `datetime`

**Event Processing Methods**:
- `parse_tool_call` (L28-45): Handles "tool:call" events, extracts tool name and request details
- `parse_tool_response` (L47-85): Handles "tool:response" events, processes success/error status and breakpoint data
- `parse_tool_error` (L86-100): Handles "tool:error" events, logs error messages
- `parse_session_created` (L102-125): Handles "session:created" events, sets session ID and name
- `parse_session_closed` (L127-147): Handles "session:closed" events, formats duration and resets session
- `parse_debug_state` (L149-197): Handles "debug:state" events for paused/running/stopped states
- `parse_debug_breakpoint` (L198-242): Handles "debug:breakpoint" events for set/verified/hit states
- `parse_debug_variables` (L244-289): Handles "debug:variables" events, formats variable display (max 20 vars, 60 char limit)
- `parse_debug_output` (L291-313): Handles "debug:output" events for console output (100 char limit)

**Utility Methods**:
- `_format_tool_details` (L315-358): Formats tool request parameters for display based on tool type
- `_format_response_details` (L360-393): Formats tool response data for display based on tool type
- `_normalize_path` (L395-423): Normalizes file paths to absolute canonical form using pathlib
- `_format_duration` (L425-451): Converts milliseconds to human-readable duration strings

**Key Patterns**:
- Event-driven architecture: Each parse method handles specific event message types
- State mutation: All parsers update the shared `DebugState` instance
- Path normalization: File paths consistently normalized for display
- Data truncation: Long strings truncated for UI display (variables: 60 chars, output: 100 chars)
- Error handling: Graceful fallbacks for missing event fields

**Notable Behaviors**:
- Breakpoint handling updates both breakpoint state and current location view
- Variable display limited to first 20 variables with type information when available
- Session tracking with auto-reset when matching session closes
- Debug state changes (paused/running/stopped) tracked with location updates

**Test Code**: Example usage in `__main__` block (L455-472) demonstrates basic tool call parsing