# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/unix/listener.rs
@source-hash: 6fc204b8b70f667a
@generated: 2026-02-09T18:03:01Z

## Primary Purpose
Unix domain socket listener implementation for Tokio's async I/O runtime. Provides async server functionality for Unix socket connections, wrapping mio's UnixListener with Tokio's event-driven polling system.

## Key Components

### Core Structure
- **UnixListener** (L54-56): Main async Unix socket listener struct containing a `PollEvented<mio::net::UnixListener>` for event-driven I/O operations.

### Construction Methods
- **new()** (L60-63): Internal constructor wrapping mio::net::UnixListener in PollEvented
- **bind()** (L76-96): Creates listener bound to filesystem or abstract socket path. Handles Linux/Android abstract sockets (paths starting with null byte) vs regular filesystem paths
- **from_std()** (L140-146): Converts std::os::unix::net::UnixListener to Tokio equivalent, validates non-blocking mode via `check_socket_for_blocking`
- **into_std()** (L168-173): Converts back to std library listener, preserving non-blocking mode

### Core I/O Operations
- **accept()** (L193-203): Async method accepting new connections, returns (UnixStream, SocketAddr) tuple. Cancel-safe for use in select! statements
- **poll_accept()** (L211-216): Lower-level polling interface for accepting connections, integrates with manual polling scenarios

### Utility Methods
- **local_addr()** (L176-178): Returns bound socket address
- **take_error()** (L181-183): Retrieves SO_ERROR socket option value

## Dependencies & Relationships
- Depends on `PollEvented` for async I/O event handling
- Uses `mio::net::UnixListener` as underlying socket implementation  
- Creates `UnixStream` instances for accepted connections
- Integrates with Tokio's Interest-based polling system

## Platform-Specific Features
- Linux/Android support for abstract namespace sockets (L81-89)
- Conditional compilation for platform-specific socket address extensions (L7-12)

## Key Architectural Patterns
- Wrapper pattern around mio's synchronous socket with async polling layer
- Runtime requirement enforcement via #[track_caller] for proper tokio context
- File descriptor trait implementations (AsRawFd, AsFd) for interoperability
- TryFrom conversion trait for ergonomic std library integration (L219-229)

## Critical Constraints
- Must be used within Tokio runtime context (panics otherwise)
- Requires non-blocking mode for proper async operation
- Abstract socket paths on Linux/Android must start with null byte