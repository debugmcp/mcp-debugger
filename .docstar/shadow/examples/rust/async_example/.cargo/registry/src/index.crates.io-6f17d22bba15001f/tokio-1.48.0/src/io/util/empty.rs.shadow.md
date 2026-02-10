# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/empty.rs
@source-hash: 753c38a55cf259f6
@generated: 2026-02-09T18:02:50Z

## Purpose
Implements `Empty` - a null I/O type that mimics `/dev/null` behavior for async operations. Always returns EOF on reads and discards all writes without error.

## Key Components

### Empty Struct (L20-22)
- Zero-sized struct with single unit field `_p: ()`
- Acts as async equivalent of `std::io::empty()`
- Implements all major async I/O traits

### Factory Function
- `empty()` (L62-64): Creates new `Empty` instance

## Trait Implementations

### AsyncRead (L67-78)
- `poll_read()` (L69-77): Always returns `Poll::Ready(Ok(()))` with no data read
- Uses tracing and progress utilities for proper async coordination

### AsyncBufRead (L80-90)
- `poll_fill_buf()` (L82-86): Returns empty slice `&[]`
- `consume()` (L89): No-op since no data exists to consume

### AsyncWrite (L92-134)
- `poll_write()` (L94-102): Returns `Poll::Ready(Ok(buf.len()))` - pretends to write all data
- `poll_flush()` (L105-109): Always succeeds immediately
- `poll_shutdown()` (L112-116): Always succeeds immediately  
- `is_write_vectored()` (L119-121): Returns `true` - supports vectored writes
- `poll_write_vectored()` (L124-133): Sums buffer lengths and pretends to write all

### AsyncSeek (L136-148)
- `start_seek()` (L138-140): Always succeeds, ignores position
- `poll_complete()` (L143-147): Always returns position 0

### Debug (L150-154)
- Provides simple debug representation: `"Empty { .. }"`

## Dependencies
- Uses `poll_proceed_and_make_progress` utility (L1) for cooperative scheduling
- Integrates with tokio's tracing system via `trace_leaf()`
- Wrapped in `cfg_io_util!` macro (L9) for conditional compilation

## Patterns
- All async methods follow same pattern: trace → progress check → immediate success
- Consistent use of `ready!` macro for proper async state handling
- Write operations report full buffer consumption without actual processing
- Seeking always reports position 0 regardless of seek target

## Usage
Primary use cases: testing, placeholder I/O endpoints, data discarding scenarios. Examples show reading (always empty) and writing (always succeeds with full length).

## Testing (L156-164)
- Includes `assert_unpin` test to verify `Unpin` trait implementation