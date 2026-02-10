# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/riscv64/mod.rs
@source-hash: cd5b8088ddb38bbe
@generated: 2026-02-09T17:57:12Z

## Purpose
Architecture-specific low-level C bindings for RISC-V 64-bit Linux systems within the libc crate. Provides FFI type definitions, system structures, and constants that match the GNU C library ABI for RISC-V processors.

## Key Dependencies
- `crate::prelude::*` (L3): Core libc type definitions
- `crate::{off64_t, off_t}` (L4): File offset types

## Type Definitions (L6-15)
Essential C primitive type aliases for RISC-V:
- `wchar_t = c_int` (L6): Wide character type
- `nlink_t = c_uint` (L8): Number of hard links
- `blksize_t = c_int` (L9): Block size type
- `fsblkcnt64_t/fsfilcnt64_t = c_ulong` (L10-11): 64-bit filesystem counters
- `suseconds_t = i64` (L12): Microseconds type
- `__u64/__s64` (L13-14): Unsigned/signed 64-bit kernel types

## Core Structures (L16-247)
System structures defined within `s!` macro block:

### Threading & Synchronization
- `pthread_attr_t` (L17-19): Thread attributes with 7 ulong array
- `sigaction` (L148-153): Signal handler configuration with function pointer
- `stack_t` (L140-144): Signal stack descriptor

### File System Operations
- `stat` (L21-41): File status with standard Unix fields, off_t sizes
- `stat64` (L43-63): 64-bit variant using off64_t for large files
- `statfs/statfs64` (L65-93): Filesystem statistics, 64-bit block counters
- `statvfs/statvfs64` (L95-123): VFS statistics with extended attributes
- `flock/flock64` (L182-196): File locking structures

### Process & Signal Handling
- `siginfo_t` (L125-138): Signal information with deprecated _pad field
- `user_regs_struct` (L198-231): RISC-V register state (pc, ra, sp, gp, etc.)
- `clone_args` (L233-246): Process cloning arguments, 8-byte aligned

### IPC Mechanisms
- `ipc_perm` (L155-167): IPC permissions structure
- `shmid_ds` (L169-180): Shared memory segment descriptor

## Context Structures (L249-286)
Defined with `s_no_extra_traits!` macro (no Debug/Clone derivation):
- `ucontext_t` (L250-256): User context for signal handling
- `mcontext_t` (L258-262): Machine context, 16-byte aligned
- `__riscv_mc_fp_state` (L264-268): Union for floating-point state
- Floating-point extension states (L270-285): F, D, Q extensions with different precisions

## System Constants (L288-910)
Extensive constant definitions covering:

### File Operations (L288-306)
POSIX advisory flags, RTLD flags, O_* file open modes

### Memory Management (L306-476)
MADV_* memory advice, MAP_* memory mapping flags

### Error Codes (L308-385)
Complete errno definitions for Linux/RISC-V (EDEADLK through ERFKILL)

### Signal Handling (L387-458)
Socket types, signal action flags, signal numbers, polling constants

### System Calls (L608-910)
Complete system call number mappings (SYS_read=63 through SYS_set_mempolicy_home_node=450)

### RISC-V Specific (L588-607)
Register indices (REG_PC, REG_RA, etc.) and ISA capability flags (COMPAT_HWCAP_ISA_*)

## Architectural Notes
- Uses RISC-V calling convention with specific register naming (ra, sp, gp, tp, etc.)
- Supports F/D/Q floating-point extensions through union types
- 64-bit architecture with c_ulong-based counters
- System call numbers follow RISC-V Linux kernel ABI