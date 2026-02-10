# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/read_link.rs
@source-hash: 910a34ccae4604c3
@generated: 2026-02-09T18:06:27Z

## Purpose
Provides an asynchronous wrapper around the standard library's `std::fs::read_link` function for reading symbolic links in Tokio applications.

## Key Functions
- `read_link(path)` (L9-12): Async function that reads a symbolic link and returns the target path it points to
  - Takes any path-like parameter via `impl AsRef<Path>`
  - Returns `io::Result<PathBuf>` containing the link target
  - Uses internal `asyncify` utility to convert blocking I/O to async

## Implementation Details
- Converts input path to owned `PathBuf` (L10) to avoid lifetime issues in async context
- Delegates actual work to `std::fs::read_link` via `asyncify` wrapper (L11)
- Uses move closure to transfer ownership of path data to background thread

## Dependencies
- `crate::fs::asyncify`: Internal Tokio utility for converting blocking filesystem operations to async
- `std::io`: For `Result` type and error handling
- `std::path`: For `Path` and `PathBuf` types

## Architectural Pattern
Follows Tokio's standard pattern of wrapping synchronous std library filesystem functions with async interfaces using the `asyncify` helper, which likely runs the blocking operation on a thread pool to avoid blocking the async runtime.