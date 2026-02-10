# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/events.py
@source-hash: 6a18b7eee5926622
@generated: 2026-02-09T18:12:28Z

**Core Purpose:** Defines the fundamental asynchronous event loop abstractions and global event loop management for the asyncio framework. This is the architectural foundation that enables event-driven programming in Python.

## Key Classes

**Handle (L29-104):** Represents a scheduled callback with context and cancellation support. Uses `__slots__` for memory efficiency. Key methods:
- `__init__` (L36): Stores callback, args, loop reference, and optional context
- `cancel` (L72): Marks handle as cancelled, clears callback/args in debug mode
- `_run` (L86): Executes callback within its context, handles exceptions via loop's exception handler
- Includes debug traceback support when loop debug mode is enabled

**TimerHandle (L106-167):** Extends Handle for time-based scheduling with comparison operators for priority queue ordering:
- `__init__` (L111): Adds `_when` timestamp and `_scheduled` flag
- Comparison methods (L124-153): Enable sorting by execution time
- `when` (L160): Returns scheduled execution timestamp
- `cancel` (L155): Notifies loop of cancellation before parent cancel

**AbstractServer (L169-209):** Interface for servers created by event loops:
- Lifecycle methods: `close`, `start_serving`, `serve_forever`, `wait_closed`
- Context manager support (`__aenter__`/`__aexit__`)
- Must be subclassed with actual implementations

**AbstractEventLoop (L211-616):** Comprehensive interface defining all event loop operations:
- Lifecycle: `run_forever`, `run_until_complete`, `stop`, `close`
- Callback scheduling: `call_soon`, `call_later`, `call_at`
- Network I/O: TCP/UDP server/client creation, Unix sockets
- File I/O: pipe connections, subprocess management
- Socket operations: low-level async socket methods
- Signal handling, task factory, exception handling, debug controls

**AbstractEventLoopPolicy (L618-650):** Interface for event loop lifecycle management:
- `get_event_loop`, `set_event_loop`, `new_event_loop`
- Child process watcher management (Unix-specific)

**BaseDefaultEventLoopPolicy (L652-721):** Thread-local event loop policy implementation:
- Uses `threading.local` for per-thread loop storage
- Auto-creates loops for main thread with deprecation warning
- `_loop_factory` attribute must be set by subclasses

## Global State Management

**Policy Management (L727-797):**
- `_event_loop_policy`: Global policy singleton with lazy initialization
- `_lock`: Thread safety for policy creation
- Functions: `get_event_loop_policy`, `set_event_loop_policy`

**Running Loop Tracking (L734-773):**
- `_RunningLoop`: Thread-local storage for currently executing loop
- Process ID tracking to handle fork scenarios
- Functions: `get_running_loop`, `_get_running_loop`, `_set_running_loop`

**Convenience Functions (L800-834):**
- `get_event_loop`: Returns running loop or policy's loop
- `set_event_loop`, `new_event_loop`: Delegate to current policy
- `get_child_watcher`, `set_child_watcher`: Child process management

## Performance Optimizations

**C Extension Integration (L844-857):** 
- Attempts to import optimized C implementations for frequently called functions
- Falls back to pure Python implementations
- Maintains both versions with `_py_` and `_c_` prefixes for testing

**Fork Handling (L860-868):**
- Registers `on_fork` callback to reset loop state in child processes
- Prevents event loop corruption across process boundaries

## Dependencies
- `contextvars`: Context variable support for callback execution
- `threading`: Thread-local storage and synchronization
- `format_helpers`: Callback formatting and traceback utilities
- Standard library modules: `os`, `signal`, `socket`, `subprocess`, `sys`

## Architectural Patterns
- Abstract base classes define contracts for event loop implementations
- Policy pattern for pluggable event loop management strategies
- Thread-local storage pattern for managing per-thread event loop state
- Handle pattern for cancellable scheduled operations with context preservation