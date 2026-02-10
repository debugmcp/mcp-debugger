# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/signal_notify_both.rs
@source-hash: 5c5526f1f2a465d2
@generated: 2026-02-09T18:12:25Z

## Purpose
Unix signal handling test for Tokio's signal notification system. Tests that multiple signal receivers can both receive the same signal notification.

## Key Components
- **notify_both test function (L13-24)**: Async test that verifies multiple signal listeners can receive the same SIGUSR2 signal
- **Support module import (L6-9)**: Uses local test utilities for signal sending functionality

## Dependencies
- `tokio::signal::unix`: Signal handling primitives (`signal`, `SignalKind`)
- `support::signal::send_signal`: Test utility for sending signals to current process
- `libc::SIGUSR2`: POSIX signal constant

## Test Flow
1. Creates `SignalKind::user_defined2()` (maps to SIGUSR2) (L15)
2. Instantiates two signal receivers for the same signal type (L17-18)
3. Sends SIGUSR2 to current process via `send_signal()` (L20)
4. Verifies both receivers can await and receive the signal (L22-23)

## Platform Constraints
- Unix-only (`#![cfg(unix)]`) (L3)
- Requires "full" feature flag (L2)
- Excluded from Miri testing due to `sigaction` unavailability (L4)

## Architecture Notes
This test validates Tokio's signal broadcasting behavior - ensuring that signal notifications are delivered to all registered listeners rather than just the first one, which is critical for multi-consumer signal handling patterns.