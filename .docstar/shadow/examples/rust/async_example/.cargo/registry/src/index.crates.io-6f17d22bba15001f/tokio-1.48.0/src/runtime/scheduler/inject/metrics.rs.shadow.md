# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/inject/metrics.rs
@source-hash: 26ee4f9d34c9d670
@generated: 2026-02-09T17:58:12Z

## Purpose
Metrics implementation for the Inject queue, providing introspection capabilities for the async runtime's work-stealing scheduler. This module extends the Inject type with length monitoring functionality.

## Key Components
- **len() method (L4-6)**: Returns the current number of tasks in the inject queue by delegating to the underlying shared queue's length method. Used for runtime diagnostics and monitoring.

## Dependencies
- **super::Inject**: The main inject queue type that this module extends
- **self.shared**: Internal shared queue structure that maintains the actual task count

## Architectural Notes
- Follows Tokio's pattern of separating metrics functionality into dedicated modules
- Uses pub(crate) visibility for internal runtime access only
- Generic over task type T with 'static lifetime constraint
- Simple delegation pattern to underlying shared queue implementation

## Usage Context
Part of Tokio's multi-threaded scheduler metrics system, enabling runtime introspection for debugging and performance monitoring of the global task injection queue.