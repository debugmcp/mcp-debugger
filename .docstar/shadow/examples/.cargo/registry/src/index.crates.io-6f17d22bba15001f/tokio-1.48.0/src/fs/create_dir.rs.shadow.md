# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/create_dir.rs
@source-hash: 4fd26d27b97ded25
@generated: 2026-02-09T18:06:27Z

## Purpose
Provides async wrapper for standard library's `std::fs::create_dir` function within the Tokio ecosystem. Part of Tokio's filesystem module that enables non-blocking directory creation operations.

## Key Function
- `create_dir(path: impl AsRef<Path>) -> io::Result<()>` (L47-50): Async function that creates a single directory at the specified path. Uses Tokio's `asyncify` utility to run the blocking `std::fs::create_dir` operation on a thread pool, converting it to an async operation.

## Dependencies
- `crate::fs::asyncify` (L1): Tokio's utility for converting blocking filesystem operations to async
- `std::io` (L3): For `io::Result` error handling
- `std::path::Path` (L4): For path parameter type

## Implementation Pattern
Follows Tokio's standard pattern for filesystem operations:
1. Convert path parameter to owned value via `path.as_ref().to_owned()` (L48)
2. Use `asyncify` with move closure to execute blocking operation on thread pool (L49)
3. Delegate actual work to corresponding `std::fs` function

## Behavioral Constraints
- Creates only single directory (not recursive) - parent directories must exist
- Returns error if path already exists or parent doesn't exist
- Platform-specific behavior delegates to OS-level directory creation APIs
- Requires appropriate filesystem permissions

## Error Conditions
- Insufficient permissions
- Missing parent directories
- Path already exists
- General I/O errors from underlying filesystem operations