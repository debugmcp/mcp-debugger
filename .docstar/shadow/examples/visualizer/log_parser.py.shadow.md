# examples/visualizer/log_parser.py
@source-hash: 21175d030c7c399f
@generated: 2026-02-09T18:15:03Z

## Primary Purpose
Log event parser for MCP debugger visualizer that transforms structured debug log events into state updates for the visualizer interface.

## Core Architecture
- **LogEventParser (L16-453)**: Main parser class that processes various debug event types and updates a shared DebugState instance
- **State-driven design**: All parsing methods update the shared `self.state` object (DebugState) rather than returning values
- **Event-specific handlers**: Each log message type has a dedicated parsing method

## Key Event Handlers
- **parse_tool_call (L28-45)**: Handles `tool:call` events, extracts tool name/request parameters, adds activity to state
- **parse_tool_response (L47-85)**: Processes `tool:response` events, handles success/error status, special logic for breakpoint responses
- **parse_tool_error (L86-101)**: Handles `tool:error` events, adds error activity to state
- **parse_session_created (L102-125)**: Processes session creation, updates session ID/name in state
- **parse_session_closed (L127-147)**: Handles session termination, formats duration, resets state if current session
- **parse_debug_state (L149-197)**: Core debug state handler for paused/running/stopped events, updates location and pause status
- **parse_debug_breakpoint (L198-242)**: Manages breakpoint events (set/verified/hit), updates breakpoint state and location
- **parse_debug_variables (L244-289)**: Processes variable data, limits display to 20 variables, formats with types
- **parse_debug_output (L291-313)**: Handles debug output/console messages, truncates long output

## Utility Methods
- **_format_tool_details (L315-358)**: Formats tool request parameters for display based on tool type
- **_format_response_details (L360-393)**: Formats tool response data for display
- **_normalize_path (L395-423)**: Converts file paths to absolute canonical form using pathlib
- **_format_duration (L425-451)**: Converts milliseconds to human-readable duration strings

## Dependencies
- **Internal**: `.state` module (DebugState, CodeLocation classes)
- **Standard library**: typing, pathlib, os, datetime
- **Data flow**: Reads Dict events → updates DebugState → visualizer reflects changes

## Critical Patterns
- **Defensive parsing**: All event access uses `.get()` with defaults to handle malformed events
- **Path normalization**: File paths consistently normalized via `_normalize_path()` for display consistency
- **Activity logging**: Most operations add entries to `state.tool_activities` for user visibility
- **Data truncation**: Long strings (variables, output) truncated to prevent UI overflow
- **State synchronization**: Parser directly mutates shared state object rather than returning updates

## Key Invariants
- All file paths stored in state are absolute and normalized
- Variable display limited to 20 entries and 60 characters per value
- Tool activities always include status (success/error/info/warning) and description
- Session state resets only when current session closes, not other sessions