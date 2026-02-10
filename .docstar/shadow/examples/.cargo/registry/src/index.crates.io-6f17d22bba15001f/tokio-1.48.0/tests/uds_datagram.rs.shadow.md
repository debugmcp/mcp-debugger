# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/uds_datagram.rs
@source-hash: db3ba082d44dac1d
@generated: 2026-02-09T18:12:43Z

## Tokio Unix Domain Socket Datagram Tests

Test suite for `tokio::net::UnixDatagram` functionality on Unix systems. Comprehensive coverage of async datagram operations including echo servers, polling interfaces, and buffer management.

### Key Components

**Echo Server Function (L13-21)**
- `echo_server()`: Async function that receives datagrams and echoes them back to sender
- Uses `recv_from()` to get data and peer address, then `send_to()` for response
- Handles peer address extraction via `as_pathname()`

**Core Test Functions**
- `echo()` (L23-46): Basic echo test with connected client/server using temporary socket files
- `echo_from()` (L48-72): Similar to echo but validates sender address in response
- `try_send_recv_never_block()` (L75-119): Tests non-blocking send/recv until OS buffer limits, uses `UnixDatagram::pair()`
- `split()` (L121-144): Tests concurrent send/recv using `Arc<UnixDatagram>` for shared ownership
- `send_to_recv_from_poll()` (L146-166): Tests polling interfaces `poll_send_to()` and `poll_recv_from()`
- `send_recv_poll()` (L168-190): Tests connected socket polling with `poll_send()` and `poll_recv()`

**Advanced Buffer Tests**
- `try_send_to_recv_from()` (L192-238): Non-blocking operations with retry loops and readiness checking
- `try_recv_buf_from()` (L240-286): Tests `try_recv_buf_from()` with dynamic Vec buffers
- `recv_buf_from()` (L288-309): Tests async `recv_buf_from()` with capacity management
- `try_recv_buf_never_block()` (L312-358): Comprehensive buffer test similar to L75 but with Vec buffers
- `recv_buf()` (L360-377): Tests paired socket `recv_buf()` functionality
- `poll_ready()` (L379-425): Tests readiness polling with `poll_send_ready()` and `poll_recv_ready()`

### Dependencies and Patterns

**Key Imports**
- `tokio::net::UnixDatagram`: Core datagram socket type
- `tokio::io::ReadBuf`: Buffer management for polling operations
- `tempfile::tempdir()`: Temporary directory creation for socket files
- `std::future::poll_fn`: Manual polling utilities

**Architectural Patterns**
- Temporary socket files using `tempfile` for isolation
- Socket pairing for bidirectional communication without filesystem paths
- Error handling focusing on `WouldBlock` and `ENOBUFS` conditions
- Buffer capacity management with both fixed arrays and dynamic Vecs
- Readiness-based I/O patterns with `writable()`/`readable()` await points

### Critical Test Invariants

- All tests ignore execution under Miri due to socket limitations
- Unix-only execution via `#[cfg(unix)]` 
- Proper cleanup through temporary directory scoping
- Echo pattern validation ensuring sent data matches received data
- Address verification in bidirectional communications
- Non-blocking operation testing pushes to OS buffer limits