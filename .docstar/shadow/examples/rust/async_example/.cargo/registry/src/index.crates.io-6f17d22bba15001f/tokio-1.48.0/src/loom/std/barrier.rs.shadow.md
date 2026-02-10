# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/std/barrier.rs
@source-hash: 9beeff33c89c6d7e
@generated: 2026-02-09T18:02:54Z

## Purpose & Responsibility
Thread synchronization barrier implementation that mirrors Rust's standard library `Barrier` but adds timeout functionality. Located in Tokio's `loom` module for testing concurrent code with deterministic scheduling.

## Key Components

### Barrier struct (L38-42)
Primary synchronization primitive with fields:
- `lock: Mutex<BarrierState>` - Protected state access
- `cvar: Condvar` - Condition variable for thread coordination  
- `num_threads: usize` - Total threads that must rendezvous

### BarrierState struct (L45-48)
Internal state tracking:
- `count: usize` - Current waiting threads
- `generation_id: usize` - Barrier cycle identifier to handle reuse

### BarrierWaitResult struct (L61)
Return type wrapping boolean indicating if thread is the "leader" (last to arrive).

## Core Methods

### `new(n: usize)` (L85-94)
Constructor requiring number of participating threads. Initializes with zero count and generation ID.

### `wait()` (L132-149)
Blocking synchronization method:
- Increments count under lock
- If not last thread: waits on condition variable using generation ID to handle spurious wakeups
- If last thread: resets count, increments generation, notifies all waiters
- Returns `BarrierWaitResult(true)` for leader, `false` for others

### `wait_timeout(timeout: Duration)` (L153-192) 
Timeout-enabled variant unique to this implementation:
- Uses deadline-based timeout calculation
- Custom lock acquisition loop with yielding (L160-168)
- Adjusts timeout for lock acquisition time
- Same barrier logic as `wait()` but with timeout handling
- Returns `None` on timeout, `Some(BarrierWaitResult)` on success

## Dependencies
- `crate::loom::sync::{Condvar, Mutex}` - Loom's testing-friendly synchronization primitives
- `std::time::{Duration, Instant}` - Timeout functionality

## Key Patterns
- **Generation-based reuse**: Prevents race conditions when barriers are reused across multiple synchronization cycles
- **Spurious wakeup protection**: While loops around condition variable waits
- **Leader election**: Last arriving thread becomes leader and triggers release
- **Wrapping arithmetic**: `generation_id.wrapping_add(1)` prevents overflow

## Critical Invariants
- Exactly one thread per barrier cycle receives `is_leader() == true`
- Barrier can be safely reused after all threads pass through
- Timeout variant maintains same synchronization semantics as non-timeout version