# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_write_buf.rs
@source-hash: 331d3b54c7664386
@generated: 2026-02-09T18:12:19Z

## Purpose
Test file validating Tokio's `AsyncWriteExt::write_buf` functionality with buffered I/O operations. Verifies that data is correctly transferred from a readable buffer to an async writer with partial write semantics.

## Key Components

### Test Function: `write_all` (L13-56)
Async test that validates `write_buf` behavior by:
- Creating a mock writer that accepts only 4 bytes per write operation
- Using a `Cursor` over byte slice as the source buffer
- Verifying partial write semantics and buffer advancement

### Mock Writer: `Wr` struct (L15-43)
Custom `AsyncWrite` implementation for testing:
- **Fields**: `buf` (BytesMut for accumulating writes), `cnt` (write operation counter)
- **Constraint**: Only allows single write operation (`cnt` assertion on L26)
- **Behavior**: Limits writes to 4 bytes maximum per operation (L28-29)

### AsyncWrite Implementation (L20-43)
- `poll_write` (L21-34): Accepts up to 4 bytes, extends internal buffer, increments counter
- `poll_flush` (L36-38): No-op implementation returning immediate success
- `poll_shutdown` (L40-42): No-op implementation returning immediate success

## Dependencies
- `tokio::io::{AsyncWrite, AsyncWriteExt}` - Core async I/O traits
- `tokio_test::assert_ok` - Test assertion macro
- `bytes::BytesMut` - Mutable byte buffer
- `std::io::Cursor` - In-memory buffer with position tracking

## Test Assertions
- Verifies exactly 4 bytes written to internal buffer (L53)
- Confirms single write operation occurred (L54)
- Validates source cursor advanced to position 4 (L55)

## Key Pattern
Demonstrates partial write handling where `write_buf` must handle writers that don't consume entire input in single operation, typical in real async I/O scenarios.