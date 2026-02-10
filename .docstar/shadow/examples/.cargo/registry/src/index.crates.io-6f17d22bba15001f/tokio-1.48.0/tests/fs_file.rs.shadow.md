# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/fs_file.rs
@source-hash: 9f2172b9918e1ab4
@generated: 2026-02-09T18:12:15Z

## Purpose
Comprehensive integration tests for Tokio's async File I/O implementation (`tokio::fs::File`). Tests core file operations, platform-specific behavior, and async runtime integration patterns.

## Key Test Functions
- `basic_read` (L15-26): Tests async file reading with buffer allocation and content verification
- `basic_write` (L29-39): Tests async file creation and writing with flush semantics
- `basic_write_and_shutdown` (L42-52): Tests graceful file closure using `shutdown()` method
- `write_vectored` (L55-69): Tests vectored I/O writes using `IoSlice` for scatter-gather operations
- `write_vectored_and_shutdown` (L72-86): Combines vectored writes with shutdown semantics
- `rewind_seek_position` (L89-99): Tests file seeking operations (`seek`, `rewind`, `stream_position`)
- `coop` (L102-124): Critical cooperative scheduling test ensuring async file ops yield control
- `write_to_clone` (L127-138): Tests `try_clone()` method for file handle duplication
- `write_into_std` (L141-151): Tests async-to-sync conversion via `into_std()`
- `write_into_std_immediate` (L154-164): Tests synchronous conversion via `try_into_std()`
- `read_file_from_std` (L167-178): Tests sync-to-async conversion via `From<std::fs::File>`
- `empty_read` (L181-196): Tests edge case of zero-length read operations
- `set_max_buf_size_read/write` (L203-222): Tests buffer size limiting functionality
- Platform-specific debug format tests (L227-249): Unix/Windows debug output verification
- Unix-specific tests (L253-279): Raw file descriptor handling and conversion
- Windows-specific test (L283-289): Raw handle validation

## Dependencies
- `tokio::fs::File`: Primary async file abstraction being tested
- `tokio::io`: Async I/O traits (`AsyncReadExt`, `AsyncSeekExt`, `AsyncWriteExt`)
- `tempfile::NamedTempFile`: Temporary file management for isolated testing
- `tokio_test::task`: Cooperative scheduling test utilities
- `futures::future::FutureExt`: Future extension traits for immediate polling

## Test Patterns
- **Isolation**: Each test uses `tempfile()` helper (L198-200) for clean temporary files
- **Verification**: Standard pattern of write-then-read verification using sync `std::fs::read`
- **Error Handling**: Consistent `.unwrap()` usage assuming test environment success
- **Platform Branching**: Conditional compilation for Unix/Windows-specific features

## Critical Test Cases
- **Cooperative Scheduling** (L102-124): Ensures file operations don't block the async runtime
- **Resource Management**: Tests proper file handle lifecycle through clone, conversion, and platform handles
- **Buffer Management**: Validates configurable buffer size limits for I/O operations

## Constants
- `HELLO` (L12): Test data constant `b"hello world..."` used across all file operation tests