# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/fs_dir.rs
@source-hash: 4f29f2979a869ed1
@generated: 2026-02-09T18:12:11Z

## Purpose

Test file for Tokio's asynchronous filesystem directory operations. Provides comprehensive test coverage for directory creation, deletion, and reading functionality using `tokio::fs` module.

## Dependencies

- `tokio::fs` - Async filesystem operations
- `tokio_test` - Test utilities (`assert_ok!`, `assert_err!`)
- `tempfile` - Temporary directory creation for isolated tests
- `std::sync::{Arc, Mutex}` - Thread-safe shared state for concurrent testing

## Test Functions

### Directory Creation Tests
- `create_dir()` (L10-19) - Tests basic single directory creation with `fs::create_dir()`
- `create_all()` (L21-29) - Tests recursive directory creation with `fs::create_dir_all()`
- `build_dir()` (L31-46) - Tests `fs::DirBuilder` with recursive and non-recursive modes
- `build_dir_mode_read_only()` (L48-67) - Unix-only test for directory creation with specific permissions (mode 0o444)

### Directory Removal Tests
- `remove()` (L69-79) - Tests directory deletion with `fs::remove_dir()`, verifies directory no longer exists

### Directory Reading Tests
- `read_inherent()` (L81-108) - Tests directory listing with `fs::read_dir()` and `ReadDir::next_entry()`, collects entries into shared vector using Arc<Mutex>
- `read_dir_entry_info()` (L110-126) - Tests `DirEntry` methods: `path()`, `file_name()`, `metadata()`, and `file_type()`

## Key Patterns

- All tests use `tempdir()` for isolated test environments that auto-cleanup
- Mix of tokio async functions and synchronous std operations for setup
- Uses `assert_ok!` and `assert_err!` macros for cleaner async result testing
- Thread-safe collection pattern with `Arc<Mutex<Vec>>` for concurrent access
- Platform-specific compilation with `#[cfg(unix)]` for permissions testing

## Configuration

- Conditional compilation excludes WASI targets (`#[cfg(all(feature = "full", not(target_os = "wasi")))]`)
- Requires "full" feature flag for complete filesystem API access