# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/signal_drop_rt.rs
@source-hash: 5e12a1f58bce7a91
@generated: 2026-02-09T18:12:25Z

## Purpose
Test file ensuring that dropping Tokio signal handlers and runtime loops doesn't cause signal processing starvation between different runtime instances on Unix systems.

## Key Functions

**`dropping_loops_does_not_cause_starvation()` (L14-38)**
- Main test function validating signal handling across multiple runtime lifecycles
- Creates two separate Tokio runtimes with SIGUSR1 signal handlers
- Tests that after dropping the first runtime and handler, the second runtime can still receive signals
- Ensures proper cleanup prevents starvation of subsequent signal processing

**`rt()` (L40-45)**
- Helper function creating single-threaded Tokio runtime instances
- Uses `new_current_thread()` with all features enabled
- Returns configured Runtime for test isolation

## Dependencies
- `tokio::runtime::Runtime` - Core async runtime
- `tokio::signal::unix::{signal, SignalKind}` - Unix signal handling primitives
- `support::signal::send_signal` - Test utility for signal transmission (L6-9)
- `libc::SIGUSR1` - System signal constant

## Test Architecture
- **Platform constraints**: Unix-only (`#![cfg(unix)]`) with full feature set
- **Signal type**: Uses `SignalKind::user_defined1()` (SIGUSR1)
- **Runtime isolation**: Each signal handler gets its own runtime instance
- **Cleanup validation**: Explicit dropping of resources before testing second handler

## Critical Test Flow
1. Create first runtime + signal handler, receive signal successfully
2. Drop first runtime and handler explicitly
3. Create second runtime + signal handler
4. Verify second handler can receive signals (proving no starvation)

## Architectural Notes
- Tests edge case where improper cleanup could block future signal registrations
- Uses blocking operations (`block_on`) for synchronous test execution
- Validates cross-runtime signal handling independence