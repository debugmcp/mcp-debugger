# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/create_dir_all.rs
@source-hash: 049f2fe1575ee5ce
@generated: 2026-02-09T18:06:27Z

**Primary Purpose**: Provides asynchronous directory creation functionality for Tokio's filesystem module, wrapping the standard library's `std::fs::create_dir_all` with async capabilities.

**Key Function**:
- `create_dir_all(path)` (L48-51): Async function that recursively creates directories and all parent components. Takes any type implementing `AsRef<Path>`, converts to owned `PathBuf`, and delegates to `std::fs::create_dir_all` via the `asyncify` wrapper.

**Dependencies**:
- `crate::fs::asyncify` (L1): Tokio's internal utility for converting blocking filesystem operations to async
- `std::io` (L3): For `io::Result<()>` return type
- `std::path::Path` (L4): For path parameter handling

**Implementation Pattern**:
Uses the "asyncify" pattern common in Tokio's fs module - takes ownership of the path by converting `AsRef<Path>` to owned `PathBuf`, then wraps the synchronous `std::fs::create_dir_all` call in an async context via the `asyncify` helper.

**Behavioral Notes**:
- Race condition safe: concurrent calls from multiple threads/processes won't fail due to directories being created simultaneously
- Platform-specific: uses Unix `mkdir` / Windows `CreateDirectory` under the hood
- Error handling mirrors `std::fs::create_dir_all` behavior

**API Design**:
- Generic parameter accepts any path-like type (`impl AsRef<Path>`)
- Returns `io::Result<()>` matching standard library conventions
- Async/await compatible interface