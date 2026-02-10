# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/signal/ctrl_c.rs
@source-hash: 9b2a47659fe10680
@generated: 2026-02-09T18:06:40Z

## Purpose
Cross-platform ctrl-c signal handler for Tokio async runtime. Provides unified API for receiving SIGINT notifications on both Unix and Windows platforms.

## Key Function
**`ctrl_c() -> io::Result<()>` (L59-62)**: Async function that completes when ctrl-c is pressed. Returns future that resolves on first ctrl-c signal after being polled/awaited.

## Dependencies
- Platform-specific implementations via conditional compilation:
  - Unix: `super::unix` as `os_impl` (L1-2)
  - Windows: `super::windows` as `os_impl` (L3-4)
- Standard `io` for error handling (L6)

## Implementation Details
Function delegates to platform-specific `os_impl::ctrl_c()?.recv().await` (L60), abstracting OS differences while maintaining async semantics.

## Critical Behavioral Notes
**Signal Handler Persistence**: On Unix, registering any signal listener installs process-wide signal handler that **permanently** overrides default platform behavior (L20-31). Default ctrl-c termination is disabled for entire process lifetime, even after dropping signal instances.

**Polling Requirement**: Listener only registers after first poll/await call (L14-16). Signal events before polling are not captured.

## Usage Patterns
- Direct await for single ctrl-c handling (L38-49 example)
- Background spawning for concurrent signal handling (L51-58 example)
- Process graceful shutdown coordination

## Architectural Design
Facade pattern providing platform abstraction over OS-specific signal handling implementations while maintaining Tokio's async model.