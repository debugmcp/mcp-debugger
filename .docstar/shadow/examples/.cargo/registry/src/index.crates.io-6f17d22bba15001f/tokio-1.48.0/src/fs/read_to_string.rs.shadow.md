# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/read_to_string.rs
@source-hash: 9e5b2d476a6084e3
@generated: 2026-02-09T18:06:28Z

## Primary Purpose
Provides asynchronous file reading functionality for Tokio, specifically reading entire file contents into a String. Acts as async wrapper around `std::fs::read_to_string`.

## Key Functions
- **`read_to_string`** (L27-30): Main async function that reads entire file contents into String
  - Takes `impl AsRef<Path>` parameter for flexible path input
  - Returns `io::Result<String>`
  - Internally converts path to owned and uses `asyncify` helper

## Dependencies & Architecture
- **Internal**: `crate::fs::asyncify` (L1) - Core utility for converting blocking filesystem operations to async
- **Standard Library**: `std::io`, `std::path::Path` (L3) - Standard filesystem types

## Implementation Pattern
Uses Tokio's thread pool delegation pattern via `asyncify`:
1. Converts path reference to owned `PathBuf` (L28)
2. Moves owned path into closure (L29) 
3. Executes blocking `std::fs::read_to_string` on separate thread pool
4. Returns awaitable future

## Critical Design Notes
- **Thread Safety**: Path ownership transfer (L28) ensures safe cross-thread usage
- **Performance**: Blocking operation delegated to thread pool to avoid blocking async runtime
- **API Compatibility**: Maintains same signature pattern as standard library equivalent