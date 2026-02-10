# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/netbsd/mod.rs
@source-hash: 461feb5dc8dddea3
@generated: 2026-02-09T17:57:39Z

# NetBSD System Constants & Types Module

This module defines NetBSD-specific system types, constants, structures, and foreign function declarations for Rust's libc crate. It provides comprehensive bindings for NetBSD system calls and low-level OS functionality.

## Core Type Definitions (L4-20)
- **System types**: `clock_t`, `dev_t`, `idtype_t`, `lwpid_t`, `timer_t` - fundamental OS data types
- **Threading types**: `pthread_spin_t`, `cpuid_t`, `cpuset_t` - threading and CPU management primitives
- **IPC types**: `mqd_t`, `shmatt_t` - message queues and shared memory

## ELF Binary Format Support (L23-60)
- **ELF32/ELF64 types** (L23-37): Complete ELF header type definitions for both 32-bit and 64-bit
- **Conditional ELF aliases** (L50-60): Platform-specific type selection based on pointer width
- **AuxInfo structures** (L499-507): Auxiliary information for dynamic linking

## Signal Information Interface (L62-130)
- **siginfo_t implementation**: Provides safe accessors for signal information fields
- Methods: `si_addr()`, `si_code()`, `si_errno()`, `si_pid()`, `si_uid()`, `si_value()`, `si_status()`
- Uses internal struct casting for field access due to union complexity

## Core System Structures (L132-793)
Key structures include:
- **aiocb** (L133-144): Asynchronous I/O control block
- **stat** (L178-200): File metadata with NetBSD-specific fields like birthtime
- **pthread_mutex_t** (L228-251): Architecture-dependent mutex implementation
- **kevent** (L295-303): Kernel event notification structure
- **kinfo_proc2** (L535-630): Comprehensive process information structure
- **tcp_info** (L751-792): TCP connection state and statistics

## Special Structure Handling (L795-914)
- **s_no_extra_traits!** macro: Structures without automatic trait implementations
- **Complex networking structures**: `sockaddr_storage`, `in_pktinfo`, `dirent`
- **Union types**: Anonymous unions for POSIX spawn and interface configuration

## Trait Implementations (L916-1233)
Conditional `extra_traits` feature implementations:
- **PartialEq, Eq, Hash**: For structures that need comparison/hashing
- **Complex field-by-field comparisons**: Handles arrays and nested structures safely

## System Constants (L1235-2304)
Extensive constant definitions covering:
- **File operations**: `AT_*`, `O_*`, `F_*` flags for file descriptor operations
- **Memory management**: `MAP_*`, `PROT_*` flags for mmap operations
- **Network protocols**: Complete `IPPROTO_*` definitions (L1416-1490)
- **Socket options**: `SO_*`, `IFF_*` network interface flags
- **System call numbers**: `CTL_*`, `KERN_*` for sysctl interface

## Function Declarations (L2396-2977)
Foreign function interfaces organized by library:

### Core C Library Functions (L2396-2772)
- **Time functions**: `clock_nanosleep()`, `ntp_adjtime()` with NetBSD-specific linking
- **Threading**: `pthread_*` functions with NetBSD extensions like `pthread_getname_np()`
- **Memory**: `reallocarr()` - NetBSD-specific secure reallocation
- **Extended attributes**: Complete `extattr_*` API for file metadata
- **Locale support**: `duplocale()`, `newlocale()` for internationalization

### Real-time Library (`librt`) (L2774-2794)
- **AIO functions**: Complete asynchronous I/O API
- **POSIX timers**: Timer creation and management functions

### Utility Library (`libutil`) (L2796-2959)
- **User database**: `getpwent_r()`, `getgrent_r()` for thread-safe user lookups
- **Login records**: `utmpx`, `lastlogx` login tracking functions
- **Error utilities**: `e*` family of error-checking wrapper functions
- **Extended attributes**: Linux-compatible xattr API

### Architecture-Specific Modules (L2979-3007)
Conditional compilation for different CPU architectures:
- Support for aarch64, arm, powerpc, sparc64, x86_64, x86, mips, riscv64
- Architecture-specific constants and type definitions

## Notable Patterns
- **Defensive programming**: Extensive use of `unsafe` markers for system calls
- **Version compatibility**: Link name attributes for symbol versioning (e.g., `__gettimeofday50`)
- **Feature flags**: Conditional compilation based on target architecture and features
- **Safety abstractions**: Helper functions like `SOCKCREDSIZE()` for safe buffer sizing

This module serves as the foundation for NetBSD system programming in Rust, providing type-safe access to low-level OS functionality while maintaining C ABI compatibility.