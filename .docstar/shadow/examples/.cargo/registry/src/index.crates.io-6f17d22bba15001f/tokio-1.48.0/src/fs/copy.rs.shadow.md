# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/copy.rs
@source-hash: 545c92b60acecefa
@generated: 2026-02-09T18:06:27Z

## Primary Purpose
Async wrapper for file copying operations in Tokio's filesystem module. Provides non-blocking file copy functionality by delegating to `std::fs::copy` via Tokio's asyncify mechanism.

## Key Function
- **`copy` (L20-24)**: Main async function that copies file contents and permissions from source to destination
  - Parameters: `from` and `to` paths (generic `AsRef<Path>`)  
  - Returns: `Result<u64, std::io::Error>` where `u64` is bytes copied
  - Implementation: Converts paths to owned values, then uses `asyncify` to run `std::fs::copy` on thread pool

## Dependencies
- **`crate::fs::asyncify` (L1)**: Tokio's utility for making blocking operations async
- **`std::path::Path` (L2)**: Standard library path handling
- **`std::fs::copy`**: Underlying synchronous copy implementation (called at L23)

## Architectural Pattern
Follows Tokio's standard pattern for filesystem operations:
1. Accept generic path parameters via `AsRef<Path>`
2. Convert to owned `PathBuf` values to avoid lifetime issues across thread boundaries  
3. Use `asyncify` to execute blocking `std::fs` operations on dedicated thread pool
4. Preserve exact semantics and return types of standard library equivalents

## Behavior Notes
- Overwrites destination file if it exists
- Copies file permissions from source to destination
- File copy is atomic at filesystem level (delegated to OS implementation)
- Returns number of bytes copied on success