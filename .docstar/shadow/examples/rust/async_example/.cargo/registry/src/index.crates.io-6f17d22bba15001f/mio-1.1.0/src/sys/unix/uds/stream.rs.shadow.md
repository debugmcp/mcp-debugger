# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/uds/stream.rs
@source-hash: 4b0ec759a550b65c
@generated: 2026-02-09T17:58:16Z

## Purpose
Unix domain socket stream connection utilities for the Mio async I/O library. Provides low-level socket creation and connection functionality for Unix domain stream sockets.

## Key Functions

### `connect_addr` (L8-21)
Creates and connects a Unix domain stream socket to a specified socket address.
- **Parameters**: `&SocketAddr` - target Unix socket address
- **Returns**: `io::Result<net::UnixStream>` - connected stream socket
- **Process**:
  1. Creates new Unix stream socket using `new_socket` with `AF_UNIX` and `SOCK_STREAM`
  2. Wraps raw file descriptor in `UnixStream` using `from_raw_fd`
  3. Converts address to Unix socket address format via `unix_addr`
  4. Performs blocking connect syscall, handling `EINPROGRESS` as success
  5. Returns connected socket or propagates connection errors

### `pair` (L23-25)
Creates a connected pair of Unix domain stream sockets.
- **Returns**: `io::Result<(net::UnixStream, net::UnixStream)>` - bidirectional socket pair
- **Implementation**: Delegates to `super::pair(SOCK_STREAM)` for actual pair creation

## Dependencies
- **Internal**: `crate::sys::unix::net::new_socket` for socket creation, `crate::sys::unix::uds::unix_addr` for address conversion
- **External**: Standard library Unix networking (`std::os::unix::net`), libc for system calls
- **Macros**: Uses `syscall!` macro for safe system call invocation with error handling

## Key Patterns
- **Error Handling**: Explicit handling of `EINPROGRESS` errno as non-error condition (L16)
- **Unsafe Operations**: Raw file descriptor manipulation wrapped in safe abstractions (L10)
- **System Call Wrapping**: Direct libc syscall usage through `syscall!` macro for precise control

## Architecture Notes
This module provides the Unix-specific implementation layer for stream socket operations, abstracting platform differences while maintaining direct control over socket behavior for async I/O operations.