# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/task/mod.rs
@source-hash: f5e38105c7f8a942
@generated: 2026-02-09T18:03:12Z

## Purpose
Module entry point for Tokio's thread-safe task notification primitives, providing atomic waker functionality for async task coordination.

## Structure
- **Module Declaration**: `atomic_waker` (L3) - Contains core atomic waker implementation
- **Public Export**: `AtomicWaker` (L4) - Re-exports the main atomic waker type for internal crate usage

## Key Components
- **AtomicWaker** (L4): Thread-safe primitive for waking async tasks, exported with `pub(crate)` visibility indicating it's for internal Tokio synchronization primitives

## Dependencies
- Internal dependency on `atomic_waker` submodule containing the implementation

## Architectural Notes
- Minimal module interface following Rust's module organization patterns
- Uses crate-internal visibility (`pub(crate)`) suggesting this is infrastructure for other Tokio sync primitives
- Part of Tokio's broader synchronization primitive ecosystem