# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/powerpc.rs
@source-hash: 7c3b9aad88564085
@generated: 2026-02-09T17:57:05Z

**PowerPC 32-bit GNU libc Architecture-Specific Bindings**

This file provides low-level system interface definitions for PowerPC 32-bit systems running Linux with GNU libc. It contains architecture and ABI-specific type definitions, constants, and system call numbers required for system programming.

**Core Type Definitions**

The file defines several critical system data structures using the `s!` macro:

- `wchar_t` (L4): Defined as `i32` for PowerPC 32-bit
- `sigaction` (L9-14): Signal handler structure with function pointer, mask, flags, and optional restorer
- `statfs` / `statfs64` (L16-31, L126-139): Filesystem statistics structures with conditional 64-bit variants
- `flock` / `flock64` (L33-47): File locking structures for both 32-bit and 64-bit file offsets
- `ipc_perm` (L49-60): Inter-process communication permissions structure
- `stat` / `stat64` (L62-124): File metadata structures with extensive conditional compilation for different time/offset configurations
- `statvfs64` (L141-155): Extended filesystem statistics
- `shmid_ds` / `msqid_ds` (L157-199): Shared memory and message queue descriptor structures
- `siginfo_t` (L201-214): Signal information structure with deprecated padding field
- `stack_t` (L216-220): Signal stack structure

**Key Architectural Features**

The structures extensively use conditional compilation (`#[cfg]`) to handle:
- `gnu_file_offset_bits64`: Large file support toggling between 32/64-bit offsets
- `gnu_time_bits64`: 64-bit time support with padding adjustments

**System Constants**

Comprehensive constant definitions include:
- File operation flags (L223-244): `O_DIRECT`, `O_LARGEFILE`, etc.
- Memory mapping flags (L246-258): `MAP_LOCKED`, `MAP_HUGETLB`, etc.  
- Error codes (L260-343): Complete errno value mappings for PowerPC
- Signal handling constants (L345-397): Signal numbers and flags
- Terminal control constants (L398-489): Baud rates, control flags, etc.

**System Call Numbers**

Extensive system call number definitions (L491-892) covering:
- Basic system calls: `SYS_read`, `SYS_write`, `SYS_open` (L494-496)
- Process management: `SYS_fork`, `SYS_execve`, `SYS_exit` (L493, L502, L492)
- Modern syscalls: `SYS_io_uring_setup`, `SYS_landlock_*` (L866, L885-887)
- Architecture-specific: `SYS_switch_endian`, `SYS_subpage_prot` (L855, L802)

**Dependencies**

Imports from parent crate modules:
- `crate::prelude::*` (L1): Common type definitions
- `crate::{off64_t, off_t}` (L2): File offset types

**Critical Notes**

- Contains deprecated elements: `siginfo_t._pad` field (L206-212) and `SIGUNUSED` constant (L382-383)
- Some syscalls marked deprecated for kernels 2.6+ (L618-623, L659-660)
- Architecture-specific PowerPC syscalls like `SYS_multiplexer` and `SYS_rtas` included