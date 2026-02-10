# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/mips64/mod.rs
@source-hash: 3fac2105995a594d
@generated: 2026-02-09T17:57:23Z

## MIPS64 GNU/Linux Platform-Specific Definitions

This file provides MIPS64 (64-bit MIPS) architecture-specific type definitions, system call numbers, constants, and structures for GNU/Linux systems within the libc crate's platform abstraction layer.

### Dependencies & Imports (L1-2)
- `crate::prelude::*`: Common type definitions and traits
- Core types: `off64_t`, `off_t`, `pthread_mutex_t`

### Type Aliases (L4-9)
Platform-specific primitive type mappings for MIPS64:
- `blksize_t = i64`: Block size type
- `nlink_t = u64`: File link count type  
- `suseconds_t = i64`: Microseconds type
- `wchar_t = i32`: Wide character type
- `__u64 = c_ulong`, `__s64 = c_long`: 64-bit integer types

### Core System Structures (L11-187)
Defines C-compatible structures using the `s!` macro:

**File System Structures:**
- `stat` (L12-34): File metadata with MIPS64-specific padding
- `stat64` (L67-88): 64-bit file metadata variant
- `statfs`/`statfs64` (L36-103): File system statistics
- `statvfs`/`statvfs64` (L105-133): POSIX file system info

**File Locking:**
- `flock` (L51-57): 32-bit file lock structure
- `flock64` (L59-65): 64-bit file lock structure

**Threading & Signals:**
- `pthread_attr_t` (L135-137): Thread attributes (7 x c_ulong)
- `sigaction` (L141-146): Signal handler registration
- `stack_t` (L148-152): Signal stack information
- `siginfo_t` (L154-160): Signal information

**IPC Structures:**
- `ipc_perm` (L162-173): IPC permissions
- `shmid_ds` (L175-186): Shared memory segment descriptor

### Special Alignment Structure (L189-194)
- `max_align_t`: 16-byte aligned structure using `s_no_extra_traits!` macro

### Threading Constants (L196-244)
- Pthread object sizes (L196-201): mutex, rwlock, barrier sizes
- Mutex initializers with endian-specific variants:
  - Little-endian (L203-223): RECURSIVE, ERRORCHECK, ADAPTIVE
  - Big-endian (L224-244): Same initializers with different byte ordering

### System Call Numbers (L246-601)
Comprehensive MIPS64 system call number definitions, all offset by 5000:
- Basic I/O: `SYS_read` (5000), `SYS_write` (5001), etc.
- File operations: `SYS_open`, `SYS_stat`, `SYS_chmod`, etc.
- Process management: `SYS_fork`, `SYS_execve`, `SYS_exit`, etc.
- Network operations: `SYS_socket`, `SYS_bind`, `SYS_listen`, etc.
- Modern syscalls: `SYS_io_uring_setup` (5425), `SYS_landlock_*`, etc.

### File & I/O Constants (L603-656)
- File descriptor flags: `SFD_CLOEXEC`, `O_TRUNC`, `O_CLOEXEC`, etc.
- File access modes: `O_APPEND`, `O_CREAT`, `O_SYNC`, etc.
- Terminal control: `NCCS = 32`

### Error Codes (L614-739)
MIPS64-specific errno values:
- Extended errors: `EBFONT` (59), `ENOSTR` (60), etc.
- Network errors: `EADDRINUSE` (125), `ECONNRESET` (131), etc.
- Modern errors: `EKEYEXPIRED` (162), `ERFKILL` (167), etc.

### Memory & Process Constants (L741-832)
- Memory mapping: `MAP_NORESERVE`, `MAP_ANON`, `MAP_HUGETLB`, etc.
- Socket types: `SOCK_STREAM = 2`, `SOCK_DGRAM = 1`
- Signal handling: `SA_ONSTACK`, `SA_SIGINFO`, etc.
- Signal numbers: `SIGCHLD = 18`, `SIGBUS = 10`, etc.
- Memory locking: `MCL_CURRENT`, `MCL_FUTURE`, `MCL_ONFAULT`
- Stack sizes: `SIGSTKSZ = 8192`, `MINSIGSTKSZ = 2048`

### Terminal I/O Constants (L833-918)
Comprehensive terminal control definitions:
- Baud rates: `B0` through `B4000000`
- Control flags: `CBAUD`, `CSIZE`, `CS6`/`CS7`/`CS8`
- Input/output modes: `IXON`, `IXOFF`, `ONLCR`
- Local modes: `ICANON`, `ECHO*`, `ISIG`

### Hardware Error (L919)
- `EHWPOISON = 168`: Memory corruption error

### System Function (L921-930)
- `sysctl()`: System control interface function declaration

This file serves as the foundational platform abstraction for MIPS64 GNU/Linux systems, ensuring binary compatibility with C libraries and proper system call interfaces.