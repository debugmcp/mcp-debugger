# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/riscv64/mod.rs
@source-hash: cd5b8088ddb38bbe
@generated: 2026-02-09T17:57:19Z

## Purpose

RISC-V 64-bit architecture-specific bindings for the libc crate, targeting Linux GNU systems. This module defines platform-specific data structures, constants, and system call numbers that match the ABI for RISC-V 64-bit processors on Linux.

## Key Components

### Type Definitions (L6-14)
- `wchar_t`, `nlink_t`, `blksize_t`: Basic type aliases mapped to appropriate C types
- `fsblkcnt64_t`, `fsfilcnt64_t`: 64-bit filesystem block/file count types using `c_ulong`
- `suseconds_t`: Microsecond timing type as `i64`
- `__u64`, `__s64`: Kernel-level 64-bit signed/unsigned types

### Core System Structures (L16-247)

**Threading & Process Control:**
- `pthread_attr_t` (L17-19): Thread attribute structure with 7 `c_ulong` elements
- `siginfo_t` (L125-138): Signal information with deprecated `_pad` field and alignment
- `sigaction` (L148-153): Signal handler configuration with RISC-V-specific layout
- `stack_t` (L140-144): Signal stack specification

**File System Operations:**
- `stat` (L21-41) / `stat64` (L43-63): File metadata structures, differing in inode and size field types (`off_t` vs `off64_t`)
- `statfs` (L65-78) / `statfs64` (L80-93): Filesystem statistics with 32-bit vs 64-bit block counts
- `statvfs` (L95-108) / `statvfs64` (L110-123): POSIX filesystem information structures
- `flock` (L182-188) / `flock64` (L190-196): File locking structures with different offset types

**IPC & Memory Management:**
- `ipc_perm` (L155-167): System V IPC permissions structure
- `shmid_ds` (L169-180): Shared memory segment descriptor
- `clone_args` (L234-246): Modern process cloning arguments with 8-byte alignment

### RISC-V Architecture Specifics (L249-286)

**Context Management:**
- `ucontext_t` (L250-256): User context for signal handling
- `mcontext_t` (L259-262): Machine context with 32 general registers and floating-point state, 16-byte aligned
- `user_regs_struct` (L198-231): Complete RISC-V register set (pc, ra, sp, gp, tp, t0-t6, s0-s11, a0-a7)

**Floating-Point State Union:**
- `__riscv_mc_fp_state` (L264-268): Union supporting F, D, and Q extensions
- `__riscv_mc_f_ext_state` (L270-273): 32-bit float registers + FCSR
- `__riscv_mc_d_ext_state` (L275-278): 64-bit double registers + FCSR  
- `__riscv_mc_q_ext_state` (L281-285): 128-bit quad registers + FCSR, 16-byte aligned

### Constants & System Calls (L288-910)

**File Operations (L288-305):** POSIX advisory flags, RTLD loader flags, O_* file access modes
**Error Codes (L308-385):** Linux-specific errno values for RISC-V
**Signal Handling (L387-414):** Socket types, signal action flags, signal numbers
**Memory Management (L466-476):** MAP_* flags for mmap operations
**Hardware Capabilities (L599-606):** RISC-V ISA extension detection bits (I, M, A, F, D, C, V)
**System Call Numbers (L608-910):** Complete mapping of Linux system calls to RISC-V 64-bit syscall numbers

## Dependencies

- `crate::prelude::*`: Core libc prelude types
- `crate::{off64_t, off_t}`: File offset types from parent modules
- Various `crate::*` types: References to common libc types defined elsewhere

## Architecture Notes

- Assumes 64-bit pointers and `c_ulong` types
- RISC-V register naming follows standard ABI conventions
- Floating-point state supports F/D/Q extensions via union
- System call numbers follow the standard Linux RISC-V 64-bit ABI
- Memory alignment requirements are explicitly specified where critical (16-byte for quad-precision FP)