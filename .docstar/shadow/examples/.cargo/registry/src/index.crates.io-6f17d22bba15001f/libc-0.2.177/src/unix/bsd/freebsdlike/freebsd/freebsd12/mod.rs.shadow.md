# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd12/mod.rs
@source-hash: 8467832d4b8a73e4
@generated: 2026-02-09T17:58:14Z

## FreeBSD 12-Specific System Types and Constants

This module defines FreeBSD 12-specific data types, structures, constants, and functions that changed from FreeBSD 11. It's part of the libc crate's Unix BSD FreeBSD-like system interface layer.

### Key Type Definitions (L6-9)
- `nlink_t = u64`: File link count type, increased from 32-bit
- `dev_t = u64`: Device identifier type, increased from 32-bit  
- `ino_t = u64`: Inode number type, increased from 64-bit
- `shmatt_t = c_uint`: Shared memory attachment count type

### Core System Structures

**shmid_ds (L12-21)**: Shared memory segment descriptor with IPC permissions, size, process IDs, attachment count, and timestamps.

**kevent (L23-31)**: Kernel event structure for kqueue system with identifier, filter, flags, data, user data pointer, and 4-element extension array.

**kvm_page (L33-41)**: Kernel virtual memory page descriptor containing version, physical/virtual addresses, protection flags, offset and length.

**kinfo_proc (L43-222)**: Comprehensive process information structure containing 80+ fields including:
- Process identifiers (PID, PPID, session IDs)
- User/group credentials and signal masks
- Memory statistics (virtual size, resident set size)
- Timing information (runtime, start time, CPU usage)
- Thread and kernel state information
- String arrays for names and descriptions

**stat (L224-256)**: File status structure with device IDs, inode, permissions, ownership, timestamps (including nanosecond precision), size, and block information. Contains x86-specific timestamp extension fields (L234-247).

### Structures Without Extra Traits (L259-306)

**dirent (L260-269)**: Directory entry with inode number, offset, record length, file type, name length, and 256-character name buffer.

**statfs (L271-294)**: File system statistics including version, type, flags, block sizes, counts, sync/async operation counters, and mount point names.

**vnstat (L296-305)**: Virtual node statistics with file ID, size, device info, mount directory, type, mode, and device name.

### Trait Implementations (L308-425)
Conditional `PartialEq`, `Eq`, and `Hash` implementations for `statfs`, `dirent`, and `vnstat` when `extra_traits` feature is enabled. Custom implementations handle array comparisons properly.

### Constants and Device Functions (L427-455)
- `RAND_MAX`, `ELAST`, `SPECNAMELEN`, `KI_NSPARE_PTR`, `MINCORE_SUPER`
- Device number manipulation functions: `makedev()`, `major()`, `minor()` for encoding/decoding device identifiers

### External Function Bindings (L457-480)
System call bindings including `setgrent()`, `mprotect()`, `freelocale()`, `msgrcv()`, `dirname()`, `basename()`, and version-specific `qsort_r()` with FBSD_1.0 symbol linking.

### Architecture Conditional Module (L482-487)
Conditionally includes x86_64-specific definitions when targeting that architecture.

**Dependencies**: Imports `off_t`, crate prelude, and various system types from parent crate modules. Uses `cfg_if!` macro for conditional compilation.