# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/rt_basic.rs
@source-hash: b3ed283326064c47
@generated: 2026-02-09T18:12:33Z

## File Purpose
Test suite for Tokio's basic runtime functionality, specifically testing the current-thread runtime scheduler behavior and edge cases. Validates task spawning, execution, dropping, panic handling, and metrics collection.

## Key Test Functions

### Core Runtime Behavior Tests
- `spawned_task_does_not_progress_without_block_on()` (L29-46): Verifies tasks don't execute without explicit runtime drive via block_on
- `no_extra_poll()` (L48-114): Tests that streams are polled the minimum required times using custom TrackPolls wrapper
- `spawn_two()` (L221-251): Tests nested task spawning and local scheduling metrics
- `spawn_remote()` (L254-287): Tests remote task scheduling from background threads with metrics validation

### Drop and Cleanup Tests  
- `acquire_mutex_in_drop()` (L116-150): Tests runtime drop behavior with pending tasks using chained oneshot channels
- `drop_tasks_in_context()` (L152-179): Validates that tasks dropped during runtime shutdown still have access to runtime context
- `wake_in_drop_after_panic()` (L181-219): Tests wakeup behavior during panic handling using WakeOnDrop helper struct

### Configuration Tests
- `timeout_panics_when_no_time_handle()` (L289-303): Verifies timeout panics when time features are disabled

### Unstable Feature Tests (L305-452)
- `shutdown_on_panic()` (L309-326): Tests UnhandledPanic::ShutdownRuntime behavior
- `spawns_do_nothing()` (L328-355): Validates task spawning fails after runtime shutdown
- `shutdown_all_concurrent_block_on()` (L357-394): Tests concurrent block_on calls during panic shutdown
- `rng_seed()` (L396-422): Tests deterministic RNG seeding across runtime instances
- `rng_seed_multi_enter()` (L424-451): Tests RNG consistency across multiple runtime entries

## Key Helper Components

### TrackPolls Stream Wrapper (L59-77)
Pin-projected struct that counts poll calls on wrapped streams using AtomicUsize counter. Used to verify minimal polling behavior.

### ContextOnDrop Future (L156-172) 
Custom future that checks runtime handle availability during drop to validate cleanup context.

### WakeOnDrop Helper (L185-191)
Drop guard that sends oneshot signal on drop, used to test wakeup behavior during panic scenarios.

### Support Module (L16-18)
References external `mpsc_stream` module for unbounded channel streams.

## Utility Functions
- `rt()` (L454-459): Creates standard current-thread runtime with all features enabled
- `cfg_metrics!` macro (L20-27): Conditionally compiles metrics-related code based on tokio_unstable and atomic support

## Dependencies
- Core: tokio runtime, sync primitives, time utilities
- Testing: tokio_test assertions, pin_project_lite, tokio_stream
- External: futures crate for additional utilities

## Architecture Notes
- Uses current-thread runtime exclusively for deterministic testing
- Extensive use of oneshot channels for task coordination
- Metrics validation requires tokio_unstable feature flag
- Tests cover both normal operation and edge cases (panics, drops, shutdown)
- Platform-specific test exclusions for WASI and Miri environments