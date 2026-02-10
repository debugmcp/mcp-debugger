# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd13/mod.rs
@source-hash: 2027bae85dac0ca1
@generated: 2026-02-09T17:58:19Z

## Purpose
FreeBSD 13-specific system type definitions and function bindings for the libc crate. This module defines C ABI-compatible data structures, type aliases, constants, and external function declarations that changed between FreeBSD 11 and 13.

## Key Type Definitions

### Basic Types (L6-12)
- `nlink_t`, `dev_t`, `ino_t` as `u64` - File system types upgraded from 32-bit
- `shmatt_t` as `c_uint` - Shared memory attachment count
- `kpaddr_t`, `kssize_t` as `u64`/`i64` - Kernel virtual memory types
- `domainset_t` as `__c_anonymous_domainset` - CPU domain set type

### Core Data Structures

#### `shmid_ds` (L15-24)
Shared memory segment descriptor with permissions, size, process IDs, and timestamps.

#### `kevent` (L26-34) 
Kernel event structure for kqueue with extended 64-bit data field and 4x u64 extension array.

#### `kvm_page` (L36-44)
Kernel virtual memory page descriptor with physical/virtual addresses, protection, offset and length.

#### `__c_anonymous_domainset` (L46-51)
CPU domain set with architecture-dependent size (4 ulongs on 64-bit, 8 on 32-bit).

#### `kinfo_proc` (L53-235)
Comprehensive process information structure containing:
- Process identification (PID, PPID, session, etc.) (L80-90)
- User/group credentials (L106-120) 
- Memory statistics (L122-132)
- Signal masks (L98-104)
- Runtime statistics (L148-152)
- Various name fields (thread, command, login class) (L172-186)
- Kernel pointers to internal structures (L219-229)

#### `stat` (L237-269)
File status structure with 64-bit inode/device numbers, nanosecond timestamps, and x86-specific padding.

### Structures Without Extra Traits (L272-319)

#### `dirent` (L273-282)
Directory entry with 64-bit inode, 16-bit name length, 256-byte name buffer.

#### `statfs` (L284-307)  
File system statistics with 64-bit block counts, large mount point name buffers (1024 bytes each).

#### `vnstat` (L309-318)
Vnode statistics structure for file system nodes.

## Custom Trait Implementations (L321-438)
Conditional PartialEq, Eq, and Hash implementations for `statfs`, `dirent`, and `vnstat` when "extra_traits" feature is enabled. Special handling for array comparisons and string field hashing.

## Constants and Utilities

### System Constants (L440-456)
- `RAND_MAX`, `ELAST` - Standard C library limits
- `KF_TYPE_EVENTFD`, `SPECNAMELEN` - File descriptor and device name limits  
- Domain set policy constants (ROUNDROBIN, FIRSTTOUCH, etc.)
- `MINCORE_SUPER` for memory core status

### Device Number Functions (L458-477)
Safe const functions for device number manipulation:
- `makedev()` - Combine major/minor into dev_t
- `major()`/`minor()` - Extract components from dev_t

## External Function Bindings

### Standard C Functions (L479-519)
- Process/group management: `setgrent()`
- Memory protection: `mprotect()`
- Locale handling: `freelocale()`
- Message queues: `msgrcv()`
- CPU set domain management: `cpuset_getdomain()`, `cpuset_setdomain()`
- Path manipulation: `dirname()`, `basename()`
- Sorting with context: `qsort_r()` with FreeBSD 1.0 symbol versioning

### KVM Library (L521-524)
Links to libkvm for `kvm_kerndisp()` function accessing kernel virtual memory.

## Architecture Dependencies
Conditional compilation for x86_64-specific definitions via submodule inclusion (L526-531).

## Key Dependencies
- `crate::off_t`, `crate::prelude::*` - Core libc types
- Various `crate::` prefixed types from parent modules
- Architecture-specific conditional compilation