# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/tcp_stream.rs
@source-hash: 8aa16fa46e48c130
@generated: 2026-02-09T18:12:42Z

## Purpose
Comprehensive test suite for Tokio's `TcpStream` implementation, validating socket behavior, async readiness notifications, and buffer management patterns. Tests non-blocking I/O operations, vectored I/O, connection state detection, and future size optimization.

## Key Test Functions

### `set_linger` (L15-29)
Tests TCP socket linger option configuration, verifying ability to set/unset linger timeout for graceful connection termination.

### `try_read_write` (L31-153) 
**Primary integration test** validating complete TCP I/O workflow:
- Creates client-server socket pair using localhost binding (L37-43)
- Tests readiness notifications with `task::spawn` polling (L47-48, L62-63)
- Fills write buffers to test backpressure handling (L60-72, L99-113)
- Validates both non-vectored (L65-71, L86-90) and vectored I/O (L106-112, L131-135)
- Tests connection shutdown detection using `Interest::READABLE` (L144-152)

### `buffer_not_included_in_future` (L155-178)
Performance test ensuring large stack buffers don't inflate future size, validating that `TcpStream::readable()` futures remain under 1000 bytes.

### Polling Readiness Tests
- `poll_read_ready` (L212-234): Tests `poll_read_ready()` state transitions
- `poll_write_ready` (L236-251): Tests `poll_write_ready()` state transitions  
- Uses helper macros (L180-210) for assertion patterns

### Buffer API Tests
- `try_read_buf` (L290-367): Tests `try_read_buf()` with `Vec<u8>` auto-sizing
- `read_closed`/`write_closed` (L370-406): Validates connection state detection accuracy

## Helper Functions

### `create_pair` (L253-258)
Factory function creating connected TCP socket pairs for testing, uses `try_join!` for concurrent connection establishment.

### `read_until_pending`/`write_until_pending` (L260-288)
Utility functions that exhaust socket buffers until `WouldBlock`, returning total bytes processed. Critical for testing backpressure scenarios.

## Testing Patterns

### Readiness Polling
Uses `task::spawn` with `assert_pending!`/`assert_ready_ok!` to test async readiness state transitions without blocking.

### Buffer Management
Tests demonstrate proper handling of:
- Write buffer saturation and backpressure
- Read buffer draining patterns  
- Vectored I/O for efficiency
- Non-blocking operation error handling

### Connection Lifecycle
Validates detection of connection events (readable/writable state changes, disconnection) through Interest-based readiness polling.

## Dependencies
- `tokio::net::{TcpListener, TcpStream}` for TCP networking
- `tokio_test` for async test utilities and assertions
- Standard I/O traits and error handling patterns

## Architecture Notes
- All tests use localhost (127.0.0.1:0) binding for isolation
- Skips execution on WASI (no socket support) and Miri (limited socket implementation)
- Demonstrates canonical patterns for non-blocking TCP I/O in Tokio applications