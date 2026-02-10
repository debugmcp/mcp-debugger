# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_take.rs
@source-hash: 106f860874232825
@generated: 2026-02-09T18:12:22Z

## Primary Purpose
Test suite for tokio's `AsyncReadExt::take()` functionality, which limits the number of bytes that can be read from an `AsyncRead` stream. Validates correct behavior for normal usage, buffer handling edge cases, and error conditions.

## Key Test Functions
- **take (L14-23)**: Basic functionality test verifying that `take(4)` correctly limits reading to 4 bytes from a larger byte slice
- **issue_4435 (L25-40)**: Regression test for specific GitHub issue, testing `ReadBuf` behavior with pre-existing data when using `take()` with manual polling
- **bad_reader_fails (L68-74)**: Error condition test using malicious reader implementation, expects panic due to buffer safety violations

## Key Classes and Structures
- **BadReader (L42-66)**: Malicious `AsyncRead` implementation that violates buffer safety by replacing the provided `ReadBuf` with a leaked buffer containing different data
  - Uses `LeakedBuffers` helper for creating unsafe buffer scenarios
  - `poll_read` implementation (L55-65) deliberately creates buffer corruption

## Dependencies
- `tokio::io::{AsyncRead, AsyncReadExt, ReadBuf}`: Core async I/O traits and utilities
- `tokio_test::assert_ok`: Test assertion helper
- `support::leaked_buffers::LeakedBuffers`: Buffer leak testing utility (L9-12)

## Architecture Patterns
- Standard tokio async test pattern using `#[tokio::test]` macro
- Pin-based manual polling for low-level async testing (L31, L36-38)
- Safety violation testing through controlled buffer corruption
- Platform-specific conditional compilation excluding WASI (L2)

## Critical Invariants
- `take()` must never read more bytes than the specified limit
- `ReadBuf` instances must not be replaced by readers (enforced through panic test)
- Buffer contents before the cursor position must be preserved during reads
- Memory safety maintained even with malicious reader implementations

## Notable Implementation Details
- Uses `tokio::pin!` macro for stack pinning in manual poll scenarios
- Employs `std::future::poll_fn` for direct `Poll` handling
- `BadReader` intentionally violates `ReadBuf` contract to test safety mechanisms
- All tests use small, deterministic data sets for precise validation