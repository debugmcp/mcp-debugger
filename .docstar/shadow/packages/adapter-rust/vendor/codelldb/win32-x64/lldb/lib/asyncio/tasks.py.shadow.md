# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/tasks.py
@source-hash: 6f6aad82d597fea1
@generated: 2026-02-09T18:10:38Z

## Core Purpose
Python asyncio tasks module that provides the Task class and task management utilities for coroutine scheduling and execution. This is a reference implementation that falls back to C extensions when available for performance optimization.

## Key Classes

### Task (L83-398)
Core task implementation inheriting from `futures._PyFuture`. Wraps coroutines in a Future-like interface with execution state management.

**Key Invariants:**
- Maintains 3 execution states based on `_fut_waiter` and `__step()` scheduling (L88-105)
- State 1: Waiting for `_fut_waiter` (not done), `__step()` not scheduled
- State 2: Ready to run, `__step()` scheduled 
- State 3: Currently executing in `__step()`

**Critical Methods:**
- `__init__` (L111-140): Constructor with eager start support, context management
- `__step` (L291-306): Main execution driver, handles task state transitions
- `__step_run_and_handle_result` (L308-381): Coroutine execution with result/exception handling
- `__wakeup` (L383-397): Callback for awaited future completion
- `cancel` (L210-250): Cancellation with message support and nested future handling
- `__eager_start` (L272-289): Immediate execution for performance optimization

### _GatheringFuture (L702-728)
Specialized Future for `gather()` operations that coordinates cancellation across multiple child tasks.

## Key Functions

### Task Creation
- `create_task` (L412-425): Primary task creation interface
- `create_eager_task_factory` (L954-977): Factory for eager task execution
- `eager_task_factory` (L980): Pre-built eager factory instance

### Synchronization Primitives
- `wait` (L435-464): Wait for multiple futures with completion conditions
- `wait_for` (L472-520): Single future with timeout using `timeouts` module
- `gather` (L731-862): Aggregate results from multiple coroutines/futures
- `shield` (L865-928): Protect tasks from cancellation propagation

### Utilities
- `sleep` (L653-667): Async delay with zero-delay optimization via `__sleep0` (L641-650)
- `as_completed` (L584-638): Iterator yielding futures as they complete
- `ensure_future` (L670-699): Convert coroutines/awaitables to futures
- `run_coroutine_threadsafe` (L931-951): Cross-thread coroutine execution

## Task Registry System

### Global State (L983-991)
- `_scheduled_tasks`: WeakSet of regular tasks
- `_eager_tasks`: Set of eagerly executing tasks (optimization)
- `_current_tasks`: Loop-to-task mapping for execution tracking

### Management Functions (L994-1036)
- `_register_task`/`_unregister_task`: Regular task lifecycle
- `_register_eager_task`/`_unregister_eager_task`: Eager task optimization
- `_enter_task`/`_leave_task`: Execution context management
- `current_task`/`all_tasks` (L36-67): Task introspection with thread-safe iteration

## Performance Optimizations

### C Extension Fallback (L1049-1065)
Attempts to import optimized C implementations from `_asyncio` module, falling back to Python versions if unavailable. Both versions maintain API compatibility.

### Eager Execution
Tasks can start immediately if the loop is running, avoiding initial scheduling overhead. Used via `eager_start=True` parameter or eager task factory.

## Dependencies
- `base_tasks`: Task representation utilities
- `coroutines`: Coroutine detection and utilities  
- `events`: Event loop access
- `futures`: Future base classes and utilities
- `timeouts`: Timeout context management
- `concurrent.futures`: Threading integration
- `contextvars`: Context variable propagation

## Architecture Notes
- Thread-safe task name generation using `itertools.count()` (L33)
- Careful exception handling preserves context and prevents cycles
- Dual registry system optimizes performance for eager vs scheduled tasks
- Extensive state validation prevents invalid task transitions