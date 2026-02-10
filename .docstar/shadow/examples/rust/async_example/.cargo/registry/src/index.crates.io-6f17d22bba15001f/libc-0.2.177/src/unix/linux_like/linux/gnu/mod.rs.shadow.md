# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/mod.rs
@source-hash: 606d323e8aa2c14b
@generated: 2026-02-09T17:57:42Z

## Primary Purpose
This is a GNU libc-specific module within the Rust `libc` crate, providing system call interfaces and data structure definitions for GNU/Linux systems. It serves as the FFI boundary between Rust code and GNU libc system functions.

## Key Type Definitions

### Basic Types (L4-9)
- `pthread_t`, `__priority_which_t`, `__rlimit_resource_t`, `Lmid_t`, `regoff_t`, `__kernel_rwf_t`: Core system types for threading, priorities, resource limits, and kernel operations

### Ioctl Type Configuration (L11-19)
- `Ioctl` type: Conditionally defined based on documentation build context, used for ioctl constant definitions

## Major Structure Categories

### Asynchronous I/O Structures (L22-42, L263-282)
- `aiocb` (L22-42): POSIX async I/O control block with architecture-specific padding
- `iocb` (L263-282): Linux kernel async I/O control block with endian-specific field ordering

### Network and Socket Structures (L67-81, L286-320)
- `msghdr` (L67-75): Socket message header for sendmsg/recvmsg
- `cmsghdr` (L77-81): Control message header for ancillary data
- `tcp_info` (L286-320): TCP connection state information with extensive metrics

### System Information Structures (L110-134, L212-223)
- `mallinfo`/`mallinfo2` (L110-134): Memory allocation statistics (legacy and modern versions)
- `seminfo` (L212-223): Semaphore system limits and parameters

### Process Tracing Structures (L225-261)
- `ptrace_peeksiginfo_args` (L225-229): Arguments for ptrace signal inspection
- `ptrace_syscall_info` (L247-254): System call tracing information
- Multiple anonymous structs for different ptrace operation types

### Time and Terminal Structures (L83-108, L177-186, L343-373)
- `termios` (L83-108): Terminal I/O settings with architecture-specific speed fields
- `ntptimeval` (L177-186): NTP time synchronization data
- `timespec` (L363-373): High-resolution timestamp with complex architecture handling
- `fpos_t`/`fpos64_t` (L348-359): File position with multi-byte character state

### ELF and Binary Format (L199-210)
- `Elf64_Chdr`/`Elf32_Chdr` (L199-210): ELF compression headers for 32/64-bit

## Signal Handling Implementation (L376-458)
- `siginfo_t` methods: `si_addr()`, `si_value()`, `si_pid()`, etc. - unsafe methods to access union fields
- Internal helper structures (`sifields_sigchld`, `sifields`, `siginfo_f`) for safe union field access

## Union Types (L460-510)
- `__c_anonymous_ptrace_syscall_info_data` (L461-465): Union for different ptrace syscall info types
- `utmpx` (L467-509): Login record structure with architecture-specific field layouts

## Constants and Feature Gates

### HugeTLB Memory Management (L577-615)
Constants for huge page size encoding in memory mapping operations

### Process Priority (L617-619)
Priority scope constants (`PRIO_PROCESS`, `PRIO_PGRP`, `PRIO_USER`)

### System Limits and Capabilities (L623-687, L709-792)
- UTMP record size constants
- Locale category masks
- File system constants
- POSIX and system configuration limits

### Kernel Interface Constants (L812-843, L890-929)
- ptrace operation codes
- clone flags for process creation
- keyctl operation and capability flags

## External Function Declarations (L1051-1350)

### Core System Functions
- Memory management: `qsort_r`, `mallopt`, `malloc_*` family
- Network I/O: `sendmmsg`, `recvmmsg`
- Resource limits: `getrlimit64`, `setrlimit64`, `prlimit64`
- Time management: `gettimeofday`, `adjtimex`, `ntp_*` functions

### GNU Extensions
- `backtrace` family for stack tracing
- `glob64` for file pattern matching  
- `reallocarray`, `explicit_bzero` for secure memory operations
- POSIX spawn extensions with `_np` (non-portable) suffixes

### Thread and Process Management
- `pthread_attr_*affinity_np` for CPU affinity
- `pthread_sigqueue` for thread signaling
- `execveat`, `close_range` for process execution and file descriptor management

## Architecture-Specific Modules (L1352-1381)
Conditionally includes either `b32` or `b64` modules based on target architecture pointer width, providing architecture-specific constants and function signatures.

## Key Dependencies
- Imports `off64_t` and prelude types from parent crate modules
- Heavy use of conditional compilation (`cfg_if!`) for cross-platform compatibility
- Links to time64-aware functions when `gnu_time_bits64` feature is enabled