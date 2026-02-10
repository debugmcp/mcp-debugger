# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/signal_drop_recv.rs
@source-hash: 654805a66effecb7
@generated: 2026-02-09T18:12:24Z

## Purpose and Responsibility
Tests signal handling behavior when a signal receiver is dropped and then recreated. Specifically validates that dropping a signal receiver doesn't prevent subsequent receivers from receiving signals that were sent while no receiver was active.

## Key Components
- **drop_then_get_a_signal test** (L13-23): Core test function that validates signal delivery after receiver drop/recreation
- **Support module imports** (L6-9): Local test utilities for signal operations
- **Dependencies**: tokio signal handling (`signal`, `SignalKind`) and libc for raw signal sending

## Test Flow
1. Creates initial SIGUSR1 signal receiver (L15-16)
2. Immediately drops the receiver (L17)
3. Sends SIGUSR1 signal while no receiver exists (L19)
4. Creates new signal receiver for same signal type (L20)
5. Validates that the signal can still be received (L22)

## Platform Constraints
- Unix-only test (`#![cfg(unix)]` L3)
- Requires "full" tokio feature set (L2)
- Disabled in Miri due to sigaction unavailability (L4)

## Architecture Pattern
Follows tokio's async signal testing pattern using the test harness and support utilities. Tests edge case behavior in signal multiplexing where receivers are dynamically created/destroyed.