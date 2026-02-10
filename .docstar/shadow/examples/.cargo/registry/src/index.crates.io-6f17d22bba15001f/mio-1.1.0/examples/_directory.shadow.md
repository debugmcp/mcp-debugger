# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/examples/
@generated: 2026-02-09T18:16:07Z

## Purpose
Example implementations demonstrating mio's event-driven, non-blocking I/O capabilities across different network protocols and deployment patterns. This directory serves as a comprehensive reference for building asynchronous servers using mio's polling-based architecture.

## Key Components

**tcp_server.rs** - Standard TCP echo server showing core mio patterns:
- Event loop with Poll instance managing multiple connections
- Token-based connection identification and lifecycle management
- Non-blocking I/O with graceful error handling for `WouldBlock`/`Interrupted`

**tcp_listenfd_server.rs** - Advanced TCP server with socket activation support:
- Demonstrates pre-opened file descriptor pattern (systemd-style)
- Platform-specific abstraction layer (Unix/WASI vs Windows)
- Environment variable configuration (`LISTEN_FDS`)

**udp_server.rs** - UDP echo server illustrating connectionless protocol handling:
- Single-socket event registration with packet draining loops
- Immediate echo pattern without connection state tracking
- Buffer management for maximum UDP packet sizes

## Common Architecture Patterns

**Event-Driven Core**: All examples use mio's `Poll` instance as the central event dispatcher with edge-triggered semantics

**Token System**: Standardized approach using `Token(0)` for server sockets and incrementing tokens for client connections

**Error Classification**: Consistent handling distinguishing between recoverable errors (`WouldBlock`, `Interrupted`) and fatal conditions

**Registration Lifecycle**: Explicit socket registration → event handling → deregistration pattern across all examples

## Public API Demonstration

**Entry Points**: Each file contains a standalone `main()` function showing complete server implementations

**Key mio APIs Showcased**:
- `Poll::new()` and `poll()` for event loop management
- `TcpListener`/`TcpStream`/`UdpSocket` non-blocking network abstractions  
- `Registry::register()` with `Interest` flags for event subscription
- `Events` iteration and `Token` matching for event dispatch

**Platform Considerations**: Examples include conditional compilation and runtime checks for WASI compatibility limitations

## Internal Organization

**Connection Management**: TCP examples maintain `HashMap<Token, TcpStream>` for stateful connection tracking, while UDP operates statelessly

**Buffer Strategies**: Dynamic buffer growth in TCP examples vs fixed 64KB buffers for UDP maximum packet size

**Event Flow**: Server socket events trigger connection acceptance, client socket events handle I/O operations with appropriate interest re-registration

## Dependencies
- **mio**: Core event loop and network abstractions
- **env_logger**: Debug logging across examples
- **std collections**: Connection state management

These examples collectively demonstrate mio's flexibility across different network protocols, deployment patterns, and platform constraints while maintaining consistent architectural principles.