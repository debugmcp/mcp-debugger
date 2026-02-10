# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/unix/socketaddr.rs
@source-hash: 7cc93197c10c1727
@generated: 2026-02-09T18:02:54Z

**Purpose**: Thin wrapper around `std::os::unix::net::SocketAddr` to provide Tokio-compatible Unix socket addressing with cross-platform support.

**Core Structure**:
- `SocketAddr` struct (L10): Newtype wrapper containing `std::os::unix::net::SocketAddr` as private field
- Implements Clone trait for value semantics

**Key Methods**:
- `is_unnamed()` (L18-20): Checks if socket address is unnamed (not bound to filesystem path)
- `as_pathname()` (L27-29): Extracts filesystem path if address is pathname-based, returns `Option<&Path>`
- `as_abstract_name()` (L40-47): Linux/Android-specific method to get abstract namespace address as byte slice

**Platform Support**:
- Core functionality works on all Unix platforms
- Abstract namespace support conditionally compiled for Linux/Android only (L38-39)
- Uses platform-specific `SocketAddrExt` traits via conditional imports (L41-44)

**Trait Implementations**:
- `Debug` (L50-54): Delegates to wrapped standard library type
- `From<std::os::unix::net::SocketAddr>` (L56-60): Constructor conversion
- `From<SocketAddr>` (L62-66): Extraction conversion for interoperability

**Architecture Pattern**: 
Newtype pattern providing zero-cost abstraction while maintaining full compatibility with standard library types. All methods delegate to underlying `std::os::unix::net::SocketAddr` implementation.

**Dependencies**: 
- `std::fmt` for Debug formatting
- `std::path::Path` for pathname handling
- Platform-specific `SocketAddrExt` traits for extended functionality