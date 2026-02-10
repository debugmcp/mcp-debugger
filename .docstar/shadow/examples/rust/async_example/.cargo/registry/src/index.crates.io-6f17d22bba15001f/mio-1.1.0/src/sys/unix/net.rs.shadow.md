# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/net.rs
@source-hash: 9f77775969e6811b
@generated: 2026-02-09T18:03:18Z

## Socket Creation and Address Conversion Utilities for Unix Systems

This module provides low-level networking utilities for creating non-blocking sockets and converting between Rust `SocketAddr` types and C `sockaddr` representations on Unix-like systems.

### Key Functions

**`new_ip_socket(addr: SocketAddr, socket_type: libc::c_int)` (L5-12)**
- Creates IP sockets based on address family (IPv4/IPv6)
- Determines domain (AF_INET/AF_INET6) from SocketAddr variant
- Delegates to `new_socket()` for actual creation

**`new_socket(domain: libc::c_int, socket_type: libc::c_int)` (L14-79)**
- Core socket creation function that handles platform-specific non-blocking setup
- Uses SOCK_NONBLOCK|SOCK_CLOEXEC flags on Linux/BSD systems (L16-29)
- Falls back to fcntl() calls on macOS/Darwin systems (L54-76)
- Sets SO_NOSIGPIPE on Apple platforms (L35-52)
- Returns raw file descriptor on success

**`socket_addr(addr: &SocketAddr)` (L98-183)**
- Converts Rust SocketAddr to C sockaddr representation
- Returns (SocketAddrCRepr, socklen_t) tuple
- Handles IPv4 (L100-143) and IPv6 (L144-181) variants
- Manages platform-specific sockaddr field differences (sin_zero, sin_len, etc.)

**`to_socket_addr(storage: *const libc::sockaddr_storage)` (L191-216)**
- Unsafe function converting C sockaddr back to Rust SocketAddr
- Dispatches on ss_family field (AF_INET/AF_INET6)
- Performs proper endianness conversion for ports and addresses

### Core Types

**`SocketAddrCRepr` (L85-95)**
- Union type providing memory-efficient sockaddr representation
- Contains either sockaddr_in (v4) or sockaddr_in6 (v6) variants
- Provides `as_ptr()` method for C interop

### Platform Handling

The module extensively uses conditional compilation to handle differences across Unix variants:
- Socket flag support (SOCK_NONBLOCK, SOCK_CLOEXEC availability)
- Sockaddr structure field variations (sin_len, sin_zero sizes)
- Platform-specific features (SO_NOSIGPIPE on Apple, sin_vport on Vita)

### Dependencies

- `std::io` for Result types and error handling  
- `std::net` for Rust socket address types
- `libc` crate for C system call bindings (implied by usage)
- Assumes availability of `syscall!` macro for system call error handling

### Architectural Notes

- Prioritizes performance by avoiding unnecessary allocations
- Uses union types to minimize memory footprint
- Implements platform-specific optimizations where available
- Maintains compatibility across wide range of Unix-like systems