# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/mips/mips32/mod.rs
@source-hash: 59493f1ab84ddbcf
@generated: 2026-02-09T17:57:17Z

## MIPS 32-bit uClibc Platform Definitions

This file provides low-level C bindings for MIPS 32-bit architecture running on uClibc (micro C library) in a Linux environment. It's part of the Rust libc crate's platform-specific type definitions and system call mappings.

### Core Type Definitions (L4-18)
Defines primitive type aliases matching the uClibc ABI for MIPS32:
- `clock_t`, `time_t`, `suseconds_t`, `wchar_t`, `off_t` - All 32-bit signed integers
- `ino_t`, `nlink_t` - 32-bit unsigned integers for inode and link counts  
- `blkcnt_t`, `blksize_t` - 32-bit signed integers for block operations
- `fsblkcnt_t`, `fsfilcnt_t` - Unsigned long types for filesystem counts
- `fsblkcnt64_t`, `fsfilcnt64_t` - 64-bit unsigned types for large filesystem operations

### System Structures (L20-267)
Contains C struct definitions wrapped in `s!{}` macro for FFI compatibility:

**File Operations:**
- `stat` (L21-42): Standard file metadata structure with MIPS-specific padding
- `stat64` (L44-65): 64-bit version for large file support
- `statvfs64` (L67-81): 64-bit filesystem statistics
- `statfs`/`statfs64` (L176-204): Filesystem information structures

**Process/Threading:**
- `pthread_attr_t` (L83-85): Thread attribute structure (36-byte size)
- `sigaction` (L87-92): Signal handler configuration
- `sigset_t` (L100-102): Signal mask (4 x unsigned long array)
- `siginfo_t` (L104-109): Signal information with 29-word padding

**IPC Structures:**
- `ipc_perm` (L124-135): IPC permission structure
- `shmid_ds` (L137-148): Shared memory segment descriptor
- `msqid_ds` (L150-174): Message queue descriptor with endian-specific layout

**Miscellaneous:**
- `flock` (L231-239): File locking structure
- `sysinfo` (L241-256): System information structure
- `sem_t` (L261-266): Semaphore type with architecture-dependent sizing

### pthread Constants (L269-276)
Size definitions for pthread objects:
- `__SIZEOF_PTHREAD_ATTR_T`: 36 bytes
- `__SIZEOF_PTHREAD_MUTEX_T`: 24 bytes
- Various other pthread structure sizes

### System Call Numbers (L278-666)
Complete mapping of MIPS O32 ABI system calls, all offset by 4000:
- Basic syscalls: `SYS_exit` (4001), `SYS_fork` (4002), `SYS_read` (4003), etc.
- Modern syscalls: `SYS_io_uring_setup` (4425), `SYS_landlock_*` (4444-4446)
- Some deprecated syscalls marked with `#[deprecated]` attribute

### External Function Bindings (L668-695)
Links to "util" library providing:
- `sysctl()`: System parameter control
- `glob64()`/`globfree64()`: 64-bit pathname expansion
- `pthread_attr_*affinity_np()`: CPU affinity management for thread attributes

### Architecture Notes
- Uses MIPS O32 ABI conventions
- 32-bit pointers and most integer types
- Specific padding and alignment for MIPS requirements
- Endian-aware structure layouts (e.g., msqid_ds)
- uClibc-specific structure sizes and layouts