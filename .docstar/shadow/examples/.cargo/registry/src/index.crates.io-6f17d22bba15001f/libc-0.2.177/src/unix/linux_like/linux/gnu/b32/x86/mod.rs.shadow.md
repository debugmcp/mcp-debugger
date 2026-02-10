# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/x86/mod.rs
@source-hash: ce42dc6c6b620f89
@generated: 2026-02-09T17:57:13Z

## Platform-Specific Linux x86 32-bit GNU libc Bindings

This file provides x86 32-bit specific system type definitions and constants for GNU libc on Linux systems. It serves as the lowest level in the libc crate's hierarchical platform organization (unix/linux_like/linux/gnu/b32/x86).

### Core Type Definitions (L4-6)
- `wchar_t` as i32 and `greg_t` as i32 - x86-specific wide character and register types

### Major Structure Groups

**Signal Handling (L7-15)**
- `sigaction` struct with x86-specific layout including `sa_restorer` function pointer
- Contains deprecated FIXME about PartialEq implementation (L8)

**File System Structures (L17-32, L171-200)**
- `statfs` and `statfs64` - file system statistics with x86-specific field sizes
- `statvfs64` - extended file system information (L186-200)
- Uses conditional compilation for 64-bit file offset support

**File Locking (L34-48)**
- `flock` and `flock64` - file locking structures using `off_t` and `off64_t` respectively

**x86 Floating Point State (L50-77)**
- `_libc_fpreg` and `_libc_fpstate` - x87 FPU register state
- `user_fpregs_struct` - user-space FPU registers for debugging/ptrace

**x86 CPU Registers (L78-96)**
- `user_regs_struct` - complete x86 register set (EBX, ECX, EDX, etc.)
- Used for process debugging and system calls

**Process Context (L98-121)**
- `user` struct - complete process state for debugging (L98-114)
- `mcontext_t` - machine context with 19 general registers array (L116-121)

**IPC Structures (L123-239)**
- `ipc_perm` - IPC permissions with x86-specific padding
- `shmid_ds` and `msqid_ds` - shared memory and message queue descriptors
- Conditional time field padding based on `gnu_time_bits64` feature

**Advanced Structures (L263-294)**
- `user_fpxregs_struct` - extended x86 FPU/SSE state (L264-278)
- `ucontext_t` - user context for signal handling (L280-288)
- `max_align_t` - 16-byte aligned type for memory alignment (L291-293)

### Trait Implementations (L296-360)
Custom PartialEq, Eq, and Hash implementations for structures with padding fields, ignoring reserved/padding members during comparison and hashing.

### System Constants

**File Operations (L362-381)**
- File descriptor flags (O_DIRECT, O_LARGEFILE, etc.)
- RTLD dynamic linking constants

**Memory Management (L382-396)**
- Memory mapping flags specific to x86 (MAP_32BIT, MAP_LOCKED, etc.)

**Error Codes (L397-481)**
- Complete x86-specific errno values including Linux extensions

**Signal Constants (L482-539)**
- x86-specific signal numbers and stack sizes
- `SIGSTKSZ: 8192` and `MINSIGSTKSZ: 2048` for x86

**Terminal I/O (L540-632)**
- Comprehensive termios constants and baud rates up to 4Mbps

**System Call Numbers (L638-1051)**
- Complete x86 32-bit syscall table from 0 (restart_syscall) to 462 (mseal)
- Includes deprecated syscalls with version annotations

**Register Offsets (L1053-1091)**
- User register structure offsets and mcontext register indices
- Maps symbolic names to array positions for debugging/ptrace

### External Functions (L1093-1098)
Context switching functions: `getcontext`, `setcontext`, `makecontext`, `swapcontext` for user-level threading.

### Key Dependencies
- Imports `off_t` and `off64_t` from parent module
- Uses extensive conditional compilation for time bits and file offset features
- Relies on crate-level type definitions for portability