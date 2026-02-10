# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/aarch64/mod.rs
@source-hash: 9bfab4e70363d559
@generated: 2026-02-09T17:57:19Z

This file provides AArch64-specific type definitions and constants for 64-bit GNU Linux systems within the libc crate. It serves as the platform-specific layer that defines system interface types and constants that match the kernel ABI.

## Primary Purpose
Defines AArch64-specific system types, structures, and constants for interfacing with the Linux kernel on 64-bit ARM systems. This includes file operations, process management, signals, memory management, and system calls.

## Key Type Definitions (L6-11)
- `wchar_t = u32`: Wide character type
- `nlink_t = u32`: Number of hard links
- `blksize_t = i32`: Block size type
- `suseconds_t = i64`: Microseconds type for time operations
- `__u64 = c_ulonglong`, `__s64 = c_longlong`: 64-bit integer types

## Core System Structures

### Signal Handling (L16-23)
- `sigaction`: Signal action structure with function pointer, mask, flags, and optional restorer

### File System Structures (L25-114)
- `statfs` (L25-39): File system statistics
- `stat` (L57-77): File metadata with timestamps and size info
- `stat64` (L79-99): 64-bit version for large files
- `statfs64` (L101-114): 64-bit file system statistics
- `statvfs` (L116-129), `statvfs64` (L131-144): POSIX file system info

### File Locking (L41-55)
- `flock` (L41-47): File locking structure
- `flock64` (L49-55): 64-bit file locking for large offsets

### Process and Thread Management
- `pthread_attr_t` (L146-148): Thread attributes
- `clone_args` (L229-241): Arguments for clone3 system call

### Architecture-Specific Structures
- `user_regs_struct` (L150-155): AArch64 register state with 31 general registers, stack pointer, program counter, and processor state
- `mcontext_t` (L213-220): Machine context with 16-byte alignment, fault address, registers, and reserved space
- `user_fpsimd_struct` (L222-226): Floating-point/SIMD register state

### Signal and Context Management
- `siginfo_t` (L183-196): Signal information with deprecated padding field
- `stack_t` (L198-202): Signal stack structure
- `ucontext_t` (L204-210): User context for signal handling

### IPC Structures
- `ipc_perm` (L157-168): IPC permissions
- `shmid_ds` (L170-181): Shared memory segment descriptor

## Constants and System Call Numbers

### File Operations (L257-268, L396-397, L422-424)
- File open flags: `O_APPEND`, `O_CREAT`, `O_EXCL`, etc.
- File control: `F_GETLK`, `F_SETLK`, `F_SETLKW` (L403-407)

### Error Codes (L273-355)
Comprehensive errno definitions from `EUCLEAN` (117) to `ERFKILL` (132)

### Signal Constants (L363-391)
- Signal actions: `SA_ONSTACK`, `SA_SIGINFO`, `SA_NOCLDWAIT`
- Signal numbers: `SIGTTIN` (21) through `SIGPWR` (30)
- Signal mask operations: `SIG_SETMASK`, `SIG_BLOCK`, `SIG_UNBLOCK`

### Memory Protection (L946-947)
AArch64-specific memory protection flags:
- `PROT_BTI = 0x10`: Branch Target Identification
- `PROT_MTE = 0x20`: Memory Tagging Extension

### Hardware Capabilities (L573-604)
AArch64 hardware capability flags for CPU feature detection (HWCAP_*)

### System Call Table (L641-944)
Complete mapping of system call numbers to names, from `SYS_io_setup` (0) to `SYS_mseal` (462)

## External Functions (L950-962)
- `sysctl`: System control interface
- Context manipulation functions: `getcontext`, `setcontext`, `makecontext`, `swapcontext`

## Architecture Conditional Compilation (L965-972)
Uses `cfg_if!` to conditionally include either 32-bit (ilp32) or 64-bit (lp64) specific definitions based on pointer width.

## Dependencies
- Imports from crate prelude and specific types (`off64_t`, `off_t`) from parent modules
- Relies on C type definitions from libc