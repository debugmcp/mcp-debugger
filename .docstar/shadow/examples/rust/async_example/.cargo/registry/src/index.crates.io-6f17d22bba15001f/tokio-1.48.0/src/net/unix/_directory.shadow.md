# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/unix/
@generated: 2026-02-09T18:16:31Z

## Purpose and Responsibility

This directory implements Tokio's comprehensive Unix domain socket networking layer, providing async I/O abstractions for all Unix socket types: streams (connection-oriented), datagrams (connectionless), listeners (servers), and pipes. It serves as the platform-specific networking foundation for Unix systems, wrapping `mio`'s non-blocking socket implementations with Tokio's async runtime integration.

## Key Components and Architecture

### Core Socket Types
- **UnixStream** (`stream.rs`): Bidirectional connection-oriented communication with full duplex async I/O
- **UnixListener** (`listener.rs`): Server-side socket accepting new connections
- **UnixDatagram** (`datagram/`): Connectionless message-passing sockets
- **Unix Pipes** (`pipe.rs`): Anonymous and named pipe (FIFO) implementations for process communication
- **UnixSocket** (`socket.rs`): Low-level builder for custom socket configuration before conversion

### Supporting Infrastructure
- **SocketAddr** (`socketaddr.rs`): Cross-platform Unix socket addressing with filesystem and abstract namespace support
- **UCred** (`ucred.rs`): Process credential retrieval with extensive platform-specific implementations
- **Stream Splitting**: Separate read/write halves via borrowed (`split.rs`) and owned (`split_owned.rs`) patterns

## Public API Surface

### Main Entry Points
- **Connection Management**: `UnixStream::connect()`, `UnixListener::bind()`, socket pairs via `pair()` methods
- **Datagram Communication**: `UnixDatagram::bind()`, `send_to()`/`recv_from()` operations
- **Pipe Operations**: `pipe()` function for anonymous pipes, `OpenOptions` for named FIFOs
- **Stream Splitting**: `split()` for borrowed halves, `into_split()` for owned halves

### Async I/O Patterns
- **Readiness-Based**: `ready()`, `readable()`, `writable()` methods for interest-driven I/O
- **Try Operations**: Non-blocking `try_read()`, `try_write()` variants that return immediately
- **Polling Interface**: `poll_*` methods for manual async state management
- **Custom I/O**: `try_io()` and `async_io()` for user-defined socket operations

## Internal Organization and Data Flow

### Layered Architecture
```
Tokio Unix Socket Types (stream, listener, datagram, pipe)
                    ↓
        PollEvented<mio::net::*> wrappers
                    ↓
            mio non-blocking sockets
                    ↓
            System calls (socket, bind, etc.)
```

### Event-Driven Model
All socket types follow the same pattern:
1. Register with Tokio runtime via `PollEvented`
2. Attempt I/O operation
3. If `WouldBlock`, await readiness notification
4. Retry operation when ready
5. Clear readiness state to prevent spurious wakeups

### Platform Abstraction
- **Cross-Platform**: Unified API across Unix variants (Linux, macOS, BSD, etc.)
- **Platform-Specific Features**: Linux abstract namespaces, platform-specific credential retrieval
- **Conditional Compilation**: Extensive `#[cfg()]` usage for platform capabilities

## Important Patterns and Conventions

### Resource Management
- **RAII**: All sockets automatically clean up file descriptors via Drop
- **Runtime Integration**: All operations require active Tokio runtime with I/O enabled
- **Non-blocking Mode**: File descriptors automatically configured for async operation

### Type Safety and Ergonomics
- **Builder Pattern**: `UnixSocket` for pre-configuration, `OpenOptions` for pipes
- **Conversion Traits**: Seamless interop with standard library types via `From`/`TryFrom`
- **Split Ownership**: Zero-cost read/write splitting with type-level enforcement
- **Cancel Safety**: All async operations designed to be cancellation-safe in `select!`

### Error Handling
- **Graceful Degradation**: `WouldBlock` handling for spurious readiness
- **Platform Errors**: Proper propagation of syscall errors with context
- **Validation**: Runtime checks for socket types and modes where needed

This module serves as the complete Unix networking foundation for Tokio applications, providing both high-level async APIs for common use cases and low-level polling interfaces for advanced custom implementations. The design emphasizes zero-cost abstractions, platform portability, and seamless integration with Tokio's async runtime.