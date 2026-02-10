# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/tcp/
@generated: 2026-02-09T18:16:15Z

## Purpose and Responsibility

The TCP networking module for Tokio's async runtime, providing complete TCP client and server capabilities with non-blocking I/O operations. This module implements async TCP sockets, listeners, and advanced socket configuration on top of mio's cross-platform networking primitives.

## Core Components and Architecture

### Primary Types
- **`TcpStream`**: Main async TCP client socket for bi-directional communication
- **`TcpListener`**: Async TCP server socket for accepting incoming connections  
- **`TcpSocket`**: Low-level socket abstraction for advanced pre-connection configuration
- **Split Types**: Borrowed (`ReadHalf`/`WriteHalf`) and owned (`OwnedReadHalf`/`OwnedWriteHalf`) stream halves for concurrent I/O

### Module Organization
- **`mod.rs`**: Central module aggregator and public API surface
- **`stream.rs`**: Core `TcpStream` implementation with full I/O operations
- **`listener.rs`**: TCP server functionality through `TcpListener`
- **`socket.rs`**: Advanced socket configuration via `TcpSocket`
- **`split.rs`**: Borrowed stream splitting for zero-cost concurrent access
- **`split_owned.rs`**: Owned stream splitting with Arc-based reference counting

## Public API Surface

### Connection Establishment
- `TcpStream::connect()` - High-level async client connection with multi-address fallback
- `TcpListener::bind()` - Server socket binding with address resolution
- `TcpSocket::new_v4()/new_v6()` - Advanced socket creation for custom configuration

### Core I/O Operations
- **Async**: `read()`, `write()` via AsyncRead/AsyncWrite traits
- **Non-blocking**: `try_read()`, `try_write()`, `try_read_vectored()`, `try_write_vectored()`
- **Readiness**: `ready()`, `readable()`, `writable()` for fine-grained I/O control
- **Specialized**: `peek()` for data inspection, `poll_peek()` for polling

### Server Operations
- `TcpListener::accept()` - Async connection acceptance returning `(TcpStream, SocketAddr)`
- `TcpListener::poll_accept()` - Low-level polling interface for custom event loops

### Stream Splitting
- `TcpStream::split()` - Zero-cost borrowed splitting for concurrent read/write
- `TcpStream::into_split()` - Owned splitting with independent lifetime management
- `reunite()` - Reconstruction of original stream from owned halves

## Internal Organization and Data Flow

### Event Loop Integration
All TCP types wrap `PollEvented<mio::net::T>` structures, integrating with Tokio's reactor:
1. **Registration**: Sockets register with epoll/kqueue/IOCP event system
2. **Readiness Notification**: Event loop notifies when I/O operations can proceed
3. **Async Execution**: Operations use `Interest` flags (READABLE/WRITABLE) for efficient polling

### Connection Flow
1. **Client**: `TcpSocket` → configuration → `connect()` → `TcpStream`
2. **Server**: `TcpSocket` → configuration → `listen()` → `TcpListener` → `accept()` → `TcpStream`
3. **I/O Operations**: `TcpStream` provides all read/write capabilities

### Split Pattern Implementation
- **Borrowed splits**: Same lifetime as original stream, zero allocation
- **Owned splits**: Arc-wrapped with automatic cleanup on drop
- **Reunification**: Type-safe reconstruction with pointer equality verification

## Platform Abstraction

Comprehensive cross-platform support through conditional compilation:
- **Unix**: File descriptor traits (`AsRawFd`, `AsFd`)
- **Windows**: Socket handle traits (`AsRawSocket`, `AsSocket`) 
- **WASI**: Limited functionality with `cfg_not_wasi!` exclusions
- **Platform-specific options**: `SO_REUSEPORT` (Unix), `TCP_QUICKACK` (Linux)

## Key Patterns and Conventions

### Resource Management
- Automatic cleanup on drop with optional graceful shutdown
- Explicit conversion methods (`from_std()`, `into_std()`) for interop
- Non-blocking mode enforced throughout the API

### Error Handling  
- OS-specific error normalization (e.g., `NotConnected` handling)
- Cancel-safe operations for use with `tokio::select!`
- Context-appropriate error propagation

### Configuration Philosophy
- Sensible defaults for high-level operations (`connect()`, `bind()`)
- Advanced configuration through `TcpSocket` before connection establishment
- Runtime socket option modification (`set_nodelay()`, `set_ttl()`, etc.)

This module serves as the foundation for TCP networking in Tokio applications, providing both high-level convenience and low-level control while maintaining async/await compatibility and efficient event-driven I/O.