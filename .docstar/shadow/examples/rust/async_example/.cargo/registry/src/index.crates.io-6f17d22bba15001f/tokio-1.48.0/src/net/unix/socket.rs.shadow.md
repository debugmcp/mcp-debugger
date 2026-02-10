# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/unix/socket.rs
@source-hash: 88bce80c004001e7
@generated: 2026-02-09T18:03:04Z

## Purpose and Responsibility
This file defines `UnixSocket`, a Tokio wrapper around Unix domain sockets that provides a low-level, configurable interface before converting to higher-level abstractions like `UnixStream`, `UnixDatagram`, or `UnixListener`. It serves as a builder pattern for Unix sockets with custom configuration needs.

## Key Components

### UnixSocket Struct (L89-91)
- Wraps a `socket2::Socket` providing cross-platform Unix domain socket functionality
- Debug-derivable struct with single `inner` field
- Conditionally compiled behind `cfg_net_unix!` macro

### Constructor Methods
- `new_datagram()` (L107-109): Creates `SOCK_DGRAM` socket via `socket(2)` syscall
- `new_stream()` (L119-121): Creates `SOCK_STREAM` socket via `socket(2)` syscall  
- `new()` (L123-148): Internal constructor with platform-specific non-blocking setup
  - Uses `Type::nonblocking()` on modern Unix platforms (L134)
  - Falls back to `set_nonblocking(true)` on older platforms (L146)

### Configuration Methods
- `bind()` (L153-156): Binds socket to filesystem path using `bind(2)` syscall
- `ty()` (L95-97): Internal helper to get socket type for validation

### Conversion Methods
- `listen()` (L171-188): Converts stream socket to `UnixListener` with backlog
  - Validates socket type (rejects datagram sockets L172-177)
  - Calls `listen(2)` syscall and wraps in mio listener
- `connect()` (L201-223): Async connects stream socket, returns `UnixStream`
  - Validates socket type (rejects datagram sockets L202-207)
  - Handles `EINPROGRESS` for non-blocking connect (L211-213)
  - Uses mio for async operation completion
- `datagram()` (L230-245): Converts datagram socket to `UnixDatagram`
  - Validates socket type (rejects stream sockets L231-236)

### Raw File Descriptor Traits (L248-271)
Implements standard Unix fd traits for interoperability:
- `AsRawFd` (L248-252): Borrows raw fd
- `AsFd` (L254-258): Borrows typed fd (newer Rust)
- `FromRawFd` (L260-265): Unsafe construction from raw fd
- `IntoRawFd` (L267-271): Consumes and returns raw fd

## Dependencies and Relationships
- Uses `socket2` crate for cross-platform socket operations
- Integrates with `mio` for async I/O readiness
- Converts to Tokio's higher-level Unix socket types (`UnixStream`, `UnixDatagram`, `UnixListener`)
- Relies on `libc` for error code constants (`EINPROGRESS`)

## Architectural Patterns
- **Builder Pattern**: Configure socket before conversion to final type
- **Type Safety**: Runtime validation prevents invalid operations (stream vs datagram)
- **Platform Abstraction**: Conditional compilation for non-blocking socket setup
- **Resource Management**: RAII through Drop trait (inherited from socket2::Socket)
- **Async Integration**: Seamless conversion to async-capable Tokio types

## Critical Invariants
- Socket type must match operation (stream for listen/connect, datagram for datagram conversion)
- Socket is always configured as non-blocking before use
- Raw fd ownership is properly transferred during conversions
- Error propagation preserves original syscall errors