# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/hard_link.rs
@source-hash: c76b95ca6517ce1a
@generated: 2026-02-09T18:06:28Z

## Purpose
Async wrapper for creating filesystem hard links. Provides non-blocking hard link creation using Tokio's thread pool execution pattern.

## Key Function
- **`hard_link`** (L39-44): Async function that creates a hard link from `original` path to `link` path
  - Takes two `AsRef<Path>` parameters (supports `&str`, `Path`, `PathBuf`, etc.)
  - Returns `io::Result<()>` 
  - Converts paths to owned `PathBuf` instances before thread pool execution
  - Uses `asyncify` to execute `std::fs::hard_link` on blocking thread pool

## Dependencies
- `crate::fs::asyncify` (L1): Tokio's utility for running blocking filesystem operations asynchronously
- `std::io` (L3): For `Result` type and error handling
- `std::path::Path` (L4): Path manipulation types

## Implementation Pattern
Follows Tokio's standard async filesystem wrapper pattern:
1. Accept generic path parameters via `AsRef<Path>`
2. Convert to owned types (`to_owned()`) to avoid lifetime issues in async context
3. Move owned data into closure passed to `asyncify`
4. Execute blocking stdlib operation (`std::fs::hard_link`) on thread pool

## Platform Behavior
- Unix: Uses `link` system call
- Windows: Uses `CreateHardLink` function
- Requires both paths typically be on same filesystem
- May fail if original path doesn't exist or isn't a file

## Error Conditions
Function will error if:
- Original path doesn't exist or isn't a file
- Filesystem doesn't support hard links
- Insufficient permissions
- Paths on different filesystems (platform-dependent)