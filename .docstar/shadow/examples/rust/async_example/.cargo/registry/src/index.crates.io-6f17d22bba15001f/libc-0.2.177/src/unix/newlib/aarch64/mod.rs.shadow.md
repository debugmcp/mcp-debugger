# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/newlib/aarch64/mod.rs
@source-hash: ec594c54dc0e7784
@generated: 2026-02-09T17:58:16Z

## Purpose
Platform-specific bindings for newlib on AArch64 architecture. Defines C ABI-compatible types, socket structures, and networking constants that mirror the newlib C library interface for 64-bit ARM systems.

## Key Types
- `clock_t` (L3): Time measurement type aliased to `c_long`
- `wchar_t` (L4): Wide character type as 32-bit unsigned integer

## Socket Structures (L6-29)
Defined using the `s!` macro for C struct compatibility:

- `sockaddr` (L7-11): Generic socket address with 8-bit length field, address family, and 14-byte data buffer
- `sockaddr_in6` (L13-20): IPv6 socket address containing length, family, port, flow info, IPv6 address, and scope ID
- `sockaddr_in` (L22-28): IPv4 socket address with length, family, port, IPv4 address, and 8-byte padding

## Network Constants
- **Address Family**: `AF_INET6 = 23` (L31) for IPv6 addressing
- **I/O Control**: `FIONBIO = 1` (L33) for non-blocking I/O operations
- **Poll Events** (L35-40): Standard polling flags (POLLIN, POLLOUT, POLLERR, etc.)
- **Socket Level**: `SOL_SOCKET = 65535` (L42) for socket-level operations
- **Message Flags** (L44-50): Socket message options, many set to 0 indicating unsupported features

## Dependencies
- Imports `crate::prelude::*` (L1) for common types like `c_int`, `c_char`, `c_long`
- Re-exports `dirent`, `sigset_t`, `stat` from generic newlib module (L52)

## Architecture Notes
- AArch64-specific newlib implementation
- Socket structures include explicit length fields (BSD-style)
- Several message flags are disabled (set to 0), indicating limited socket feature support in newlib
- Uses platform-appropriate integer sizes for time and character types