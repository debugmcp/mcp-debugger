# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_write_all_buf.rs
@source-hash: 4d55a1841ca7a237
@generated: 2026-02-09T18:12:23Z

## Purpose
Comprehensive test suite for Tokio's `write_all_buf` functionality, verifying correct behavior with different writer implementations and error conditions.

## Key Components

### Test Functions
- **write_all_buf** (L13-56): Core test verifying successful buffer writing with chunked output
- **write_buf_err** (L58-96): Error handling test ensuring partial writes and proper error propagation
- **write_all_buf_vectored** (L98-145): Vectored I/O test verifying optimization path for writers supporting vectored operations

### Mock Writer Implementations

#### Wr (L15-42)
Chunked writer that limits writes to 4 bytes maximum per operation:
- `buf: BytesMut` - Accumulates written data
- `cnt: usize` - Tracks write operation count
- Forces chunking by limiting write size with `cmp::min(4, buf.len())` (L26)

#### Wr (L61-85) 
Error-generating writer for failure path testing:
- Succeeds on first write, fails on second with "whoops" error (L72-74)
- Always reports 4 bytes written when successful (L75)

#### Wr (L100-134)
Vectored writer demonstrating I/O optimization:
- Implements `poll_write_vectored` to handle multiple buffers efficiently (L119-129)
- `is_write_vectored()` returns `true` to enable vectored path (L130-133)
- `poll_write` panics to verify vectored path is used (L111)

## Dependencies
- `tokio::io::{AsyncWrite, AsyncWriteExt}` - Core async I/O traits and extensions
- `tokio_test::{assert_err, assert_ok}` - Test assertion utilities
- `bytes::{Buf, Bytes, BytesMut}` - Buffer management types

## Test Patterns

### Buffer Creation
Uses chained `Bytes` for multi-segment buffer testing:
```rust
Bytes::from_static(b"hello").chain(Bytes::from_static(b"world"))
```

### Verification Strategy
- Data integrity: Compares final buffer contents (L52, L144)
- Operation counting: Verifies expected number of write calls (L54)
- Error handling: Ensures partial consumption on failure (L93-95)
- Buffer consumption: Confirms complete buffer drain (L55)

## Key Behaviors Tested
1. **Chunked Writing**: Verifies `write_all_buf` handles writers that accept partial writes
2. **Error Recovery**: Tests proper state after write failure with partial consumption
3. **Vectored Optimization**: Confirms vectored writers bypass standard write path for efficiency