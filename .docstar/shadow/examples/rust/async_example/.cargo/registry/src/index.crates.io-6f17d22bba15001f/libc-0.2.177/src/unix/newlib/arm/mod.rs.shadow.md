# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/newlib/arm/mod.rs
@source-hash: a1fb6caa077c2ed6
@generated: 2026-02-09T17:58:16Z

## Primary Purpose
ARM-specific platform definitions for the newlib C library implementation within the libc crate. This module provides ARM architecture-specific type definitions, socket structures, and networking constants that override or extend generic newlib definitions.

## Key Type Definitions
- `clock_t` (L3): ARM-specific clock type defined as `c_long`
- `wchar_t` (L4): Wide character type defined as `u32` for ARM

## Socket Structures (L6-31)
Defined within the `s!` macro block for C-compatible struct layout:
- `sockaddr` (L7-10): Generic socket address with 14-byte data field
- `sockaddr_in6` (L12-18): IPv6 socket address structure with flow info and scope ID
- `sockaddr_in` (L20-25): IPv4 socket address with 8-byte zero padding
- `sockaddr_storage` (L27-30): Generic storage for any socket address type with 26-byte padding

## Networking Constants
- `AF_INET6` (L33): IPv6 address family constant (23)
- `FIONBIO` (L35): Non-blocking I/O control constant (1)
- Poll event flags (L37-42): `POLLIN`, `POLLPRI`, `POLLHUP`, `POLLERR`, `POLLOUT`, `POLLNVAL`
- `SOL_SOCKET` (L44): Socket-level option constant (65535)
- Message flags (L46-52): Various `MSG_*` constants for socket operations, many set to 0 (no-op on this platform)

## Dependencies
- Imports from `crate::prelude::*` (L1) for basic types
- Re-exports generic newlib types: `dirent`, `sigset_t`, `stat` (L54)

## Architecture Notes
ARM-specific socket address structures use standard padding schemes. Several message flags (`MSG_DONTROUTE`, `MSG_WAITALL`, `MSG_MORE`, `MSG_NOSIGNAL`) are defined as 0, indicating these features are not supported or are no-ops on ARM newlib.