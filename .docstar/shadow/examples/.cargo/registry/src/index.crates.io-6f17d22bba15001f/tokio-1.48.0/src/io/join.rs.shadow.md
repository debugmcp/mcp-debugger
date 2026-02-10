# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/join.rs
@source-hash: f1c229259247b006
@generated: 2026-02-09T18:06:34Z

## Purpose
Provides a utility for combining separate AsyncRead and AsyncWrite implementations into a single unified handle, enabling bidirectional I/O operations through one object.

## Key Components

### `join<R, W>()` function (L11-17)
Factory function that creates a `Join<R, W>` wrapper around separate reader and writer components. Requires `R: AsyncRead` and `W: AsyncWrite` bounds.

### `Join<R, W>` struct (L23-28) 
Core wrapper struct that holds pinned reader and writer fields. Uses `pin_project_lite` for safe projection of pinned fields during async operations.

### Component Access Methods (L38-70)
- `into_inner()` (L38-40): Consumes self and returns the original (reader, writer) tuple
- `reader()` / `writer()` (L43-49): Immutable references to inner components
- `reader_mut()` / `writer_mut()` (L53-59): Mutable references to inner components  
- `reader_pin_mut()` / `writer_pin_mut()` (L63-69): Pinned mutable references using projection

### Trait Implementations

#### `AsyncRead` for `Join` (L73-84)
Delegates `poll_read()` to the reader component via projection. Only requires `R: AsyncRead` bound.

#### `AsyncWrite` for `Join` (L86-117) 
Delegates all write operations to the writer component:
- `poll_write()` / `poll_write_vectored()` for data writing
- `poll_flush()` / `poll_shutdown()` for lifecycle management
- `is_write_vectored()` for capability querying
Only requires `W: AsyncWrite` bound.

#### `AsyncBufRead` for `Join` (L119-130)
Conditionally implemented when `R: AsyncBufRead`. Delegates `poll_fill_buf()` and `consume()` to reader component.

## Architecture Notes
- Uses `pin_project_lite` for safe field projection in async contexts
- Asymmetric trait bounds allow mixing different capability levels (e.g., buffered reader with simple writer)
- Zero-cost abstraction that purely delegates to underlying components
- Supports vectored I/O when underlying writer supports it

## Dependencies
- `tokio::io::{AsyncBufRead, AsyncRead, AsyncWrite, ReadBuf}`
- `pin_project_lite` for safe pinning projection
- Standard library I/O and async primitives