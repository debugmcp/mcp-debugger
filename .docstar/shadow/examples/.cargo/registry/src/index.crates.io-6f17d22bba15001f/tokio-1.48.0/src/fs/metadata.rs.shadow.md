# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/metadata.rs
@source-hash: 1eb0f7b53f2afb53
@generated: 2026-02-09T18:06:26Z

## Purpose
Provides asynchronous file system metadata querying functionality by wrapping the synchronous `std::fs::metadata` in Tokio's async runtime.

## Key Function
**`metadata`** (L43-46): Async wrapper around `std::fs::metadata` that:
- Accepts any path-like type via `AsRef<Path>`
- Returns `io::Result<Metadata>` asynchronously
- Follows symbolic links to query destination file metadata
- Uses `asyncify` helper to convert blocking operation to async

## Dependencies
- `crate::fs::asyncify` (L1): Tokio's utility for converting blocking FS operations to async
- `std::fs::Metadata` (L3): Standard library metadata type
- `std::io` (L4): Standard I/O error handling
- `std::path::Path` (L5): Standard path handling

## Implementation Pattern
Uses Tokio's standard pattern for async filesystem operations:
1. Convert path reference to owned `PathBuf` (L44)
2. Wrap synchronous stdlib call in `asyncify` closure (L45)
3. Return awaitable future

## Platform Behavior
- Unix: Uses `stat` system call
- Windows: Uses `GetFileAttributesEx` function
- Subject to future changes per stdlib documentation

## Error Conditions
- Permission denied for metadata access
- Path does not exist
- General I/O errors from underlying filesystem operations