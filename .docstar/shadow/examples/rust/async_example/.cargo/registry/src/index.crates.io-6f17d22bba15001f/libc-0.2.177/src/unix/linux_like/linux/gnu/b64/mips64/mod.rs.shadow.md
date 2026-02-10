# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/mips64/mod.rs
@source-hash: 3fac2105995a594d
@generated: 2026-02-09T17:57:11Z

## Purpose
Architecture-specific type definitions and constants for MIPS64 GNU/Linux systems in the libc crate. This module provides platform-specific bindings that enable Rust programs to interface with MIPS64 Linux system calls, data structures, and low-level operations.

## Key Type Definitions

### Basic Types (L4-9)
- `blksize_t`, `nlink_t`, `suseconds_t` - File system and time-related types
- `wchar_t` - Wide character type (32-bit signed)
- `__u64`, `__s64` - Raw 64-bit unsigned/signed types

### System Structures (L11-187)

**File System Structures:**
- `stat` (L12-34) - File metadata with MIPS64-specific padding and field layout
- `stat64` (L67-88) - 64-bit version using `ino64_t` and `off64_t`
- `statfs`/`statfs64` (L36-103) - File system statistics with different block count types
- `statvfs`/`statvfs64` (L105-133) - POSIX file system information

**File Locking:**
- `flock` (L51-57) - File lock with standard offset types
- `flock64` (L59-65) - 64-bit version using `off64_t`

**Threading & Signals:**
- `pthread_attr_t` (L135-137) - Thread attributes (7 64-bit words)
- `sigaction` (L141-146) - Signal handler configuration with restorer function
- `siginfo_t` (L154-160) - Signal information with MIPS64 padding
- `stack_t` (L148-152) - Signal stack specification

**IPC Structures:**
- `ipc_perm` (L162-173) - IPC permissions with MIPS64 field ordering
- `shmid_ds` (L175-186) - Shared memory descriptor

### Special Alignment (L189-194)
- `max_align_t` - 16-byte aligned type for maximum alignment requirements

## Threading Constants (L196-244)

**Pthread Sizes:**
- Mutex, rwlock, barrier sizes specific to MIPS64 architecture
- Endian-specific mutex initializers for recursive, errorcheck, and adaptive types
- Separate definitions for little-endian (L204-223) and big-endian (L225-244) systems

## System Call Numbers (L246-601)
Comprehensive mapping of Linux system calls to MIPS64 numbers (base 5000):
- Standard POSIX calls (read, write, open, etc.)
- Linux-specific extensions (epoll, inotify, etc.)
- Modern additions (io_uring, landlock, etc.)
- Some deprecated syscalls marked with deprecation attributes (L413-420)

## File & I/O Constants (L603-656)
- File descriptor flags (`SFD_CLOEXEC`, `EFD_CLOEXEC`)
- File open flags with MIPS64-specific values
- Terminal control constants (`NCCS`, various O_* flags)

## Error Codes (L614-739)
MIPS64-specific errno values for various error conditions, including:
- Standard POSIX errors with platform-specific numbers
- Network-related errors (socket operations)
- Extended error codes for modern Linux features

## Memory & Process Constants (L741-829)
- Memory mapping flags (`MAP_*` constants)
- Socket types and signal handling flags
- Process control and debugging constants (`PTRACE_*`)
- Memory locking options (`MCL_*`)

## Terminal I/O (L831-917)
Extensive terminal control constants:
- Baud rates from B0 to B4000000
- Control flags for character processing
- Terminal special characters and modes
- MIPS64-specific flag values using octal notation

## External Functions (L921-930)
- `sysctl()` - System control interface for kernel parameters

## Architecture Notes
- All constants and structures reflect MIPS64 GNU/Linux ABI requirements
- Endian-specific handling for mutex initializers
- Syscall numbers use MIPS64 base offset (5000)
- Padding fields ensure proper memory layout for kernel interfaces