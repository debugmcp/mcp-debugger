# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/udp.rs
@source-hash: 2d9c704b059fdd0b
@generated: 2026-02-09T18:02:29Z

## Purpose
Unix-specific UDP socket implementation for mio's async I/O library. Provides low-level UDP socket creation and configuration utilities that wrap libc syscalls.

## Key Functions

**bind(addr: SocketAddr) -> io::Result<net::UdpSocket> (L13-21)**
- Creates and binds a UDP socket to the specified address
- Uses `new_ip_socket()` to create raw socket file descriptor with SOCK_DGRAM type
- Converts address to raw format via `socket_addr()` and binds using libc syscall
- Returns standard library UdpSocket wrapped around the raw fd

**only_v6(socket: &net::UdpSocket) -> io::Result<bool> (L23-36)**
- Queries IPV6_V6ONLY socket option to determine if socket is IPv6-only
- Uses getsockopt syscall with IPPROTO_IPV6/IPV6_V6ONLY parameters
- Returns true if socket only accepts IPv6 connections (optval != 0)

## Dependencies
- `crate::sys::unix::net::{new_ip_socket, socket_addr}` - Core socket creation utilities
- `std::os::fd` traits for raw file descriptor conversion (platform-specific)
- Direct libc syscall interface via `syscall!` macro

## Platform Handling
Conditional compilation handles Hermit OS differences in fd trait location (L4-9), with TODO noting future std::os::fd unification.

## Architecture Notes
- Part of mio's Unix platform abstraction layer
- Bridges high-level SocketAddr types with low-level libc socket operations
- Uses unsafe code for raw fd conversion but maintains memory safety through controlled ownership transfer