# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/riscv32/mod.rs
@source-hash: 4bdfd096759a489c
@generated: 2026-02-09T17:57:11Z

**RISC-V 32-bit Linux System Definitions Module**

This module provides RISC-V-specific C FFI definitions for 32-bit Linux systems within the libc crate. It serves as a platform-specific layer defining system structures, constants, and syscall numbers that match the Linux ABI for RISC-V 32-bit architecture.

## Key Dependencies (L3-4)
- `crate::prelude::*` - Core libc types and macros
- `crate::{off64_t, off_t}` - File offset types

## Type Definitions

### Core Types (L6)
- `wchar_t = c_int` - Wide character type for RISC-V 32-bit

### System Structures (L8-197)
Defined using the `s!` macro for C-compatible struct layout:

- **`msqid_ds` (L9-21)** - Message queue descriptor with IPC permissions, timestamps, and metadata
- **`stat64` (L23-43)** - 64-bit file statistics structure with device info, size, timestamps, and nanosecond precision
- **`statfs/statfs64` (L45-73)** - Filesystem statistics structures for both 32-bit and 64-bit block counts
- **`statvfs64` (L75-88)** - POSIX filesystem statistics with 64-bit counters
- **`siginfo_t` (L90-103)** - Signal information structure with deprecated `_pad` field and alignment
- **`stack_t` (L105-109)** - Signal stack descriptor
- **`sigaction` (L113-118)** - Signal action handler structure with function pointers
- **`ipc_perm` (L120-132)** - IPC permissions structure
- **`shmid_ds` (L134-145)** - Shared memory descriptor
- **`flock/flock64` (L147-161)** - File locking structures for 32-bit and 64-bit offsets
- **`user_regs_struct` (L163-196)** - RISC-V register set for debugging/ptrace (32 registers: pc, ra, sp, gp, tp, t0-t6, s0-s11, a0-a7)

### Architecture Context Structures (L199-236)
Defined using `s_no_extra_traits!` macro (no derived traits):

- **`ucontext_t` (L200-206)** - User context for signal handling
- **`mcontext_t` (L209-212)** - Machine context with 16-byte alignment, containing general registers and floating-point state
- **`__riscv_mc_fp_state` (L214-218)** - Union for different RISC-V floating-point extensions
- **`__riscv_mc_f_ext_state` (L220-223)** - Single-precision floating-point state
- **`__riscv_mc_d_ext_state` (L225-228)** - Double-precision floating-point state  
- **`__riscv_mc_q_ext_state` (L231-235)** - Quad-precision floating-point state with 16-byte alignment

## Constants

### File Operations (L238-377)
- File flags (`O_LARGEFILE`, `O_APPEND`, etc.)
- Runtime linker flags (`RTLD_*`)
- Memory mapping flags (`MAP_*`)
- Error codes (`EDEADLK`, `ENAMETOOLONG`, etc.)

### Signal Handling (L333-359)
- Socket types and signal action flags
- Signal numbers (`SIGTTIN`, `SIGTTOU`, etc.)
- Signal masks (`SIG_SETMASK`, `SIG_BLOCK`, `SIG_UNBLOCK`)

### Terminal I/O (L360-504)
- Terminal control flags and baud rates
- Character control indices (`VEOF`, `VMIN`, etc.)
- Pthread size constants for mutexes, barriers, etc.

### Register Definitions (L495-504)
- `NGREG = 32` - Number of general registers
- Register indices (`REG_PC`, `REG_RA`, `REG_SP`, etc.)

### System Call Numbers (L506-808)
Comprehensive mapping of Linux system calls to their RISC-V 32-bit numbers, including:
- Basic I/O (`SYS_read`, `SYS_write`, etc.)
- Process management (`SYS_clone`, `SYS_execve`, etc.)  
- Memory management (`SYS_mmap`, `SYS_brk`, etc.)
- Modern syscalls (`SYS_io_uring_*`, `SYS_landlock_*`, etc.)

## Architectural Notes
- RISC-V 32-bit specific register layout in `user_regs_struct`
- Floating-point context supports F, D, and Q extensions
- Alignment requirements enforced for machine context structures
- Syscall numbers match the RISC-V Linux ABI specification