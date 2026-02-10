# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/copy_buf.rs
@source-hash: 3bde20d0bfb8e886
@generated: 2026-02-09T18:02:47Z

## Purpose
Provides asynchronous buffered copying functionality for Tokio IO operations. Implements zero-allocation streaming copy from `AsyncBufRead` readers to `AsyncWrite` writers by leveraging the reader's internal buffer.

## Key Components

### `copy_buf` Function (L60-70)
Public async function that copies entire contents from a buffered reader to a writer. Returns total bytes copied as `u64`. Requires `AsyncBufRead + Unpin` reader and `AsyncWrite + Unpin` writer. Creates and awaits a `CopyBuf` future.

### `CopyBuf` Struct (L17-21)
Private future implementation holding:
- `reader: &'a mut R` - Source buffered reader reference
- `writer: &'a mut W` - Destination writer reference  
- `amt: u64` - Running count of bytes copied

### Future Implementation (L73-97)
Core polling logic in `poll()` method:
1. Fills reader buffer via `poll_fill_buf()` (L83)
2. On empty buffer, flushes writer and returns total (L84-86)
3. Writes buffer contents via `poll_write()` (L89)
4. Handles WriteZero error condition (L90-92)
5. Updates byte count and consumes from reader (L93-94)
6. Loops until EOF or error

## Dependencies
- `crate::io::{AsyncBufRead, AsyncWrite}` - Core async IO traits
- `std::future::Future` - Future trait implementation
- `std::task::{ready, Context, Poll}` - Async task primitives

## Architecture Patterns
- Future-based async design with manual `Poll` implementation
- Zero-copy optimization using reader's internal buffer
- Error propagation via `?` operator on IO operations
- Streaming copy with backpressure handling

## Critical Invariants
- Must check for WriteZero condition to prevent infinite loops
- Reader buffer consumption must match bytes written
- Writer flush required on completion for data integrity
- All operations use pinned references for safe async operation