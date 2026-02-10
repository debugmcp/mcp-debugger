# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/signal_drop_signal.rs
@source-hash: c98d4a98bd021165
@generated: 2026-02-09T18:12:24Z

**Primary Purpose:** Test file ensuring that dropping Tokio signal handlers doesn't interfere with other signal handlers for the same signal type.

**Key Test Function:**
- `dropping_signal_does_not_deregister_any_other_instances()` (L13-27): Validates that dropping signal handler instances doesn't deregister other handlers listening for the same signal

**Test Logic Flow:**
1. Creates three signal handlers for `SIGUSR1` using `SignalKind::user_defined1()` (L15-20)
2. Drops the first and third handlers while keeping the middle one (L22-23)
3. Sends `SIGUSR1` signal and verifies the remaining handler still receives it (L25-26)

**Dependencies:**
- `support::signal::send_signal` (L9): Helper function for sending signals
- `tokio::signal::unix::{signal, SignalKind}` (L11): Tokio's Unix signal handling primitives
- `libc::SIGUSR1` (L25): System signal constant

**Architectural Notes:**
- Unix-only test (cfg guards L3-4)
- Requires "full" feature flag (L2)
- Excluded from Miri testing due to missing `sigaction` support (L4)
- Tests signal handler reference counting/lifecycle management

**Critical Behavior Tested:**
Signal handlers should maintain independent lifecycles - dropping some instances shouldn't affect others listening to the same signal type.