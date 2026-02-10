# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/net/uds/
@generated: 2026-02-09T18:16:11Z

## Overall Purpose
This directory provides Unix Domain Socket (UDS) networking primitives for the Mio asynchronous I/O library. It implements non-blocking wrappers around standard library Unix socket types, integrating them with Mio's event-driven architecture for high-performance async networking on Unix-like systems.

## Key Components
The module is organized around three primary socket types that mirror standard TCP/UDP patterns but operate over Unix domain sockets:

- **UnixDatagram** (`datagram.rs`): Connectionless datagram communication, similar to UDP but over Unix domain sockets
- **UnixListener** (`listener.rs`): Server-side socket for accepting incoming connections, analogous to TCP listeners  
- **UnixStream** (`stream.rs`): Bidirectional connection-oriented communication, similar to TCP streams
- **Module Interface** (`mod.rs`): Clean API aggregation with selective re-exports

## Public API Surface
The main entry points are the three socket types exposed through `mod.rs`:

### UnixDatagram
- `bind()`, `bind_addr()` - Create bound sockets
- `unbound()`, `pair()` - Create unbound or paired sockets
- `recv_from()`, `send_to()` - Connectionless I/O operations
- `connect()`, `recv()`, `send()` - Connected mode operations

### UnixListener  
- `bind()`, `bind_addr()` - Create listening sockets
- `accept()` - Accept incoming connections (returns UnixStream)
- Event registration for async operation

### UnixStream
- `connect()`, `connect_addr()` - Establish connections
- `pair()` - Create connected socket pairs
- Standard `Read`/`Write` trait implementations
- `try_io()` - Custom I/O operation wrapper

## Internal Organization & Data Flow
All socket types follow a consistent architectural pattern:

1. **IoSource Wrapper**: Each socket wraps `std::os::unix::net` types within `IoSource<T>` for event integration
2. **Platform Delegation**: Core operations delegate to `sys::uds::{datagram,listener,stream}` for platform-specific implementation
3. **Event Integration**: All types implement `event::Source` for Mio event loop registration
4. **Non-blocking I/O**: Operations use `inner.do_io()` pattern to handle `WouldBlock` and ensure proper event re-registration

## Important Patterns & Conventions

### Safety Invariants
- All sockets must be in non-blocking mode (enforced by construction, assumed in `from_std()` and `from_raw_fd()`)
- File descriptor conversions provide comprehensive interoperability with standard library and raw fd operations

### Error Handling
- I/O operations return `WouldBlock` for incomplete operations, integrated with Mio's edge-triggered event system
- `try_io()` method provides template for custom I/O operations with proper event handling

### Conversion Traits
All socket types implement extensive fd conversion traits (`AsRawFd`, `IntoRawFd`, `FromRawFd`, `AsFd`, `From<OwnedFd>`) for seamless interoperability between Mio types, standard library types, and raw file descriptors.

## System Integration
This module serves as the Unix-specific networking layer within Mio's cross-platform async I/O framework, providing Unix domain socket capabilities that complement the TCP/UDP networking primitives found elsewhere in the library.