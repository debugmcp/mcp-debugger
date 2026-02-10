# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_buf_writer.rs
@source-hash: 3bdabe9ac26f3189
@generated: 2026-02-09T18:12:23Z

## Purpose
Comprehensive test suite for Tokio's `BufWriter` async buffered writer, verifying buffering behavior, flushing mechanics, seeking operations, and vectored write operations. Originated from futures-rs codebase but adapted for Tokio.

## Key Test Structures

### MaybePending (L22-59)
Mock async writer that alternates between returning `Poll::Pending` and `Poll::Ready` on each call to `poll_write`. Uses internal `ready` flag to simulate async I/O delays. Wraps a `Vec<u8>` for actual data storage.

### MaybePendingSeek (L194-253)
Enhanced version of `MaybePending` with async seeking capabilities. Maintains separate ready flags for write and seek operations (`ready_write`, `ready_seek`). Wraps a `Cursor<Vec<u8>>` and caches seek results in `seek_res`.

### MockWriter (L272-341)
Configurable mock writer for testing vectored writes. Key features:
- `write_len`: limits bytes written per operation
- `vectored`: flag controlling `is_write_vectored()` response
- `write_up_to()` (L295): helper limiting write operations to `write_len`

### VectoredWriteHarness (L443-479)
Test harness for vectored write operations. Wraps `BufWriter<MockWriter>` and provides:
- `write_all()` (L463): writes all data from `IoBufs`, tracking progress
- `flush()` (L475): flushes buffer and returns written data
- Configurable for vectored/non-vectored backends

## Core Test Functions

### Basic Buffering Tests
- `buf_writer()` (L69-109): Tests capacity-2 buffer behavior with sequential writes
- `buf_writer_inner_flushes()` (L111-119): Verifies flush before `into_inner()`
- `buf_writer_seek()` (L121-132): Tests seeking with `Cursor` backend

### Async Behavior Tests
- `maybe_pending_buf_writer()` (L134-180): Same buffering tests with async delays
- `maybe_pending_buf_writer_inner_flushes()` (L182-190): Flush test with delays
- `maybe_pending_buf_writer_seek()` (L192-270): Seek operations with async delays

### Vectored Write Tests
- `write_vectored_empty_*()` (L343-369): Empty buffer handling
- `write_vectored_basic_*()` (L371-401): Basic multi-buffer writes
- `write_vectored_large_total_*()` (L403-441): Large writes exceeding buffer capacity
- `write_vectored_odd_*()` (L481-509): Irregular buffer patterns with empty slices
- `write_vectored_large_slice_*()` (L511-537): Single large buffer handling

## Key Dependencies
- `tokio::io::{BufWriter, AsyncWrite, AsyncSeek}`: Core buffered writer
- `support::io_vec::IoBufs`: Advanced vectored I/O buffer management
- `futures::future::poll_fn`: Manual polling for vectored operations
- `write_vectored()` helper (L61-67): Async wrapper for `poll_write_vectored`

## Testing Patterns
Tests systematically verify buffer state using `buffer()` method and underlying writer state via `get_ref()`. Each test covers both immediate writes (exceeding buffer) and buffered writes (within capacity). Vectored tests cover both backends that support vectored operations and those that don't.