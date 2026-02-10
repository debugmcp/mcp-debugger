# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/uds_stream.rs
@source-hash: 4d13118a7a4cb321
@generated: 2026-02-09T18:12:42Z

## Unix Domain Socket Stream Tests

**Purpose**: Comprehensive test suite for Tokio's Unix domain socket stream functionality, testing async I/O operations, readiness polling, and socket lifecycle management.

**Platform Requirements**: Unix-only (lines 1-5), disabled for miri due to socket limitations, requires "full" feature flag.

### Key Test Functions

**Basic Socket Operations**:
- `accept_read_write()` (L19-44): Tests fundamental client-server communication pattern with write/read operations and proper socket closure detection
- `shutdown()` (L46-67): Validates graceful socket shutdown behavior using `AsyncWriteExt::shutdown()`

**Non-blocking I/O Operations**:
- `try_read_write()` (L69-194): Comprehensive test of try_read/try_write methods with both regular and vectored I/O, includes buffer filling patterns and readiness notification testing
- `try_read_buf()` (L306-386): Tests `try_read_buf` method with similar buffer management patterns

**Readiness Polling Tests**:
- `poll_read_ready()` (L241-262): Tests read readiness state transitions and disconnect detection
- `poll_write_ready()` (L264-278): Tests write readiness state changes and buffer saturation

**Edge Case Tests**:
- `epollhup()` (L388-427): Tests connection failure handling when listener is dropped mid-connection (non-macOS only)
- `abstract_socket_name()` (L430-446): Linux/Android-specific test for abstract socket namespace functionality

### Utility Functions and Macros

**Helper Functions**:
- `create_pair()` (L196-207): Factory function for creating connected UnixStream pairs using temporary socket files
- `read_until_pending()` (L280-291): Drains socket until WouldBlock error
- `write_until_pending()` (L293-304): Fills write buffer until WouldBlock error

**Polling Assertion Macros** (L209-239):
- `assert_readable_by_polling!`: Verifies socket is readable via `poll_read_ready`
- `assert_not_readable_by_polling!`: Verifies socket is not readable
- `assert_writable_by_polling!`: Verifies socket is writable via `poll_write_ready`  
- `assert_not_writable_by_polling!`: Verifies socket is not writable

### Key Dependencies
- `tokio::net::{UnixListener, UnixStream}`: Core Unix socket types
- `tokio::io::{AsyncReadExt, AsyncWriteExt, Interest}`: Async I/O traits and interest flags
- `tokio_test`: Testing utilities for task spawning and assertion macros
- `tempfile`: Temporary directory creation for socket files
- `futures::future::try_join`: Concurrent operation coordination

### Testing Patterns
- Extensive use of temporary socket files in isolated directories
- Buffer saturation testing to verify proper WouldBlock handling
- Readiness notification verification using task spawning and polling
- Both regular and vectored I/O operation coverage
- Platform-specific conditional compilation for OS differences