# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/symlink.rs
@source-hash: fb03282828170739
@generated: 2026-02-09T18:06:29Z

## Purpose
Provides async wrapper for Unix symbolic link creation, bridging synchronous filesystem operations with Tokio's async runtime.

## Key Function
- **`symlink`** (L11-16): Creates symbolic links asynchronously
  - Parameters: `original` (target path), `link` (symlink path) - both accept `AsRef<Path>`
  - Returns: `io::Result<()>`
  - Implementation: Converts paths to owned `PathBuf`, delegates to `std::os::unix::fs::symlink` via `asyncify`

## Dependencies
- **`crate::fs::asyncify`** (L1): Core utility for wrapping blocking filesystem operations
- **`std::os::unix::fs::symlink`** (L15): Platform-specific Unix symlink creation

## Architecture Pattern
Follows Tokio's standard pattern for filesystem operations:
1. Accept flexible path parameters via `AsRef<Path>`
2. Clone paths to owned values for thread safety
3. Use `asyncify` to execute blocking operation on thread pool
4. Preserve original error semantics

## Platform Constraints
- **Unix-only**: Uses `std::os::unix::fs::symlink`, not portable across platforms
- Thread pool execution ensures non-blocking behavior in async context

## Critical Notes
- Path ownership transfer prevents borrowing issues across async boundaries
- Direct delegation maintains std library error handling and behavior