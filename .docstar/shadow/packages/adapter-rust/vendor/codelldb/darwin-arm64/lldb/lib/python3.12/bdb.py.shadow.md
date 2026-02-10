# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/bdb.py
@source-hash: 49a9ff991f55461c
@generated: 2026-02-09T18:07:13Z

## Primary Purpose
Python debugger foundation module providing base classes for implementing debuggers. Core component for Python's debugging infrastructure, offering trace function dispatch, breakpoint management, and stepping controls.

## Key Classes and Functions

### BdbQuit Exception (L13-14)
Exception class for complete debugger termination.

### Bdb Class (L17-656) 
Main debugger base class implementing Python's trace facility.

**Core State Management:**
- `__init__(skip=None)` (L31-37): Initializes with optional module skip patterns, breakpoint storage, filename cache
- `reset()` (L56-61): Prepares debugger for new session, clears line cache and frame state
- `canonic(filename)` (L39-54): Normalizes filenames to canonical form with caching

**Trace Dispatch System:**
- `trace_dispatch(frame, event, arg)` (L63-104): Main trace function routing events (line/call/return/exception) to specialized handlers
- `dispatch_line(frame)` (L106-116): Handles line execution events, checks breakpoints and stop conditions
- `dispatch_call(frame, arg)` (L118-138): Handles function calls, manages generator/coroutine special cases
- `dispatch_return(frame, arg)` (L140-165): Handles function returns with frame tracking
- `dispatch_exception(frame, arg)` (L167-192): Handles exceptions with StopIteration filtering for generators

**Stepping Controls:**
- `set_step()` (L314-316): Single-step mode
- `set_next(frame)` (L318-320): Step over calls
- `set_until(frame, lineno=None)` (L306-312): Continue until line/return
- `set_return(frame)` (L322-327): Continue until function return
- `set_continue()` (L344-357): Run until breakpoint
- `set_quit()` (L359-367): Terminate debugging

**Breakpoint Management:**
- `set_break(filename, lineno, ...)` (L382-396): Create new breakpoint
- `clear_break(filename, lineno)` (L422-437): Remove specific breakpoint
- `break_here(frame)` (L222-247): Check if current location has active breakpoint
- `break_anywhere(frame)` (L256-259): Check if file has any breakpoints

**Execution Methods:**
- `run(cmd, globals=None, locals=None)` (L591-611): Debug exec() statement
- `runeval(expr, globals=None, locals=None)` (L613-631): Debug eval() expression
- `runcall(func, /, *args, **kwds)` (L640-655): Debug single function call

**User Override Points (L264-278):**
- `user_call()`, `user_line()`, `user_return()`, `user_exception()`: Stub methods for derived classes

### Breakpoint Class (L663-781)
Manages individual breakpoints with conditions, ignore counts, and temporary status.

**State Management:**
- Class variables: `next` (L684), `bplist` (L685), `bpbynumber` (L686) for global breakpoint tracking
- `__init__(file, line, temporary=False, cond=None, funcname=None)` (L690-708): Creates breakpoint with metadata
- `deleteMe()` (L716-728): Removes breakpoint from global lists

### Helper Functions
- `set_trace()` (L658-660): Convenience function to start debugging
- `checkfuncname(b, frame)` (L785-814): Validates function-based breakpoints
- `effective(file, line, frame)` (L817-865): Finds active breakpoint for location
- `Tdb` test class (L870-886): Example debugger implementation

## Dependencies
- `fnmatch`: Module pattern matching for skip functionality
- `sys`: Frame inspection and trace function management
- `os`: Path normalization operations
- `inspect`: Code object flags for generators/coroutines
- `linecache`: Source line retrieval and caching

## Architecture Patterns
- **Template Method**: Base `Bdb` provides framework, derived classes implement `user_*` methods
- **Global State**: Breakpoint class maintains shared state across debugger instances
- **Trace Function Chain**: Each dispatch method returns trace function for continued tracing
- **Canonical Paths**: All filenames normalized through `canonic()` for consistent matching

## Critical Invariants
- `trace_dispatch()` must return trace function or None to maintain tracing
- Breakpoints stored both per-instance (`self.breaks`) and globally (`Breakpoint.bplist`)
- Frame traversal respects `botframe` boundary for debugging scope
- Generator/coroutine frames require special handling for call/return events