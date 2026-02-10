# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/net/uds/listener.rs
@source-hash: 4a18435153265535
@generated: 2026-02-09T18:02:23Z

Non-blocking Unix domain socket server implementation for Mio async I/O framework.

## Primary Responsibility
Provides a non-blocking wrapper around std::os::unix::net::UnixListener for event-driven async programming. Bridges standard library Unix sockets with Mio's event registration system.

## Core Structure
- **UnixListener (L11-13)**: Main struct wrapping IoSource<net::UnixListener> for non-blocking operations

## Key Methods

### Construction
- **bind() (L17-20)**: Creates listener bound to filesystem path, converts path to SocketAddr
- **bind_addr() (L23-25)**: Creates listener bound to specific SocketAddr, delegates to sys module
- **from_std() (L33-37)**: Wraps standard library UnixListener, assumes caller sets non-blocking mode

### Socket Operations  
- **accept() (L43-45)**: Accepts incoming connections returning (UnixStream, SocketAddr), delegates to sys module
- **local_addr() (L48-50)**: Returns bound socket address
- **take_error() (L53-55)**: Gets SO_ERROR socket option value

### Event System Integration
- **event::Source impl (L58-80)**: Implements Mio's event registration interface
  - register(), reregister(), deregister() all delegate to inner IoSource

## File Descriptor Management
Comprehensive fd trait implementations for interoperability:
- **IntoRawFd (L88-92)**: Extracts raw fd, consuming self
- **AsRawFd (L94-98)**: Borrows raw fd reference  
- **FromRawFd (L100-110)**: Constructs from raw fd (unsafe, caller ensures non-blocking)
- **AsFd (L127-131)**: Modern borrowed fd interface
- **From<OwnedFd> (L133-137)**: Constructs from owned fd

## Critical Dependencies
- IoSource: Core Mio abstraction providing event registration
- sys::uds::listener: Platform-specific Unix socket operations
- std::os::unix::net: Standard library Unix socket types

## Key Constraints
- Caller must ensure sockets are in non-blocking mode when using from_std() or from_raw_fd()
- All I/O operations delegate to platform-specific sys module implementations
- Safety relies on proper fd lifecycle management in conversions