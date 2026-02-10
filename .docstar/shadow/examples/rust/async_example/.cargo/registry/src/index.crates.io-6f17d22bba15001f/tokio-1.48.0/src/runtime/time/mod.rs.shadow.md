# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/time/mod.rs
@source-hash: e59c976435ce61b0
@generated: 2026-02-09T18:03:23Z

## Timer Driver Module (Tokio Runtime)

**Primary Purpose**: Implements the time driver for Tokio's async runtime, managing timer wheels and coordinating sleep, timeout, and interval operations with the I/O event loop.

### Core Architecture

**Driver (L87-90)**: Main time driver struct that wraps an `IoStack` for parking threads. Created via `new()` (L126-146) which returns both a `Driver` and `Handle` pair.

**Inner/InnerState (L93-117)**: Shared timer state split across two structs:
- `Inner`: Contains mutex-protected state and atomic shutdown flag
- `InnerState`: Protected state including next wake time and timer wheel

**Handle**: Time driver handle for timer operations (imported from handle module, L14)

### Timer Wheel Implementation

Based on Varghese and Lauck's hashed timing wheel paper with 6-level hierarchical structure:
- Level 0: 64 × 1ms slots
- Level 1: 64 × 64ms slots  
- Level 2: 64 × ~4s slots
- Level 3: 64 × ~4min slots
- Level 4: 64 × ~4hr slots
- Level 5: 64 × ~12day slots

Timers cascade down levels as time progresses until reaching level 0 for notification.

### Key Operations

**park/park_timeout (L148-154)**: Main event loop integration points that delegate to `park_internal()` (L172-215). Calculates next wake time from timer wheel and parks the thread appropriately.

**process/process_at_time (L249-296)**: Core timer processing logic:
- Handles time going backwards (L260-268)
- Polls expired timers from wheel (L270-286)
- Wakes tasks in batches to avoid deadlocks
- Updates next wake time

**Timer Management**:
- `clear_entry()` (L308-318): Removes and cancels timers
- `reregister()` (L326-379): Moves timers to new expiration times

### Dependencies & Integration

- **IoStack**: Underlying parking mechanism for blocking threads
- **TimeSource**: Clock abstraction for getting current time and converting ticks
- **WakeList**: Batch waker management to avoid deadlock during timer notification
- **TimerEntry/TimerShared**: Timer entry types from entry module

### Critical Behaviors

- **Resolution**: 1ms minimum, rounds up sub-millisecond durations
- **Thread Safety**: All operations are thread-safe via mutex protection
- **Shutdown Handling**: Advances time to u64::MAX and notifies all pending timers with errors
- **Monotonic Time**: Handles backwards time movement gracefully (L260-268)
- **Test Integration**: Special parking behavior when `test-util` feature enabled for time mocking

### Conditional Compilation

- `#[cfg(feature = "test-util")]`: Special test utilities for time mocking (L106-107, L217-239, L381-385)
- `#[cfg(not(feature = "rt"))]`: Dead code allowance when runtime disabled (L5)