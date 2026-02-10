# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/tcp_echo.rs
@source-hash: cbb4802650cbbc4e
@generated: 2026-02-09T18:12:32Z

## Purpose
Integration test for Tokio's TCP echo server functionality, demonstrating bidirectional TCP communication with async I/O operations.

## Key Test Function
- **echo_server()** (L11-43): Main test function that creates a TCP echo server and client, verifying that data sent by the client is correctly echoed back by the server

## Test Architecture
The test uses a concurrent client-server pattern:

### Server Side (L16-17, L36-40)
- Creates `TcpListener` bound to localhost:0 (L16)
- Accepts incoming connection (L36)
- Uses `io::copy()` to echo all received data back to client (L39)

### Client Side (L20-34)
- Spawned as separate async task (L20)
- Connects to server using resolved address (L21)
- Performs 1024 iterations of write-read cycles (L23-31)
- Each iteration sends "foo bar baz" and verifies echo response
- Signals completion via oneshot channel (L33)

## Key Dependencies
- `tokio::net::{TcpListener, TcpStream}` for TCP networking (L6)
- `tokio::io::{AsyncReadExt, AsyncWriteExt}` for async I/O operations (L5)
- `tokio::sync::oneshot` for coordination between client and server tasks (L7)
- `tokio_test::assert_ok` for test assertions (L8)

## Test Configuration
- Conditional compilation excludes WASI and Miri targets (L2-3)
- Requires "full" feature flag for complete Tokio functionality (L2)
- Uses `#[tokio::test]` macro for async test execution (L10)

## Critical Test Logic
- **Data Volume Verification**: Confirms total bytes copied equals expected amount (1024 iterations × 11 bytes = 11,264 bytes) (L40)
- **Synchronization**: Uses oneshot channel to ensure client completes before test ends (L42)
- **Stream Splitting**: Demonstrates splitting TCP stream into read/write halves for echo implementation (L37)