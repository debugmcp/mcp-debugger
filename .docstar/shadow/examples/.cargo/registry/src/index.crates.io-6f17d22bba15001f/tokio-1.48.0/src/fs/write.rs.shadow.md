# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/write.rs
@source-hash: 7ed2293fd589198e
@generated: 2026-02-09T18:06:32Z

## Purpose
Provides async file writing functionality for Tokio, serving as the async equivalent of `std::fs::write`. Implements platform-optimized strategies using either io_uring (Linux) or thread pool blocking operations.

## Key Functions

### `write` (L26-46)
Primary public async function for writing entire contents to a file. Takes generic path and content parameters via `AsRef` traits. Implements dual-strategy approach:
- **io_uring path**: Conditionally compiled for Linux with tokio_unstable feature, checks runtime driver and delegates to `write_uring`
- **Fallback path**: Uses `write_spawn_blocking` for all other cases

### `write_uring` (L55-87) 
Linux-specific implementation using io_uring for high-performance async I/O. Key behaviors:
- Opens file with write/create/truncate permissions via `OpenOptions`
- Converts Tokio file to `OwnedFd` for direct io_uring operations
- Implements write loop with offset tracking for partial writes
- Handles `WriteZero` error condition when no bytes written

### `write_spawn_blocking` (L89-92)
Fallback implementation using `asyncify` to run `std::fs::write` on thread pool via `spawn_blocking`. Clones path to owned version for thread safety.

## Dependencies
- `crate::fs::asyncify`: Thread pool async wrapper
- `crate::util::as_ref::OwnedBuf`: Buffer ownership utilities  
- `crate::runtime::driver::op::Op`: io_uring operation interface
- `crate::fs::OpenOptions`: Async file opening

## Architecture Patterns
- **Conditional compilation**: Heavy use of feature gates for io_uring support
- **Runtime detection**: Checks io_uring driver availability at runtime rather than compile time
- **Graceful degradation**: Falls back to blocking implementation when io_uring unavailable
- **Generic interfaces**: Uses `AsRef<Path>` and `AsRef<[u8]>` for flexible parameter types

## Critical Invariants
- Buffer ownership properly transferred through async boundaries
- File descriptor ownership managed correctly in io_uring path
- Write completion requires all bytes written (WriteZero error on 0-byte writes)
- Path cloning necessary for thread safety in blocking path