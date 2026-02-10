# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/time/timeout.rs
@source-hash: c571b4e933bf7e71
@generated: 2026-02-09T18:06:50Z

## Purpose
Provides timeout functionality for Tokio futures, allowing futures to be canceled if they don't complete within a specified duration or by a deadline.

## Key Components

### Public Functions
- **`timeout(duration, future)` (L86-98)**: Creates a timeout future that wraps another future, canceling it if it doesn't complete within the given duration. Returns `Result<T, Elapsed>`. Uses `Instant::now().checked_add(duration)` to calculate deadline and creates a `Sleep::new_timeout()` or `Sleep::far_future()` for timing.

- **`timeout_at(deadline, future)` (L145-155)**: Similar to `timeout()` but accepts an absolute `Instant` deadline instead of a duration. Uses `sleep_until(deadline)` for timing.

### Core Type
- **`Timeout<T>` struct (L161-167)**: Pin-projected future wrapper containing:
  - `value: T` - the wrapped future being executed
  - `delay: Sleep` - the timeout timer

### Timeout Implementation
- **`Timeout::new_with_delay()` (L170-172)**: Internal constructor used by timeout functions
- **Accessor methods (L174-187)**: `get_ref()`, `get_mut()`, `into_inner()` for accessing wrapped future
- **`Future` implementation (L190-208)**: Core polling logic that:
  1. Polls the wrapped future first
  2. Returns `Ok(value)` if future completes
  3. Falls back to polling timeout delay, returning `Err(Elapsed)` on timeout

### Optimization Helper
- **`poll_delay()` (L212-234)**: Monomorphization optimization that handles timeout polling with cooperative scheduling awareness. Implements budget-aware polling to prevent pathological cases where the wrapped future always exhausts the cooperative budget.

## Dependencies
- Uses `crate::time::{Sleep, Instant, Duration}` for timing primitives
- Leverages `crate::task::coop` for cooperative scheduling
- Depends on `pin_project_lite` for safe pin projection

## Key Behaviors
- Timeout is checked before polling the future, so non-yielding futures can exceed timeout without error
- Cancellation is handled by dropping the future (no special cleanup needed)
- Handles budget exhaustion scenarios to ensure timeout checking isn't starved
- Supports both relative duration and absolute deadline timeouts

## Error Handling
- Returns `Elapsed` error type on timeout
- Panics if no current timer is set (requires Tokio runtime with time enabled)