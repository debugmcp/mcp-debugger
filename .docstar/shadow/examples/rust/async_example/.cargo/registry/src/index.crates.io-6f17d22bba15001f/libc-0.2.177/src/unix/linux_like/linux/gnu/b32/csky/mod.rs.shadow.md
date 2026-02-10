# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/csky/mod.rs
@source-hash: 8fdab3a121a111b9
@generated: 2026-02-09T17:57:09Z

## Purpose

C Sky (CSKY) architecture-specific bindings for 32-bit GNU/Linux systems within the libc crate. This module provides type definitions, constants, and system call numbers that are specific to the CSKY processor architecture running on Linux with GNU libc.

## Key Types and Structures

### Core System Types
- **wchar_t** (L4): Wide character type defined as u32 for CSKY
- **sigaction** (L9-14): Signal handling structure with function pointer, mask, flags, and optional restorer
- **max_align_t** (L172-174): 8-byte aligned type for maximum alignment requirements

### File System Structures
- **statfs** (L16-30): File system statistics with block counts, inode counts, and filesystem metadata
- **statfs64** (L84-97): 64-bit version of statfs with extended field sizes
- **statvfs64** (L99-113): POSIX-compliant filesystem statistics structure
- **stat64** (L62-82): Extended file status structure with 64-bit fields for large files
- **flock/flock64** (L32-46): File locking structures for 32-bit and 64-bit offset types

### IPC Structures
- **ipc_perm** (L48-60): IPC permissions structure with user/group IDs and access modes
- **shmid_ds** (L115-129): Shared memory segment descriptor
- **msqid_ds** (L131-146): Message queue descriptor with timing and capacity information

### Signal Handling
- **siginfo_t** (L148-161): Signal information structure with deprecated padding field
- **stack_t** (L163-167): Signal stack descriptor

## Constants and Flags

### File Operations (L177-195)
- Terminal control: VEOF, RTLD_* flags
- File flags: O_DIRECT, O_DIRECTORY, O_LARGEFILE, O_APPEND, etc.

### Memory Management (L197-209)
- Memory advice: MADV_SOFT_OFFLINE
- Memory mapping: MAP_LOCKED, MAP_NORESERVE, MAP_ANON, MAP_POPULATE, etc.

### Error Codes (L211-294)
Comprehensive errno definitions including network errors (EDEADLOCK, ECONNREFUSED, etc.) and filesystem errors (ESTALE, EDQUOT, etc.)

### Signal Constants (L316-342)
- Signal numbers: SIGCHLD, SIGBUS, SIGUSR1/2, SIGCONT, etc.
- Signal handling: SA_SIGINFO, SIG_SETMASK, SIG_BLOCK
- Stack sizes: SIGSTKSZ (8192), MINSIGSTKSZ (2048)

### Terminal Control (L343-439)
- Baud rates: B0 through B4000000
- Control flags: CBAUD, TAB1-3, CR1-3, terminal discipline flags
- Character handling: VWERASE, VREPRINT, VSUSP, etc.

### System Call Numbers (L441-745)
Complete system call table for CSKY architecture including:
- Basic I/O: SYS_read, SYS_write, SYS_close
- Memory management: SYS_mmap, SYS_munmap, SYS_brk
- Process control: SYS_clone, SYS_execve, SYS_exit
- Modern syscalls: SYS_io_uring_*, SYS_pidfd_*, SYS_landlock_*

## Dependencies

- Imports `crate::prelude::*` and `crate::{off64_t, off_t}` (L1-2)
- Uses libc primitive types throughout (c_int, c_long, size_t, etc.)
- References crate-internal types (sighandler_t, fsblkcnt_t, pid_t, etc.)

## Architecture Notes

- Designed specifically for 32-bit CSKY processors
- Uses s! macro for structure definitions (indicating shared struct definitions)
- Uses s_no_extra_traits! for max_align_t to avoid automatic trait derivation
- Follows GNU libc conventions and layouts