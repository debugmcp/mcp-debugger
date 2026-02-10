# examples/visualizer/state.py
@source-hash: b8053f81251b02e5
@generated: 2026-02-10T00:41:44Z

## Purpose
Application state management for a debugger visualizer, providing centralized storage and manipulation of debugging session data including tool activities, execution location, breakpoints, and variable states.

## Key Classes

### ToolActivity (L16-23)
Dataclass representing a single MCP tool invocation with fields:
- `tool`: Tool name
- `status`: Execution status ('calling', 'success', 'error')
- `details`: Human-readable description
- `timestamp`: Execution time

### CodeLocation (L25-35)
Represents a code position with `file_path` and `line` number. Includes `__str__()` method (L31-34) that returns basename and line for display.

### DebugState (L37-157)
Central state manager with session, execution, and debugging data:

**Session Fields:**
- `session_id`, `session_name`: Session identification
- `current_location`: Current execution position (CodeLocation)
- `is_paused`: Execution state flag

**Data Structures:**
- `breakpoints`: Dict[file_path, Set[line_numbers]] for breakpoint storage
- `variables`: Dict[str, str] for current scope variables
- `tool_activities`: List[ToolActivity] with max_activities limit (20)

**Key Methods:**
- `add_tool_activity()` (L59-73): Appends activity with automatic history trimming
- `set_breakpoint()`/`remove_breakpoint()` (L75-99): Breakpoint management with cleanup
- `update_location()` (L101-109): Updates current execution position
- `update_variables()` (L115-122): Replaces variable state
- `reset_session()` (L124-132): Clears session data but preserves tool history
- `get_breakpoints_for_file()`/`has_breakpoint()` (L134-157): Breakpoint queries

## Dependencies
- `dataclasses` for data structures
- `typing` for type hints
- `time` for timestamps
- `os` (imported in `__str__`) for path operations

## Architectural Patterns
- Immutable dataclasses for activity and location records
- Centralized state pattern with the DebugState class
- Memory management through bounded tool activity history
- Dict-based breakpoint storage using file paths as keys and line number sets as values

## Constraints
- Tool activities limited to 20 entries to prevent memory growth
- Variables stored as string representations only
- Breakpoints automatically cleaned up when file has no remaining breakpoints