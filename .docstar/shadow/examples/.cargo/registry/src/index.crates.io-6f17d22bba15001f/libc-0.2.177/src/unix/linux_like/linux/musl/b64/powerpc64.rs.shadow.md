# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/powerpc64.rs
@source-hash: 03552edded40fccc
@generated: 2026-02-09T17:58:31Z

## Purpose

PowerPC64 architecture-specific type definitions and constants for musl libc on Linux. This file provides low-level system programming interface definitions for 64-bit PowerPC systems using the musl C library.

## Architecture Context

- **Target**: 64-bit PowerPC (powerpc64) architecture
- **C Library**: musl libc
- **Platform**: Linux-like systems
- **Bit Width**: 64-bit (`b64` in path)

## Key Type Definitions (L4-8)

- `wchar_t = i32` - Wide character type (32-bit signed)
- `__u64 = c_ulong`, `__s64 = c_long` - 64-bit unsigned/signed kernel types
- `nlink_t = u64` - File link count (64-bit)
- `blksize_t = c_long` - Block size type

## Core Structures

### termios (L11-20)
Terminal I/O control structure with:
- Control flags (`c_iflag`, `c_oflag`, `c_cflag`, `c_lflag`)
- Control character array `c_cc[NCCS]`
- Line discipline and speed fields

### stat (L22-41) and stat64 (L43-62)
File status structures with standard POSIX fields:
- Device, inode, mode, ownership
- Size, block information
- Timestamps with nanosecond precision
- Key difference: `stat64` uses `ino64_t` and `blkcnt64_t` for large file support

### shmid_ds (L64-74)
System V shared memory segment descriptor with permissions, timestamps, size, and process IDs.

### ipc_perm (L76-94)
IPC permission structure with conditional field naming:
- `__key` (musl v1.2.3+) vs deprecated `__ipc_perm_key`
- Standard uid/gid ownership fields

## Constants Categories

### File Operations (L97-116)
- Memory advice: `MADV_SOFT_OFFLINE`
- Open flags: `O_APPEND`, `O_DIRECT`, `O_LARGEFILE`, etc.
- Sync flags: `O_SYNC`, `O_RSYNC`, `O_DSYNC`

### Error Codes (L118-200)
Comprehensive Linux error constants (`ENAMETOOLONG` through `EHWPOISON`), including:
- File system errors
- Network socket errors  
- System resource errors
- Hardware/kernel errors

### Memory Mapping (L202-212)
`MAP_*` constants for `mmap()` system call options.

### System Call Numbers (L263-668)
Complete PowerPC64 system call table mapping symbolic names to numbers:
- Classic syscalls (0-200): `SYS_restart_syscall` through basic operations
- Extended syscalls (200+): Modern Linux features like epoll, timers, namespaces
- Recent additions: io_uring, landlock, futex improvements

### Signal and Terminal (L220-752)
- Signal handling constants
- Terminal control flags and speeds
- Character device settings

## Notable Patterns

- Extensive use of `crate::` prefixes for type references
- Conditional compilation with `#[cfg(musl_v1_2_3)]`
- Deprecation annotations for obsolete constants and syscalls
- Octal literals for terminal speed constants (L738-752)

## Dependencies

- `crate::off_t` and `crate::prelude::*` imports
- References many types from parent crate modules (`tcflag_t`, `dev_t`, etc.)

## Critical Notes

- Architecture-specific values - not portable to other architectures
- Some constants deprecated due to kernel version changes
- IPC structure field naming changed between musl versions