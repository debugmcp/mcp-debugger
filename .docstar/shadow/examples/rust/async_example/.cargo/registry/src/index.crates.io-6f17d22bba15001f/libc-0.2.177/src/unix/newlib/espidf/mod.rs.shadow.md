# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/newlib/espidf/mod.rs
@source-hash: 77e8ad5b7db027b8
@generated: 2026-02-09T17:58:18Z

This file provides ESP-IDF (Espressif IoT Development Framework) platform-specific definitions for the libc crate's Unix newlib compatibility layer. ESP-IDF is the official SDK for ESP32 microcontrollers running FreeRTOS.

## Type Definitions
- `clock_t` (L3): Time representation as `c_ulong`
- `wchar_t` (L4): Wide character as 32-bit unsigned integer

## Core Socket Structures (L6-58)
The file defines essential networking structures using the `s!` macro (likely for struct generation):

- `cmsghdr` (L7-11): Control message header for advanced socket operations
- `msghdr` (L13-21): Message header for scatter-gather I/O operations  
- `sockaddr_un` (L23-26): Unix domain socket address with 108-byte path
- `sockaddr` (L28-32): Generic socket address with length field and 14-byte data
- `sockaddr_in6` (L34-41): IPv6 socket address with flow info and scope ID
- `sockaddr_in` (L43-49): IPv4 socket address with 8-byte padding
- `sockaddr_storage` (L51-57): Generic storage for any socket address type

## Network Constants
- Address families: `AF_UNIX` (L60), `AF_INET6` (L61)
- I/O control: `FIONBIO` (L63) for non-blocking mode
- Poll events (L65-73): Standard polling flags for socket readiness
- Socket options: `SOL_SOCKET` (L75) for socket-level operations
- Message flags (L77-86): Control flags for send/recv operations

## Threading and Signals
- `PTHREAD_STACK_MIN` (L88): Minimum stack size of 768 bytes
- Signal constants (L90-98): Standard POSIX signals with ESP-IDF values

## External Function Bindings (L100-118)
- `pthread_create` (L101-106): Thread creation with standard POSIX signature
- `getrandom` (L108): Cryptographically secure random number generation
- `gethostname` (L110): System hostname retrieval
- `sendmsg`/`recvmsg` (L112-115): Advanced socket I/O with lwIP linking
- `eventfd` (L117): Event notification mechanism

## Dependencies
- Imports from `crate::prelude::*` (L1) for common types
- Re-exports from `crate::unix::newlib::generic` (L120) for shared Unix types
- Uses lwIP network stack functions via `#[link_name]` attributes

## Architecture Notes
This module bridges standard Unix networking APIs to ESP-IDF's lwIP TCP/IP stack implementation, providing POSIX-like socket programming interface for ESP32 embedded applications. The structures maintain compatibility with standard socket programming while accommodating ESP-IDF's specific requirements.