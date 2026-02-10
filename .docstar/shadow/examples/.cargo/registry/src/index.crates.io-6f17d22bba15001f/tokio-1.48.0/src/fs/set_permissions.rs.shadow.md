# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/set_permissions.rs
@source-hash: 8adccafa475dcfc1
@generated: 2026-02-09T18:06:27Z

**Primary Purpose**: Provides asynchronous file system permissions modification functionality as part of the Tokio async runtime's fs module.

**Core Function**:
- `set_permissions` (L12-15): Async wrapper around `std::fs::set_permissions` that accepts any path-like type and file permissions, returning an IO result. Uses Tokio's `asyncify` utility to execute the blocking operation on a thread pool.

**Key Dependencies**:
- `crate::fs::asyncify` (L1): Tokio's utility for converting blocking operations to async
- `std::fs::Permissions` (L3): Standard library permissions type
- `std::path::Path` (L5): Standard library path handling

**Implementation Pattern**:
- Path conversion pattern (L13): Converts path reference to owned `PathBuf` to avoid lifetime issues when moving to thread pool
- Async wrapper pattern (L14): Uses `asyncify` closure to wrap synchronous `std::fs::set_permissions` call

**Type Flexibility**: 
- Accepts `impl AsRef<Path>` allowing `&str`, `String`, `PathBuf`, etc. as path arguments

**Error Handling**: 
- Propagates standard IO errors from underlying filesystem operations through `io::Result<()>`