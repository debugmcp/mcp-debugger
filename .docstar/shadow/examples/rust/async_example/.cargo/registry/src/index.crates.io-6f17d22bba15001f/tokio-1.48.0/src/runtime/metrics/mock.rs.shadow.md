# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/metrics/mock.rs
@source-hash: d0acc1a3c8e87bff
@generated: 2026-02-09T18:03:00Z

## Purpose and Responsibility

Mock implementation file for Tokio runtime metrics types, providing no-op implementations for testing and compilation scenarios where full metrics functionality is not needed.

## Key Types and Functions

### SchedulerMetrics (L3)
- Mock struct for scheduler metrics collection
- `new()` constructor (L9-11): Creates empty instance
- `inc_remote_schedule_count()` (L14): No-op method for incrementing remote task scheduling count

### HistogramBuilder (L6)
- Mock builder struct with Clone and Default traits
- Likely used for constructing histogram metrics in non-mock implementations

## Architectural Notes

- All implementations are deliberately empty (no-op) as this is a mock module
- Uses `pub(crate)` visibility for internal crate access only
- Follows the same interface as the real metrics types to enable seamless substitution
- Part of Tokio's conditional compilation strategy for metrics collection