# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/new/bionic/sys/socket.rs
@source-hash: c11b51f13897a7ff
@generated: 2026-02-09T17:58:14Z

## Purpose
Bionic libc socket system bindings for Android's C library. Provides Rust FFI definitions for socket-related structures and functions from `sys/socket.h`.

## Key Structures

**msghdr (L6-14)**: Message header structure for advanced socket I/O operations
- Contains message metadata: name/address, I/O vectors, control data, and flags
- Used with `sendmsg`/`recvmsg` for scatter-gather I/O and ancillary data transfer
- Fields map directly to POSIX `struct msghdr`

**cmsghdr (L16-20)**: Control message header for ancillary data
- Used within `msghdr.msg_control` to pass file descriptors, credentials, etc.
- Standard POSIX structure for socket control messages

**ucred (L22-26)**: Unix credentials structure
- Contains process ID, user ID, and group ID
- Used with `SO_PEERCRED` socket option for peer authentication

## External Functions

**recvmmsg (L30-36)**: Batch receive multiple messages
- Returns number of messages received or -1 on error
- Bionic-specific function for high-performance message reception
- Includes optional timeout parameter

**sendmmsg (L37-42)**: Batch send multiple messages  
- Returns number of messages sent or -1 on error
- Counterpart to `recvmmsg` for efficient bulk transmission

**recvfrom (L43-50)**: Receive data with source address
- Standard socket function for connectionless protocols
- Returns bytes received, fills source address if provided

## Dependencies
- Uses `crate::prelude::*` for common libc types (L3)
- References external types: `socklen_t`, `iovec`, `mmsghdr`, `timespec`, `sockaddr`, `pid_t`, `uid_t`, `gid_t`
- Wrapped in `s!` macro (L5) for structure definition generation

## Architecture Notes
- Part of Bionic-specific libc bindings (Android's C library)
- All structures use C-compatible layout for FFI
- Functions declared as `extern "C"` for proper ABI linking