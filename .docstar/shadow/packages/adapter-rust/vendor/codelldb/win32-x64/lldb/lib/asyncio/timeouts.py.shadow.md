# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/timeouts.py
@source-hash: 3e40ca0dca3e5477
@generated: 2026-02-09T18:10:22Z

**Primary Purpose**: Implements asynchronous timeout context managers for cancelling overdue coroutines in asyncio event loops.

**Core Classes & Functions**:

- `_State` enum (L18-24): Defines timeout lifecycle states (CREATED, ENTERED, EXPIRING, EXPIRED, EXITED)
- `Timeout` class (L27-127): Main asynchronous context manager for timeout functionality
  - `__init__` (L33-44): Initializes with optional deadline timestamp
  - `when()` (L46-48): Returns current deadline
  - `reschedule()` (L50-71): Updates timeout deadline and manages timer handles
  - `expired()` (L73-75): Checks if timeout has expired during execution
  - `__aenter__` (L85-95): Enters timeout context, validates task context, sets up timer
  - `__aexit__` (L97-119): Exits timeout context, converts CancelledError to TimeoutError
  - `_on_timeout()` (L121-126): Timer callback that cancels the task
- `timeout()` (L129-146): Factory function creating relative timeout from delay
- `timeout_at()` (L149-167): Factory function creating absolute timeout from timestamp

**Key Dependencies**:
- `asyncio.events`: Event loop operations and timer handles
- `asyncio.exceptions`: CancelledError handling
- `asyncio.tasks`: Current task management and cancellation

**Architecture Patterns**:
- State machine pattern using enum for timeout lifecycle management
- Context manager protocol for automatic resource cleanup
- Timer-based cancellation using event loop scheduling
- Exception transformation (CancelledError → TimeoutError)

**Critical Invariants**:
- Timeout can only be entered once (enforced in `__aenter__`)
- Must be used within an asyncio task context
- Proper cleanup of timer handles on exit/cancellation
- State transitions must follow: CREATED → ENTERED → (EXPIRING/EXITED) → EXPIRED/EXITED

**Usage Pattern**: Provides `async with timeout(seconds)` or `async with timeout_at(timestamp)` context managers that automatically cancel nested operations that exceed time limits.