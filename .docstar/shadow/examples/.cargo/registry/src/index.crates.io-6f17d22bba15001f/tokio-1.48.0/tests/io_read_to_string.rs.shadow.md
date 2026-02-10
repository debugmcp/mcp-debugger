# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_read_to_string.rs
@source-hash: 4932431f3a1a0a2e
@generated: 2026-02-09T18:12:18Z

## Purpose
Test file for tokio's `AsyncReadExt::read_to_string` functionality, verifying correct behavior for successful reads, UTF-8 errors, IO errors, and string appending scenarios.

## Test Functions

### `read_to_string` (L10-17)
Basic functionality test that reads "hello world" bytes into a string buffer and verifies:
- Correct byte count returned (11 bytes)
- Proper string content extraction from byte slice reader

### `to_string_does_not_truncate_on_utf8_error` (L20-32)
Error handling test using invalid UTF-8 bytes (0xff, 0xff, 0xff) to ensure:
- Operation fails with "stream did not contain valid UTF-8" error
- Original string content ("abc") remains unmodified on failure
- No partial corruption of target buffer

### `to_string_does_not_truncate_on_io_error` (L35-49)
Error handling test using tokio_test::io::Builder mock to simulate IO failure:
- Mock provides "def" bytes then triggers "whoops" IO error
- Verifies original string content ("abc") preserved on IO failure
- Tests error propagation and buffer integrity

### `to_string_appends` (L52-63)
Appending behavior test that verifies read_to_string correctly appends to existing string:
- Starts with "abc" string
- Reads "def" bytes from slice
- Confirms result is "abcdef" with 3 bytes read

## Dependencies
- `std::io`: Standard IO error types
- `tokio::io::AsyncReadExt`: Core async read extension trait
- `tokio_test`: Testing utilities and mock IO builders
- `assert_ok!` macro for unwrapping Results in tests

## Key Patterns
- All tests use `#[tokio::test]` for async test execution
- Error tests use explicit match patterns to verify specific error messages
- Mock IO builder pattern for controlled failure simulation
- Buffer integrity verification across all error scenarios