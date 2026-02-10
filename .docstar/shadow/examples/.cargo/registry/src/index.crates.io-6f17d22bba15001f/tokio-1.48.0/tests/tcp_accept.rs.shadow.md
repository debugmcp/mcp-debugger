# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/tcp_accept.rs
@source-hash: debf8c202528f2bc
@generated: 2026-02-09T18:12:34Z

## Purpose
Test suite for Tokio's TCP listener accept functionality, verifying correct behavior across different address formats and polling scenarios.

## Key Components

### test_accept! Macro (L12-34)
Declarative macro that generates test functions for TCP accept operations. Each test:
- Binds a TcpListener to the specified address format
- Spawns a task to accept incoming connections
- Connects a client and verifies address matching between client local and server peer addresses

### Generated Test Functions (L36-42)
Five parameterized tests covering different address binding formats:
- `ip_str`: String IP address "127.0.0.1:0" 
- `host_str`: Hostname string "localhost:0"
- `socket_addr`: Parsed SocketAddr
- `str_port_tuple`: (IP string, port) tuple
- `ip_port_tuple`: (IpAddr, port) tuple

### TrackPolls Stream (L52-64) 
Custom Stream wrapper that counts poll operations on a TcpListener:
- `npolls`: Atomic counter tracking poll_accept calls
- Implements Stream trait, forwarding to `listener.poll_accept()`

### no_extra_poll Test (L66-96)
Verifies efficient polling behavior:
- Ensures exactly 1 initial poll, then 2 more polls (accept + pending check) after connection
- Uses TrackPolls to monitor poll count via atomic operations

### accept_many Test (L98-157)
Stress test with 50 concurrent accept operations:
- Creates N tasks each polling a shared listener
- Uses coordination channels to synchronize polling phases
- Verifies all tasks are properly notified when connection arrives
- Tests wakeup behavior across multiple concurrent accepts

## Dependencies
- `tokio::net::{TcpListener, TcpStream}` for TCP networking
- `tokio::sync::{mpsc, oneshot}` for async coordination
- `tokio_stream::Stream` for custom stream implementation
- `std::sync::atomic` for thread-safe counters

## Architecture Patterns
- Macro-based test generation for parameterized testing
- Stream trait implementation for custom polling behavior
- Atomic counters for cross-task state tracking
- Channel-based task coordination in concurrent scenarios

## Platform Constraints
Disabled on WASI (no socket binding) and Miri (no socket support) via cfg attributes (L2-3).