# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/try_exists.rs
@source-hash: cb2e0954f1e33adb
@generated: 2026-02-09T18:06:29Z

## Purpose
Provides async filesystem existence checking functionality for Tokio. Wraps `std::path::Path::try_exists` in an async interface using Tokio's thread pool.

## Key Function
- `try_exists` (L25-28): Async function that checks if a path exists on filesystem
  - **Parameters**: `path: impl AsRef<Path>` - accepts any path-like type
  - **Returns**: `io::Result<bool>` - true if path exists, false otherwise
  - **Behavior**: Follows symbolic links, returns false for broken symlinks
  - **Implementation**: Clones path to owned version, delegates to `asyncify` wrapper

## Dependencies
- `crate::fs::asyncify` (L1): Tokio's thread pool wrapper for blocking operations
- `std::io` (L3): Standard IO error types
- `std::path::Path` (L4): Standard path handling

## Architecture
Uses Tokio's standard pattern for async filesystem operations:
1. Convert path reference to owned value (L26)
2. Move owned value into closure for thread pool execution (L27)
3. Delegate actual work to standard library equivalent via `asyncify`

## Key Characteristics
- Non-blocking: Uses thread pool to avoid blocking async runtime
- Memory safe: Clones path to avoid lifetime issues across thread boundaries  
- Compatible: Direct async equivalent of `std::path::Path::try_exists`
- Symlink aware: Traverses symbolic links to check target existence