# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/signal_ctrl_c.rs
@source-hash: 10815d8f7d1bd14b
@generated: 2026-02-09T18:12:22Z

## Purpose
Test file for Tokio's signal handling functionality, specifically testing the `ctrl_c()` signal handler on Unix platforms.

## Key Components

### Test Function
- `ctrl_c()` (L14-23): Async test that verifies `signal::ctrl_c()` properly receives SIGINT signals
  - Creates a ctrl_c signal handler future
  - Spawns a task to send SIGINT using `send_signal(libc::SIGINT)`
  - Asserts the signal handler completes successfully

### Dependencies
- `support::signal::send_signal` (L9): Utility function from local support module for sending Unix signals
- `tokio::signal` (L11): Tokio's signal handling module
- `tokio_test::assert_ok` (L12): Test assertion macro for Result types

## Platform Constraints
- Unix-only (`#![cfg(unix)]` L3): Signal handling is Unix-specific
- Full feature flag required (`#![cfg(feature = "full")]` L2): Needs complete Tokio feature set
- Miri excluded (`#![cfg(not(miri))]` L4): Miri doesn't support `sigaction` syscall

## Architecture
Simple integration test pattern: setup signal handler, trigger signal from spawned task, verify handler receives signal. Tests the fundamental signal delivery mechanism in Tokio's async runtime.