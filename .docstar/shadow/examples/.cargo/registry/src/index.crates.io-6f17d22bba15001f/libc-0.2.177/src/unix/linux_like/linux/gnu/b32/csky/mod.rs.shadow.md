# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/csky/mod.rs
@source-hash: 8fdab3a121a111b9
@generated: 2026-02-09T17:57:07Z

## C-Sky Architecture Platform Constants and Structures

This module provides platform-specific constants and data structures for the C-Sky architecture on Linux GNU systems (32-bit). It is part of the libc crate's architecture-specific bindings for system programming.

### Primary Components

**Type Definitions** (L4):
- `wchar_t` defined as `u32` for C-Sky architecture

**Core System Structures** (L6-175):
- `sigaction` (L9-14): Signal handling structure with function pointer, mask, flags, and optional restorer
- `statfs` (L16-30): File system statistics with block counts, sizes, and metadata  
- `flock`/`flock64` (L32-46): File locking structures for 32-bit and 64-bit offset types
- `ipc_perm` (L48-60): Inter-process communication permissions structure
- `stat64` (L62-82): Extended file status information with 64-bit fields
- `statfs64` (L84-97): 64-bit file system statistics
- `statvfs64` (L99-113): POSIX-style 64-bit file system information
- `shmid_ds` (L115-129): Shared memory segment descriptor
- `msqid_ds` (L131-146): Message queue descriptor
- `siginfo_t` (L148-161): Signal information structure with deprecated padding field
- `stack_t` (L163-167): Signal stack definition
- `max_align_t` (L171-174): Maximum alignment type (8-byte aligned)

**Platform Constants**:
- RTLD dynamic loading flags (L178-180)
- File operation flags (O_* constants, L181-195)
- Memory mapping constants (MAP_*, L197-209)
- Error codes (E* constants, L211-294)
- Signal handling constants (SA_*, L296-297)
- Socket types (L299-300)
- Memory locking flags (MCL_*, L302-304)
- Poll events (L306-307)
- File control operations (F_*, L309-311)
- Event/signal file descriptor flags (L313-314)
- Signal numbers (L316-342)
- Terminal I/O constants (L343-435)
- Baud rates (B*, L395-427)
- Terminal control modes (L437-439)

**System Call Numbers** (L441-745):
Complete mapping of system call numbers for C-Sky architecture, including:
- Basic I/O operations (SYS_read, SYS_write, etc.)
- Memory management (SYS_mmap, SYS_brk, etc.)
- Process control (SYS_clone, SYS_execve, etc.)
- Signal handling (SYS_rt_sigaction, etc.)
- File operations (SYS_openat, SYS_fstat, etc.)
- Modern syscalls (SYS_io_uring_*, SYS_landlock_*, etc.)

### Dependencies
- Imports `prelude::*` and `{off64_t, off_t}` from parent crate
- References numerous crate-level type definitions (sighandler_t, pid_t, etc.)

### Notable Patterns
- Uses `s!` macro for structure definitions with automatic trait derivation
- Uses `s_no_extra_traits!` for `max_align_t` to control trait implementation
- Extensive use of octal notation for traditional Unix constants
- Platform-specific syscall numbering scheme for C-Sky architecture