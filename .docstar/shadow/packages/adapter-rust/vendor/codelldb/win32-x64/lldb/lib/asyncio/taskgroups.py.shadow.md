# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/taskgroups.py
@source-hash: 04895039b4870219
@generated: 2026-02-09T18:10:23Z

**Primary Purpose:** 
Asyncio context manager for coordinated task group execution with exception handling and cancellation semantics. Adapted from EdgeDB project under PSFL license. Manages multiple concurrent tasks, ensuring all complete before exit and handling exceptions via ExceptionGroup aggregation.

**Key Classes & Functions:**

**TaskGroup (L12-240)** - Main asynchronous context manager
- `__init__` (L28-38): Initializes state tracking (_entered, _exiting, _aborting flags, task set, error collection)
- `__aenter__` (L54-66): Context entry - validates single use, captures parent task and event loop
- `__aexit__` (L68-148): Context exit - handles exception propagation, task cancellation, and ExceptionGroup creation
- `create_task` (L149-173): Creates and registers new tasks with lifecycle management
- `_abort` (L183-188): Cancels all pending tasks when group needs to shut down
- `_on_task_done` (L190-240): Task completion callback handling errors and completion signaling
- `_is_base_error` (L179-181): Identifies SystemExit/KeyboardInterrupt as base errors

**Core Architecture:**
- **State Management**: Uses flags (_entered, _exiting, _aborting) to track lifecycle phases
- **Error Handling**: Distinguishes base errors (SystemExit, KeyboardInterrupt) from regular exceptions
- **Cancellation Protocol**: Complex parent task cancellation with uncancel() semantics for proper cleanup
- **Completion Signaling**: Uses futures (_on_completed_fut) to coordinate task completion waiting

**Key Dependencies:**
- `events` module: Event loop access (L7, L59)  
- `exceptions` module: CancelledError handling (L8, L77, L111)
- `tasks` module: Task creation and naming utilities (L9, L60, L164)

**Critical Invariants:**
- Single entry enforcement (L55-57)
- All tasks must complete before context exit (L105-126)  
- Base errors take precedence over regular exceptions (L128-129)
- Parent task cancellation state must be properly managed (L78-83, L239-240)

**Exception Handling Pattern:**
1. Collect exceptions from failed tasks in `_errors` list
2. Track base errors separately in `_base_error` 
3. On exit, raise base error if present, otherwise create ExceptionGroup from collected errors
4. Handle CancelledError propagation based on parent task state