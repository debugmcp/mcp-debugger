# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/task_trace_self.rs
@source-hash: cadff9aa979e014c
@generated: 2026-02-09T18:12:32Z

## Purpose
Test file for Tokio's task tracing functionality that validates self-tracing behavior when tasks run for extended periods. Only compiles under specific unstable feature flags and platform constraints.

## Key Components

### PrettyFuture<F> (L17-24)
Pin-projected wrapper around `Root<F>` that monitors future execution time and captures traces when tasks run longer than 500ms threshold. Contains:
- `f: Root<F>` - Wrapped future with tracing capabilities
- `t_last: State` - Current execution state tracking
- `logs: Arc<Mutex<Vec<Trace>>>` - Shared trace collection storage

### State Enum (L26-30)
Tracks future execution phases:
- `NotStarted` - Initial state before first poll
- `Running { since: Instant }` - Active execution with start time
- `Alerted` - Already captured trace, prevents duplicate alerts

### Future Implementation (L42-67)
Core polling logic with performance monitoring:
- Tracks execution duration between polls (L47-58)
- Triggers trace capture via `Trace::capture()` when duration exceeds 500ms (L60-63)
- Sets state to `Alerted` to prevent duplicate traces for same future
- Falls back to direct polling for normal execution (L65)

### Test Function (L69-107)
Validates trace capture behavior through nested `PrettyFuture` wrappers:
- Creates nested structure with two trace collectors
- Executes mix of fast operations (should not trace) and slow loop (should trace)
- Uses `line!()` macro to track specific code locations
- Asserts that only slow-running code locations appear in traces (L92-98)
- Verifies fast operations are NOT captured (L99-106)

## Dependencies
- `tokio::runtime::dump::{Root, Trace}` - Core tracing infrastructure
- `pin_project_lite` - Safe pin projection for async futures
- Standard async/threading primitives

## Architectural Notes
- Requires `tokio_unstable` + `taskdump` features + Linux + specific architectures
- Implements performance-based selective tracing rather than comprehensive logging
- Uses 500ms threshold as trigger point for "slow" task identification
- Thread-safe trace collection through `Arc<Mutex<Vec<Trace>>>`