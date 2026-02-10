# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/remove_dir_all.rs
@source-hash: b85abd05c7ab64ee
@generated: 2026-02-09T18:06:28Z

## Purpose
Provides an async wrapper for recursive directory removal operations in Tokio's filesystem module.

## Core Function
- **`remove_dir_all`** (L11-14): Async function that removes a directory and all its contents recursively
  - Takes any path-like type via `impl AsRef<Path>`
  - Returns `io::Result<()>` for error handling
  - Converts path to owned `PathBuf` to move into async context
  - Delegates to `std::fs::remove_dir_all` via `asyncify` utility

## Dependencies
- **`crate::fs::asyncify`** (L1): Tokio utility for converting blocking filesystem operations to async
- **`std::io`** (L3): Standard library I/O error types
- **`std::path::Path`** (L4): Standard library path types

## Implementation Pattern
Uses Tokio's standard pattern for async filesystem operations:
1. Accept generic path parameter
2. Convert to owned type (`to_owned()`) for thread safety
3. Wrap synchronous stdlib operation with `asyncify`
4. Preserve original error semantics

## Critical Notes
- **Destructive operation**: Removes directory and ALL contents recursively
- **Blocking operation**: Despite async signature, actual deletion happens on thread pool
- **Error propagation**: Maintains std::fs error behavior and types