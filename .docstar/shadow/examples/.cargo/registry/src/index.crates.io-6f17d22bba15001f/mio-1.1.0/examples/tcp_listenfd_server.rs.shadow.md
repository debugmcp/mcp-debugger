# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/examples/tcp_listenfd_server.rs
@source-hash: 3e11f2318584f252
@generated: 2026-02-09T18:11:39Z

## Purpose
Example TCP server using mio for non-blocking I/O with pre-opened file descriptors, demonstrating socket activation pattern. Supports both native Unix/WASI platforms and shows how to handle multiple concurrent client connections through event polling.

## Key Functions

**get_first_listen_fd_listener() (L21-34)**: Platform-specific function to acquire pre-opened TCP listener from file descriptor 3. Unix/WASI implementation uses `FromRawFd` (L25), while Windows returns `None` since `LISTEN_FDS` is unsupported.

**main() (L36-117)**: Core event loop that:
- Validates `LISTEN_FDS` environment variable (L39)
- Creates mio `Poll` instance and event storage (L42-44)
- Wraps std listener as mio `TcpListener` (L47-57)
- Registers server socket for readable events (L60-61)
- Manages client connections in HashMap with unique tokens (L63-66)
- Processes events: accepts new connections (L73-99) or handles existing connection I/O (L100-113)

**handle_connection_event() (L126-199)**: Processes individual client connection events:
- Writable events: sends welcome message `DATA` and reregisters for readable (L131-153)
- Readable events: reads client data with dynamic buffer growth, handles connection closure (L155-196)
- Returns boolean indicating if connection should be cleaned up

**next() (L119-123)**: Token generator for unique client connection identification.

**Error handling utilities (L201-207)**: `would_block()` and `interrupted()` helpers for non-blocking I/O error classification.

## Key Constants
- `SERVER` token (L15): Identifies server socket events
- `DATA` (L18): Welcome message sent to new clients

## Dependencies
- mio: Event-driven non-blocking I/O primitives
- std collections, I/O traits
- env_logger for debugging

## Architecture Patterns
- Event-driven architecture with single-threaded event loop
- Token-based event identification system
- Connection lifecycle management with registration/deregistration
- Platform abstraction for file descriptor handling
- Graceful error handling for non-blocking operations

## Critical Invariants
- File descriptor 3 must be pre-opened TCP listener
- `LISTEN_FDS` environment variable must be set
- Each connection gets unique token for event correlation
- Connections are removed from registry when done