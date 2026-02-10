# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/tcp.rs
@source-hash: 17e970986c6e9ec5
@generated: 2026-02-09T18:02:33Z

## Purpose
Unix-specific TCP socket operations module for the MIO async I/O library. Provides low-level TCP socket creation, binding, connecting, listening, and accepting functionality with platform-specific optimizations.

## Key Functions

### Socket Creation & Management
- `new_for_addr(address: SocketAddr)` (L13-19): Creates a new TCP socket with appropriate domain (IPv4/IPv6) based on address type
- `bind(socket: &net::TcpListener, addr: SocketAddr)` (L21-25): Binds TCP listener to specified address using raw syscalls
- `listen(socket: &net::TcpListener, backlog: i32)` (L40-43): Sets socket to listening mode with specified backlog
- `set_reuseaddr(socket: &net::TcpListener, reuseaddr: bool)` (L45-55): Configures SO_REUSEADDR socket option

### Connection Operations
- `connect(socket: &net::TcpStream, addr: SocketAddr)` (L27-38): Non-blocking TCP connect that handles EINPROGRESS appropriately
- `accept(listener: &net::TcpListener)` (L57-135): Platform-optimized accept with dual implementation paths for different OS capabilities

## Platform-Specific Logic

### Accept Implementation Strategy
The `accept` function uses conditional compilation to optimize for different platforms:

**Modern Platforms** (L63-86): Uses `accept4()` syscall with SOCK_CLOEXEC and SOCK_NONBLOCK flags for atomic socket creation on Linux, FreeBSD, NetBSD, OpenBSD, etc. (excluding Android x86 due to seccomp restrictions)

**Legacy Platforms** (L91-130): Falls back to standard `accept()` with manual flag setting via `fcntl()` for AIX, macOS, iOS, Android x86, and other BSD-derived systems

### File Descriptor Management
- Uses platform-specific imports for raw FD operations (L4-9)
- Hermit OS requires separate import path due to Rust issue #126198
- Automatic CLOEXEC and NONBLOCK flag setting based on platform capabilities

## Dependencies
- `crate::sys::unix::net`: Provides `new_socket`, `socket_addr`, `to_socket_addr` utilities
- Standard library networking and file descriptor traits
- `libc` for raw syscall bindings (implied through `syscall!` macro usage)

## Architecture Notes
- All functions are `pub(crate)` indicating internal MIO library usage
- Extensive use of `syscall!` macro for error handling consistency
- Platform detection via `cfg` attributes enables compile-time optimization
- Raw socket operations wrapped in safe Rust interfaces