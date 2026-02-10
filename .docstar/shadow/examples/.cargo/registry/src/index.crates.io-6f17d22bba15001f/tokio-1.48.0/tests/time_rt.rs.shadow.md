# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/time_rt.rs
@source-hash: 7467d08a4d681eba
@generated: 2026-02-09T18:12:33Z

## Purpose
Integration test suite for Tokio's time utilities, validating timer functionality across different runtime configurations and edge cases.

## Key Tests

### `timer_with_threaded_runtime` (L10-26)
Tests `sleep_until()` functionality with multi-threaded runtime. Creates a 10ms timer task, spawns it asynchronously, and verifies timing accuracy using channel-based synchronization.

### `timer_with_current_thread_scheduler` (L29-45)  
Validates `sleep_until()` with single-threaded current_thread scheduler. Uses `block_on()` instead of spawning, testing same timing logic as multi-threaded variant.

### `starving` (L48-76)
Tests timer behavior under CPU starvation conditions. Uses custom `Starve` future (L53-69) that continuously wakes itself while wrapping a sleep operation, ensuring timers still complete despite scheduler pressure.

### `timeout_value` (L79-90)
Validates `timeout()` function behavior with operations that never complete. Uses oneshot channel receiver that never receives, verifying timeout triggers correctly after specified duration.

## Key Components

### `Starve<T>` Future (L53-69)
Custom future wrapper that simulates CPU starvation by:
- Incrementing counter on each poll (L63)
- Immediately re-waking via `wake_by_ref()` (L65)  
- Only resolving when wrapped future completes (L59-60)

## Dependencies
- `tokio::time::*` - Core time utilities (sleep_until, timeout, Instant, Duration)
- `tokio::runtime` - Runtime builders and executors
- `std::sync::mpsc` - Channel-based test synchronization
- `tokio::sync::oneshot` - Single-use channels for timeout testing

## Architecture Notes
- Tests cover both multi-threaded and single-threaded runtime scenarios
- Uses conditional compilation for WASI compatibility (L8)
- Employs channel patterns for async test coordination
- Validates both functional correctness and timing guarantees