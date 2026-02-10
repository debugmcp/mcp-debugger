# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/mod.rs
@source-hash: 537ab6b4af3685a7
@generated: 2026-02-09T18:02:45Z

## Purpose

This is the core Linux-like systems module for the libc Rust FFI crate, containing type definitions, constants, structures, and external function bindings for POSIX and Linux-specific system programming interfaces. Serves as the foundational layer for Unix-like system programming in Rust.

## Key Type Definitions

**Primitive Type Aliases (L3-9):**
- `sa_family_t`, `speed_t`, `tcflag_t` - Network and terminal interface types
- `clockid_t`, `timer_t`, `key_t`, `id_t` - System resource identifiers

**Missing Types (L11-14):**
- `timezone` enum - Incomplete type definition using `missing!` macro

## Core Structures

**Network Structures (L16-208):**
- `in_addr` (L17-19) - IPv4 address representation
- `ip_mreq*` variants (L21-36) - Multicast group membership structures
- `sockaddr*` family (L38-76) - Socket address structures for different protocols
- `sockaddr_ll` (L78-86) - Linux packet socket address
- `addrinfo` (L58-76) - Address resolution structure with platform-specific field ordering

**System Information Structures:**
- `fd_set` (L88-90) - File descriptor set for select operations
- `tm` (L92-104) - Time structure with timezone extensions
- `utsname` (L303-310) - System identification structure
- `sched_param` (L106-116) - Scheduling parameters with conditional fields

**Network/System Structures:**
- `ifaddrs` (L158-166) - Network interface address list
- `lconv` (L125-150) - Locale-specific formatting information
- `Dl_info` (L118-123) - Dynamic linking information

## Platform-Specific Conditional Structures

**File Operations (L210-277):**
- `file_clone_range` (L213-218) - File cloning parameters (non-emscripten)
- `sock_filter`/`sock_fprog` (L221-231) - Berkeley Packet Filter structures
- `statx`/`statx_timestamp` (L243-274) - Extended file status (GNU/Android/musl>=1.2.3)

**Special Trait Structures (L279-324):**
- `epoll_event` (L284-287) - Event polling with architecture-specific packing
- `sockaddr_un` (L289-292) - Unix domain socket address
- `sockaddr_storage` (L294-301) - Generic socket address storage
- `sigevent` (L312-323) - Asynchronous event notification

## Manual Trait Implementations

**Extra Traits (L327-446):** Conditional implementation of `PartialEq`, `Eq`, and `Hash` for special structures when "extra_traits" feature is enabled. Custom implementations handle array comparison and platform-specific padding.

## Constants and Configuration

**Architecture Constants (L448-457):** `ULONG_SIZE` determined by pointer width for fd_set operations.

**Standard Constants (L459-568):** Exit codes, file operations, signals, and I/O constants.

**File Control (L470-491):** `F_*` constants for fcntl operations, including Linux-specific extensions.

**Clock IDs (L499-510):** Various clock types for timing operations.

**Memory Protection (L559-563, L654-656):** `PROT_*` flags for memory mapping.

**Network Protocol Constants (L704-932):** Extensive socket, protocol, and IP option definitions.

## Advanced Features

**I/O Control (L1703-1784):** Comprehensive ioctl infrastructure with architecture-specific implementations:
- `_IOC*` macros for ioctl number construction
- Type-safe ioctl builders (`_IO`, `_IOR`, `_IOW`, `_IOWR`)
- TUN/TAP interface constants (L1463-1547)

**File System Magic Numbers (L1549-1661):** Constants for identifying different file system types.

## Function-like Macros

**Message Control (L1787-1837):**
- `CMSG_*` functions for control message handling in socket programming
- `FD_*` functions for file descriptor set manipulation

**Process Status (L1839-1912):** `W*` macros for interpreting process wait status and other utility functions.

## External Function Bindings

**Core System Functions (L1914-2071):**
- Time functions with 64-bit time support
- Thread attribute management
- Memory management and file operations
- Locale handling and process control

**LFS64 Extensions (L2073-2156):** Large File Support functions for systems requiring explicit 64-bit variants.

**Platform Modules (L2198-2214):** Conditional inclusion of platform-specific modules (emscripten, linux, android, l4re).

## Architecture Considerations

- Extensive use of `cfg_if!` for platform/architecture-specific definitions
- Special handling for different architectures (x86, MIPS, SPARC, s390x)
- Conditional compilation based on environment (GNU, musl, uclibc, OHOS)
- 64-bit time support with automatic symbol linking