# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/uds/mod.rs
@source-hash: 8417ea2b8818fa93
@generated: 2026-02-09T17:58:19Z

## Unix Domain Socket (UDS) Low-Level Utilities Module

This module provides Unix domain socket utilities for the mio library, handling platform-specific address conversion and socket pair creation across different Unix variants.

### Core Components

**Sub-modules (L10-12)**:
- `datagram`: UDS datagram socket implementation
- `listener`: UDS listener socket implementation  
- `stream`: UDS stream socket implementation

**Key Functions**:

**`path_offset()` (L22-26)**: Calculates the byte offset of the `sun_path` field within `sockaddr_un` structure. Essential for portable address length calculations across different Unix implementations.

**`unix_addr()` (L29-82)**: Primary address conversion function that transforms Rust's `SocketAddr` into C's `sockaddr_un` representation. Handles three address types:
- Pathname addresses: filesystem paths with null termination
- Abstract addresses: Linux/Android-specific namespace starting with null byte
- Unnamed addresses: empty addresses for auto-binding

Returns tuple of (`sockaddr_un`, `socklen_t`) with correct length calculations.

**`pair<T>()` (L84-134)**: Generic socket pair creation with platform-specific flag handling. Uses `socketpair()` syscall with conditional logic:
- Modern platforms: Uses `SOCK_NONBLOCK | SOCK_CLOEXEC` flags directly
- Legacy platforms (Darwin, AIX, etc.): Requires separate `fcntl()` calls for non-blocking and close-on-exec flags

### Platform Abstractions

**Conditional imports (L1-4)**: OS-specific `SocketAddrExt` traits for Android and Linux abstract namespace support.

**Extensive conditional compilation**: Two major platform categories:
- Platforms with native `SOCK_NONBLOCK/SOCK_CLOEXEC` support
- Platforms requiring manual `fcntl()` flag setting (L112-131)

### Key Constants and Safety

**`UNNAMED_ADDRESS` (L14)**: Empty byte slice representing unnamed socket addresses.

**Memory safety patterns**: Uses `mem::zeroed()` with documented safety justifications, `ptr::copy_nonoverlapping()` for path copying, and careful bounds checking with `debug_assert!()`.

### Dependencies

- `libc`: C library bindings for socket syscalls
- `std::os::unix`: Unix-specific standard library extensions
- Platform-specific OS extensions for abstract namespaces

The module implements critical low-level socket operations with careful attention to Unix variant differences and memory safety requirements.