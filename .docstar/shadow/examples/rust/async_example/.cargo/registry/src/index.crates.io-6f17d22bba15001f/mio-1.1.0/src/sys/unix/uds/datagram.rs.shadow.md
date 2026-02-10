# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/uds/datagram.rs
@source-hash: c09a1cd0d9ca43e5
@generated: 2026-02-09T17:58:13Z

**Purpose**: Unix domain socket datagram utilities for the mio library, providing low-level operations for creating and binding Unix datagram sockets.

**Key Functions**:
- `bind_addr` (L8-16): Creates and binds a Unix datagram socket to a specified address. Takes a `SocketAddr` reference, creates an unbound socket, converts the address to Unix format, and performs the bind syscall.
- `unbound` (L18-21): Creates an unbound Unix datagram socket using `AF_UNIX` and `SOCK_DGRAM` flags. Returns a `UnixDatagram` wrapped from the raw file descriptor.
- `pair` (L23-25): Creates a connected pair of Unix datagram sockets by delegating to the parent module's `pair` function with `SOCK_DGRAM` type.

**Dependencies**:
- Standard library: `std::io`, `std::os::fd`, `std::os::unix::net`
- Internal modules: `crate::sys::unix::net::new_socket`, `crate::sys::unix::uds::unix_addr`
- System: `libc` for socket constants and syscalls

**Architecture Pattern**: 
- Thin wrapper around Unix system calls for datagram socket operations
- Uses unsafe code for raw file descriptor manipulation (L20)
- Leverages syscall macro for error handling in bind operation (L13)
- All functions are `pub(crate)` indicating internal library API

**Critical Operations**:
- Raw pointer casting for sockaddr structures (L12)
- Unsafe `from_raw_fd` conversion (L20)
- Direct libc syscall usage with proper error propagation