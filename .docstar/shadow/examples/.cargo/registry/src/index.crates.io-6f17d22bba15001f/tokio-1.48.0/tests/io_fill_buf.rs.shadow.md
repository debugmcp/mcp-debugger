# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_fill_buf.rs
@source-hash: 930ce8ab5562c201
@generated: 2026-02-09T18:12:14Z

**Purpose**: Test file for Tokio's `fill_buf()` functionality on buffered file readers, verifying the async buffer reading pattern with manual buffer consumption.

**Key Components**:
- `fill_buf_file()` test function (L10-34): Demonstrates and validates the `AsyncBufReadExt::fill_buf()` method pattern for reading file contents incrementally

**Test Flow**:
1. Creates temporary file and writes "hello" using synchronous std::fs (L11-13)
2. Opens file asynchronously with Tokio and wraps in BufReader (L15-16)  
3. Implements manual buffered reading loop using `fill_buf()` + `consume()` pattern (L20-31)
4. Validates complete content was read correctly (L33)

**Dependencies**:
- `tempfile::NamedTempFile` - temporary file creation for testing
- `tokio::fs::File` - async file operations
- `tokio::io::{AsyncBufReadExt, BufReader}` - buffered async I/O traits and types
- `tokio_test::assert_ok` - test assertion macro

**Key Pattern**: The test demonstrates the low-level `fill_buf()` + `consume()` pattern (L22-30) which is the foundation for higher-level async reading methods. This pattern allows fine-grained control over buffer consumption and is useful when you need to process data incrementally without copying.

**Platform Constraints**: Disabled on WASI targets due to file system limitations (L2 cfg attribute).

**Architectural Note**: This test validates the core async buffered I/O abstraction by manually implementing what higher-level methods like `read_to_end()` would do internally.