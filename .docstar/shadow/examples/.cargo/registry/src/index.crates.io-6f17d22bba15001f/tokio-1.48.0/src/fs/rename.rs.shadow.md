# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/rename.rs
@source-hash: 0a9d11d546fcfa50
@generated: 2026-02-09T18:06:28Z

## Purpose
Provides async wrapper for filesystem rename operations in Tokio. Exposes a single public function that moves/renames files and directories asynchronously.

## Key Components
- `rename()` (L12-17): Async function that renames/moves files or directories from one path to another
  - Parameters: `from` and `to` paths (both `impl AsRef<Path>`)
  - Returns: `io::Result<()>`
  - Behavior: Replaces destination if it exists, fails if crossing mount points

## Dependencies
- `crate::fs::asyncify` (L1): Tokio's utility for converting blocking filesystem operations to async
- `std::io` (L3): For `io::Result` error handling
- `std::path::Path` (L4): For path parameter types

## Implementation Pattern
Uses Tokio's standard async filesystem pattern:
1. Convert path references to owned `PathBuf` instances (L13-14)
2. Move owned paths into closure to avoid lifetime issues
3. Wrap `std::fs::rename` with `asyncify()` to make blocking operation async (L16)
4. Await the asyncified operation

## Constraints
- Cannot rename across different mount points (filesystem limitation)
- Overwrites destination file if it exists
- Inherits all error conditions from `std::fs::rename`