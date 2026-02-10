# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/read_buf.rs
@source-hash: 812ac09bb6e19f14
@generated: 2026-02-09T18:02:47Z

## Purpose
Provides a future wrapper for asynchronous buffer reading operations. Implements the bridge between tokio's AsyncRead trait and bytes::BufMut for efficient buffer management.

## Key Components

### Constructor Function
- `read_buf()` (L11-21): Factory function creating ReadBuf instances with proper lifetime management and PhantomPinned marker

### Main Structure
- `ReadBuf<'a, R, B>` (L23-33): Pin-projected future struct containing:
  - `reader: &'a mut R` - mutable reference to AsyncRead implementor
  - `buf: &'a mut B` - mutable reference to BufMut buffer
  - `_pin: PhantomPinned` - ensures struct cannot be moved once pinned

### Future Implementation
- `Future::poll()` (L42-70): Core async polling logic that:
  - Checks buffer capacity using `has_remaining_mut()` (L47)
  - Creates unsafe uninit slice from buffer chunk (L52-54)
  - Wraps slice in tokio's ReadBuf for safe initialization tracking (L54)
  - Polls underlying reader with pointer stability assertion (L56-59)
  - Safely advances buffer position by bytes read (L65-66)

## Dependencies
- `crate::io::{AsyncRead, ReadBuf}` - tokio's async I/O traits
- `bytes::BufMut` - efficient buffer mutation interface
- `pin_project_lite::pin_project` - safe pin projection macro

## Key Patterns
- **Pin Safety**: Uses PhantomPinned and pin_project to ensure memory safety during async operations
- **Zero-Copy**: Leverages BufMut's chunk_mut() for direct buffer access without intermediate copying
- **Pointer Stability**: Asserts buffer pointer remains stable across async yields (L58-59)
- **Unsafe Optimization**: Uses unsafe buffer advancement after verified initialization

## Critical Invariants
- Buffer capacity must be checked before attempting reads
- ReadBuf::filled() guarantees track initialized bytes correctly
- Buffer pointer must remain stable during poll_read operation
- advance_mut() call count must match exactly the bytes initialized by ReadBuf