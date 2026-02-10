# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/task_local_set.rs
@source-hash: a321ef58d3d454a4
@generated: 2026-02-09T18:12:47Z

## Purpose
Comprehensive test suite for Tokio's `LocalSet` functionality, ensuring thread-local task execution, runtime compatibility, and proper lifecycle management across different runtime flavors.

## Core Test Categories

### Basic LocalSet Operations
- `local_current_thread_scheduler()` (L24-31): Validates basic LocalSet operation on current-thread runtime
- `enter_guard_spawn()` (L138-152): Tests LocalSet enter guard functionality with manual task spawning

### Thread Affinity & Multi-threading Tests
- `local_threadpool()` (L34-52): Verifies tasks stay on original thread using thread-local storage
- `localset_future_threadpool()` (L55-68): Tests LocalSet as future maintains thread affinity
- `all_spawns_are_local()` (L303-327): Validates 128 concurrent tasks all run on local thread
- `nested_spawn_is_local()` (L330-363): Tests deeply nested spawn_local calls maintain thread locality

### Timing & Coordination
- `localset_future_timers()` (L71-88): Tests timer functionality within LocalSet futures
- `localset_future_drives_all_local_futs()` (L90-113): Ensures all local futures are driven to completion
- `local_threadpool_timer()` (L116-137): Validates timer services work correctly in LocalSet

### Blocking Operations & Runtime Interactions
- `local_threadpool_blocking_run()` (L274-300): Tests spawn_blocking works correctly from LocalSet
- `block_in_place_cases` module (L155-271): Comprehensive tests ensuring block_in_place panics appropriately in LocalSet contexts
  - `BlockInPlaceOnDrop` struct (L161-173): Custom future that calls block_in_place in drop
  - Various panic tests for different runtime flavors and execution contexts

### Task Lifecycle & Cancellation
- `drop_cancels_tasks()` (L422-449): Ensures dropping LocalSet cancels running tasks using Rc reference counting
- `drop_cancels_remote_tasks()` (L496-516): Tests cancellation of remotely notified tasks
- `acquire_mutex_in_drop()` (L622-656): Tests LocalSet drop behavior with pending tasks

### Advanced Scenarios
- `join_local_future_elsewhere()` (L366-399): Tests local task execution when joined from different threads
- `localset_in_thread_local()` (L403-420): Tests LocalSet stored in thread-local storage
- `local_tasks_wake_join_all()` (L522-541): Reproduces and tests issue #2460 with join_all
- `spawn_wakes_localset()` (L658-665): Ensures spawning tasks wakes the LocalSet future

### Timing-Sensitive Tests
- `local_tasks_are_polled_after_tick()` (L544-558): Retry wrapper for timing-dependent test
- `local_tasks_are_polled_after_tick_inner()` (L561-620): Complex test reproducing issues #1899/#1900 with task polling timing

### Unstable Features
- `unstable` module (L730-801): Tests for experimental LocalSet features
  - `shutdown_on_panic()` (L735-750): Tests UnhandledPanic::ShutdownRuntime behavior
  - `run_until_does_not_get_own_budget()` (L758-800): Tests budget inheritance in run_until

## Key Dependencies
- `tokio::task::LocalSet`: Primary component under test
- `futures`: For future combinators and testing utilities
- `std::cell::Cell`: Thread-local state tracking (WASI-excluded)
- `std::sync::atomic`: Cross-thread coordination
- `tokio::sync::{mpsc, oneshot}`: Channel-based coordination

## Test Utilities
- `with_timeout()` (L455-490): Wrapper for tests that might hang, prevents infinite loops
- `complete()` (L175-182): Helper for awaiting JoinHandles with proper panic handling
- `rt()` (L803-808): Standard current-thread runtime builder

## Platform Considerations
Extensive use of `#[cfg(not(target_os = "wasi"))]` to exclude threading-dependent tests on WASI platform, as WASI doesn't support threads.

## Architecture Patterns
Tests demonstrate LocalSet's key invariant: tasks spawned with `spawn_local` always execute on the thread where LocalSet was created, regardless of where they are awaited or how the runtime is configured.