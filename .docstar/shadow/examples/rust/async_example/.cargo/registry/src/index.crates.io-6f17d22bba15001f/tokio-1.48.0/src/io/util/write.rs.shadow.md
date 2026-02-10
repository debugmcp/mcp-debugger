# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/write.rs
@source-hash: 20d14ee545ab1f67
@generated: 2026-02-09T18:02:47Z

## Purpose
Utility module providing an async write future for Tokio's I/O system. Creates a future that attempts to write a buffer to an `AsyncWrite` implementation once when polled.

## Key Components

### `Write<'a, W>` struct (L10-21)
Future type that wraps an async write operation with borrowed references:
- `writer: &'a mut W` - Mutable reference to the writer implementing `AsyncWrite`
- `buf: &'a [u8]` - Byte slice to write
- `_pin: PhantomPinned` - Makes future `!Unpin` for async trait method compatibility

Uses `pin_project!` macro for safe field projection during polling.

### `write()` function (L25-34)
Public crate-internal constructor that creates a `Write` future:
- Takes mutable writer reference and byte buffer
- Requires `W: AsyncWrite + Unpin + ?Sized`
- Returns configured `Write` future ready for polling

### Future Implementation (L36-46)
`Future` trait implementation for `Write`:
- `Output = io::Result<usize>` - Returns bytes written or I/O error
- `poll()` method projects self and delegates to writer's `poll_write()`
- Single attempt write operation - doesn't loop or retry

## Architecture Notes
- Single-shot write operation (not write_all)
- Uses pin projection for safe async handling
- Designed for integration with higher-level Tokio I/O utilities
- Compatible with async trait methods due to `!Unpin` constraint

## Dependencies
- `crate::io::AsyncWrite` - Core async write trait
- `pin_project_lite` - Safe pin projection macros
- Standard library futures and I/O types