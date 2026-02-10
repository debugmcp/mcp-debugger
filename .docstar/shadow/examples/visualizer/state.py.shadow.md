# examples/visualizer/state.py
@source-hash: b8053f81251b02e5
@generated: 2026-02-09T18:15:00Z

## Primary Purpose
Central state management module for a debugger visualizer, providing comprehensive tracking of debugging session state including execution location, breakpoints, variables, and tool activity history.

## Core Classes

### ToolActivity (L16-23)
Immutable dataclass representing a single MCP tool invocation with fields:
- `tool`: Tool name
- `status`: Execution status ('calling', 'success', 'error')
- `details`: Human-readable description
- `timestamp`: Float timestamp of invocation

### CodeLocation (L25-35)
Represents a specific location in source code with:
- `file_path`: Full file path
- `line`: Line number
- `__str__()` method returns basename:line format for display

### DebugState (L37-157)
Main state container managing all debugger session data:

**Session Management:**
- `session_id`, `session_name`: Optional session identifiers
- `reset_session()` (L124): Clears session state but preserves tool history

**Execution Tracking:**
- `current_location`: CodeLocation of current execution point
- `is_paused`: Boolean execution state
- `update_location()` (L101): Updates current position

**Breakpoint Management:**
- `breakpoints`: Dict[file_path, Set[line_numbers]] structure
- `set_breakpoint()` (L75): Adds breakpoint, auto-creates file entry
- `remove_breakpoint()` (L87): Removes breakpoint, cleans empty sets
- `get_breakpoints_for_file()` (L134): Returns breakpoints for specific file
- `has_breakpoint()` (L146): Checks if specific line has breakpoint

**Variable Tracking:**
- `variables`: Dict[name, value_string] of current scope variables
- `update_variables()` (L115): Replaces all variables with new dict copy
- `clear_variables()` (L111): Empties variable dict

**Activity History:**
- `tool_activities`: Limited list of ToolActivity objects
- `max_activities`: Configurable limit (default 20)
- `add_tool_activity()` (L59): Appends new activity with automatic pruning

## Key Patterns

**Memory Management:** Tool activity list implements automatic pruning to prevent unbounded growth, maintaining only the most recent N activities.

**Breakpoint Storage:** Uses nested dict-set structure for efficient file-based breakpoint lookup and management.

**Defensive Programming:** Breakpoint methods handle missing file entries gracefully, set operations use `discard()` for safe removal.

## Dependencies
- `dataclasses`: For structured data classes
- `typing`: For type annotations
- `time`: For activity timestamps
- `os` (imported inline): For path manipulation in display formatting