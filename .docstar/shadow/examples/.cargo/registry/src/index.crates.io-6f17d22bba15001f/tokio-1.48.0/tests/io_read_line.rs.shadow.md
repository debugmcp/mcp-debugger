# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_read_line.rs
@source-hash: 8296624b4f5e162c
@generated: 2026-02-09T18:12:19Z

## Purpose
Test suite for Tokio's `AsyncBufReadExt::read_line()` functionality, validating line-by-line reading behavior with various edge cases and error conditions.

## Key Test Functions

### `read_line()` (L10-30)
Tests basic line reading from a `Cursor<&[u8]>` containing "hello\nworld\n\n". Validates:
- Correct byte counts returned (6, 6, 1, 0)
- Proper line content extraction including newlines
- EOF handling (returns 0 bytes)

### `read_line_not_all_ready()` (L32-61)
Tests incremental reading using `tokio_test::io::Builder` mock that delivers data in chunks:
- Simulates partial reads across line boundaries
- Validates line accumulation in pre-existing string buffers
- Tests appending behavior ("We say " + "Hello World\n")

### `read_line_invalid_utf8()` (L63-74)
Error handling test for invalid UTF-8 sequences (\xff):
- Expects `ErrorKind::InvalidData`
- Verifies error message: "stream did not contain valid UTF-8"
- Confirms buffer remains unchanged on UTF-8 error

### `read_line_fail()` (L76-90)
Tests I/O error propagation during reading:
- Mock returns partial data then `ErrorKind::Other`
- Validates that partial valid data gets appended to buffer before error
- Buffer state: "Foo" + "Hello Wor" = "FooHello Wor"

### `read_line_fail_and_utf8_fail()` (L92-107)
Combined failure test with UTF-8 error followed by I/O error:
- When UTF-8 error occurs first, buffer remains unmodified
- I/O error takes precedence in error reporting
- Buffer preserves original content ("Foo")

## Dependencies
- `tokio::io::{AsyncBufReadExt, BufReader, Error}` - Core async I/O traits
- `tokio_test::{assert_ok, io::Builder}` - Test utilities and mock I/O
- `std::io::{Cursor, ErrorKind}` - Standard I/O primitives

## Key Patterns
- Uses `#[tokio::test]` for async test execution
- Employs `assert_ok!` macro for unwrapping Results with better error messages
- Mock I/O builder pattern for controlled data delivery scenarios
- Buffer reuse pattern with `.clear()` between reads