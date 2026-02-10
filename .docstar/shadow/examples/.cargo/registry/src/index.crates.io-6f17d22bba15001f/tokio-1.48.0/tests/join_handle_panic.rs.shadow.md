# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/join_handle_panic.rs
@source-hash: 3cfa1437f51802eb
@generated: 2026-02-09T18:12:18Z

## Purpose
Integration test file validating that panics occurring during `JoinHandle` drop operations do not propagate and crash the runtime. Tests Tokio's panic isolation mechanisms.

## Key Components

### PanicsOnDrop (L5-11)
Test utility struct that panics when dropped. Used to simulate panic-inducing cleanup operations.
- `drop()` method (L8-10): Always panics with "I told you so" message

### test_panics_do_not_propagate_when_dropping_join_handle (L13-21)
Integration test validating panic isolation during `JoinHandle` cleanup.
- Spawns task returning `PanicsOnDrop` instance (L15)
- Uses `tokio::time::sleep()` for crude synchronization (L19)
- Drops `JoinHandle` after task completion, triggering panic in destructor (L20)
- Verifies runtime doesn't crash from propagated panic

## Dependencies
- `tokio`: Async runtime and testing framework
- `std::time::Duration`: Sleep duration specification

## Configuration Constraints
- Requires `full` feature flag
- Excludes WASI targets (no panic recovery support)
- Requires `panic = "unwind"` configuration
- Uses `rust_2018_idioms` warnings

## Testing Pattern
Crude timing-based synchronization approach using fixed 3ms sleep. Tests panic boundary enforcement in Tokio's task cleanup mechanisms.