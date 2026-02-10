# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd15/mod.rs
@source-hash: 9835c3374c2daea2
@generated: 2026-02-09T17:57:05Z

## FreeBSD 15 System Interface Definitions

This module provides FreeBSD 15-specific type definitions, structures, and function bindings for system programming. It serves as part of the libc crate's Unix BSD hierarchy, specifically targeting FreeBSD 15 API changes.

### Core Type Definitions (L6-12)
- `nlink_t = u64`: File link count type
- `dev_t = u64`: Device identifier type  
- `ino_t = u64`: Inode number type
- `shmatt_t = c_uint`: Shared memory attachment count
- `kpaddr_t = u64`: Kernel physical address type
- `kssize_t = i64`: Kernel signed size type
- `domainset_t = __c_anonymous_domainset`: NUMA domain set type

### Key Data Structures

#### IPC & Memory Management
- `shmid_ds` (L15-24): Shared memory segment descriptor with permissions, size, PIDs, and timestamps
- `__c_anonymous_domainset` (L46-51): NUMA domain set with architecture-dependent size (4 ulongs on 64-bit, 8 on 32-bit)

#### Event & Process Management
- `kevent` (L26-34): Kernel event structure for kqueue with 64-bit extensions (`ext` field)
- `kinfo_proc` (L54-238): Comprehensive process information structure with 100+ fields including PIDs, memory stats, signals, credentials, and timing data. Marked `#[non_exhaustive]` for ABI stability
- `kvm_page` (L36-44): Kernel virtual memory page descriptor

#### Filesystem Structures
- `stat` (L240-273): File status with 64-bit fields and x86-specific timestamp extensions
- `dirent` (L277-286): Directory entry with 256-char name buffer (uses `s_no_extra_traits!`)
- `statfs` (L288-311): Filesystem statistics with 1024-char mount paths (uses `s_no_extra_traits!`)
- `vnstat` (L313-322): Virtual node statistics

### Device Number Utilities (L462-481)
Safe const functions for device number manipulation:
- `makedev()`: Combines major/minor into dev_t using FreeBSD's bit layout
- `major()`/`minor()`: Extract components from dev_t

### System Constants (L444-461)
- `RAND_MAX = 0x7fff_ffff`: Maximum random number value
- `ELAST = 97`: Last error number
- `SPECNAMELEN = 255`: Maximum device name length
- Domain set policy constants for NUMA control
- `MINCORE_SUPER = 0x60`: Memory core mapping flag

### External Function Bindings

#### Standard Library (L483-522)
- User/group management: `setgrent()`
- Memory protection: `mprotect()`
- Locale handling: `freelocale()`
- Message queues: `msgrcv()`
- Path utilities: `dirname()`, `basename()`
- Sorting: `qsort_r()` with context parameter

#### NUMA CPU Sets (L495-510)
- `cpuset_getdomain()`/`cpuset_setdomain()`: NUMA domain management functions

#### KVM Library (L524-527)
- `kvm_kerndisp()`: Kernel displacement query (requires linking with libkvm)

### Architecture Support (L529-534)
Conditional compilation includes x86_64-specific definitions when targeting that architecture.

### Trait Implementations (L325-442)
When `extra_traits` feature is enabled, provides custom `PartialEq` and `Hash` implementations for structures with large arrays (`statfs`, `dirent`, `vnstat`), handling variable-length data appropriately.

This module represents FreeBSD 15's evolution from earlier versions, particularly in 64-bit type expansions and extended structure fields.