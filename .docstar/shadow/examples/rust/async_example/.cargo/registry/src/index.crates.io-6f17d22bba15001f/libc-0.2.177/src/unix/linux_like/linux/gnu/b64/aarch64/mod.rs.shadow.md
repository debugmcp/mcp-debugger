# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/aarch64/mod.rs
@source-hash: 9bfab4e70363d559
@generated: 2026-02-09T17:57:13Z

## AArch64-specific System Interface Definitions

This module provides platform-specific type definitions and constants for AArch64 architecture on 64-bit Linux-like systems. Part of the `libc` crate's architecture-specific abstraction layer.

### Core Architecture Types (L6-11)
- `wchar_t = u32`: Wide character type for AArch64
- `nlink_t = u32`: File link count type
- `blksize_t = i32`: Block size type
- `suseconds_t = i64`: Microseconds type for time operations
- `__u64/__s64`: 64-bit unsigned/signed types mapped to C long long

### System Data Structures

**Signal Handling (L16-23)**
- `sigaction`: Signal action descriptor with function pointer, mask, flags, and restorer
- Contains FIXME note about removing `PartialEq` implementation in future version

**File System Structures (L25-144)**
- `statfs/statfs64` (L25-39, L101-114): File system statistics with block counts, sizes, and metadata
- `flock/flock64` (L41-55): File locking structures for advisory locking
- `stat/stat64` (L57-99): File metadata including permissions, ownership, timestamps, and sizes
- `statvfs/statvfs64` (L116-144): POSIX file system information structures

**Process/Thread Context (L146-226)**
- `pthread_attr_t` (L146-148): Thread attribute storage (64 bytes)
- `user_regs_struct` (L150-155): User-space register context for debugging/tracing
- `ucontext_t/mcontext_t` (L204-220): User context and machine context for signal handling
- `user_fpsimd_struct` (L222-226): Floating-point/SIMD register state

**Inter-Process Communication (L157-181)**
- `ipc_perm` (L157-168): IPC permission structure with user/group IDs
- `shmid_ds` (L170-181): Shared memory segment descriptor

**Signal Information (L183-196)**
- `siginfo_t`: Signal information with deprecated `_pad` field (marked since 0.2.54)

**Process Control (L198-241)**
- `stack_t` (L198-202): Signal stack descriptor
- `clone_args` (L229-241): Arguments for clone3 system call with 8-byte alignment
- `max_align_t` (L246-248): Maximum alignment type with 16-byte alignment

### System Constants

**File Operations (L257-268)**
- O_* flags: File open modes (O_APPEND, O_CREAT, O_EXCL, etc.)
- O_TMPFILE combines with O_DIRECTORY

**Memory Management (L270-271, L454-464)**
- MAP_* flags: Memory mapping options
- MADV_* flags: Memory advice operations

**Error Codes (L273-355)**
- Comprehensive errno definitions for AArch64-specific error conditions
- Network, file system, and hardware-specific error codes

**Signal Constants (L367-391)**
- Signal numbers (SIGCHLD=17, SIGBUS=7, etc.)
- Signal action flags (SA_ONSTACK, SA_SIGINFO, etc.)

**Hardware Capabilities (L573-632)**
- HWCAP_* flags: CPU feature detection for AArch64 extensions
- Includes cryptographic, SIMD, and architectural features

**Process Control (L619-638)**
- PR_* constants for prctl() system calls
- AArch64-specific process control operations

**System Call Numbers (L641-944)**
- Complete syscall table for AArch64 Linux
- Maps system call names to numbers (SYS_io_setup=0, SYS_exit=93, etc.)

**Memory Protection (L946-947)**
- PROT_BTI/PROT_MTE: AArch64-specific memory protection flags for security features

### External Functions (L950-962)
- `sysctl()`: System parameter access
- Context manipulation functions: `getcontext`, `setcontext`, `makecontext`, `swapcontext`

### Conditional Compilation (L965-972)
Uses `cfg_if!` to conditionally include either 32-bit (ilp32) or 64-bit (lp64) specific definitions based on target pointer width.

This module serves as the foundation for system programming on AArch64 Linux, providing the necessary types and constants for low-level system interactions, signal handling, file operations, and process management.