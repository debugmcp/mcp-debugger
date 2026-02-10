# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/loongarch64/mod.rs
@source-hash: 294414bcb24a5b59
@generated: 2026-02-09T17:57:14Z

## Purpose

Platform-specific type and constant definitions for LoongArch 64-bit architecture on Linux with musl libc. This file provides low-level system interface compatibility by defining architecture-specific data structures, system call numbers, and constants that match the kernel ABI.

## Key Type Definitions

**Basic Types (L6-11):**
- `wchar_t` as `c_int` - Wide character type for LoongArch64
- `nlink_t` as `c_uint` - File link count type
- `blksize_t` as `c_int` - Block size type
- `__u64`/`__s64` as unsigned/signed 64-bit integers

**File System Structures:**
- `stat` (L14-34) - Standard file status structure with nanosecond-precision timestamps
- `stat64` (L36-56) - 64-bit variant using `ino64_t` and `off64_t` for large file support
- `ipc_perm` (L58-68) - Inter-process communication permissions structure

**Architecture-Specific Structures:**
- `user_regs_struct` (L70-76) - CPU register state for debugging/ptrace, with 32 general-purpose registers plus LoongArch-specific CSR registers
- `user_fp_struct` (L78-82) - Floating-point register state with 32 FP registers and control/status registers
- `ucontext_t` (L84-90) - Signal context structure
- `mcontext_t` (L92-98) - Machine context with 16-byte alignment for signal handling
- `max_align_t` (L117-120) - Maximum alignment type with 16-byte alignment
- `clone_args` (L100-113) - Modern clone system call arguments structure

## System Call Numbers

Comprehensive system call number definitions (L123-429) covering:
- I/O operations (io_setup, read, write, etc.)
- File operations (open, close, stat, etc.)
- Process management (fork, exec, wait, etc.)
- Memory management (mmap, mprotect, etc.)
- Signal handling (sigaction, sigprocmask, etc.)
- Modern syscalls (io_uring, pidfd operations, landlock, futex variants)

## File Operation Constants

**Open flags (L431-443):** Standard POSIX file opening modes and flags
**Signal constants (L445-560):** Stack sizes, signal numbers, and signal handling flags specific to LoongArch64
**File control (L562-566):** fcntl operation codes
**Polling (L570-571):** Poll event flags
**Networking (L573-574):** Socket type constants

## Memory Management Constants

**Memory mapping flags (L576-586):** mmap behavior controls including LoongArch64-specific options
**Memory locking (L588-590):** mlockall operation flags

## Terminal I/O Constants

Extensive termios definitions (L591-667) for serial communication and terminal control, including:
- Baud rates from standard to high-speed (up to 4Mbps)
- Control flags for character size, parity, flow control
- Input/output processing flags
- Special character indices

## Error Code Constants

Standard POSIX error numbers (L448-530) with LoongArch64-specific values for system call error reporting.

## Dependencies

- `crate::prelude::*` - Common type definitions
- `crate::{off64_t, off_t}` - File offset types from parent modules

## Architecture Notes

This module represents the lowest level of the libc abstraction for LoongArch64, ensuring binary compatibility with the Linux kernel ABI. The structures contain platform-specific padding and alignment requirements that must match kernel expectations exactly.