# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/uds_socket.rs
@source-hash: cfa682445bb5e0ab
@generated: 2026-02-09T18:12:37Z

## Primary Purpose
Test suite for Tokio's Unix Domain Socket (UDS) functionality, specifically testing datagram and stream socket operations on Unix systems.

## Key Test Functions

### `datagram_echo_server` (L12-52)
Integration test demonstrating bidirectional Unix datagram socket communication:
- Creates temporary server and client socket paths using tempfile
- Server socket: binds to path, spawns echo server task that receives and echoes data back
- Client socket: connects to server, sends "ECHO" message, verifies echo response
- Tests socket binding, datagram creation, send_to/recv_from operations, and peer address handling

### `listen_and_stream` (L54-92) 
Integration test for Unix stream socket client-server communication:
- Sets up listener socket bound to temporary path with backlog of 1024
- Uses `try_join` to concurrently handle server accept and client connect operations
- Verifies peer address resolution and bidirectional data transfer
- Tests stream socket binding, listening, accepting, connecting, and async I/O operations

### `assert_usage` (L94-121)
Unit test validating socket type restrictions and error handling:
- Verifies datagram sockets reject `connect()` and `listen()` operations with specific error messages
- Verifies stream sockets reject `datagram()` conversion with specific error message
- Ensures proper API boundaries between socket types

## Dependencies
- `tokio`: Core async runtime and Unix socket primitives (`UnixSocket`)
- `futures`: Provides `try_join` utility for concurrent operations
- `tempfile`: Generates temporary directories for socket file paths
- Standard library I/O traits and error handling

## Architecture Patterns
- Test isolation through temporary directories
- Async/await pattern for non-blocking socket operations  
- Spawn-based concurrency for server simulation
- Error assertion testing for API contract validation

## Platform Constraints
- Unix-only compilation (`#![cfg(unix)]`)
- Miri execution disabled due to missing socket syscall support
- Requires "full" feature flag for complete Tokio functionality