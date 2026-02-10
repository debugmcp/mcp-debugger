# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/trace.rs
@source-hash: f8ac6b0db76c4505
@generated: 2026-02-09T17:58:17Z

## Purpose
Provides synchronization infrastructure for coordinating runtime tracing operations across multiple worker threads in Tokio's multi-threaded scheduler. Manages trace request lifecycle and result collection.

## Key Components

**TraceStatus struct (L8-14)**
Central coordination structure containing:
- `trace_requested` (L9): AtomicBool flag indicating active trace request
- `trace_start`, `trace_end` (L10-11): Barriers for synchronizing worker threads at trace boundaries
- `result_ready` (L12): Notify for signaling when trace results are available
- `trace_result` (L13): Mutex-protected storage for collected trace data

**Constructor (L17-25)**
Creates TraceStatus with barriers sized for `remotes_len` workers, initializing all synchronization primitives to default states.

**Trace State Management**
- `trace_requested()` (L27-29): Non-blocking check for active trace request
- `start_trace_request()` (L31-40): Async method that atomically sets trace flag, with retry loop and worker notification on contention
- `end_trace_request()` (L51-60): Async method that atomically clears trace flag, with identical retry pattern

**Result Handling**
- `stash_result()` (L42-45): Stores trace dump and signals completion via notification
- `take_result()` (L47-49): Retrieves and consumes stored trace result

## Architecture Notes
Uses compare-and-swap operations with Acquire/Relaxed ordering for trace flag management. Implements cooperative retry loops with yield points to handle contention without blocking. Barriers coordinate multi-worker synchronization phases during trace collection.

## Dependencies
- `crate::loom::sync`: Provides atomic primitives and synchronization types
- `crate::runtime::dump::Dump`: Trace result data structure
- `crate::runtime::scheduler::multi_thread::Handle`: Worker thread handle for notifications
- `crate::sync::notify::Notify`: Async notification primitive