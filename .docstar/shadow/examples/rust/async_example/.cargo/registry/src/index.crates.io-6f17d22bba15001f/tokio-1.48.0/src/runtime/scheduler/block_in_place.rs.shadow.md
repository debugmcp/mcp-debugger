# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/block_in_place.rs
@source-hash: f67fe80e7ebc480a
@generated: 2026-02-09T18:03:02Z

**Primary Purpose**: Provides a public crate-level interface for blocking the current async task to execute synchronous code without blocking the entire runtime thread.

**Key Function**:
- `block_in_place<F, R>(f: F) -> R` (L4-9): Generic wrapper function that delegates blocking execution to the multi-threaded scheduler implementation. Takes a closure `F: FnOnce() -> R` and executes it while temporarily blocking the current task.

**Dependencies**:
- `crate::runtime::scheduler` (L1): Imports scheduler module
- `scheduler::multi_thread::block_in_place` (L8): Delegates to multi-threaded scheduler's implementation

**Architectural Pattern**: 
This is a thin facade/adapter that provides a unified interface while hiding the underlying scheduler-specific implementation. The `#[track_caller]` attribute (L3) ensures that panic locations are properly propagated to the original call site for better debugging.

**Usage Context**: 
Used within Tokio's runtime to allow async code to safely execute blocking operations (like synchronous I/O or CPU-intensive work) without starving other tasks. The actual blocking logic is implemented in the multi-threaded scheduler module.