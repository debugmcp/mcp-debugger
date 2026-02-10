# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_write_all.rs
@source-hash: e171af1ecab45a43
@generated: 2026-02-09T18:12:18Z

## Purpose
Test file for Tokio's `AsyncWriteExt::write_all()` method, ensuring it properly handles partial writes by retrying until all data is written.

## Key Components

### Test Function: `write_all()` (L13-51)
- Main test function that validates `write_all()` behavior with a mock writer that accepts limited bytes per write
- Uses `tokio_test::assert_ok!` macro for async result validation

### Mock Writer: `Wr` Struct (L15-18)
- `buf: BytesMut` - accumulates written data for verification
- `cnt: usize` - tracks number of write operations performed

### AsyncWrite Implementation (L20-41)
- **`poll_write()`** (L21-32): Simulates partial writes by limiting to 4 bytes maximum per call, increments counter, extends buffer
- **`poll_flush()`** (L34-36): No-op implementation returning immediate success  
- **`poll_shutdown()`** (L38-40): No-op implementation returning immediate success

## Test Logic
1. Creates mock writer with 64-byte capacity buffer (L43-46)
2. Calls `write_all()` with "hello world" (11 bytes) (L48)
3. Verifies complete data was written to buffer (L49)
4. Verifies exactly 3 write operations occurred due to 4-byte limit (L50)

## Dependencies
- `tokio::io::{AsyncWrite, AsyncWriteExt}` - core async I/O traits and extensions
- `tokio_test::assert_ok` - test assertion macro
- `bytes::BytesMut` - mutable byte buffer for data accumulation

## Test Pattern
Demonstrates incremental write behavior where `write_all()` automatically retries partial writes until completion, validating the extension trait's retry logic.