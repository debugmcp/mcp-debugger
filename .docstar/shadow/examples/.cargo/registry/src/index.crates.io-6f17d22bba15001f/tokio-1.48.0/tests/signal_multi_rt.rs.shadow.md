# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/signal_multi_rt.rs
@source-hash: 3362def87b02dccc
@generated: 2026-02-09T18:12:28Z

## Purpose
Unix signal handling test for Tokio runtime focusing on multi-threaded signal reception across multiple event loops. Tests race condition resilience when multiple runtimes concurrently listen for the same signal type.

## Key Components

### Test Function: `multi_loop()` (L17-48)
Primary test that validates signal handling across multiple Tokio runtimes:
- Creates 10 test iterations to detect race conditions
- Spawns 4 threads per iteration, each with its own Tokio runtime
- Each thread registers a SIGHUP signal handler and signals readiness via std::sync::mpsc
- Main thread sends SIGHUP signal once all threads are ready
- Verifies all threads terminate successfully after signal reception

### Runtime Factory: `rt()` (L50-55)
Helper function creating single-threaded Tokio runtime instances with all features enabled.

## Dependencies
- `tokio::runtime::Runtime` - Individual runtime per thread
- `tokio::signal::unix::{signal, SignalKind}` - Unix signal handling primitives
- `support::signal::send_signal` - Test utility for signal transmission (L9)
- `std::sync::mpsc::channel` - Thread synchronization for readiness signaling
- `libc::SIGHUP` - POSIX hangup signal constant

## Architecture Pattern
**Multi-runtime signal coordination**: Tests that multiple independent Tokio runtimes can simultaneously register for the same signal type without interference. Uses synchronous channels to ensure deterministic signal delivery timing.

## Critical Constraints
- Unix-only (L3): Relies on POSIX signal semantics
- Feature-gated: Requires "full" Tokio feature set (L2)
- Miri-excluded (L4): Signal handling unavailable in Miri interpreter
- Thread-per-runtime model: Each runtime runs in isolated thread context

## Test Semantics
Validates signal multiplexing behavior where one OS signal delivery should be receivable by multiple concurrent Tokio signal handlers across different runtime instances.