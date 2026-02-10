# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/open_options.rs
@source-hash: 0c6e822a3fc9e86c
@generated: 2026-02-09T18:06:39Z

## Purpose
Tokio's async file opening options builder - a wrapper around `std::fs::OpenOptions` that provides async file opening with optional io_uring support on Linux. Implements the builder pattern for configuring file access permissions, creation modes, and platform-specific options.

## Key Components

**OpenOptions Struct (L88-90)**
- Main builder struct with `inner: Kind` field
- Provides fluent API for configuring file opening options
- Supports both standard filesystem operations and experimental io_uring on Linux

**Kind Enum (L92-103)**
- Internal discriminated union selecting backend implementation
- `Std(StdOpenOptions)` - Standard filesystem operations via thread pool
- `Uring(UringOpenOptions)` - Linux io_uring operations (conditional compilation)
- Backend selection happens at compile/runtime based on feature flags and platform

**Core Builder Methods**
- `new()` (L122-141) - Creates default instance, selects backend based on feature flags
- `read()` (L168-185) - Configures read access permission
- `write()` (L212-229) - Configures write access permission  
- `append()` (L285-302) - Configures append mode with atomic guarantees
- `truncate()` (L332-349) - Configures file truncation on open
- `create()` (L382-399) - Configures file creation if not exists
- `create_new()` (L439-456) - Configures exclusive file creation (atomic, prevents TOCTOU)

**File Opening (L520-542)**
- `open()` - Async method that dispatches to appropriate backend
- For `Kind::Std`: Uses `asyncify()` to run blocking operation on thread pool
- For `Kind::Uring`: Attempts io_uring first, falls back to standard on failure
- Returns `io::Result<File>` with comprehensive error documentation

**Platform Extensions**
- Unix-specific methods (L563-650): `mode()`, `custom_flags()` for permission bits and open flags
- Windows-specific methods (L654-834): `access_mode()`, `share_mode()`, `custom_flags()`, `attributes()`, `security_qos_flags()`
- Platform methods delegate to underlying `StdOpenOptions` via `as_inner_mut()`

## Architecture Patterns

**Conditional Compilation Strategy**
- Heavy use of `#[cfg()]` attributes for platform and feature-specific code
- io_uring support gated behind multiple conditions: `tokio_unstable`, `feature = "io-uring"`, `target_os = "linux"`
- Test vs production builds use different underlying types (`MockOpenOptions` vs `StdOpenOptions`)

**Async Abstraction**
- Wraps synchronous `std::fs::OpenOptions` with async interface
- Uses `asyncify()` helper to run blocking operations on thread pool
- Maintains compatibility with standard library API surface

**Error Handling**
- Comprehensive error documentation with specific `ErrorKind` mappings
- Preserves all standard library error semantics in async context

## Dependencies
- `crate::fs::{asyncify, File}` - Core async filesystem utilities
- `std::fs::OpenOptions` - Standard library file opening (aliased as `StdOpenOptions`)
- Platform-specific extensions via `std::os::{unix,windows}::fs::OpenOptionsExt`
- Optional: `uring_open_options::UringOpenOptions` for io_uring support

## Critical Invariants
- Builder methods always return `&mut Self` for chaining
- Backend selection is immutable after construction via `new()`
- Platform-specific methods only available on appropriate targets
- io_uring operations gracefully degrade to standard operations on failure