# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/arm/mod.rs
@source-hash: a90c7811623714e1
@generated: 2026-02-09T17:58:26Z

## Purpose
Platform-specific type definitions and constants for ARM-based uClibc systems running on Linux. This module defines the low-level C types, data structures, and system call numbers that interface with the ARM uClibc runtime on Linux systems.

## Key Components

### Type Definitions (L1-23)
Fundamental C type aliases specific to ARM uClibc:
- Basic types: `wchar_t`, `time_t`, `clock_t` (L4-7)
- File system types: `fsblkcnt_t`, `ino_t`, `off_t` (L8-11) 
- Threading types: `pthread_t` (L12)
- 64-bit variants: `fsblkcnt64_t`, `__u64`, `__s64` (L19-22)

### Core Data Structures (L24-255)
Platform-specific C struct definitions using `s!` macro:

**Network/IPC Structures:**
- `cmsghdr` (L25-29): Control message header for socket operations
- `msghdr` (L31-39): Message header for socket I/O
- `ipc_perm` (L199-211): IPC permissions structure
- `msqid_ds` (L213-228): Message queue descriptor
- `shmid_ds` (L230-244): Shared memory descriptor

**File System Structures:**
- `stat` (L45-66): File status information with ARM-specific layout
- `stat64` (L68-88): 64-bit file status for large file support
- `statfs`/`statfs64` (L115-144): File system statistics
- `statvfs64` (L146-160): Extended file system information
- `flock` (L90-96): File locking structure

**Process/Signal Structures:**
- `pthread_attr_t` (L41-43): Thread attribute structure
- `sigset_t` (L162-164): Signal set representation
- `sigaction` (L168-173): Signal action handler with ARM layout
- `siginfo_t` (L186-191): Signal information
- `stack_t` (L193-197): Signal stack information
- `termios` (L175-184): Terminal I/O settings

**System Information:**
- `sysinfo` (L98-113): System information structure
- `sem_t` (L249-254): Semaphore type with conditional sizing based on pointer width

### Constants and Flags (L257-543)
Extensive collection of platform-specific constants:
- File operation flags: `O_CLOEXEC`, `O_*` flags (L257, L454-472)
- Pthread sizing constants: `__SIZEOF_PTHREAD_*` (L258-266)
- Terminal control constants: Baud rates `B*` (L274-304), control flags `C*` (L307-321)
- Error codes: Extended errno values `E*` (L322-427)
- Signal constants: `SIG*` signal numbers and masks (L492-514)
- Memory mapping flags: `MAP_*` constants (L440-449)

### System Call Numbers (L547-925)
Complete ARM system call table mapping symbolic names to numeric values:
- Basic syscalls: `SYS_exit`, `SYS_read`, `SYS_write` (L548-551)
- File operations: `SYS_open`, `SYS_stat*`, `SYS_chmod` (L552+)
- Process control: `SYS_fork`, `SYS_clone`, `SYS_execve` (L549+)
- Modern syscalls: `SYS_io_uring_*`, `SYS_landlock_*` (L900+)

## Dependencies
- `crate::off64_t`: 64-bit offset type
- `crate::prelude::*`: Common type imports
- Various crate-level type references (`socklen_t`, `iovec`, etc.)

## Architecture Notes
- ARM-specific structure layouts and padding
- 32-bit pointer width assumptions in some structures
- uClibc-specific implementations that may differ from glibc
- Syscall table copied from musl ARM implementation (L546)
- Some constants sourced from other Linux implementations due to uClibc build limitations (L269-271)