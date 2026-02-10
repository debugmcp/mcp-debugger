# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/powerpc64/mod.rs
@source-hash: 285c465bd0cb1e66
@generated: 2026-02-09T17:57:14Z

## PowerPC64-specific Linux system definitions

This file provides PowerPC64 architecture-specific type definitions and constants for 64-bit Linux systems within the libc crate. It serves as the lowest-level platform abstraction layer for PowerPC64 GNU/Linux.

### Architecture-Specific Types
- **Basic types** (L6-11): Defines fundamental C types for PowerPC64 including `wchar_t`, `nlink_t`, `blksize_t`, `suseconds_t`, and 64-bit integer types
- **sigaction structure** (L16-23): Signal handling structure with function pointer comparisons allowed via attribute
- **File system structures** (L25-142): Complete definitions for `statfs`, `flock`, `stat`, and their 64-bit variants, plus `statvfs` structures
- **Threading types** (L144-146): PowerPC64-specific `pthread_attr_t` with 7 u64 fields
- **IPC structures** (L148-172): Inter-process communication types including `ipc_perm` and `shmid_ds`
- **Signal types** (L174-194): Signal information and stack structures, including deprecated `_pad` field (L185)

### Memory Alignment
- **max_align_t** (L197-201): 16-byte aligned structure for maximum alignment requirements

### System Constants
- **File operation flags** (L203-224): POSIX file advice, dynamic linking, and file open flags
- **Memory mapping** (L226-235): Memory mapping flags specific to PowerPC64
- **Error codes** (L237-314): Complete errno definitions for PowerPC64 Linux
- **Socket types** (L316-317): Basic socket type definitions
- **Signal constants** (L319-347): Signal handling flags and signal numbers
- **File control** (L359-370): File locking and control operation codes
- **Terminal control** (L374-570): Comprehensive terminal I/O constants and baud rates

### System Call Numbers
- **Complete syscall table** (L573-963): All PowerPC64 Linux system call numbers from 0 to 450, including modern syscalls like `landlock_*`, `io_uring_*`, and `memfd_secret`

### External Functions
- **sysctl** (L966-973): Direct system control interface function

### Key Dependencies
- Imports from `crate::prelude::*` and specific types like `off64_t`, `off_t`, `pthread_mutex_t`
- Uses `s!` and `s_no_extra_traits!` macros for structure definitions

### Endianness Handling
- **Pthread mutex initializers** (L415-456): Separate definitions for little-endian and big-endian PowerPC64 systems