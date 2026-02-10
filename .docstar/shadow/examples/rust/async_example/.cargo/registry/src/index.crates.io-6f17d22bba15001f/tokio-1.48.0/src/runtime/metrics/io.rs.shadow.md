# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/metrics/io.rs
@source-hash: c329886c5193910a
@generated: 2026-02-09T18:03:03Z

## Purpose
Metrics collection for Tokio's I/O driver, tracking file descriptor registration/deregistration and readiness events using atomic counters.

## Key Components

**IoDriverMetrics struct (L6-11)**
- Primary metrics container for I/O driver operations
- `fd_registered_count`: Tracks file descriptor registrations
- `fd_deregistered_count`: Tracks file descriptor deregistrations  
- `ready_count`: Tracks total readiness events
- All fields use `MetricAtomicU64` for thread-safe atomic operations

**Core Methods (L13-25)**
- `incr_fd_count()` (L14-16): Increments registered FD counter by 1
- `dec_fd_count()` (L18-20): Increments deregistered FD counter by 1
- `incr_ready_count_by(amt)` (L22-24): Adds specified amount to ready event counter

## Dependencies
- `crate::util::metric_atomics::MetricAtomicU64`: Custom atomic wrapper for metrics
- `std::sync::atomic::Ordering::Relaxed`: Memory ordering for atomic operations

## Architectural Notes
- Uses relaxed memory ordering for performance - exact ordering of metric updates not critical
- Conditional compilation with `net` feature flag (L1) - becomes dead code when networking disabled
- Public within crate but internal to Tokio's implementation
- Thread-safe design allows concurrent access from multiple I/O threads
- Metrics are increment-only counters, no decrement operations for registered FDs

## Usage Context
Part of Tokio's runtime metrics system, specifically for monitoring I/O driver performance and resource usage. Likely consumed by runtime introspection and debugging tools.