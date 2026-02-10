# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b32/mips/mod.rs
@source-hash: 12c57cfa8eae992b
@generated: 2026-02-09T17:57:19Z

This file provides MIPS 32-bit architecture-specific definitions for musl libc on Linux. It serves as a platform adaptation layer, defining system call numbers, constants, and data structures that match the MIPS32/Linux kernel ABI.

## Primary Purpose
Defines MIPS32-specific types, structures, constants, and system call numbers for the libc crate, enabling Rust programs to interface with the Linux kernel on MIPS architectures.

## Key Type Definitions
- `wchar_t` (L4): Maps to `c_int` for MIPS32
- `max_align_t` (L149-154): 8-byte aligned structure using `f32` array for maximum alignment requirements

## Core System Structures
All structures use the `s!` macro for C-compatible layout:

- `stat` (L7-28): Standard file metadata structure with MIPS-specific field ordering and padding
- `stat64` (L30-51): 64-bit version using `ino64_t` and `blkcnt64_t` for large file support
- `stack_t` (L53-57): Signal stack configuration
- `ipc_perm` (L59-77): IPC permissions with conditional field naming based on musl version
- `shmid_ds` (L79-90): Shared memory segment descriptor
- `msqid_ds` (L92-116): Message queue descriptor with endian-specific field placement
- `statfs`/`statfs64` (L118-146): Filesystem statistics structures

## Architecture Constants
Signal and memory management constants (L156-254):
- Stack sizes: `SIGSTKSZ` (8192), `MINSIGSTKSZ` (2048)
- File operation flags: `O_DIRECT`, `O_DIRECTORY`, `O_LARGEFILE`, etc.
- Memory control: `MCL_CURRENT`, `MCL_FUTURE`, `MCL_ONFAULT`
- Memory mapping flags: `MAP_ANON`, `MAP_GROWSDOWN`, `MAP_HUGETLB`, etc.

Terminal control constants (L168-233):
- Baud rates from `B57600` to `B4000000`
- Terminal flags: `CBAUD`, `CSIZE`, `PARENB`, etc.
- Control characters: `VWERASE`, `VREPRINT`, `VSUSP`, etc.

## Error Codes
Comprehensive POSIX error constants (L255-339) including:
- Standard errors: `EDEADLK`, `ENOLCK`, `ENOSYS`
- Network errors: `ENOTSOCK`, `EADDRINUSE`, `ECONNREFUSED`
- Extended errors: `ENOKEY`, `EKEYEXPIRED`, `ERFKILL`

## Socket and Signal Constants
- Socket types: `SOCK_STREAM` (2), `SOCK_DGRAM` (1) - Note the non-standard values
- Signal handling: `SA_ONSTACK`, `SA_SIGINFO`, `SA_NOCLDWAIT`
- Signal numbers: `SIGCHLD`, `SIGBUS`, `SIGUSR1`, etc.

## System Call Numbers
Extensive system call definitions (L392-775) following MIPS convention:
- Base offset: 4000 for all syscalls
- Traditional calls: `SYS_read` (4003), `SYS_write` (4004), `SYS_open` (4005)
- Modern calls: `SYS_openat2` (4437), `SYS_pidfd_getfd` (4438)
- Recent additions: `SYS_landlock_*`, `SYS_futex_waitv`, `SYS_set_mempolicy_home_node`

## Platform-Specific Features
- Conditional compilation based on musl version (`musl_v1_2_3`)
- Endian-specific struct field ordering in `msqid_ds`
- MIPS-specific syscalls: `SYS_cacheflush`, `SYS_cachectl`, `SYS_sysmips`
- Deprecated syscalls marked for removal in newer kernels

## Dependencies
- `crate::off_t`, `crate::prelude::*` (L1-2)
- Extensive use of crate-defined types (`dev_t`, `ino_t`, `mode_t`, etc.)