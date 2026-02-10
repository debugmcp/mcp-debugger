# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/riscv32/mod.rs
@source-hash: 4bdfd096759a489c
@generated: 2026-02-09T17:57:06Z

## RISC-V 32-bit Linux GNU Platform Bindings

This file provides RISC-V-specific type definitions and constants for 32-bit Linux systems using GNU libc. Part of the `libc` crate's platform-specific abstraction layer.

### Core Purpose
- Defines platform-specific data structures and constants for RISC-V 32-bit Linux
- Provides C ABI compatibility for system calls and data structures
- Serves as the foundational layer for low-level system programming on RISC-V

### Dependencies
- `crate::prelude::*` - Common libc types and macros
- `crate::{off64_t, off_t}` - File offset types

### Key Type Definitions

**Basic Types:**
- `wchar_t` (L6) - Wide character type aliased to `c_int`

**IPC Structures:**
- `msqid_ds` (L9-21) - Message queue descriptor with timestamps and metadata
- `ipc_perm` (L120-132) - IPC permissions structure with user/group IDs
- `shmid_ds` (L134-145) - Shared memory descriptor with size and timestamps

**File System Structures:**
- `stat64` (L23-43) - 64-bit file status structure with extended attributes
- `statfs`/`statfs64` (L45-73) - File system statistics (32-bit and 64-bit variants)
- `statvfs64` (L75-88) - Extended file system statistics
- `flock`/`flock64` (L147-161) - File locking structures

**Signal Handling:**
- `siginfo_t` (L90-103) - Signal information with deprecated padding field
- `sigaction` (L113-118) - Signal action structure with function pointers
- `stack_t` (L105-109) - Signal stack configuration

**Context Switching:**
- `ucontext_t` (L200-206) - User context for signal handling (no extra traits)
- `mcontext_t` (L209-212) - Machine context with 16-byte alignment
- `__riscv_mc_fp_state` (L214-218) - Floating-point state union
- RISC-V floating-point extension states (L220-235) - F, D, and Q extensions

**CPU Registers:**
- `user_regs_struct` (L163-196) - Complete RISC-V register set including PC, RA, SP, GP, and all general-purpose registers

### Constants

**File Operations:** O_* flags (L238-251, L362-378) for file opening modes
**Memory Management:** MAP_* flags (L379-389) for memory mapping
**Error Codes:** E* constants (L254-331) for system error numbers  
**Signal Constants:** SIG* values (L333-359) for signal handling
**Terminal Control:** Various tcflag_t constants (L401-491) for terminal I/O
**System Call Numbers:** SYS_* constants (L506-808) mapping to RISC-V system call numbers

### Architecture-Specific Details
- 32-bit RISC-V register layout in `user_regs_struct`
- RISC-V floating-point extension support (F/D/Q)
- Platform-specific pthread structure sizes (L373-375, L492-494)
- RISC-V register access constants (L495-504)

### Critical Notes
- `siginfo_t._pad` field is deprecated since v0.2.54 (L95-101)
- `sigaction` allows unpredictable function pointer comparisons (L112)
- FIXME comment indicates `sigaction` should not implement `PartialEq` (L111)
- Structures in `s_no_extra_traits!` macro don't derive standard traits for performance