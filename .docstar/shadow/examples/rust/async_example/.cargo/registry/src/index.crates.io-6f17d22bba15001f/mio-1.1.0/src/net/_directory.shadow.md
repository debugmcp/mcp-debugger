# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/net/
@generated: 2026-02-09T18:16:39Z

## Overall Purpose and Responsibility
The `net` directory implements Mio's complete networking layer, providing cross-platform, non-blocking network socket abstractions for building scalable async I/O applications. It serves as the primary networking interface between user applications and Mio's event-driven architecture, offering both Internet Protocol (TCP) and Unix Domain Socket primitives.

## Key Components and Integration
The module is organized into two major networking domains:

### TCP Networking (`tcp/`)
- **TcpListener**: Non-blocking TCP server socket for accepting connections
- **TcpStream**: TCP client socket with bidirectional data transfer capabilities

### Unix Domain Sockets (`uds/`)  
- **UnixDatagram**: Connectionless datagram communication over Unix domain sockets
- **UnixListener**: Server socket for accepting Unix domain connections
- **UnixStream**: Connection-oriented bidirectional Unix domain communication

Both subsystems share identical architectural patterns and event integration, ensuring consistent programming models across different network transport types.

## Public API Surface
The networking module exposes five primary socket types as main entry points:

### Internet Sockets
- **`TcpListener::bind(addr)`** → **`accept()`**: Server-side TCP connection acceptance
- **`TcpStream::connect(addr)`**: Client-side TCP connection establishment with full `Read`/`Write` support

### Unix Domain Sockets
- **`UnixListener::bind(addr)`** → **`accept()`**: Server-side Unix socket connection acceptance  
- **`UnixStream::connect(addr)`**, **`pair()`**: Client connections and socket pairs
- **`UnixDatagram::bind(addr)`**: Connectionless Unix socket communication with `send_to()`/`recv_from()`

## Internal Organization and Data Flow
All networking components follow a unified three-layer architecture:

### 1. IoSource Wrapper Pattern
Every socket type wraps standard library networking primitives (`std::net`, `std::os::unix::net`) within `IoSource<T>` containers that provide:
- Platform-agnostic event registration with Mio's polling system
- Automatic `WouldBlock` error handling and event re-registration
- Consistent non-blocking I/O behavior across all socket types

### 2. Cross-Platform Abstraction
The networking layer handles platform differences through:
- **Unix/Linux**: File descriptor-based operations with full feature support
- **Windows**: Socket handle-based operations for TCP sockets
- **WASI**: Limited subset functionality for WebAssembly environments
- Comprehensive conversion traits for interoperability with standard library types

### 3. Event System Integration
All socket types implement `event::Source` trait, enabling:
- Registration with Mio's `Poll` instance using tokens
- Interest specification (readable/writable events)
- Edge-triggered event notifications for scalable async operation

## Important Patterns and Conventions

### Unified Programming Model
Both TCP and Unix domain sockets expose identical patterns:
- **Server Pattern**: `bind()` → `register()` → `accept()` → handle connections
- **Client Pattern**: `connect()` → `register()` → async I/O operations
- **Datagram Pattern**: `bind()` → `register()` → `send_to()`/`recv_from()`

### Safety and Interoperability
- All sockets maintain non-blocking mode guarantees
- Extensive raw FD/socket conversion support for `std` library interoperability
- Platform-specific security considerations (e.g., `SO_REUSEADDR` behavior differences)

### Error Handling Philosophy
- All I/O operations return immediately with `WouldBlock` when data is unavailable
- Event system ensures proper re-registration after incomplete operations
- Consistent error semantics across all socket types and platforms

This networking module serves as the foundation for all network I/O in Mio applications, providing the essential building blocks for both client and server architectures in event-driven, async systems. The unified design allows developers to work with different transport mechanisms using consistent APIs and patterns.