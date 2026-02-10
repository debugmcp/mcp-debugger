# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/shell/uds.rs
@source-hash: 06b7e16d03fd7636
@generated: 2026-02-09T18:02:23Z

## Purpose
Shell/stub implementation of Unix Domain Socket (UDS) functionality for platforms where UDS is not supported. This file provides no-op implementations that return platform-specific errors via the `os_required!()` macro.

## Architecture
Organized into three modules mirroring full UDS functionality:

**datagram module (L1-16)**: Stub implementations for Unix datagram sockets
- `bind_addr()` (L5): Would bind socket to address, returns os_required error
- `unbound()` (L9): Would create unbound datagram socket, returns os_required error  
- `pair()` (L13): Would create connected socket pair, returns os_required error

**listener module (L18-31)**: Stub implementations for Unix stream listeners
- `bind_addr()` (L24): Would bind listener to address, returns os_required error
- `accept()` (L28): Would accept incoming connection, returns os_required error

**stream module (L33-44)**: Stub implementations for Unix stream sockets
- `connect_addr()` (L37): Would connect to address, returns os_required error
- `pair()` (L41): Would create connected stream pair, returns os_required error

## Dependencies
- Standard library I/O types and Unix networking types
- `crate::net::UnixStream` for type compatibility (L22)
- Relies on `os_required!()` macro (not defined in this file) to generate appropriate platform errors

## Design Pattern
This is a null object pattern implementation, providing the same interface as the real UDS implementation but with no-op behavior. Used in conditional compilation scenarios where the target platform lacks UDS support. All functions accept the expected parameters but immediately return platform-specific errors without performing any actual operations.