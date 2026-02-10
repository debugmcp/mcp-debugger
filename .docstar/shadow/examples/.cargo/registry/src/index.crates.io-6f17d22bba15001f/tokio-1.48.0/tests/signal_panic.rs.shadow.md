# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/signal_panic.rs
@source-hash: 4cc5af05c5b9441a
@generated: 2026-02-09T18:12:25Z

## Purpose
Unix-specific test for tokio signal handling panic behavior and location tracking. Validates that panics from invalid signal kinds occur at the expected source location.

## Architecture
**Test Configuration (L1-5):** Unix-only test requiring full tokio features and unwind panic mode, excluded from Miri execution due to lack of sigaction support.

**Core Test Function:** `signal_panic_caller` (L16-31)
- Creates single-threaded tokio runtime 
- Tests panic behavior when creating signal handler with invalid signal kind (-1)
- Uses `test_panic` helper to capture panic location information
- Validates panic occurs in this source file for proper error attribution

## Dependencies
- `tokio::runtime::Builder` - Runtime creation
- `tokio::signal::unix::{signal, SignalKind}` - Unix signal handling
- `support::panic::test_panic` (L14) - Panic location testing utility

## Key Operations
1. **Invalid Signal Creation (L22-23):** Creates SignalKind from raw value -1 (invalid) and attempts to create signal handler
2. **Panic Location Validation (L27-28):** Asserts panic originated from current file using `file!()` macro

## Testing Pattern
Demonstrates tokio's panic location tracking for signal-related errors, ensuring proper error attribution in async contexts when invalid signal operations are attempted.