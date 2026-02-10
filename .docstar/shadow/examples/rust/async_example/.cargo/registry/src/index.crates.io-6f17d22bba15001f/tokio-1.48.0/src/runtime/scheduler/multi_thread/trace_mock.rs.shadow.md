# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/trace_mock.rs
@source-hash: 3ce6a3d19b53b608
@generated: 2026-02-09T17:58:13Z

**Purpose**: Mock implementation of tracing status tracking for Tokio's multi-threaded scheduler when tracing is disabled.

**Structure**:
- `TraceStatus` (L1-11): Empty struct serving as a no-op placeholder for tracing functionality

**Key Methods**:
- `new(_: usize)` (L4-6): Constructor that ignores the provided parameter and returns an empty instance
- `trace_requested()` (L8-10): Always returns `false`, indicating tracing is not active

**Architecture Notes**:
- This is a mock/stub implementation used when tracing features are disabled
- The `pub(super)` visibility restricts access to parent module only
- Constructor parameter is intentionally ignored (unnamed `_` parameter)
- Designed as a zero-cost abstraction when tracing is compiled out

**Dependencies**: None - completely self-contained mock implementation

**Usage Context**: Part of Tokio's conditional compilation strategy where this mock replaces the actual tracing implementation when tracing features are disabled, maintaining the same API surface.