# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/read.rs
@source-hash: 3583f5adb74ddafc
@generated: 2026-02-09T18:02:49Z

## Purpose
Provides a low-level asynchronous read utility for Tokio's I/O system. Creates a future that reads bytes from an AsyncRead source into a provided buffer.

## Key Components

### `read()` function (L16-25)
- **Purpose**: Factory function that creates a `Read` future for asynchronous buffer filling
- **Parameters**: Takes a mutable reference to an `AsyncRead` reader and a mutable byte slice buffer
- **Constraints**: Reader must implement `AsyncRead + Unpin + ?Sized`
- **Returns**: `Read<'a, R>` future that will perform the read operation

### `Read` struct (L34-40)
- **Purpose**: Future type that represents a pending read operation
- **Fields**:
  - `reader: &'a mut R` - Mutable reference to the async reader
  - `buf: &'a mut [u8]` - Mutable reference to destination buffer
  - `_pin: PhantomPinned` - Makes future `!Unpin` for async trait compatibility
- **Attributes**: `#[must_use]` ensures the future is awaited/polled
- **Pin Projection**: Uses `pin_project!` macro for safe field access in pinned contexts

### `Future` implementation (L43-55)
- **Output Type**: `io::Result<usize>` - returns number of bytes read or I/O error
- **Polling Logic** (L49-54):
  1. Projects pinned self to access fields safely
  2. Wraps buffer in `ReadBuf` for Tokio's read interface
  3. Polls the underlying reader with `ready!` macro (handles `Pending` states)
  4. Returns filled buffer length on successful completion

## Dependencies
- `pin_project_lite`: Enables safe field projection in pinned futures
- `crate::io::{AsyncRead, ReadBuf}`: Core Tokio async I/O traits and buffer wrapper
- Standard library: Future trait, I/O error types, pin/task utilities

## Architectural Notes
- **Lifetime Management**: Uses single lifetime `'a` for both reader and buffer references
- **Pin Safety**: `PhantomPinned` field ensures compatibility with async trait bounds that require `!Unpin`
- **Error Handling**: Propagates I/O errors from underlying reader using `?` operator
- **Zero-Copy Design**: Works with borrowed slices, avoiding unnecessary allocations