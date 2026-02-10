# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/
@generated: 2026-02-09T18:16:19Z

## Purpose and Responsibility

The `tokio::fs` module provides asynchronous wrappers around the entire standard library filesystem API (`std::fs`). This module enables non-blocking file and directory operations within Tokio's async runtime by delegating blocking operations to thread pools while maintaining the exact same semantics and error handling as their synchronous counterparts.

## Key Components and Architecture

### Core Abstraction Pattern
All operations follow a consistent "async-over-sync" pattern implemented through the central `asyncify<F, T>` utility function (mod.rs:308-320), which:
- Wraps blocking `std::fs` operations in `spawn_blocking` for thread pool execution
- Converts thread pool panics to `io::Error::Other` with standardized error messages
- Ensures async runtime never blocks on filesystem I/O

### File Operations
**Primary Types:**
- `File`: Main async file handle implementing `AsyncRead`, `AsyncWrite`, and `AsyncSeek` traits
- `OpenOptions`: Builder pattern for configuring file opening with optional io_uring support on Linux

**Core Functions:**
- `open()`, `create()`, `create_new()`: File creation and opening
- `read()`, `read_to_string()`: Complete file reading operations
- `write()`: Optimized file writing with io_uring support where available
- `copy()`: Efficient file copying
- `remove_file()`: File deletion
- `metadata()`, `set_permissions()`: File attribute operations

### Directory Operations
- `create_dir()`, `create_dir_all()`: Directory creation (single and recursive)
- `DirBuilder`: Advanced directory creation with permissions and options
- `read_dir()`, `ReadDir`, `DirEntry`: Async directory iteration with chunked reading
- `remove_dir()`, `remove_dir_all()`: Directory removal (empty and recursive)

### Path and Link Operations
- `canonicalize()`: Path resolution to canonical form
- `rename()`: File/directory moving and renaming
- `hard_link()`: Hard link creation
- `read_link()`: Symbolic link target reading
- Platform-specific symbolic link creation: `symlink()` (Unix), `symlink_dir()`/`symlink_file()` (Windows)
- `try_exists()`: Safe existence checking
- `symlink_metadata()`: Metadata querying without following symlinks

## Public API Surface

### Main Entry Points
```rust
// File operations
tokio::fs::File::open(path) -> File
tokio::fs::read(path) -> Vec<u8>
tokio::fs::write(path, contents) -> ()

// Directory operations  
tokio::fs::read_dir(path) -> ReadDir
tokio::fs::create_dir_all(path) -> ()

// Path operations
tokio::fs::metadata(path) -> Metadata
tokio::fs::try_exists(path) -> bool
```

### Builder APIs
- `OpenOptions::new()` - Fluent file opening configuration
- `DirBuilder::new()` - Advanced directory creation options

## Internal Organization and Data Flow

### Thread Pool Integration
- All blocking operations route through `asyncify()` using `spawn_blocking`
- Test environments use mock implementations via conditional compilation
- Thread pool operations maintain ownership semantics through path cloning

### Platform Abstractions
- Unix-specific features: file permissions, symbolic links, raw file descriptors
- Windows-specific features: file attributes, security flags, raw handles
- Conditional compilation ensures platform-appropriate APIs

### Performance Optimizations
- **Chunked Directory Reading**: `ReadDir` uses 32-entry buffering to minimize thread pool round-trips
- **io_uring Integration**: `write()` and `OpenOptions` support high-performance Linux io_uring when available
- **Metadata Caching**: `DirEntry` caches file types on supporting platforms
- **Buffer Management**: `File` supports configurable buffer sizes (default 2MB)

## Important Patterns and Conventions

### Error Handling
- Preserves exact `std::fs` error semantics and types
- Background task failures convert to generic `io::Error::Other`
- Platform-specific error conditions documented per operation

### Memory Safety
- Path parameters converted to owned `PathBuf` before thread pool execution
- `Arc<T>` used for shared ownership in async contexts (e.g., `DirEntry`)
- Careful lifetime management across async boundaries

### Async Traits Integration
- `File` implements standard async I/O traits (`AsyncRead`, `AsyncWrite`, `AsyncSeek`)
- Stream-based directory iteration via `ReadDir`
- Compatibility with `tokio::io::BufReader`/`BufWriter`

## Critical Constraints and Considerations

1. **Blocking Nature**: Despite async interface, all operations are ultimately blocking and run on thread pools
2. **Thread Pool Overhead**: Batching operations recommended to minimize `spawn_blocking` costs
3. **File Type Restrictions**: Only suitable for regular files; special files (pipes, sockets) can cause runtime hangs
4. **Explicit Flushing**: `File` requires explicit `flush()` calls unlike `std::fs::File`
5. **Platform Dependencies**: Some operations (symlinks, permissions) have platform-specific behavior and availability

## Dependencies and Integration

- Core dependency on `crate::blocking::spawn_blocking` for async execution
- Integration with `tokio::io` traits for stream-like interfaces
- Platform-specific extensions via `std::os::{unix,windows}::fs`
- Optional io_uring support gated behind `tokio_unstable` feature flag
- Test infrastructure uses mockall-based mocking system