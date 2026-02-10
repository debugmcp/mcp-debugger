# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_util_empty.rs
@source-hash: 1a3402637b3960f6
@generated: 2026-02-09T18:12:19Z

## Purpose and Responsibility
Test suite for `tokio::io::empty()` utility, verifying that empty readers behave cooperatively with Tokio's async runtime and implement seek operations correctly.

## Test Functions

### `empty_read_is_cooperative()` (L5-17)
Tests that `tokio::io::empty().read()` yields control to other tasks instead of busy-looping. Uses `tokio::select!` with `biased` priority to ensure the infinite read loop competes fairly with `yield_now()`. If the empty reader is cooperative, `yield_now()` will eventually win the race.

### `empty_buf_reads_are_cooperative()` (L20-32) 
Similar cooperative behavior test for buffered read operations using `read_line()`. Ensures buffered reading operations on empty streams don't monopolize the executor.

### `empty_seek()` (L35-61)
Comprehensive test of seek behavior on empty readers. Verifies that all seek operations (`SeekFrom::Start`, `SeekFrom::End`, `SeekFrom::Current`) always return position 0, regardless of the seek offset values including edge cases (0, 1, MIN, MAX values).

## Key Dependencies
- `tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncSeekExt}` (L2) - Async I/O trait extensions
- `std::io::SeekFrom` (L36) - Standard library seek positioning enum
- `tokio::test` attribute for async test execution

## Testing Patterns
- Uses `tokio::select!` with `biased` flag to test cooperative scheduling
- Employs `matches!` macro for pattern matching on `Result` types in seek tests
- Tests boundary conditions with extreme values (MIN/MAX) for robustness

## Critical Behavior Verified
- Empty readers must be cooperative (yield to scheduler)
- Empty readers always report position 0 regardless of seek operations
- Both direct reads and buffered reads exhibit cooperative behavior