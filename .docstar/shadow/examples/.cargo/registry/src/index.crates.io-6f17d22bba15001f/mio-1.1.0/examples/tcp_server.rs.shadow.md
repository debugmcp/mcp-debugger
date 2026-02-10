# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/examples/tcp_server.rs
@source-hash: 3d8b0315eebca8de
@generated: 2026-02-09T18:11:37Z

## Primary Purpose
A complete example TCP server implementation using the MIO event-driven I/O library. Demonstrates asynchronous, non-blocking server architecture with epoll/kqueue-style event handling for concurrent client connections.

## Key Functions and Components

**main() (L17-99)** - Core server loop implementing:
- Poll-based event system initialization (L21-23)
- TCP server socket binding on 127.0.0.1:9000 (L26-31)
- Connection management using HashMap<Token, TcpStream> (L34)
- Event dispatch between server socket and client connections

**handle_connection_event() (L108-181)** - Connection state machine handling:
- Writable events: Sends "Hello world!\n" greeting then switches to read-only mode (L113-135)
- Readable events: Echo server functionality with dynamic buffer resizing (L137-178)
- Returns boolean indicating if connection should be closed

**Utility Functions:**
- **next() (L101-105)** - Token generator for unique client identification
- **would_block() (L183-185)** - ErrorKind::WouldBlock detection helper
- **interrupted() (L187-189)** - ErrorKind::Interrupted detection helper

## Architecture Patterns

**Event-Driven Architecture**: Uses mio::Poll for multiplexed I/O with edge-triggered semantics
**Token-Based Identification**: SERVER token (0) for listener, incrementing tokens for clients starting at 1
**State Management**: Explicit connection lifecycle (register → handle events → deregister)
**Error Handling**: Distinguishes between recoverable (WouldBlock, Interrupted) and fatal errors

## Key Dependencies
- **mio**: Core event loop, TCP abstractions, and polling mechanisms
- **std::collections::HashMap**: Client connection storage keyed by Token
- **env_logger**: Debug logging support

## Critical Invariants
- Each client connection gets unique Token generated sequentially
- Connections register with READABLE|WRITABLE initially, switch to READABLE after greeting
- WouldBlock errors are normal in non-blocking I/O and handled gracefully
- Connection cleanup requires explicit deregistration from poll registry

## Platform Constraints
WASI target compilation fails at runtime - TCP binding not supported (L191-194)