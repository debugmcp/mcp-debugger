# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_read_exact.rs
@source-hash: b6387dbeb0baceb7
@generated: 2026-02-09T18:12:15Z

This is a unit test file for Tokio's `AsyncReadExt::read_exact` functionality. The file validates that the async read_exact method correctly reads exactly the specified number of bytes from an async reader.

**Primary Purpose**: Tests the `read_exact` method from Tokio's async I/O extension trait to ensure it reads precisely the requested number of bytes.

**Key Test Function**:
- `read_exact()` (L8-15): Async test that verifies reading exactly 8 bytes from a byte slice containing "hello world". Creates a boxed 8-byte buffer, uses a byte slice as the reader, and confirms that exactly 8 bytes are read ("hello wo").

**Dependencies**:
- `tokio::io::AsyncReadExt` (L4): Provides the `read_exact` async method
- `tokio_test::assert_ok` (L5): Macro for asserting successful Result unwrapping in tests

**Test Strategy**: Uses a simple byte slice (`&[u8]`) as the async reader source, which automatically implements AsyncRead, making it suitable for testing without complex async I/O setup.

**Validation Points**:
- Return value verification: Confirms `read_exact` returns the number of bytes read (8)
- Buffer content verification: Ensures the buffer contains exactly the first 8 characters from the source

**Configuration**: Requires "full" feature flag (L2) and enables Rust 2018 idiom warnings (L1).