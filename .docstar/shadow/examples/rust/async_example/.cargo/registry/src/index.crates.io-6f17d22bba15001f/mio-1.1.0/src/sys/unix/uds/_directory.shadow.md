# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/uds/
@generated: 2026-02-09T18:16:10Z

## Unix Domain Socket (UDS) Implementation Module

This directory provides the complete Unix domain socket implementation for the mio async I/O library, handling platform-specific socket operations across different Unix variants. It serves as the low-level foundation for Unix domain socket communication within mio's cross-platform networking abstraction.

### Overall Architecture

The module is organized around socket type specialization with a common utility foundation:

- **`mod.rs`**: Core utilities and address conversion infrastructure shared across all socket types
- **`datagram.rs`**: Datagram socket (SOCK_DGRAM) specific operations  
- **`listener.rs`**: Stream listener socket binding and connection acceptance
- **`stream.rs`**: Stream socket (SOCK_STREAM) connection operations

### Key Components and Relationships

**Address Management**:
- `unix_addr()`: Central address conversion from Rust `SocketAddr` to C `sockaddr_un`
- `path_offset()`: Platform-portable offset calculations for sockaddr structures
- Support for pathname, abstract (Linux/Android), and unnamed address types

**Socket Creation and Management**:
- `new_socket()` (from parent module): Raw socket creation with appropriate flags
- `pair()`: Generic socketpair creation with platform-specific flag handling
- Consistent unsafe-to-safe wrapping patterns across all socket types

**Platform Abstraction**:
- Conditional compilation for modern vs. legacy Unix platforms
- Handles differences in `SOCK_NONBLOCK`/`SOCK_CLOEXEC` support
- Platform-specific quirks (FreeBSD/Darwin address handling, Android seccomp restrictions)

### Public API Surface

**Entry Points for Socket Creation**:
- `datagram::bind_addr()`: Create bound datagram socket
- `datagram::unbound()`: Create unbound datagram socket  
- `datagram::pair()`: Create connected datagram socket pair
- `listener::bind_addr()`: Create bound listener socket
- `stream::connect_addr()`: Create connected stream socket
- `stream::pair()`: Create connected stream socket pair

**Connection Handling**:
- `listener::accept()`: Accept incoming stream connections with platform-optimized syscalls

### Internal Organization and Data Flow

1. **Socket Creation**: Raw socket creation through `new_socket()` with Unix-specific flags
2. **Address Conversion**: `SocketAddr` → `sockaddr_un` via `unix_addr()` with proper length calculation  
3. **Syscall Execution**: Platform-appropriate syscalls (`bind`, `listen`, `accept4`/`accept`, `connect`, `socketpair`)
4. **Safe Wrapping**: Raw file descriptors wrapped in standard library types (`UnixStream`, `UnixListener`, `UnixDatagram`)

### Important Patterns and Conventions

**Memory Safety**: Extensive use of `mem::zeroed()` for sockaddr initialization with documented safety justifications, careful bounds checking, and safe pointer operations.

**Error Handling**: Consistent use of `syscall!` macro for system call error propagation, special handling of `EINPROGRESS` for non-blocking operations.

**Platform Compatibility**: Two-tier approach with modern platforms using atomic flag setting and legacy platforms requiring separate `fcntl()` calls for non-blocking and close-on-exec behavior.

**API Consistency**: All functions follow `pub(crate)` visibility pattern, indicating internal library API, with consistent error propagation and resource management across socket types.

This module abstracts the complexity of Unix domain socket operations while maintaining the performance characteristics required for async I/O, providing a unified interface that handles platform differences transparently.