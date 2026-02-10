# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/dump.rs
@source-hash: 158642d668488672
@generated: 2026-02-09T18:12:13Z

## Primary Purpose
Test file for Tokio's `taskdump` feature, which provides runtime task introspection and stack trace dumping capabilities. Only compiled when `tokio_unstable` feature is enabled on Linux platforms with supported architectures.

## Key Functions

**Test Helper Functions:**
- `a()` (L12-14): Async function that calls `b()`, marked with `#[inline(never)]` to ensure stack frames are preserved for tracing
- `b()` (L17-19): Async function that calls `c()`, also marked `#[inline(never)]`
- `c()` (L22-26): Infinite loop that yields control via `tokio::task::yield_now()` to create a traceable async call stack

**Core Test Functions:**
- `current_thread()` (L28-63): Tests task dumping in single-threaded runtime, spawns 3 tasks running the `a()→b()→c()` chain and verifies dump contains expected stack traces
- `multi_thread()` (L66-101): Identical test for multi-threaded runtime with 3 worker threads

**Regression Test Module: `future_completes_during_trace` (L107-159):**
- `complete_during_trace()` (L113-123): Creates a future that only completes when `Handle::is_tracing()` returns true
- `current_thread()` (L126-140): Tests that dumping doesn't deadlock when futures complete during trace collection
- `multi_thread()` (L143-158): Multi-threaded version of the deadlock prevention test

**Edge Case Test:**
- `notified_during_tracing()` (L167-199): Regression test ensuring tasks notified outside worker threads during tracing don't panic due to unset notification bits

## Key Dependencies
- `std::hint::black_box`: Prevents compiler optimizations that could eliminate stack frames
- `tokio::runtime::{self, Handle}`: Runtime management and handle for dump operations
- `core::future::{poll_fn, Future}`: For custom future implementation in regression tests

## Testing Patterns
All tests use `tokio::select!` with `biased` ordering to ensure dump operations execute alongside spawned tasks. Tests verify:
1. Expected number of tasks (3) in dump
2. Stack traces contain specific function names (`dump::a`, `dump::b`, `dump::c`, `tokio::task::yield_now`)
3. No deadlocks occur during concurrent dumping and task completion

## Architectural Notes
- Uses `#[inline(never)]` annotations to guarantee stack frame preservation for accurate tracing
- Tests both single-threaded and multi-threaded runtime configurations
- Regression tests address specific GitHub issues (#6035, #6051) related to dumping edge cases