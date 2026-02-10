# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/net/uds/datagram.rs
@source-hash: fb4bf68b6e1ef7d7
@generated: 2026-02-09T18:02:31Z

## Primary Purpose
Mio wrapper for Unix domain socket datagrams, providing asynchronous I/O capabilities. Acts as a thin wrapper around `std::os::unix::net::UnixDatagram` with event-driven socket operations for use in async runtimes.

## Core Structure
- **UnixDatagram (L11-13)**: Main struct wrapping `IoSource<net::UnixDatagram>` for async operations
- Uses composition pattern with `IoSource` to provide event registration and non-blocking I/O

## Key Constructors
- **bind() (L17-20)**: Creates socket bound to filesystem path
- **bind_addr() (L23-25)**: Creates socket bound to specific SocketAddr
- **from_std() (L33-37)**: Converts standard library UnixDatagram (assumes caller sets non-blocking mode)
- **unbound() (L48-50)**: Creates unbound socket
- **pair() (L53-60)**: Creates connected socket pair

## Core I/O Operations
- **recv_from() (L78-80)**: Receives data with sender address
- **recv() (L85-87)**: Receives data from connected peer
- **send_to() (L92-94)**: Sends data to specific path
- **send() (L102-104)**: Sends data to connected peer
- **try_io() (L181-186)**: Generic I/O operation wrapper ensuring proper event handling

## Connection Management
- **connect() (L43-45)**: Connects to peer (may return WouldBlock)
- **local_addr() (L63-65)**: Returns socket's local address
- **peer_addr() (L70-72)**: Returns connected peer address
- **shutdown() (L116-118)**: Shuts down read/write halves

## Event System Integration
- **event::Source impl (L189-211)**: Provides register/reregister/deregister for async event loops
- All I/O operations use `inner.do_io()` pattern to handle WouldBlock properly

## File Descriptor Traits
- **AsRawFd/IntoRawFd/FromRawFd (L219-241)**: Standard file descriptor conversion traits
- **AsFd/From<OwnedFd> (L252-268)**: Modern Rust fd handling traits
- **From conversions (L243-268)**: Bidirectional conversion with std library types

## Dependencies
- `IoSource`: Core Mio abstraction for event-driven I/O
- `sys::uds::datagram`: Platform-specific socket implementation
- Standard Unix socket types and path handling

## Architecture Notes
- Delegates most operations to inner `IoSource` wrapper
- Maintains compatibility with std library through conversion traits
- All I/O operations are non-blocking and integrate with Mio's event system
- Safety invariant: FromRawFd assumes caller ensures non-blocking mode