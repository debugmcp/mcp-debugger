# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/write_buf.rs
@source-hash: 8a9d58dc3ae3bccf
@generated: 2026-02-09T18:02:51Z

## Purpose
Provides an asynchronous future for writing buffer data to an `AsyncWrite` implementation. This is a utility module within tokio's I/O layer that facilitates non-blocking buffer-to-writer operations.

## Key Components

### WriteBuf Struct (L15-20)
- A pinned future that holds mutable references to both writer and buffer
- Uses `PhantomPinned` to ensure the struct cannot be moved once pinned
- Generic over writer type `W` (must implement `AsyncWrite + Unpin`) and buffer type `B` (must implement `Buf`)
- Borrows writer and buffer for lifetime `'a` to avoid ownership transfer

### write_buf Function (L25-35)
- Factory function that constructs a `WriteBuf` future
- Takes mutable references to writer and buffer, returning the configured future
- Constraint: writer must implement `AsyncWrite + Unpin`, buffer must implement `Buf`

### Future Implementation (L37-55)
- **poll method (L44-54)**: Core async execution logic
  - Returns `Poll::Ready(Ok(0))` immediately if buffer is empty (L47-49)
  - Attempts to write buffer's current chunk to writer using `poll_write` (L51)
  - Advances buffer position by number of bytes written (L52)
  - Returns number of bytes written on success

## Dependencies
- `bytes::Buf` - For buffer manipulation and chunking
- `pin_project_lite` - For safe pinning projection
- `AsyncWrite` trait from tokio's I/O module
- Standard library types for async (`Future`, `Poll`, `Context`, `Pin`)

## Architectural Patterns
- **Zero-copy design**: Works with buffer chunks directly without intermediate copying
- **Pinning safety**: Uses `PhantomPinned` and pin projection to ensure memory safety
- **Single-shot operation**: Future completes after one write attempt, returning bytes written
- **Error propagation**: Preserves I/O errors from underlying writer through `?` operator

## Critical Constraints
- Future must be pinned before polling due to `PhantomPinned`
- Buffer position is mutated during write operation (advanced by bytes written)
- Single write attempt per poll - does not retry or write entire buffer in one go