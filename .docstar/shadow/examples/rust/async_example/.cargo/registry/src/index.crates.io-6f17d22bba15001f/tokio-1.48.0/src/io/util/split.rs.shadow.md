# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/split.rs
@source-hash: 1f53bfa87019af3f
@generated: 2026-02-09T18:02:49Z

## Purpose
Implements the `Split` struct for splitting async buffered readers on delimiter boundaries, part of Tokio's IO utilities for stream processing.

## Key Components

### Split Struct (L10-26)
Pin-projected struct that wraps an `AsyncBufRead` reader to split input on delimiter boundaries:
- `reader: R` - The underlying async buffered reader (pin-projected)
- `buf: Vec<u8>` - Internal buffer for accumulating bytes
- `delim: u8` - The delimiter byte to split on
- `read: usize` - Tracks bytes read in current segment

Marked with `#[must_use]` to prevent unused stream instances.

### Factory Function (L28-38)
`split<R>(reader: R, delim: u8) -> Split<R>` - Creates a new Split instance with empty buffer and zero read counter.

### Async Interface (L40-66)
For `Split<R>` where `R: AsyncBufRead + Unpin`:
- `next_segment(&mut self) -> io::Result<Option<Vec<u8>>>` (L61-65) - Async convenience method that polls for the next segment using `poll_fn`

### Core Polling Logic (L68-111)
For `Split<R>` where `R: AsyncBufRead`:
- `poll_next_segment(self: Pin<&mut Self>, cx: &mut Context) -> Poll<io::Result<Option<Vec<u8>>>>` (L89-110)
  - Uses `read_until_internal` to read until delimiter is found
  - Returns `Poll::Ready(Ok(None))` when both read count is 0 and buffer is empty (end of stream)
  - Strips delimiter byte from result if present (L105-107)
  - Returns owned `Vec<u8>` using `mem::take` to avoid cloning

## Dependencies
- `read_until_internal` from `crate::io::util::read_until` - Core reading logic
- `pin_project_lite` - Provides pin projection for the struct
- Standard async polling infrastructure (`Context`, `Poll`, `Waker`)

## Architectural Notes
- Uses pin projection to safely handle the pinned reader while allowing mutable access to other fields
- Leverages `read_until_internal` for the actual byte-level reading and delimiter detection
- Buffer management uses `mem::take` for efficient ownership transfer without cloning
- Follows Tokio's async iterator pattern with both async and polling interfaces