# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/macros/trace.rs
@source-hash: 33befd4533a3b2b4
@generated: 2026-02-09T18:06:37Z

## Purpose and Responsibility
This file defines tracing macros for Tokio's async runtime operations, specifically for monitoring resource polling behavior. The macros are conditionally compiled only when the `trace` feature is enabled via the `cfg_trace!` wrapper.

## Key Macros and Functionality

### `trace_op!` (L2-10)
A utility macro that emits structured tracing events for runtime resource polling operations.
- **Parameters**: `$name:expr` (operation name), `$readiness:literal` (boolean readiness state)
- **Target**: "runtime::resource::poll_op" - specific tracing target for runtime resource events
- **Fields**: `op_name` and `is_ready` - structured logging fields for operation identification and state

### `trace_poll_op!` (L12-25)
Higher-level macro that wraps `std::task::Poll` results with automatic tracing based on poll outcome.
- **Parameters**: `$name:expr` (operation name), `$poll:expr` (Poll expression to evaluate)
- **Behavior**: 
  - `Poll::Ready(t)` → traces with `is_ready = true`, returns the ready value (L15-18)
  - `Poll::Pending` → traces with `is_ready = false`, early returns `Poll::Pending` (L19-22)
- **Usage Pattern**: Designed for instrumenting async poll methods in Tokio's resource types

## Architectural Decisions
- **Conditional Compilation**: Wrapped in `cfg_trace!` to eliminate overhead when tracing is disabled
- **Structured Logging**: Uses `tracing` crate with specific target and field names for consistent observability
- **Early Return Pattern**: `trace_poll_op!` includes early return logic for `Pending` state, making it suitable for use in poll method implementations
- **Zero-Cost Abstraction**: When trace feature is disabled, these macros compile away entirely

## Dependencies
- `tracing` crate for structured logging functionality
- `std::task::Poll` for async polling types

## Usage Context
These macros are internal utilities for Tokio's runtime instrumentation, enabling developers to trace resource polling behavior during async operation execution.