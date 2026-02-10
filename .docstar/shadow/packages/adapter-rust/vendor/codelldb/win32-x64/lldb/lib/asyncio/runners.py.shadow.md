# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/runners.py
@source-hash: 005535b70acf9761
@generated: 2026-02-09T18:11:20Z

## Primary Purpose
Event loop lifecycle management for asyncio applications. Provides both a context manager (`Runner`) and convenience function (`run`) to create, manage, and properly clean up event loops with support for debug mode, custom loop factories, and signal handling.

## Key Classes & Functions

### _State Enum (L14-18)
State tracking for Runner lifecycle: CREATED → INITIALIZED → CLOSED

### Runner Class (L20-158)
Context manager for controlled event loop lifecycle with reusable execution capability.

**Key Methods:**
- `__init__(*, debug=None, loop_factory=None)` (L48-55): Initialize with optional debug mode and custom loop factory
- `__enter__()` (L57-59): Lazy initialization via `_lazy_init()`
- `__exit__()` (L61-62): Automatic cleanup via `close()`
- `close()` (L64-79): Shutdown sequence - cancel tasks, shutdown generators/executor, close loop
- `get_loop()` (L81-84): Access to managed event loop with lazy init
- `run(coro, *, context=None)` (L86-130): Execute coroutine with SIGINT handling and cancellation support
- `_lazy_init()` (L131-148): Deferred loop creation and configuration
- `_on_sigint()` (L150-157): Signal handler for graceful cancellation (first SIGINT cancels task, second raises KeyboardInterrupt)

**Key State:**
- `_state`: Lifecycle tracking
- `_loop`: Managed event loop instance
- `_context`: Copied context variables
- `_interrupt_count`: SIGINT handling counter
- `_set_event_loop`: Flag to track event loop registration

### run Function (L160-194)
Convenience wrapper that creates Runner context and executes single coroutine. One-shot alternative to Runner for simple use cases.

### _cancel_all_tasks Function (L197-215)
Internal cleanup utility that cancels all pending tasks and handles exceptions during shutdown.

## Dependencies
- `contextvars`: Context variable copying
- `threading`, `signal`: SIGINT handling on main thread
- Local asyncio modules: `coroutines`, `events`, `exceptions`, `tasks`, `constants`

## Architectural Patterns
- **Context Manager Pattern**: Runner provides automatic resource cleanup
- **Lazy Initialization**: Event loop created only when first needed
- **Signal Handling**: Graceful shutdown on SIGINT with escalation (cancel → KeyboardInterrupt)
- **State Machine**: Explicit lifecycle states prevent misuse
- **Factory Pattern**: Pluggable loop creation via `loop_factory`

## Critical Invariants
- Cannot run from existing event loop context (fast-fail with RuntimeError)
- Runner instances are single-use after close() 
- SIGINT handling only on main thread with default handler
- Proper cleanup order: tasks → async generators → default executor → loop
- Context variables captured at initialization, not per-run