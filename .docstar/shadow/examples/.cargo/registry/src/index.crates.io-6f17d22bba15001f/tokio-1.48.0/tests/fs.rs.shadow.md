# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/fs.rs
@source-hash: fec30361d1e3fa7f
@generated: 2026-02-09T18:12:06Z

## Purpose
Test suite for Tokio's asynchronous filesystem operations, verifying basic file I/O and file handle cloning behavior.

## Key Functions

### `path_read_write()` (L8-16)
Async test function that validates basic file write/read operations using `tokio::fs`:
- Creates temporary directory via `tempdir()` helper
- Writes byte array to file using `fs::write()`
- Reads file content back using `fs::read()`
- Asserts written and read content match

### `try_clone_should_preserve_max_buf_size()` (L19-32)
Async test function that verifies file handle cloning preserves buffer size configuration:
- Creates a file using `fs::File::create()`
- Sets custom buffer size (128 bytes) via `set_max_buf_size()`
- Clones the file handle using `try_clone()`
- Asserts the cloned handle retains the original buffer size

### `tempdir()` (L34-36)
Helper function that creates temporary directories for test isolation using `tempfile` crate.

## Dependencies
- `tokio::fs` - Async filesystem operations
- `tokio_test::assert_ok` - Test assertion macro for Result types
- `tempfile` - Temporary directory creation for test isolation

## Configuration
- Conditional compilation: Only builds on "full" feature with non-WASI targets (L2)
- Uses `#![warn(rust_2018_idioms)]` for modern Rust style enforcement

## Test Patterns
- Both tests follow pattern: setup temp directory → perform operation → assert outcome
- Uses `tokio::test` attribute for async test execution
- Leverages `assert_ok!` macro for clean Result unwrapping in assertions