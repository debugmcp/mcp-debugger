# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/dir_builder.rs
@source-hash: 5e726ee92b953d68
@generated: 2026-02-09T18:06:29Z

**Purpose**: Provides an async wrapper around `std::fs::DirBuilder` for creating directories within the Tokio async runtime.

## Core Structure
- **DirBuilder** (L10-18): Main struct with builder pattern for directory creation
  - `recursive: bool` (L13): Controls whether parent directories are created
  - `mode: Option<u32>` (L17): Unix-specific permissions (conditional compilation)

## Key Methods
- **new()** (L33-35): Creates default DirBuilder instance (non-recursive, default permissions)
- **recursive()** (L52-55): Configures recursive directory creation, returns self for chaining
- **create()** (L91-104): Async directory creation method
  - Converts path to owned value for thread safety
  - Creates std::fs::DirBuilder and applies configuration
  - Uses `asyncify()` to run blocking operation on thread pool
- **mode()** (L124-127): Unix-only method to set directory permissions

## Dependencies
- `crate::fs::asyncify` (L1): Tokio's utility for running blocking filesystem operations
- `std::fs::DirBuilder`: Underlying synchronous directory builder
- `std::os::unix::fs::DirBuilderExt` (L99): Unix-specific extensions for permissions

## Architecture Patterns
- **Async Wrapper**: Wraps synchronous std operations with async interface
- **Builder Pattern**: Fluent API for configuration chaining
- **Thread Pool Delegation**: Uses `asyncify()` to avoid blocking the async runtime
- **Conditional Compilation**: Unix-specific features gated behind `#[cfg(unix)]`
- **Feature Gating**: Uses `feature!` macro for platform-specific implementations

## Error Handling
- Returns `io::Result<()>` from async operations
- Propagates filesystem errors from underlying std operations
- Documented error conditions include permission issues, existing files/directories

## Thread Safety
- Clones path to owned value before moving to thread pool
- Immutable self reference in create() ensures safe concurrent access