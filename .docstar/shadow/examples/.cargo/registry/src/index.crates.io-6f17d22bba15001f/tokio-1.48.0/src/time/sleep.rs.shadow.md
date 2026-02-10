# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/time/sleep.rs
@source-hash: c522be83179f0130
@generated: 2026-02-09T18:06:52Z

## Primary Purpose
Implements asynchronous sleep functionality for Tokio's time module. Provides high-level sleep functions and the core `Sleep` future that integrates with Tokio's timer system.

## Key Functions

### `sleep_until(deadline: Instant) -> Sleep` (L62)
Creates a sleep future that completes at a specific deadline. Uses `#[track_caller]` for tracing support and panic location tracking. Panics if no timer is available in the current runtime.

### `sleep(duration: Duration) -> Sleep` (L123)
Creates a sleep future for a relative duration. Handles overflow by setting deadline to `Instant::far_future()`. More commonly used than `sleep_until`.

## Core Type

### `Sleep` struct (L225-231)
The main future type returned by sleep functions. Uses pin projection from `pin_project_lite` and is marked `!Unpin`. Contains:
- `inner: Inner` - Conditional tracing context (L226)
- `entry: TimerEntry` - Timer system integration (L230)

Key methods:
- `new_timeout(deadline, location)` (L250) - Internal constructor with extensive tracing setup
- `far_future(location)` (L306) - Creates sleep for far future deadline
- `deadline()` (L311) - Returns completion instant
- `is_elapsed()` (L318) - Checks if timer has completed
- `reset(deadline)` (L351) - Changes deadline without recreating state
- `reset_without_reregister(deadline)` (L363) - Internal reset without waker registration

## Architecture Patterns

### Conditional Compilation
Uses `cfg_trace!` and `cfg_not_trace!` macros (L234-245) to conditionally include tracing infrastructure in the `Inner` struct.

### Timer Integration
Delegates timing logic to `TimerEntry` from the runtime's timer system. The `Sleep` future acts as a high-level wrapper.

### Tracing Integration
Extensive tracing support when `tokio_unstable` and `tracing` features are enabled:
- Resource spans for tracking timer lifecycle
- Async operation spans for tracing sleep operations
- State update events for duration changes

## Future Implementation

### `poll()` method (L439-450)
Calls `poll_elapsed()` internally and converts timer errors to panics. Includes cooperative scheduling support and tracing span management.

### `poll_elapsed()` method (L399-424)
Core polling logic that:
1. Handles cooperative task scheduling
2. Delegates to `TimerEntry.poll_elapsed()`
3. Reports progress to the cooperative scheduler
4. Wraps result in tracing spans

## Dependencies
- `TimerEntry` from runtime timer system for actual timing
- `pin_project_lite` for pin projection
- Tokio's cooperative scheduling system
- Optional tracing infrastructure

## Critical Constraints
- Requires active Tokio runtime with timer enabled
- Operates at millisecond granularity
- Must be pinned when used with `select!` or direct polling
- Timer errors (capacity/shutdown) cause panics rather than error propagation