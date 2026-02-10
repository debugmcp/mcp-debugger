# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/arm/mod.rs
@source-hash: 0ab9b524f4e4182e
@generated: 2026-02-09T17:57:08Z

**File Purpose:** ARM 32-bit GNU/Linux-specific C type definitions and constants for the libc crate. This module provides low-level system interface bindings specifically tailored for 32-bit ARM processors running GNU/Linux systems.

**Dependencies:**
- `crate::prelude::*` (L1) - Core libc prelude
- `crate::{off64_t, off_t}` (L2) - File offset types

**Key Type Definitions:**

**Basic Types:**
- `wchar_t = u32` (L4) - Wide character type for ARM32

**System Structures:**
- `sigaction` (L9-14) - Signal handling configuration with ARM-specific restorer function pointer
- `statfs` (L16-31) - File system statistics structure  
- `statfs64` (L97-110) - 64-bit file system statistics
- `flock`/`flock64` (L33-47) - File locking structures with 32/64-bit offset variants
- `ipc_perm` (L49-61) - IPC permissions structure
- `stat64` (L63-95) - Extended file status with conditional fields based on `gnu_time_bits64` feature
- `shmid_ds` (L128-145) - Shared memory segment descriptor  
- `msqid_ds` (L147-165) - Message queue descriptor

**Signal/Context Structures:**
- `siginfo_t` (L167-180) - Signal information with deprecated `_pad` field
- `stack_t` (L182-186) - Signal stack configuration
- `mcontext_t` (L188-210) - Machine context with ARM register layout (r0-r10, fp, ip, sp, lr, pc, cpsr)
- `user_regs` (L212-231) - User register set for debugging/ptrace
- `ucontext_t` (L241-248) - User context with 8-byte alignment and 128-word register space

**Special Alignment Types:**
- `max_align_t` (L236-238) - Maximum alignment type (8-byte aligned)

**Conditional Trait Implementations:**
- Manual `PartialEq`, `Eq`, and `Hash` for `ucontext_t` (L253-271) when `extra_traits` feature enabled, excludes `uc_regspace` from comparisons

**Constants Groups:**

**File Operations:** (L275-293)
- `VEOF`, `O_*` flags including `O_LARGEFILE`, `O_DIRECT`, `O_DIRECTORY`

**Memory Management:** (L295-307)  
- `MADV_*`, `MAP_*` constants including ARM-specific `MAP_GROWSDOWN`

**Error Codes:** (L309-392)
- Comprehensive errno definitions from `EDEADLOCK` to `ERFKILL`

**Signal Constants:** (L394-446)
- Signal action flags, signal numbers, stack sizes (`SIGSTKSZ=8192`, `MINSIGSTKSZ=2048`)

**Terminal I/O:** (L447-543)
- Terminal control flags, baud rates (B0 to B4000000), and termios constants

**System Call Table:** (L546-928)
- Complete ARM32 syscall numbers from `SYS_restart_syscall=0` to `SYS_mseal=462`

**Architecture-Specific Notes:**
- ARM register naming convention (arm_r0, arm_r1, etc.)
- 32-bit specific syscalls and structures
- Conditional compilation based on GNU libc features (`gnu_time_bits64`, `gnu_file_offset_bits64`)
- 8-byte alignment requirements for context structures