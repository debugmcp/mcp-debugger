# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd13/mod.rs
@source-hash: 2027bae85dac0ca1
@generated: 2026-02-09T17:57:07Z

## Purpose
FreeBSD 13 system bindings module providing low-level C types, structs, and function declarations that differ from FreeBSD 11. Part of the libc crate's BSD family hierarchy, specifically targeting FreeBSD 13 system interfaces.

## Core Components

### Type Definitions (L6-12)
- `nlink_t`, `dev_t`, `ino_t`: Changed to 64-bit from earlier FreeBSD versions
- `shmatt_t`: Shared memory attachment counter type
- `kpaddr_t`, `kssize_t`: Kernel virtual address and size types  
- `domainset_t`: CPU domain set type for NUMA operations

### Key Structures

**shmid_ds (L15-24)**: Shared memory segment descriptor
- Contains IPC permissions, segment size, process IDs, and timestamps

**kevent (L26-34)**: Kernel event notification structure
- Used with kqueue for efficient event monitoring
- Includes identifier, filter flags, and extended data fields

**kvm_page (L36-44)**: Kernel virtual memory page descriptor
- Maps physical to virtual addresses with protection and offset info

**kinfo_proc (L53-235)**: Comprehensive process information structure
- Massive 180+ field struct containing all process metadata
- Includes PIDs, credentials, memory stats, CPU usage, signal masks
- Critical for system monitoring and process introspection

**stat (L237-269)**: File status structure
- Extended with birthtime and larger field sizes vs older FreeBSD
- Conditional x86-specific timestamp extensions

**dirent (L273-282)**: Directory entry (no extra traits)
- File number, offset, record length, type, and name

**statfs (L284-307)**: Filesystem statistics (no extra traits) 
- Comprehensive filesystem metadata including usage and mount info

**vnstat (L309-318)**: Virtual node statistics
- File system node information with device names

### Device Number Functions (L458-477)
Safe const functions for device number manipulation:
- `makedev()`: Construct device number from major/minor
- `major()`, `minor()`: Extract components from device number

### Constants (L440-456)
- `RAND_MAX`, `ELAST`: System limits
- `KF_TYPE_EVENTFD`: Event file descriptor type
- `SPECNAMELEN`: Maximum device name length
- `DOMAINSET_POLICY_*`: NUMA domain set policies
- `MINCORE_SUPER`: Memory core flags

### External Functions (L479-524)
System call and library function declarations:
- Memory management: `mprotect()`
- Message queues: `msgrcv()`
- CPU/domain sets: `cpuset_getdomain()`, `cpuset_setdomain()`
- Path utilities: `dirname()`, `basename()`
- Sorting: `qsort_r()` with FreeBSD-specific symbol versioning
- Kernel VM: `kvm_kerndisp()` (requires libkvm)

## Architectural Patterns

### Conditional Compilation (L321-438)
Uses `cfg_if!` for feature-gated trait implementations:
- Implements `PartialEq`, `Eq`, `Hash` for structs when "extra_traits" enabled
- Custom equality for variable-length arrays (dirent names, mount paths)

### Platform Targeting (L526-531)
Architecture-specific submodules (x86_64 support shown)

## Dependencies
- Parent crate modules for common types (`off_t`, `prelude::*`)
- Links to system libraries (kvm)
- Uses FreeBSD-specific symbol versioning for ABI compatibility

## Key Differences from FreeBSD 11
Comment on L4 indicates this contains "APIs that have changed since 11" - primarily larger integer types and extended struct layouts to support modern 64-bit systems and new kernel features.