# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_buf_reader.rs
@source-hash: f5a322dea6fe9f40
@generated: 2026-02-09T18:12:20Z

Test suite for tokio's BufReader implementation, derived from futures-rs crate. Provides comprehensive testing of buffered I/O operations with various edge cases and async scenarios.

## Key Test Utilities

**run_fill_buf! macro (L17-26)**: Synchronously executes poll_fill_buf operations in a loop until completion, used for testing buffer filling behavior.

**MaybePending struct (L28-79)**: Mock async reader that alternates between returning Pending and Ready states. Implements AsyncRead and AsyncBufRead traits with controlled yielding behavior - returns at most 2 bytes per fill_buf call to test incremental reading patterns.

## Core Test Cases

**test_buffered_reader (L81-116)**: Basic BufReader functionality test with capacity-2 buffer. Verifies correct read behavior, buffer state management, and proper handling of partial reads from underlying byte slice.

**test_buffered_reader_seek (L118-131)**: Tests seeking behavior with BufReader wrapping a Cursor. Validates position tracking, buffer invalidation on seeks, and error handling for invalid seek operations.

**test_buffered_reader_seek_underflow (L133-189)**: Complex seeking test using custom PositionReader that yields position-based byte values. Tests edge cases like seeking to u64::MAX positions and multiple consecutive seeks requiring buffer invalidation.

**test_short_reads (L191-223)**: Tests BufReader behavior with ShortReader that returns predetermined read lengths (including zero-length reads). Ensures proper propagation of short reads without infinite loops.

**maybe_pending (L225-260)**: Integration test combining BufReader with MaybePending reader to verify async behavior under artificial yielding conditions.

**maybe_pending_buf_read (L262-278)**: Tests AsyncBufReadExt methods like read_until with MaybePending reader to ensure proper delimiter-based reading with yielding I/O.

**maybe_pending_seek (L281-352)**: Advanced seeking test using MaybePendingSeek (L283-339) which wraps Cursor with controlled async seek completion. Tests seek operations that may yield before completion.

**test_fill_buf_wrapper (L355-379)**: Tests the AsyncBufReadExt::fill_buf convenience method using duplex streams, verifying proper buffer management and async yielding behavior.

## Architecture Notes

- All tests use `#[tokio::test]` async test harness
- Mock readers implement controlled yielding to test async state machine behavior
- Tests verify both successful operations and proper error propagation
- Buffer capacity is explicitly controlled (typically 2 bytes) to force frequent buffer fills
- Uses tokio-test utilities for explicit async state testing (assert_pending!, assert_ready!)

## Dependencies

- tokio::io traits and BufReader implementation
- futures task utilities for manual polling
- tokio_test for async testing utilities
- std::io::Cursor for seekable byte slice wrapper