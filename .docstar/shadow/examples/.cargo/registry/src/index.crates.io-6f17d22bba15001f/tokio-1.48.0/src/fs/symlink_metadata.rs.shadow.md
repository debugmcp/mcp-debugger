# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/symlink_metadata.rs
@source-hash: f5ce1e05f137da99
@generated: 2026-02-09T18:06:29Z

## Purpose
Provides asynchronous wrapper for file system metadata querying via symbolic links. Part of Tokio's async filesystem API that converts blocking std::fs operations into non-blocking equivalents.

## Key Components
- **symlink_metadata function (L12-15)**: Async wrapper that queries file metadata without following symbolic links
  - Takes any path-like parameter via `AsRef<Path>` trait
  - Returns `io::Result<Metadata>` containing file system metadata
  - Uses `asyncify` utility to convert blocking `std::fs::symlink_metadata` call to async operation

## Dependencies
- **crate::fs::asyncify (L1)**: Internal Tokio utility for converting blocking operations to async
- **std::fs::Metadata (L3)**: Standard library metadata type returned by operation
- **std::io (L4)**: For Result and error types
- **std::path::Path (L5)**: Path handling types

## Architecture Patterns
- **Async Wrapper Pattern**: Simple delegation to blocking std library function via asyncify utility
- **Path Ownership**: Converts borrowed path reference to owned PathBuf to satisfy 'static lifetime requirements for async operation
- **Zero-Copy Interface**: Accepts generic path types through AsRef trait for ergonomic API

## Key Behavior
Unlike `std::fs::metadata`, this function does NOT follow symbolic links - it returns metadata about the symlink itself rather than its target. Essential for applications that need to distinguish between symlinks and their targets.