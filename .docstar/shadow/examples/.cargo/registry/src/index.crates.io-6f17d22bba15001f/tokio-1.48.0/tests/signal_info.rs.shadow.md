# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/signal_info.rs
@source-hash: d86bc121eb85e964
@generated: 2026-02-09T18:12:25Z

**Test Module for Unix Signal Info Handling**

This is a platform-specific test module for Tokio's Unix signal handling, specifically testing SIGINFO signal reception on BSD-like systems.

**Platform Constraints & Configuration**
- Restricted to BSD-like platforms: DragonFly, FreeBSD, macOS, NetBSD, OpenBSD, Illumos (L3-10)
- Requires Tokio's "full" feature set (L2)
- Excluded from Miri execution due to missing `sigaction` support (L11)

**Key Components**
- **Support Module Import (L13-16)**: Imports custom signal utilities from `support::signal` module
- **Main Test Function `siginfo()` (L22-35)**: Async test that validates SIGINFO signal handling

**Test Logic Flow**
1. Creates signal handler for SIGINFO using `SignalKind::info()` (L24)
2. Spawns background task to send SIGINFO signal via `libc::SIGINFO` (L26-28)
3. Implements 5-second timeout protection to prevent test hanging (L31-34)
4. Validates signal reception through `sig.recv()` with nested expect chains

**Dependencies**
- `tokio::signal::unix::SignalKind` for Unix-specific signal types
- `tokio::time::{timeout, Duration}` for test timeout mechanisms
- `libc::SIGINFO` for direct signal constant access
- Custom `support::signal::send_signal` utility function

**Testing Pattern**
Uses async spawn + timeout pattern to test asynchronous signal delivery, ensuring robust test execution without indefinite blocking.