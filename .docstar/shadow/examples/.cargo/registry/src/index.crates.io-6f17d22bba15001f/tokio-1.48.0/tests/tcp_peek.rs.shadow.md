# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/tcp_peek.rs
@source-hash: dde2f379d258e5e4
@generated: 2026-02-09T18:12:32Z

## Primary Purpose
Integration test for Tokio's `TcpStream::peek()` functionality, verifying that peeking at data doesn't consume it from the stream buffer.

## Key Components

### Test Function: `peek()` (L13-37)
- Creates a TCP connection pair using standard library and Tokio components
- Tests that `peek()` reads data without consuming it, followed by normal `read()` getting the same data
- Uses async/await pattern with tokio runtime

### Connection Setup (L15-26)
- Creates `std::net::TcpListener` on localhost with random port (L15)
- Spawns thread to accept connection (L18) 
- Establishes client connection using `std::net::TcpStream` (L20)
- Converts both ends to non-blocking mode (L22, L26)

### Data Flow Test (L28-36)
- Server writes test data `[1, 2, 3, 4]` (L28)
- Converts std TcpStream to Tokio TcpStream (L30)
- Peeks at data without consuming (L32-33)
- Reads same data normally to verify it wasn't consumed (L35-36)

## Dependencies
- `tokio::io::AsyncReadExt` - Provides async read operations
- `tokio::net::TcpStream` - Tokio's async TCP stream
- `tokio_test::assert_ok` - Test assertion macro
- Standard library networking (`std::net`) and threading

## Architecture Notes
- Uses mixed std/async approach: std components for setup, Tokio for async operations
- Demonstrates conversion from `std::net::TcpStream` to `tokio::net::TcpStream`
- Platform-conditional compilation excludes WASI and Miri targets

## Test Invariants
- Peek operation must return same data as subsequent read
- Data peeked should match exactly what was written: `[1, 2, 3, 4]`
- Both peek and read operations should return same byte count