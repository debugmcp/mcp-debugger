# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/read_dir.rs
@source-hash: a7606c7797abd9a5
@generated: 2026-02-09T18:06:37Z

## Purpose
Provides async directory reading functionality for Tokio, wrapping `std::fs::read_dir` with asynchronous streaming capabilities. Uses thread pool delegation via `spawn_blocking` to maintain async semantics while performing blocking filesystem operations.

## Key Components

### Core Function
- `read_dir(path)` (L32-42): Entry point that creates an async `ReadDir` stream from a path, initializes with first chunk of entries

### Main Types
- `ReadDir` (L64): Async directory entry stream with state machine for chunked reading
  - Contains `State` enum managing idle/pending transitions
  - Implements chunked reading with `CHUNK_SIZE = 32` (L22)

- `State` enum (L67-70): State machine for async operations
  - `Idle`: Contains buffer, std iterator, and continuation flag
  - `Pending`: Holds join handle for background thread work

- `DirEntry` (L200-212): Async wrapper around `std::fs::DirEntry`
  - Caches `file_type` on most platforms (conditional compilation)
  - Uses `Arc<std::fs::DirEntry>` for shared ownership

### Key Methods

**ReadDir Implementation:**
- `next_entry()` (L78-81): Async interface using `poll_fn`
- `poll_next_entry()` (L101-125): Core polling logic with state transitions
- `next_chunk()` (L127-156): Blocking helper that reads up to 32 entries at once

**DirEntry Methods:**
- `path()` (L244-246): Returns full path to entry
- `file_name()` (L265-267): Returns bare filename
- `metadata()` (L299-302): Async metadata retrieval via thread pool
- `file_type()` (L334-350): Async file type with platform-specific optimizations
- `ino()` (L183-185): Unix-only inode number (feature-gated)

## Architecture Patterns

### Chunked Reading Strategy
Uses buffered approach with `VecDeque<io::Result<DirEntry>>` to minimize thread pool overhead. Reads 32 entries per blocking operation.

### State Machine Pattern
Two-state async implementation:
1. **Idle**: Serves from buffer or transitions to pending
2. **Pending**: Waits for background thread completion

### Platform Abstractions
- Conditional file type caching based on OS capabilities
- Unix-specific extensions via feature gates
- Test vs production spawn_blocking selection

### Thread Pool Integration
Delegates all blocking filesystem operations to `spawn_blocking`, maintaining async runtime compatibility while preserving std::fs semantics.

## Dependencies
- `crate::fs::asyncify`: Async wrapper utility
- `crate::blocking::spawn_blocking`: Thread pool execution (production)
- `super::mocks`: Test doubles for blocking operations
- Standard library filesystem types (`std::fs::ReadDir`, `DirEntry`, etc.)

## Critical Invariants
- Buffer always drained before new chunk requests
- State transitions maintain data ownership through `Option::take()`
- Platform-specific optimizations respect OS filesystem capabilities
- Cancellation safety maintained through proper state management