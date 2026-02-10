# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/symlink_dir.rs
@source-hash: 8b2ecaa82d496c15
@generated: 2026-02-09T18:06:28Z

**Primary Purpose**: Windows-specific async filesystem symlink creation for directories. Provides async wrapper around Windows `std::os::windows::fs::symlink_dir`.

**Key Function**:
- `symlink_dir` (L14-19): Async function that creates directory symbolic links on Windows
  - Parameters: `original` (source path), `link` (symlink path) - both accept `impl AsRef<Path>`
  - Returns: `io::Result<()>`
  - Implementation: Converts paths to owned `PathBuf`, then delegates to blocking Windows API via `asyncify`

**Dependencies**:
- `crate::fs::asyncify` (L1): Tokio's utility for converting blocking I/O operations to async
- `std::os::windows::fs::symlink_dir` (L18): Windows-specific blocking symlink creation API
- `std::io` and `std::path::Path` for I/O types

**Architecture Pattern**: 
- Async wrapper pattern - takes blocking Windows API and makes it async-compatible
- Path ownership conversion (`as_ref().to_owned()`) to move data into async closure
- Platform-specific implementation (Windows only)

**Critical Notes**:
- Windows-only functionality - will not compile on non-Windows platforms
- Creates directory symlinks specifically (not file symlinks)
- Requires appropriate Windows permissions for symlink creation