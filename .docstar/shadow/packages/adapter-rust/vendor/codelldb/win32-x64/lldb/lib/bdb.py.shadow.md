# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/bdb.py
@source-hash: 49a9ff991f55461c
@generated: 2026-02-09T18:13:03Z

## Purpose
Core Python debugger base class providing the fundamental tracing and breakpoint infrastructure. This is the foundation that higher-level debuggers like `pdb` build upon.

## Key Classes

### BdbQuit (L13-14)
Exception class for completely terminating debugging sessions.

### Bdb (L17-656) 
Main debugger base class managing trace functions, breakpoints, and execution control.

**Core Initialization (L31-37):**
- `skip`: Set of glob patterns for modules to skip during debugging
- `breaks`: Dictionary mapping filenames to lists of breakpoint line numbers
- `fncache`: Filename canonicalization cache
- `frame_returning`: Tracks frame currently returning

**Trace Dispatch System (L63-192):**
- `trace_dispatch()` (L63): Main trace function dispatcher handling line/call/return/exception events
- Event-specific dispatchers: `dispatch_line()`, `dispatch_call()`, `dispatch_return()`, `dispatch_exception()`
- Handles generator/coroutine special cases using `GENERATOR_AND_COROUTINE_FLAGS`

**Stopping Logic (L198-260):**
- `stop_here()` (L207): Determines if execution should stop at current frame
- `break_here()` (L222): Checks for active breakpoints at current line
- `is_skipped_module()` (L198): Module pattern matching for skip functionality

**Step Control Commands (L306-367):**
- `set_step()`, `set_next()`, `set_until()`, `set_return()`: Different stepping modes
- `set_continue()`, `set_quit()`: Execution flow control
- `_set_stopinfo()` (L280): Internal state management for stopping conditions

**Breakpoint Management (L376-529):**
- `set_break()` (L382): Create new breakpoints with optional conditions
- `clear_break()`, `clear_all_breaks()`: Breakpoint removal
- `_load_breaks()` (L398): Sync breakpoints from global Breakpoint class
- Integration with global `Breakpoint.bplist` and `Breakpoint.bpbynumber`

**Execution Methods (L591-656):**
- `run()`, `runeval()`, `runcall()`: Entry points for debugging code execution
- Handle BdbQuit exceptions and trace function cleanup

### Breakpoint (L663-781)
Global breakpoint registry with class-level state management.

**Class Variables (L684-688):**
- `next`: Global breakpoint counter
- `bplist`: Dictionary indexed by (filename, line) tuples
- `bpbynumber`: List indexed by breakpoint numbers

**Instance Management (L690-729):**
- Automatic registration in both `bplist` and `bpbynumber` on creation
- `deleteMe()` (L716): Clean removal from global registries
- Support for temporary, conditional, and function-name breakpoints

## Key Functions

### effective() (L817-865)
Critical breakpoint evaluation function determining which breakpoint should trigger. Handles conditions, ignore counts, and temporary breakpoint deletion logic.

### checkfuncname() (L785-814)  
Validates whether a breakpoint should trigger based on function name vs line number breakpoint types.

### set_trace() (L658-660)
Convenience function to start debugging from caller's frame.

## Architecture Patterns

**State Management:** Uses instance variables (`stopframe`, `returnframe`, `quitting`, `stoplineno`) to track debugging state across trace calls.

**Global Breakpoint Registry:** Breakpoint class maintains shared state across multiple Bdb instances to preserve breakpoints between debugging sessions.

**Template Method Pattern:** Base class defines trace dispatch flow while derived classes override `user_*` methods for actual user interaction.

**Frame Walking:** Extensive use of frame introspection (`f_back`, `f_lineno`, `f_code`) for stack navigation and breakpoint evaluation.

## Dependencies
- `sys`: Trace function management and frame access
- `os`: File path canonicalization  
- `fnmatch`: Module name pattern matching
- `linecache`: Source code line retrieval
- `inspect`: Generator/coroutine flag constants

## Critical Invariants
- Trace function must be properly installed/removed via `sys.settrace()`
- Breakpoint synchronization between instance `breaks` dict and global `Breakpoint` registries
- Generator/coroutine frames require special handling for step operations
- Canonical filename forms must be maintained for breakpoint matching