# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/counters.rs
@source-hash: e5a6a1a1d01a5089
@generated: 2026-02-09T17:58:16Z

**Multi-thread Runtime Performance Counters**

This file implements conditional runtime statistics collection for Tokio's multi-threaded scheduler. The implementation uses feature-gated compilation to provide either full counter tracking or no-op stubs based on the `tokio_internal_mt_counters` feature flag.

## Core Components

**Counters struct (L59-60)**: Empty marker struct that serves as a RAII guard for printing statistics when dropped.

**Feature-gated implementations**:
- **Active counters module (L2-48)**: When `tokio_internal_mt_counters` is enabled, provides:
  - Five static atomic counters (L6-10) tracking different scheduler events
  - Drop implementation (L12-27) that prints all counter values on destruction
  - Five increment functions (L29-47) for updating each counter
  
- **No-op counters module (L51-57)**: When feature is disabled, provides empty function stubs with zero runtime overhead

## Tracked Metrics

- `NUM_NOTIFY_LOCAL` (L7): Local thread notifications
- `NUM_UNPARKS_LOCAL` (L8): Local thread unpark operations  
- `NUM_MAINTENANCE` (L6): Scheduler maintenance operations
- `NUM_LIFO_SCHEDULES` (L9): LIFO task scheduling events
- `NUM_LIFO_CAPPED` (L10): Capped LIFO scheduling events

## Public Interface

**Increment functions (L29-47, L52-56)**:
- `inc_num_inc_notify_local()`: Increments local notify counter
- `inc_num_unparks_local()`: Increments local unpark counter  
- `inc_num_maintenance()`: Increments maintenance counter
- `inc_lifo_schedules()`: Increments LIFO schedule counter
- `inc_lifo_capped()`: Increments LIFO capped counter

## Architecture Notes

Uses conditional compilation for zero-cost abstraction when counters are disabled. All atomic operations use relaxed memory ordering for minimal performance impact. The re-export pattern (L62) provides a uniform interface regardless of feature configuration. Statistics are automatically printed when the Counters guard is dropped, typically at runtime shutdown.