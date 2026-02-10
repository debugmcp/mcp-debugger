# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/tcp/listener.rs
@source-hash: 102d20a8143a55bd
@generated: 2026-02-09T18:03:02Z

## Purpose and Responsibility

Async TCP server socket implementation for Tokio runtime. Provides non-blocking TCP listener functionality with async/await support and integration with Tokio's event loop system.

## Core Structure

**TcpListener (L57-59)**: Main struct wrapping `PollEvented<mio::net::TcpListener>` to provide async TCP server capabilities. Single field `io` handles all low-level socket operations through Tokio's polling infrastructure.

## Key Methods

**bind() (L103-121)**: Static async constructor that resolves addresses and attempts binding to each until successful. Uses `to_socket_addrs()` for address resolution and `bind_addr()` internally. Not available on WASI platform.

**accept() (L163-172)**: Primary async method for accepting new connections. Returns `(TcpStream, SocketAddr)` tuple. Uses `async_io()` with `Interest::READABLE` for efficient event-driven operation. Cancel-safe for use in `tokio::select!`.

**poll_accept() (L180-195)**: Low-level polling interface for accepting connections. Returns `Poll<io::Result<(TcpStream, SocketAddr)>>`. Implements manual readiness checking and error handling for `WouldBlock` conditions.

**from_std() (L244-250)**: Converts `std::net::TcpListener` to Tokio equivalent. Validates non-blocking mode with `check_socket_for_blocking()`. Must be called within Tokio runtime context.

**into_std() (L274-301)**: Converts back to standard library listener. Platform-specific implementations using raw file descriptors (Unix/WASI) or raw sockets (Windows). Returned listener maintains non-blocking mode.

## Platform Support

- **Unix (L408-424)**: Implements `AsRawFd` and `AsFd` traits for file descriptor access
- **Windows (L446-460)**: Implements `AsRawSocket` and `AsSocket` traits for socket handle access  
- **WASI (L427-444)**: Similar to Unix but under `cfg_unstable` feature flag
- **Conditional compilation**: Uses `cfg_not_wasi!` and `cfg_net!` macros throughout

## Dependencies and Relationships

- `PollEvented<mio::net::TcpListener>`: Core async I/O wrapper providing event loop integration
- `TcpStream`: Returned by accept operations for established connections
- `mio::net::TcpListener`: Underlying non-blocking socket implementation
- `Interest::READABLE`: Used for polling readiness on accept operations

## Architecture Patterns

- **Async/Await Integration**: All blocking operations converted to async equivalents
- **Event-Driven I/O**: Uses Tokio's registration and polling system for efficiency  
- **Platform Abstraction**: Conditional compilation handles OS-specific socket operations
- **Resource Management**: Automatic cleanup when dropped, explicit conversion methods available
- **Error Propagation**: Comprehensive error handling with context-appropriate error types

## Configuration Methods

**TTL Management (L360-387)**: `ttl()` getter and `set_ttl()` setter for IP time-to-live configuration. **local_addr() (L333-335)**: Returns bound socket address, useful for dynamic port allocation.