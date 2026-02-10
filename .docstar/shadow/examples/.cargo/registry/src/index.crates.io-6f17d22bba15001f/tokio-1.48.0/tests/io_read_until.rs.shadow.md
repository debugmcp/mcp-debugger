# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_read_until.rs
@source-hash: b6c0df9e48527669
@generated: 2026-02-09T18:12:20Z

## Purpose
Test suite for Tokio's `AsyncBufReadExt::read_until` functionality, verifying asynchronous buffered reading until a delimiter byte is encountered.

## Test Functions

### `read_until` (L8-24)
Basic functionality test demonstrating:
- Reading from a simple byte slice (`b"hello world"`) until space delimiter
- First call reads `b"hello "` (6 bytes including delimiter)
- Second call reads remaining `b"world"` (5 bytes, no delimiter found)
- Third call returns 0 bytes when no more data available
- Validates that delimiter is included in output when found

### `read_until_not_all_ready` (L26-55)
Complex scenario testing partial reads with mock I/O:
- Uses `tokio_test::io::Builder` to simulate chunked data arrival
- Tests reading across multiple partial chunks: `"Hello Wor"` + `"ld#Fizz\xffBuz"` + `"z#1#2"`
- Verifies delimiter `b'#'` correctly identifies boundaries
- Tests appending to existing buffer content (`"We say "`, `"I solve "`)
- Handles binary data (`\xff`) and ensures proper byte counting

### `read_until_fail` (L57-74)
Error handling test:
- Simulates I/O error during read operation using mock builder
- Verifies that partial data read before error is preserved in buffer
- Confirms error propagation maintains original error kind (`ErrorKind::Other`) and message
- Buffer state: `b"FooHello \xffWor"` shows concatenation of initial content + partial read

## Dependencies
- `tokio::io::{AsyncBufReadExt, BufReader, Error}` - Core async I/O traits and types
- `tokio_test::{assert_ok, io::Builder}` - Testing utilities for async operations and mock I/O
- `std::io::ErrorKind` - Standard error classification

## Key Patterns
- All tests use `#[tokio::test]` attribute for async test execution
- Consistent pattern of buffer management with `buf.clear()` between operations
- Mock I/O builder pattern for controlled data delivery simulation
- Error injection testing for robustness validation