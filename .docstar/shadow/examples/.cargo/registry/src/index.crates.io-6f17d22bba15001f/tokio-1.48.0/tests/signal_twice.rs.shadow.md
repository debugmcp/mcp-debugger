# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/signal_twice.rs
@source-hash: 9714c7010f83c2c7
@generated: 2026-02-09T18:12:26Z

## Purpose
Unix signal handling integration test that verifies tokio's signal handler can receive the same signal multiple times in sequence.

## Key Components
- **Test function `twice` (L13-23)**: Main test that validates signal reception functionality by sending SIGUSR1 twice and confirming both signals are received
- **Support module import (L6-9)**: References local `support::signal` module for test utilities
- **Signal setup (L15-16)**: Creates a tokio signal handler for SIGUSR1 using `SignalKind::user_defined1()`

## Dependencies
- `tokio::signal::unix::{signal, SignalKind}` (L11): Core tokio signal handling primitives
- `support::signal::send_signal` (L9): Test utility for programmatically sending signals
- `libc::SIGUSR1` (L19): System signal constant

## Test Flow
1. Creates signal handler for SIGUSR1
2. Iterates twice, each time:
   - Sends SIGUSR1 via `send_signal`
   - Awaits signal reception via `sig.recv()`
   - Asserts signal was received successfully

## Platform Constraints
- Unix-only (`#![cfg(unix)]` L3)
- Requires "full" tokio features (`#![cfg(feature = "full")]` L2)
- Disabled under Miri due to lack of `sigaction` support (`#![cfg(not(miri))]` L4)

## Testing Pattern
Validates that tokio's signal handlers maintain state correctly across multiple signal deliveries, ensuring no signal loss or handler corruption.