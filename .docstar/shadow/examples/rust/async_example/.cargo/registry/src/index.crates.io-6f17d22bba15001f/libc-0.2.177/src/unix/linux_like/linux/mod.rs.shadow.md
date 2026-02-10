# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/mod.rs
@source-hash: 4ab0a27762842a59
@generated: 2026-02-09T17:58:47Z

## Primary Purpose

This is a Linux-specific module within the `libc` crate that provides comprehensive type definitions, constants, and function bindings for Linux system programming. It serves as the primary interface for accessing Linux kernel APIs, system calls, and POSIX/GNU library functions from Rust.

## Key Type Definitions

### Basic System Types (L6-24)
Core system type aliases like `useconds_t`, `dev_t`, `socklen_t`, `mode_t`, pthread types, and kernel types (`__kernel_fsid_t`, `__kernel_clockid_t`). These map C types to Rust-compatible equivalents.

### ELF Format Types (L31-53)
Complete ELF (Executable and Linkable Format) type definitions for both 32-bit and 64-bit architectures:
- `Elf32_*` and `Elf64_*` types for headers, symbols, relocations
- Platform-specific conditional compilation for SPARC64 (L55-59)

### Network and IPC Types (L61-95)
- SCTP protocol types (`sctp_assoc_t`)
- Event file descriptor types (`eventfd_t`)
- Packet socket enumerations (`tpacket_versions`, `pid_type`)

## Major Structure Definitions (L96-1364)

### File System Structures (L97-131)
- `glob_t` (L97-108): File globbing support
- `passwd` (L110-118): User account information
- `spwd` (L120-130): Shadow password entries
- `dqblk` (L132-142): Disk quota blocks

### Signal and Event Handling (L144-172)
- `signalfd_siginfo` (L144-167): Signal information for signalfd
- `itimerspec` (L169-172): Timer specifications

### Network Packet Structures (L178-315)
Extensive packet socket support:
- `fanout_args` (L178-185): Packet fanout configuration  
- `packet_mreq` (L187-192): Multicast requests
- `tpacket_*` structures (L201-287): Zero-copy packet capture
- `cpu_set_t` (L305-310): CPU affinity masks

### System V IPC (L317-333)
- `msginfo` (L318-327): Message queue information
- `sembuf` (L329-333): Semaphore operations

### Input/HID Structures (L335-467)
Comprehensive Linux input subsystem support:
- `input_event` (L335-354): Input events with time handling
- `input_*` structures for device capabilities, force feedback
- `ff_*` structures (L386-454): Force feedback effects
- `uinput_*` structures (L456-467): User-space input devices

### ELF Runtime Support (L474-606)
- `dl_phdr_info` (L474-506): Dynamic loader program headers
- Complete ELF header, symbol, and section structures
- Relocation entry definitions

### Security and Authentication (L622-758)
- `ucred` (L622-626): User credentials for Unix sockets
- `mntent` (L628-635): Mount table entries
- `posix_spawn*` structures (L637-655): Process spawning
- `seccomp_*` structures (L725-758): Secure computing filters

### Network Protocol Stacks (L760-1358)
- Netlink message structures (L760-776)
- Network interface structures (L787-798)
- TLS/SSL crypto information (L906-973)
- Wireless extensions (L977-1101)
- XDP (eXpress Data Path) structures (L1227-1312)

## Architecture-Specific Handling

### Conditional Compilation (L54-75, L366-401)
Uses `cfg_if!` macro for platform-specific definitions:
- SPARC64 exclusions for certain ELF types
- Target environment differences (GNU vs musl vs uClibc)
- Endianness-specific field ordering

### Function Bindings Organization (L5986-6827)
Extensive `extern "C"` blocks with conditional compilation:
- Platform-specific exclusions for uClibc, OHOS
- LFS64 (Large File Support) variants for non-musl targets
- GNU-specific function name mangling for time64 support

## Critical Constants and Macros

### Kernel Constants (L2139-5850)
Comprehensive constant definitions including:
- Error codes (EPERM, ENOENT, etc.)
- Socket options and flags
- File system flags and mount options
- Network protocol constants
- Security and capability flags
- Scheduler policies and flags

### Helper Functions (L5773-5984)
Important utility functions as `f!` and `safe_f!` macros:
- `CMSG_NXTHDR` (L5778): Control message iteration
- `CPU_*` functions (L5793-5837): CPU set manipulation
- ELF manipulation macros (L5922-5944)
- Device major/minor number handling (L5948-5971)

## Dependencies and Integration

### Internal Dependencies (L3-4)
- `crate::prelude::*`: Core libc types and macros
- Specific imports for socket filters and ioctl macros

### Modular Architecture (L6816-6829)
Conditionally includes target-specific modules:
- `uclibc`, `musl`, `gnu` modules for different C library implementations  
- `arch` module for architecture-specific definitions

## Notable Patterns

### Safety and Compatibility
- Extensive use of `#[cfg_attr]` for symbol name mangling
- Careful handling of 32/64-bit differences
- Time64 support for year 2038 compliance
- Deprecated types with migration guidance (L194-199, L1443-1449)

### ABI Stability
- Structure alignment attributes for binary compatibility
- Careful padding and reserved fields
- Version-specific constant definitions

This module represents a critical bridge between Rust and the Linux kernel/userspace ABI, requiring extreme care for binary compatibility and cross-platform support.