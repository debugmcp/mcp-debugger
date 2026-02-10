# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/signal_realtime.rs
@source-hash: 6cc057389f40afff
@generated: 2026-02-09T18:12:29Z

## Purpose
Test file for real-time Unix signals in Tokio's signal handling module. Validates that Tokio can register, receive, and handle multiple real-time signals (SIGRTMIN to SIGRTMAX range) concurrently on Linux and Illumos systems.

## Key Components

### Main Test Function
- `signal_realtime()` (L19-89): Async test that registers all available real-time signals, sends them, and verifies reception
  - Creates signal handlers for SIGRTMIN through `sigrt_max()` range
  - Uses `FuturesUnordered` to handle concurrent signal reception with 5-second timeout
  - Panics with detailed error message if any signals are missing or not received

### Helper Functions
- `sigrt_max()` (L91-101): Returns the effective maximum real-time signal number
  - Caps at SIGRTMIN+27 to handle QEMU's limitation of 28 real-time signals
  - Provides cross-platform compatibility workaround
- `sigrtnum_to_string()` (L103-105): Formats signal numbers for human-readable output

## Dependencies
- **External**: `libc` for signal constants, `futures` for stream utilities, `tokio` for async signal handling
- **Internal**: `support::signal::send_signal` for signal transmission (L11)
- **Test utilities**: `tokio_test::assert_ok` for error handling

## Architecture Patterns
- **Concurrent signal handling**: Uses `FuturesUnordered` to await multiple signal receivers simultaneously
- **Timeout-based collection**: Uses `take_until()` with sleep to prevent indefinite waiting
- **Comprehensive validation**: Tracks both missing signals and signals that returned `None`

## Platform Constraints
- Linux/Illumos only (L3)
- Excludes Miri execution environment (L4)
- Requires "full" feature flag (L2)
- Handles QEMU execution environment limitations (L92-100)

## Critical Invariants
- All real-time signals in the tested range must be registrable
- Each sent signal must be received exactly once
- Test must complete within 5-second timeout
- Signal range is inclusive: SIGRTMIN..=sigrt_max()