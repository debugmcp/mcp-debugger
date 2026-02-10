# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/tests/task.rs
@source-hash: 31f1e147c9d292aa
@generated: 2026-02-09T18:03:18Z

## Test Module for Tokio Runtime Task System

This file contains comprehensive unit tests for Tokio's task runtime system, specifically testing task lifecycle management, reference counting, shutdown behavior, and scheduling mechanisms.

### Key Test Utilities

**AssertDrop/AssertDropHandle (L29-49)**: Core testing utility that tracks when objects are dropped using shared `Arc<AtomicBool>`. Provides thread-safe assertions to verify drop behavior in async contexts.

**Test Runtime (L383-453)**: Custom lightweight runtime implementation for testing:
- `Runtime` struct wrapping `Inner` with `OwnedTasks` and task queue
- Implements `Schedule` trait for task scheduling
- Provides controlled task execution via `tick()` and `tick_max()`
- Manages task lifecycle through spawn/shutdown operations

### Primary Test Categories

**Reference Counting Tests (L53-153)**:
- `create_drop1/2`: Test basic task drop behavior with different handle drop orders
- `drop_abort_handle1/2`: Verify abort handles maintain task references correctly  
- `drop_abort_handle_clone`: Test cloned abort handle reference counting

**Shutdown Mechanism Tests (L156-236)**:
- `create_shutdown1/2`: Test explicit shutdown via `notified.shutdown()`
- `shutdown/shutdown_immediately`: Test runtime shutdown with running tasks

**Complex Async Scenarios**:
- `spawn_niche_in_task` (L239-330): Regression test for issue #6729 involving async state management with custom `Subscriber/State` pattern
- `spawn_during_shutdown` (L332-359): Test spawning tasks during shutdown process

### Key Dependencies

Imports from `crate::runtime::task` module including `unowned`, `JoinHandle`, `OwnedTasks`, and core task types. Uses `NoopSchedule` for simple test scenarios and custom `Runtime` implementation for complex scheduling tests.

### Notable Patterns

The test runtime uses a global `CURRENT` mutex (L395) for runtime access, with RAII cleanup via `Reset` struct. Tasks are managed through `OwnedTasks` with 16-slot capacity and executed via `VecDeque`-based scheduling queue.

Tests extensively verify that task futures containing test objects are properly dropped when tasks complete or are shutdown, ensuring no memory leaks in the task system.