# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/symlink_file.rs
@source-hash: d0831a8105cd6dae
@generated: 2026-02-09T18:06:29Z

## Primary Purpose
Windows-specific async wrapper for creating file symbolic links. Provides async version of `std::os::windows::fs::symlink_file` using Tokio's thread pool execution pattern.

## Key Functions
- `symlink_file(original, link)` (L14-19): Async function that creates a file symbolic link pointing from `link` path to `original` path. Returns `io::Result<()>`.

## Dependencies
- `crate::fs::asyncify` (L1): Internal utility for converting blocking filesystem operations to async
- `std::os::windows::fs::symlink_file` (L18): Windows-specific standard library function for creating file symlinks

## Implementation Pattern
Uses Tokio's `asyncify` pattern - captures path parameters by moving ownership into closure (L15-16), then executes blocking Windows API call on thread pool (L18). This prevents blocking the async runtime while performing filesystem operations.

## Platform Constraints
Windows-only functionality - relies on `std::os::windows::fs::symlink_file`. File will likely be conditionally compiled for Windows targets only (though conditional compilation directives not visible in this file).

## Parameter Handling
Accepts any type implementing `AsRef<Path>` for both parameters, converts to owned `PathBuf` instances to satisfy move closure requirements for thread pool execution.