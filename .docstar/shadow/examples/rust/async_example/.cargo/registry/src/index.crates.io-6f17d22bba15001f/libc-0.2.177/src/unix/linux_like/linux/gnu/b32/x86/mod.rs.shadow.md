# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/x86/mod.rs
@source-hash: ce42dc6c6b620f89
@generated: 2026-02-09T17:57:11Z

## Platform-Specific Type and Constant Definitions for 32-bit x86 Linux GNU

This module provides x86-specific (32-bit) Linux system type definitions and constants for the GNU C library (glibc) variant. It's part of the Rust `libc` crate's platform abstraction layer.

### Primary Purpose
- Defines C-compatible types and structures specific to 32-bit x86 Linux with GNU libc
- Provides system call numbers and platform-specific constants
- Enables FFI (Foreign Function Interface) compatibility with C system libraries

### Key Type Definitions

**Basic Types (L4-5)**
- `wchar_t`: Wide character type as `i32` 
- `greg_t`: General register type as `i32`

**Core System Structures (L7-261)**
- `sigaction` (L10-15): Signal handling configuration with restorer function pointer
- `statfs`/`statfs64` (L17-32, L171-184): Filesystem statistics with 32/64-bit variants
- `flock`/`flock64` (L34-48): File locking structures for different offset sizes
- `stat64` (L137-169): Extended file status with conditional compilation for time bits
- `user_regs_struct` (L78-96): x86 CPU register state for debugging/ptrace
- `user` (L98-114): Complete user process state including registers and memory layout
- `mcontext_t` (L116-121): Machine context for signal handling with 19 general registers
- `ucontext_t` (L280-288): User context including stack, signals, and machine context

**Advanced Structures**
- `user_fpxregs_struct` (L264-278): Extended floating-point registers with custom trait implementations (L298-334)
- IPC structures: `ipc_perm` (L123-135), `shmid_ds` (L202-219), `msqid_ds` (L221-239)
- `siginfo_t` (L241-254): Signal information with deprecated padding field

### Architecture-Specific Constants

**File Operations (L362-381)**
- File flags: `O_DIRECT`, `O_LARGEFILE`, etc.
- Memory mapping: `MAP_32BIT`, `MAP_HUGETLB`, etc.

**Error Codes (L397-480)**
- Extended error numbers specific to Linux (e.g., `EDEADLOCK=35`, `EHWPOISON=133`)

**Signal Constants (L482-540)**
- Signal handling flags and signal numbers
- Stack sizes: `SIGSTKSZ=8192`, `MINSIGSTKSZ=2048`

**Terminal I/O (L540-636)**
- Baud rates from B0 to B4000000
- Terminal control flags and character indices

**System Call Numbers (L639-1051)**
- Complete x86 syscall table from `SYS_restart_syscall=0` to `SYS_mseal=462`
- Includes deprecated syscalls with proper annotations

**Register Offsets (L1054-1091)**
- `user_regs_struct` field offsets (EBX=0, EAX=6, etc.)
- `mcontext_t.gregs` array indices (REG_GS=0, REG_EAX=11, etc.)

### External Functions (L1093-1098)
- Context manipulation: `getcontext`, `setcontext`, `makecontext`, `swapcontext`

### Dependencies
- Uses `crate::prelude::*` and specific offset types (`off64_t`, `off_t`)
- Conditional compilation based on `gnu_time_bits64` and `gnu_file_offset_bits64` features
- Trait implementations gated behind `extra_traits` feature