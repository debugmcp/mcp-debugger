# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/remove_dir.rs
@source-hash: 314303525fb2a78b
@generated: 2026-02-09T18:06:27Z

**Purpose**: Async wrapper for directory removal operations in Tokio's filesystem module.

**Core Functionality**:
- `remove_dir` (L9-12): Async function that removes an empty directory by wrapping `std::fs::remove_dir` using Tokio's `asyncify` utility. Takes any path-like type via `AsRef<Path>`, converts to owned `PathBuf`, and executes the blocking operation on a thread pool.

**Dependencies**:
- `crate::fs::asyncify` (L1): Tokio's utility for converting blocking filesystem operations to async
- `std::io` and `std::path::Path` (L3-4): Standard library types for I/O operations and path handling

**Key Patterns**:
- **Ownership Transfer**: Path is converted to owned via `to_owned()` (L10) before moving into the closure to avoid lifetime issues
- **Thread Pool Execution**: Uses `asyncify` pattern to run blocking `std::fs::remove_dir` on Tokio's blocking thread pool
- **Generic Path Input**: Accepts `impl AsRef<Path>` for flexibility with different path types (String, PathBuf, etc.)

**Constraints**:
- Directory must be empty (inherited from `std::fs::remove_dir` behavior)
- Returns `io::Result<()>` - success returns unit type, failure returns I/O error