# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/net/uds/stream.rs
@source-hash: 64348e63a6abb49a
@generated: 2026-02-09T18:03:19Z

This module implements `UnixStream` (L12-14), a non-blocking Unix domain socket stream wrapper for the Mio asynchronous I/O library. The type wraps `std::os::unix::net::UnixStream` within an `IoSource` to provide event-driven I/O capabilities.

## Core Type
- `UnixStream` (L12-14): Main struct containing `IoSource<net::UnixStream>` inner field

## Connection Management
- `connect()` (L21-24): Connects to socket by filesystem path, may return `WouldBlock`
- `connect_addr()` (L30-32): Connects to socket by `SocketAddr`, delegates to platform-specific implementation
- `from_std()` (L46-50): Wraps standard library `UnixStream`, assumes non-blocking mode already set
- `pair()` (L55-59): Creates connected socket pair, returns tuple of two `UnixStream` instances

## Socket Information & Control
- `local_addr()` (L62-64): Returns local socket address
- `peer_addr()` (L67-69): Returns remote socket address  
- `take_error()` (L72-74): Retrieves `SO_ERROR` option value
- `shutdown()` (L81-83): Shuts down read/write halves of connection

## I/O Operations
- `try_io()` (L146-151): Critical method for custom I/O operations, ensures proper event re-registration on `WouldBlock`. Contains extensive documentation example (L98-145) showing raw `libc` usage pattern
- `Read` trait implementations for owned (L154-162) and borrowed (L164-172) references
- `Write` trait implementations for owned (L174-186) and borrowed (L188-200) references
- All I/O operations delegate through `inner.do_io()` to handle event registration

## Event System Integration
- `event::Source` implementation (L202-224): Provides `register()`, `reregister()`, `deregister()` methods for Mio event loop integration

## File Descriptor Conversions
- `AsRawFd` (L238-242): Access to underlying raw file descriptor
- `IntoRawFd` (L232-236): Consumes stream to extract raw fd
- `FromRawFd` (L244-254): Creates stream from raw fd (unsafe, caller must ensure non-blocking)
- `AsFd`/`From<OwnedFd>` (L271-281): Modern Rust fd ownership patterns
- `From<UnixStream>` for `net::UnixStream` (L256-263): Conversion back to std library type

## Architecture Notes
All I/O operations use the `IoSource::do_io()` pattern to ensure proper edge-triggered event handling. The wrapper maintains the invariant that the underlying socket should be in non-blocking mode. Platform-specific connection logic is delegated to `sys::uds::stream` module.