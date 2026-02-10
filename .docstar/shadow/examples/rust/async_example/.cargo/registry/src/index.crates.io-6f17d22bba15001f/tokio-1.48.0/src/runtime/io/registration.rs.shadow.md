# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/io/registration.rs
@source-hash: 270af1b22dd4e563
@generated: 2026-02-09T18:03:10Z

## Purpose and Responsibility

Core I/O registration module that bridges Mio's event sources with Tokio's async runtime. Provides low-level API for associating I/O resources with the reactor, managing readiness streams, and coordinating async task wakeups.

## Key Classes and Functions

**Registration struct (L46-54)**
- Primary abstraction for I/O resource lifecycle management
- Contains scheduler handle and shared ScheduledIo state
- Implements Send + Sync for multi-task access with strict concurrency constraints

**Registration::new_with_interest_and_handle (L73-81)**
- Factory method registering Mio Source with reactor
- Takes mutable I/O resource, Interest flags, and scheduler handle
- Returns registration or I/O error

**Registration::deregister (L99-101)**
- Removes I/O resource from reactor before drop
- Required cleanup to prevent resource leaks

**Readiness Polling Methods**
- `poll_read_ready/poll_write_ready (L109-117)`: Poll-based readiness for specific directions
- `poll_io (L162-181)`: Generic polling with retry logic for WouldBlock errors
- `try_io (L183-202)`: Non-blocking attempt with immediate failure on not-ready
- `async_io (L214-234)`: Async version with cooperative task yielding

**Async Readiness Methods**
- `readiness (L204-212)`: Async wait for interest-based events
- Uses shared ScheduledIo for cross-task coordination

## Dependencies and Architecture

- **Mio Integration**: Direct Source trait usage for event registration
- **Scheduler Coupling**: Tight integration with runtime scheduler for driver access
- **ScheduledIo**: Shared state management via Arc for multi-task coordination
- **Cooperative Scheduling**: Integration with coop system for task fairness
- **Tracing**: Leaf trace integration for debugging

## Critical Invariants and Patterns

**Concurrency Contract**: Maximum two concurrent tasks per Registration - one for read, one for write polling. Violation causes lost notifications and hanging tasks.

**Mutual Exclusion**: All poll methods require caller-enforced mutual exclusion per direction to prevent race conditions.

**WouldBlock Handling**: Consistent pattern across all I/O methods - clear readiness state on WouldBlock, retry on next readiness event.

**Shutdown Detection**: All methods check `is_shutdown` flag and return `gone()` error when runtime is shutting down.

**Resource Lifecycle**: Drop implementation clears wakers to break potential cycles between ScheduledIo and driver (addresses tokio#3481).

## Platform Considerations

- WASI exclusion for `poll_read_io` (L121)  
- Platform-specific Mio events delivered through read stream only
- Write stream exclusively for writable events