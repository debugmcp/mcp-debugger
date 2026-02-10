# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/mod.rs
@source-hash: f6dab9fd167be29a
@generated: 2026-02-09T18:06:38Z

## Purpose and Responsibility

This module serves as the entry point for Tokio's asynchronous file system operations. It provides async wrappers around standard file system operations by using `spawn_blocking` to execute blocking I/O in a background thread pool. The module is disabled when using the `loom` feature for testing.

## Key Components

### Core Utility Function
- `asyncify<F, T>` (L308-320): Central helper function that wraps blocking operations in `spawn_blocking`, converting panics to `io::Error::Other` with "background task failed" message

### Module Exports and Organization
The module follows a pattern of one submodule per file system operation:

**File Operations:**
- `file::File` (L229-230): Main file type implementing `AsyncRead`/`AsyncWrite`
- `open_options::OpenOptions` (L238-239): File opening configuration
- `read::read` (L244-245): Read entire file to bytes
- `read_to_string::read_to_string` (L253-254): Read entire file to string
- `write::write` (L274-275): Write bytes to file (overwrites)
- `copy::copy` (L277-278): Copy file contents

**Directory Operations:**
- `create_dir::create_dir` (L220-221): Create single directory
- `create_dir_all::create_dir_all` (L223-224): Create directory and parents
- `dir_builder::DirBuilder` (L226-227): Directory creation with options
- `read_dir::{read_dir, DirEntry, ReadDir}` (L247-248): Directory iteration
- `remove_dir::remove_dir` (L256-257): Remove empty directory
- `remove_dir_all::remove_dir_all` (L259-260): Remove directory recursively

**Path Operations:**
- `canonicalize::canonicalize` (L217-218): Resolve canonical path
- `metadata::metadata` (L235-236): Get file metadata
- `symlink_metadata::symlink_metadata` (L271-272): Get symlink metadata
- `hard_link::hard_link` (L232-233): Create hard link
- `read_link::read_link` (L250-251): Read symlink target
- `rename::rename` (L265-266): Move/rename file
- `remove_file::remove_file` (L262-263): Delete file
- `set_permissions::set_permissions` (L268-269): Change file permissions
- `try_exists::try_exists` (L280-281): Check if path exists

**Platform-Specific Features:**
- Unix symlinks: `symlink::symlink` (L289-290) via `feature!` macro
- Windows symlinks: `symlink_dir::symlink_dir` (L294-295) and `symlink_file::symlink_file` (L297-298) via `cfg_windows!` macro
- io_uring support: `UringOpenOptions` (L240-242) via `cfg_io_uring!` macro

### Test Support
- `mocks` module (L283-284): Test-specific spawn_blocking implementation
- Conditional import switching (L303-306): Uses mocks during testing

## Architecture and Design Patterns

**Abstraction Strategy**: All async operations delegate to `asyncify()` helper, which wraps standard library functions in `spawn_blocking`. This creates a consistent async interface over inherently blocking file operations.

**Performance Considerations**: The extensive documentation (L9-215) emphasizes that file operations use blocking I/O in thread pools, recommending batching operations to minimize `spawn_blocking` overhead.

**Error Handling**: Failed background tasks are converted to generic `io::Error::Other` errors, losing original panic information.

## Dependencies and Relationships

- Uses `crate::blocking::spawn_blocking` for actual async execution
- Integrates with `tokio::io::{AsyncRead, AsyncWrite, BufReader, BufWriter}` traits
- Conditional compilation based on platform features (`unix`, `windows`) and capabilities (`io_uring`, `loom`)

## Critical Constraints

- Only suitable for ordinary files, not special files like named pipes (can cause runtime shutdown hangs)
- Requires explicit `flush()` calls when writing via `File` (different from `std::fs::File`)
- All operations ultimately blocking despite async interface
- Two-megabyte default buffer size for `File` operations (configurable via `File::set_max_buf_size`)