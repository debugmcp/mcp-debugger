# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/uds/listener.rs
@source-hash: 3d2e0f755d8b2ac4
@generated: 2026-02-09T17:58:18Z

## Unix Domain Socket Listener Operations

This module provides low-level Unix domain socket listener functionality for the mio async I/O library, implementing platform-specific bind and accept operations.

### Core Functions

**`bind_addr(address: &SocketAddr)` (L13-23)**
- Creates and binds a Unix domain socket listener to a given address
- Creates raw socket with `AF_UNIX` and `SOCK_STREAM` flags
- Converts address to Unix sockaddr format using `unix_addr()` helper
- Performs syscalls: `bind()` then `listen()` with configured backlog size
- Returns standard library `UnixListener` wrapped around raw file descriptor

**`accept(listener: &net::UnixListener)` (L25-122)**
- Accepts incoming connections on Unix domain socket listener
- Implements platform-specific accept logic with conditional compilation
- Uses `accept4()` with `SOCK_NONBLOCK|SOCK_CLOEXEC` on modern platforms (L54-63)
- Falls back to `accept()` + manual `fcntl()` calls on older platforms (L80-102)
- Handles platform quirks for FreeBSD/Darwin unnamed addresses (L108-112)
- Reconstructs `SocketAddr` from raw sockaddr_un structure
- Returns tuple of `(UnixStream, SocketAddr)`

### Platform Compatibility

**Modern Platforms**: Use `accept4()` syscall for atomic non-blocking + close-on-exec setup
**Legacy Platforms**: Use `accept()` + separate `fcntl()` calls for same functionality

Excluded from `accept4()` usage:
- AIX, Haiku, iOS, macOS, NetBSD, Redox, tvOS, visionOS, watchOS
- ESP-IDF, Vita, QNX Neutrino
- Android x86 (due to seccomp restrictions)

### Key Dependencies

- `crate::sys::unix::uds::{path_offset, unix_addr}` - Address conversion utilities
- `crate::sys::unix::net::new_socket` - Raw socket creation
- `crate::sys::LISTEN_BACKLOG_SIZE` - Default listener backlog configuration
- `crate::net::UnixStream` - Mio's Unix stream wrapper

### Critical Safety Considerations

- Uses `mem::zeroed<libc::sockaddr_un>()` for safe sockaddr initialization (L33)
- Extensive use of `unsafe` blocks for raw file descriptor operations
- Manual memory management for sockaddr structures and path extraction
- Platform-specific conditional compilation ensures correct syscall usage