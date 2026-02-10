# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/buffered.rs
@source-hash: 67d457bebbe39a7b
@generated: 2026-02-09T18:12:11Z

## Purpose
Test file for Tokio's buffered I/O capabilities through a TCP echo server scenario. Validates that data can be correctly transmitted and echoed between multiple TCP connections using async I/O operations.

## Key Components

### Main Test Function
- **`echo_server()` (L11-51)**: Async test that creates a TCP echo server scenario with concurrent connections
  - Creates TCP listener on localhost (L16)
  - Spawns blocking threads for client connections (L21, L24)
  - Uses `tokio::io::copy` to echo data between connections (L44)
  - Validates data integrity and byte count accuracy

### Test Architecture
- **Constants**: `N = 1024` iterations for stress testing (L14)
- **Message**: Fixed payload "foo bar baz" for predictable testing (L19)
- **Connection Pattern**: Two client connections, one writes data, other reads echoed data
- **Threading Model**: Blocking std::net clients + async Tokio server

### Key Operations
- **Client Writer** (L21-39): Sends message N times via std::net::TcpStream
- **Client Reader** (L24-29): Receives echoed data via separate connection  
- **Server Echo** (L44): Uses `tokio::io::copy(&mut a, &mut b)` to pipe data between connections
- **Validation** (L46-50): Compares expected vs actual data, verifies byte count

## Dependencies
- `tokio::net::TcpListener` for async TCP server
- `tokio_test::assert_ok` for test assertions
- `std::net::TcpStream` for synchronous client connections
- `std::thread` for concurrent client operations

## Test Patterns
- Mixed async/sync I/O testing
- Buffered data transmission validation
- Multi-connection echo server pattern
- Thread-based client simulation for realistic network scenarios

## Platform Constraints  
- Excluded on WASI (no socket support) via cfg attribute (L2)
- Ignored on Miri (no socket implementation) via cfg_attr (L12)