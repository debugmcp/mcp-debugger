# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/bdb.py
@source-hash: 49a9ff991f55461c
@generated: 2026-02-09T18:10:36Z

## Purpose and Responsibility

This is Python's core debugger base module (`bdb.py`) that provides the fundamental infrastructure for debugging Python code. It implements the trace facility mechanism and breakpoint management system that higher-level debuggers like `pdb` build upon.

## Key Classes and Components

### BdbQuit Exception (L13-14)
Exception class used to signal complete debugger termination.

### Bdb Class (L17-656) 
The main debugger base class that handles:
- **Trace dispatch system**: Core event routing via `trace_dispatch()` (L63-104)
- **Breakpoint management**: Storage and manipulation in `self.breaks` dict (L33)
- **Frame navigation**: Stepping, continuing, and stopping logic
- **Module skipping**: Pattern-based module filtering via `skip` parameter (L32)

#### Critical Methods:
- `trace_dispatch(frame, event, arg)` (L63): Main trace function dispatcher for line/call/return/exception events
- `dispatch_line/call/return/exception()` (L106-192): Event-specific handlers that call user hooks
- `stop_here(frame)` (L207): Determines if debugger should stop at current frame
- `break_here(frame)` (L222): Checks for active breakpoints at current location
- `set_trace(frame=None)` (L329): Initiates debugging from specified or caller frame
- `set_step/next/until/return()` (L314-327): Stepping control methods
- `set_break/clear_break()` (L382-437): Breakpoint manipulation

#### User Override Points (L264-278):
- `user_call/line/return/exception()`: Empty methods for derived classes to implement UI

### Breakpoint Class (L663-781)
Manages individual breakpoints with features:
- **Global state**: Class-level `bplist` dict and `bpbynumber` list for all instances (L685-686)
- **Properties**: File, line, temporary flag, condition, ignore count, hit count (L690-700)
- **Lifecycle**: Creation, deletion via `deleteMe()` (L716), enable/disable (L730-736)

## Key Functions

### checkfuncname(b, frame) (L785-814)
Determines if breakpoint should trigger based on line number vs function name matching.

### effective(file, line, frame) (L817-865)
Core breakpoint evaluation logic that finds the first active, enabled breakpoint and handles conditions/ignore counts.

### set_trace() (L658-660)
Convenience function to start debugging from caller's frame.

## Architecture Patterns

**Trace Function Chain**: Uses Python's `sys.settrace()` mechanism where `trace_dispatch` returns itself to continue tracing or `None` to stop.

**Template Method Pattern**: Base class provides framework (`dispatch_*` methods) while derived classes implement specifics (`user_*` methods).

**Global Breakpoint State**: Breakpoint class maintains shared state across all debugger instances, enabling persistence between debugging sessions.

## Critical Invariants

1. **Canonical Filenames**: All file paths normalized via `canonic()` (L39-54) for consistent breakpoint matching
2. **Frame Relationship**: `botframe` tracks outermost debugging frame; `stopframe` controls where to stop
3. **Generator Handling**: Special logic for generators/coroutines using `GENERATOR_AND_COROUTINE_FLAGS` (L10, L134, L149, L178, L324)
4. **Trace Function Restoration**: `_set_caller_tracefunc()` (L294) restores tracing in caller frames after breakpoints

## Dependencies

- `sys`: Core trace facility and frame access
- `linecache`: Source line retrieval for breakpoint validation and display
- `fnmatch`: Pattern matching for module skipping
- `inspect`: Code object flag constants for generator detection

## Testing Infrastructure

Includes `Tdb` test class (L870-886) and test functions (L888-899) demonstrating basic debugger usage.