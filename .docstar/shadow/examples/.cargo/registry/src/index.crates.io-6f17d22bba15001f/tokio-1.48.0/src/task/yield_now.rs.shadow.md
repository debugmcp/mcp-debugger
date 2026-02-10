# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/task/yield_now.rs
@source-hash: b90ba5c157b41492
@generated: 2026-02-09T18:06:45Z

## Purpose
Implements cooperative task yielding in the Tokio async runtime, allowing tasks to voluntarily give up execution time to allow other tasks to run.

## Key Components

### `yield_now()` Function (L39-64)
- **Purpose**: Async function that yields execution back to the Tokio runtime
- **Returns**: `()`
- **Behavior**: Creates and awaits a `YieldNow` future that implements a two-phase polling mechanism
- **Usage**: Tasks await this function to cooperatively yield control

### `YieldNow` Struct (L41-43)
- **Purpose**: Internal future implementation for the yielding mechanism
- **Fields**:
  - `yielded: bool` - Tracks whether the future has already yielded once

### `Future` Implementation (L45-61)
- **Poll Logic**:
  - First poll (L51-59): Returns `Poll::Pending` and defers waker via `context::defer()`
  - Second poll (L51-52): Returns `Poll::Ready(())` to complete the yield
- **Key Operations**:
  - `trace_leaf()` call (L49) for debugging/tracing
  - `context::defer(cx.waker())` (L57) schedules task for later execution

## Dependencies
- `crate::runtime::context` - Runtime context utilities for task scheduling
- `std::future::Future` - Async trait implementation
- `std::task` - Core polling and waking primitives

## Architecture Pattern
Uses a stateful future pattern where the first poll registers for rescheduling and returns pending, while the second poll completes immediately. This ensures the task yields at least one scheduling cycle.

## Important Behaviors
- Task is re-queued at the back of the pending queue
- No guarantees about scheduling order due to runtime optimizations
- May not yield through certain combinators (e.g., `tokio::select!`)
- Tracing integration for debugging yield points