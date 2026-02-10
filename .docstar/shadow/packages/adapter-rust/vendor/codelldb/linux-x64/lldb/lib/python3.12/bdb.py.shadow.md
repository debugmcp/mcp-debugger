# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/bdb.py
@source-hash: 49a9ff991f55461c
@generated: 2026-02-09T18:09:35Z

## Python Debugger Base Module (bdb.py)

Core Python debugger infrastructure providing the foundation for debuggers like pdb. Implements trace function dispatch, breakpoint management, and stepping control.

### Primary Classes

**BdbQuit (L13-14)**: Exception class used to signal complete debugger termination.

**Bdb (L17-656)**: Main debugger base class implementing the Python trace facility. Manages execution control, breakpoint handling, and frame inspection.

Key initialization (L31-37):
- `skip`: Set of glob patterns for modules to skip during debugging
- `breaks`: Dict mapping filename -> list of line numbers with breakpoints
- `fncache`: Cache for canonical filename resolution
- `frame_returning`: Tracks the frame currently returning

**Core Trace Dispatch System:**
- `trace_dispatch()` (L63-104): Main trace function that routes events (line, call, return, exception, c_call, c_return, c_exception) to specialized handlers
- `dispatch_line()` (L106-116): Handles line events, checks for stops/breaks
- `dispatch_call()` (L118-138): Handles function calls, manages generator/coroutine special cases
- `dispatch_return()` (L140-165): Handles function returns with generator awareness
- `dispatch_exception()` (L167-192): Handles exceptions, filters StopIteration in generators

**Stepping Control Methods:**
- `set_step()` (L314-316): Stop after one line
- `set_next()` (L318-320): Stop on next line in/below current frame
- `set_until()` (L306-312): Stop at specified line or when returning
- `set_return()` (L322-327): Stop when returning from frame
- `set_continue()` (L344-357): Run until breakpoint or completion
- `set_quit()` (L359-367): Terminate debugging session

**Breakpoint Management:**
- `set_break()` (L382-396): Create new breakpoint with optional conditions
- `clear_break()` (L422-437): Remove breakpoint at file:line
- `break_here()` (L222-247): Check if current location has active breakpoint
- `_load_breaks()` (L398-407): Sync breakpoints from global Breakpoint class

**Breakpoint (L663-781)**: Represents individual breakpoints with conditions, ignore counts, and hit tracking.

Class-level state (L684-688):
- `next`: Counter for breakpoint numbering
- `bplist`: Dict indexed by (file, lineno) containing breakpoint lists
- `bpbynumber`: List indexed by breakpoint number

### Key Functions

**effective() (L817-865)**: Determines which breakpoint should trigger at a given location, evaluating conditions and ignore counts.

**checkfuncname() (L785-814)**: Validates whether a breakpoint should trigger based on function name vs line number matching.

**set_trace() (L658-660)**: Convenience function to start debugging from caller's frame.

### Architecture Patterns

- **Template Method**: Bdb provides user_* hook methods (L264-278) that derived classes override for UI interaction
- **State Machine**: Uses stopframe, stoplineno, and quitting attributes to control execution flow
- **Global State**: Breakpoint class maintains shared state across Bdb instances for interactive sessions

### Critical Invariants

- Filenames must be in canonical form for breakpoint matching
- Generator/coroutine frames require special handling to avoid internal StopIteration exceptions
- Trace function must be properly installed/removed to avoid performance overhead
- Breakpoint synchronization between Bdb instances and global Breakpoint state