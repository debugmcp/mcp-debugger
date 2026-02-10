# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/task_yield_now.rs
@source-hash: f65c058e0161fba5
@generated: 2026-02-09T18:12:28Z

## Purpose
Test file for Tokio's `yield_now()` functionality, ensuring it behaves correctly both inside and outside runtime contexts.

## Key Functions

### `yield_now_outside_of_runtime()` (L8-16)
- Tests `task::yield_now()` behavior when called outside a Tokio runtime
- Uses `tokio_test::task::spawn` to create a mock task environment
- Verifies that `yield_now()` properly yields control (returns `Pending` on first poll)
- Confirms the task is marked as woken after yielding
- Validates task completes successfully on second poll

### `yield_now_external_executor_and_block_in_place()` (L18-24)
- Async test running on multi-threaded Tokio runtime
- Tests interaction between `yield_now()` and `block_in_place()`
- Spawns task that uses external executor (`futures::executor::block_on`) within `block_in_place`
- Ensures `yield_now()` works correctly when called from external executor context

## Dependencies
- `tokio::task` - Core task utilities including `yield_now()` and `block_in_place()`
- `tokio_test::task::spawn` - Mock task spawning for testing outside runtime
- `futures::executor::block_on` - External executor for blocking execution

## Configuration
Conditionally compiled with features:
- `full` feature enabled
- Not targeting WASI
- `tokio_unstable` feature enabled

## Testing Strategy
Covers two critical scenarios:
1. Yielding behavior in mock/test environments without full runtime
2. Yielding behavior when mixing Tokio runtime with external executors via `block_in_place`