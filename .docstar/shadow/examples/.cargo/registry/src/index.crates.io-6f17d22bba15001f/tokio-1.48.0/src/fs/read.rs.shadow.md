# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/read.rs
@source-hash: df8b7f73766973f8
@generated: 2026-02-09T18:06:28Z

**Primary Purpose**: Asynchronous file reading utility that wraps the synchronous `std::fs::read` operation in Tokio's thread pool to provide non-blocking file I/O.

**Core Function**:
- `read()` (L46-49): Main async function that reads entire file contents into `Vec<u8>`. Accepts any path-like type via `AsRef<Path>` and returns `io::Result<Vec<u8>>`.

**Key Dependencies**:
- `crate::fs::asyncify` (L1): Tokio's utility for converting blocking operations to async
- `std::fs::read` (L48): Underlying synchronous file read operation
- `std::io` and `std::path::Path` (L3): Standard library I/O types

**Architecture Pattern**:
- **Thread Pool Delegation**: Uses `asyncify()` to execute `std::fs::read` on a separate thread pool via `spawn_blocking` internally
- **Zero-Copy Path Handling**: Converts path reference to owned `PathBuf` (L47) before moving into async closure

**Performance Characteristics**:
- Pre-allocates buffer based on file metadata when available (more efficient than `Vec::new()`)
- Blocks a thread pool worker but doesn't block the async runtime

**Error Handling**:
- Returns `io::Result<Vec<u8>>` propagating all `std::fs::read` errors
- File must exist (returns error if not found)
- Handles interrupted I/O operations appropriately

**Usage Pattern**: Convenience function for simple file-to-memory operations in async contexts where you need the entire file content as bytes.