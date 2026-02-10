# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/rt_local.rs
@source-hash: 4d0d7c730ee1b634
@generated: 2026-02-09T18:12:26Z

## Purpose and Responsibility
Test suite for Tokio's `LocalRuntime` functionality, specifically testing thread-local task spawning (`spawn_local`) behavior and runtime context management. Requires `tokio_unstable` feature flag to access experimental APIs.

## Key Test Functions

### Core spawn_local Tests
- **`test_spawn_local_in_runtime` (L8-23)**: Validates basic `spawn_local` functionality within a runtime context using oneshot channels for synchronization
- **`test_spawn_local_on_runtime_object` (L42-55)**: Tests spawning local tasks directly on the runtime object via `rt.spawn_local()`
- **`test_spawn_local_from_guard` (L58-73)**: Verifies local task spawning works when runtime context is entered via guard (`rt.enter()`)

### Cross-Thread Behavior Tests
- **`test_spawn_from_handle` (L26-39)**: Tests normal task spawning via runtime handle (not local tasks)
- **`test_spawn_from_guard_other_thread` (L77-92)**: Validates that regular `tokio::spawn` works across threads with runtime guard
- **`test_spawn_local_from_guard_other_thread` (L97-112)**: **Panic test** ensuring `spawn_local` fails when called from different thread than runtime creation thread

### Utility Function
- **`rt()` (L114-119)**: Factory function creating `LocalRuntime` with current-thread scheduler and all features enabled

## Dependencies and Relationships
- `tokio::runtime::LocalOptions`: Configuration for local runtime
- `tokio::task::spawn_local`: Thread-local task spawning primitive
- `tokio::sync::oneshot`: Channel-based synchronization for test coordination
- `std::sync::mpsc`: Standard library channels for cross-thread communication

## Architectural Patterns
- **Consistent test structure**: All tests use oneshot channels to synchronize async operations and verify results
- **Thread affinity enforcement**: Local tasks are strictly bound to their creation thread
- **Runtime context management**: Tests various ways to establish runtime context (block_on, enter guard, handle)

## Critical Invariants
- Local tasks can only be spawned on the thread that created the `LocalRuntime`
- Cross-thread `spawn_local` attempts must panic with specific error message
- All async operations use `yield_now()` to ensure proper task scheduling
- Tests expect result value of `5` as synchronization proof