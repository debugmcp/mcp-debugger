# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/task_id.rs
@source-hash: c7c5984eeabccce2
@generated: 2026-02-09T18:12:37Z

## Primary Purpose
Test suite for Tokio's task ID functionality, ensuring proper ID assignment, uniqueness, and behavior across different runtime scenarios.

## Key Test Functions

### Basic Task ID Tests
- `task_id_spawn()` (L17-22): Verifies task ID retrieval within spawned async tasks
- `task_id_spawn_blocking()` (L25-30): Tests task ID access in blocking tasks (non-WASI only)

### ID Uniqueness Tests
- `task_id_collision_current_thread()` (L32-39): Ensures different tasks get unique IDs in single-threaded runtime
- `task_id_collision_multi_thread()` (L42-49): Validates ID uniqueness in multi-threaded runtime (non-WASI only)

### Handle-Task ID Consistency
- `task_ids_match_current_thread()` (L51-60): Verifies handle.id() matches task::id() within task (current_thread)
- `task_ids_match_multi_thread()` (L63-72): Same verification for multi-threaded runtime (non-WASI only)

### Future Lifecycle and ID Context
- `task_id_future_destructor_completion()` (L75-100): Tests task ID availability in future destructor after completion
  - Uses `MyFuture` struct (L77-93) with custom Drop impl that captures task ID
- `task_id_future_destructor_abort()` (L103-128): Validates task ID in destructor when task is aborted
  - Similar `MyFuture` pattern (L105-120) but with Poll::Pending

### Output Destructor Scenarios
- `task_id_output_destructor_handle_dropped_before_completion()` (L130-160): Tests task ID in output destructor when handle dropped before task completes
  - `MyOutput` struct (L132-140) and `MyFuture` struct (L142-152)
- `task_id_output_destructor_handle_dropped_after_completion()` (L162-201): Tests output destructor when handle dropped after completion
  - More complex `MyFuture` (L174-188) with dual channels for coordination

### Edge Cases and Error Conditions
- `task_try_id_outside_task()` (L203-206): Validates `try_id()` returns None outside task context
- `task_try_id_inside_block_on()` (L209-215): Tests `try_id()` within `block_on` (non-WASI only)

### LocalSet Integration
- `task_id_spawn_local()` (L217-226): Basic test for local task spawning
- `task_id_nested_spawn_local()` (L228-249): Verifies ID isolation between nested LocalSet contexts

### Advanced Runtime Scenarios
- `task_id_block_in_place_block_on_spawn()` (L253-271): Tests ID behavior with `block_in_place` and nested runtimes (multi_thread, non-WASI only)

### Panic Location Tests
- `task_id_outside_task_panic_caller()` (L274-284): Verifies panic location when calling `task::id()` outside task
- `task_id_inside_block_on_panic_caller()` (L287-300): Tests panic location within `block_on` context

## Dependencies
- `tokio::task::{self, Id, LocalSet}` (L10): Core task functionality
- `tokio::sync::oneshot` (L9): Channel-based coordination between tests
- `tokio::runtime::Runtime` (L8): Manual runtime creation
- `support::panic::test_panic` (L15): Custom panic testing utility

## Key Patterns
- Extensive use of oneshot channels for cross-task communication and verification
- Custom Future implementations with Drop traits to test lifecycle behavior
- Platform-specific tests (excluding WASI) for blocking operations
- Panic unwind testing with conditional compilation