# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/task_abort.rs
@source-hash: 59baffc230c54cb1
@generated: 2026-02-09T18:12:34Z

## Purpose
Test suite for Tokio task abortion functionality, verifying that suspended tasks can be aborted safely without panicking across different runtime configurations and edge cases.

## Key Test Functions

### Core Abort Tests
- **test_abort_without_panic_3157** (L23-39): Tests aborting suspended tasks in multi-threaded runtime without panicking. Creates a long-sleeping task, waits briefly, then aborts it.
- **test_abort_without_panic_3662** (L45-102): Tests aborting tasks in current_thread executor with proper cleanup verification using atomic drop flags. Includes complex thread coordination to test deferred cleanup.
- **remote_abort_local_set_3929** (L108-146): Tests aborting LocalSet tasks from remote threads, ensuring non-Send values are dropped on correct threads using ThreadId validation.
- **test_abort_wakes_task_3964** (L151-176): Tests that task abortion works even when JoinHandle is immediately dropped, using Arc weak references to verify task cleanup.

### Panic Handling Tests  
- **test_abort_task_that_panics_on_drop_contained** (L182-201): Tests that panics during task destructor are contained when task is aborted (panic = "unwind" only).
- **test_abort_task_that_panics_on_drop_returned** (L206-222): Tests that panics during destructor are properly returned as JoinError::Panic.

### JoinError Display Tests
- **test_join_error_display** (L229-275): Tests Display formatting of JoinError for different panic payload types (String, &str, non-string).
- **test_join_error_debug** (L280-326): Tests Debug formatting of JoinError for different panic payload types.

## Key Structures
- **PanicOnDrop** (L11-18): Test helper struct that panics in its Drop implementation (panic = "unwind" only).
- **DropCheck** (L49-55 in test_abort_without_panic_3662): Uses AtomicBool to track drop execution.
- **DropCheck** (L109-128 in remote_abort_local_set_3929): Non-Send struct that validates drop occurs on creation thread.

## Dependencies
- tokio::runtime::Builder for runtime creation
- tokio::time for Duration and sleep operations  
- std::thread for cross-thread testing
- std::sync::{Arc, atomic::AtomicBool} for thread-safe coordination
- futures::future::pending for indefinite suspension

## Testing Patterns
- All tests use current_thread or multi_thread runtimes via Builder
- Common pattern: spawn long-running/suspended task → brief wait → abort → verify behavior
- Extensive use of Arc/weak references and atomic flags for cleanup verification
- Cross-thread coordination to test edge cases in task scheduling