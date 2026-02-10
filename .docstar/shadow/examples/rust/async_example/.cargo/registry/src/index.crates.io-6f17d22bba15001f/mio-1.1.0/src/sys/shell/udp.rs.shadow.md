# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/shell/udp.rs
@source-hash: 0db637a4ce1ec3a5
@generated: 2026-02-09T18:03:12Z

## Purpose
Shell/stub implementation of UDP socket operations for the Mio library on non-WASI targets. This file provides placeholder functions that delegate to platform-specific implementations via the `os_required!()` macro.

## Key Functions
- `bind()` (L5-7): Public function for binding UDP sockets to addresses, takes a `SocketAddr` and returns `io::Result<net::UdpSocket>`
- `only_v6()` (L9-11): Internal function to check if a UDP socket is IPv6-only, takes a `UdpSocket` reference and returns `io::Result<bool>`

## Architecture Pattern
This is part of Mio's platform abstraction layer. The "shell" module provides a common interface while the actual implementation is dispatched to OS-specific code via the `os_required!()` macro. This allows Mio to maintain a unified API across different platforms while having specialized implementations underneath.

## Dependencies
- Standard library `io` and `net` modules for socket types and error handling
- Implicit dependency on the `os_required!()` macro (defined elsewhere in the crate)

## Platform Constraints
- Excluded from WASI targets via `#![cfg(not(target_os = "wasi"))]` (L1)
- Functions will panic or error if called without proper OS-specific implementation backing