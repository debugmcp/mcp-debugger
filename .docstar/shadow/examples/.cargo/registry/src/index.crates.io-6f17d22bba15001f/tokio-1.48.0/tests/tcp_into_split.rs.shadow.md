# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/tcp_into_split.rs
@source-hash: 4a2e692ed8ed6320
@generated: 2026-02-09T18:12:34Z

## Purpose
Test file for Tokio's `TcpStream::into_split()` functionality, which splits a bidirectional TCP stream into separate read and write halves. Tests basic splitting, reuniting of halves, and proper connection termination.

## Key Tests

### split() (L13-55)
Primary test demonstrating `into_split()` functionality:
- Creates TCP listener/client connection using `try_join!` (L20-23)
- Splits stream1 into read/write halves via `into_split()` (L24)
- Validates bidirectional communication through three concurrent async blocks (L26-52):
  - Block 1: stream2 writes MSG, then reads echoed data
  - Block 2: write_half echoes MSG back to stream2
  - Block 3: read_half uses `peek()` twice to verify non-consuming reads, then `read()` to consume

### reunite() (L57-82)
Tests the reunite mechanism for split TCP streams:
- Uses synchronous std::net::TcpListener with background thread (L59-65)
- Creates two separate TCP connections and splits both (L67-71)
- Validates reunite fails when mixing halves from different streams (L73-76)
- Confirms successful reunite of matching halves (L78)

### drop_write() (L84-132)
Tests proper connection termination when write half is dropped:
- Uses synchronous server thread that writes MSG then expects EOF (L92-109)
- Client reads initial message, then drops write_half in background thread (L119-122)
- Verifies subsequent read returns 0 (EOF) indicating proper connection closure (L124-128)

## Dependencies
- `tokio::net::{TcpListener, TcpStream}` for async TCP operations
- `tokio::io::{AsyncReadExt, AsyncWriteExt}` for async I/O traits
- `std::net` and `std::thread` for synchronous networking in some tests
- `tokio::try_join!` macro for concurrent async operations

## Architecture Notes
- Tests are conditionally compiled for "full" feature with WASI/miri exclusions (L2)
- Mix of async Tokio and sync std networking demonstrates interoperability
- Uses `127.0.0.1:0` for automatic port assignment in tests
- Error handling via `Result<()>` return types with `?` propagation