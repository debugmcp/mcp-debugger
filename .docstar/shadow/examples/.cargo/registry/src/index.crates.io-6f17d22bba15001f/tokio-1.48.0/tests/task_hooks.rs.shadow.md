# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/task_hooks.rs
@source-hash: 2376706b3d28546d
@generated: 2026-02-09T18:12:35Z

## Purpose and Responsibility

Test module for Tokio's task hook functionality, validating that runtime task lifecycle hooks fire correctly and provide accurate spawn location metadata. Only enabled with full features, unstable API access, and 64-bit atomic support.

## Key Constants and Configuration
- `TASKS` (L10): Number of tasks spawned in tests (8)
- `ITERATIONS` (L11): Runtime tick iterations for task completion (64)
- Feature gates (L2): Requires `tokio_unstable` and `target_has_atomic = "64"`

## Test Functions

### `spawn_task_hook_fires` (L13-46)
Tests that `on_task_spawn` hooks execute for every spawned task. Creates current-thread runtime with spawn hook that:
- Tracks unique task IDs in a HashSet
- Increments atomic counter
- Validates hook invocation count matches spawned task count

### `terminate_task_hook_fires` (L49-73)  
Tests that `on_task_terminate` hooks execute when tasks complete. Uses ready futures to ensure immediate completion and validates termination count through atomic counter after runtime ticking.

### `task_hook_spawn_location_current_thread` (L77-116)
Validates spawn location metadata accuracy on current-thread runtime. Tests all three hook types:
- `on_task_spawn`
- `on_before_task_poll` 
- `on_after_task_poll`

Uses both `runtime.spawn()` and `tokio::spawn()` to verify location tracking across different spawn paths.

### `task_hook_spawn_location_multi_thread` (L128-175)
Same as current-thread test but for multi-threaded runtime. Includes explicit shutdown with timeout and uses `fetch_add(0, SeqCst)` for counter reads to avoid race conditions (L167-170 comment explains this pattern).

## Helper Functions

### `mk_spawn_location_hook` (L177-194)
Factory function creating task hook closures that:
- Print event details with task ID and spawn location
- Assert spawn location file matches current test file
- Increment provided atomic counter

## Dependencies
- `std::collections::HashSet` for task ID tracking
- `std::sync::atomic` for thread-safe counters
- `tokio::runtime::Builder` for runtime configuration with hooks

## Notable Patterns
- Arc-wrapped atomic counters for multi-threaded access
- Clone pattern for moving references into closures
- Runtime ticking via `yield_now()` loops to ensure task completion
- Different memory ordering strategies between single/multi-thread tests