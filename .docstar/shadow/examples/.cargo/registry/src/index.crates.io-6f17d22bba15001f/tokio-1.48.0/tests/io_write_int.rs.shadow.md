# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_write_int.rs
@source-hash: 3f4b50345f7d7d55
@generated: 2026-02-09T18:12:19Z

## Purpose
Test file for Tokio's AsyncWriteExt integer writing methods, specifically testing error handling when the underlying writer returns 0 bytes written.

## Key Components

### Test Function: `write_int_should_err_if_write_count_0` (L10-37)
Async test that verifies AsyncWriteExt integer write methods properly error when the underlying writer claims to write 0 bytes. This is a critical safety check since writing 0 bytes typically indicates a non-transient error condition.

### Mock Writer: `Wr` (L12-30)
Minimal AsyncWrite implementation that always returns `Ok(0)` from `poll_write` (L15-21), simulating a writer that accepts data but writes nothing. Implements required AsyncWrite trait methods:
- `poll_write` (L15-21): Always returns `Poll::Ready(Ok(0))`
- `poll_flush` (L23-25): No-op, returns success
- `poll_shutdown` (L27-29): No-op, returns success

## Dependencies
- `tokio::io::{AsyncWrite, AsyncWriteExt}` (L4): Core async I/O traits
- Standard library I/O and async task primitives (L6-8)

## Test Coverage
Tests two representative integer write methods:
- `write_i8()` (L35): 1-byte integer write
- `write_i32()` (L36): 4-byte integer write

The comment (L34) indicates these represent the full family of integer write methods that are macro-generated.

## Architecture Notes
This test validates a critical invariant: integer write methods must fail when the underlying writer makes no progress, preventing infinite loops or data loss in real applications.