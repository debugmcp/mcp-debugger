# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/loongarch64/mod.rs
@source-hash: 294414bcb24a5b59
@generated: 2026-02-09T17:56:59Z

## LoongArch64 Linux System Type Definitions

This file provides platform-specific type definitions and system call constants for 64-bit LoongArch processors running Linux with musl libc. It's part of the hierarchical libc crate organization for Unix-like systems.

### Primary Purpose
- Defines LoongArch64-specific type aliases for standard C types
- Provides system call number constants for the LoongArch64 architecture
- Defines platform-specific structures for file operations, IPC, and process management
- Sets up terminal I/O and file operation constants

### Key Type Definitions

**Basic Type Aliases (L6-11)**
- `wchar_t = c_int` - Wide character type
- `nlink_t = c_uint` - Number of hard links type
- `blksize_t = c_int` - Block size type
- `__u64/__s64` - 64-bit unsigned/signed integers

**Core System Structures (L13-114)**

**File System Structures:**
- `stat` (L14-34) - Standard file metadata structure with nanosecond precision timestamps
- `stat64` (L36-56) - 64-bit version using `ino64_t` and `off64_t` for large file support

**IPC Structure:**
- `ipc_perm` (L58-68) - Inter-process communication permissions structure

**Process/Debug Structures:**
- `user_regs_struct` (L70-76) - User-space register state for debugging/ptrace
- `user_fp_struct` (L78-82) - Floating-point register state
- `ucontext_t` (L84-90) - User context for signal handling
- `mcontext_t` (L92-98) - Machine context with 16-byte alignment
- `clone_args` (L100-113) - Arguments for clone3 system call with 8-byte alignment

**Special Alignment Structure:**
- `max_align_t` (L117-120) - Maximum alignment type with 16-byte alignment, no extra traits

### System Call Constants (L123-429)
Comprehensive mapping of system call names to numbers for LoongArch64, including:
- File operations (io_setup, read, write, etc.)
- Process management (clone, execve, exit, etc.)
- Memory management (mmap, mprotect, etc.)
- Signal handling (rt_sigaction, etc.)
- Network operations (socket, bind, etc.)
- Modern syscalls (io_uring, pidfd, landlock, etc.)

### File Operation Constants (L431-443)
Standard POSIX file operation flags adapted for LoongArch64.

### Signal and Terminal Constants (L445-667)
- Signal stack sizes and error codes
- Signal numbers and handling flags
- Terminal I/O control flags and baud rates
- Character device control constants

### Architecture Dependencies
- Imports `crate::prelude::*` for common definitions
- Uses `off64_t` and `off_t` from parent modules
- Relies on crate-wide type definitions (dev_t, ino_t, etc.)

### Critical Invariants
- All structures follow C ABI layout requirements
- Alignment attributes ensure proper memory layout for kernel interface
- System call numbers must match kernel definitions exactly
- Constants maintain compatibility with musl libc expectations