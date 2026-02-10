# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd14/mod.rs
@source-hash: d536725067b3a85f
@generated: 2026-02-09T17:58:13Z

## Purpose
FreeBSD 14 specific system interface definitions for the libc crate, providing updated type definitions, structures, and function bindings that have changed since FreeBSD 11.

## Key Type Definitions (L6-12)
Core system types redefined for FreeBSD 14 with updated bit widths:
- `nlink_t = u64`: File link count (upgraded from smaller size)
- `dev_t = u64`, `ino_t = u64`: Device and inode identifiers
- `shmatt_t = c_uint`: Shared memory attachment count
- `kpaddr_t = u64`, `kssize_t = i64`: Kernel virtual memory types
- `domainset_t = __c_anonymous_domainset`: CPU domain set abstraction

## Core System Structures

### IPC and Event Structures (L14-52)
- `shmid_ds` (L15-24): Shared memory segment descriptor with permissions, size, and timestamps
- `kevent` (L26-34): Kernel event notification structure with extended data array
- `kvm_page` (L36-44): Kernel virtual memory page descriptor
- `__c_anonymous_domainset` (L46-51): Platform-specific domain set with conditional sizing

### Process Information Structure (L53-235)
`kinfo_proc`: Comprehensive process information structure containing:
- Process identifiers and hierarchy (pid, ppid, pgid, etc.)
- Memory statistics (virtual size, resident set size, stack/data/text sizes)
- Signal handling state (signal masks, pending signals)
- User/group credentials and permissions
- Resource usage statistics and timing information
- Thread and kernel-level metadata

### Filesystem Structures (L237-321)
- `stat` (L238-271): File status with nanosecond timestamps, extended attributes, and x86-specific padding
- `dirent` (L275-284): Directory entry with 64-bit inode numbers
- `statfs` (L286-309): Filesystem statistics with large block counts and path names
- `vnstat` (L311-320): Virtual node statistics for file system objects

## Trait Implementations (L323-440)
Conditional `PartialEq`, `Eq`, and `Hash` implementations for structures when `extra_traits` feature is enabled. Custom implementations handle array comparisons and variable-length data.

## Constants and Utilities (L442-480)
- System limits: `RAND_MAX`, `ELAST`, `SPECNAMELEN`
- Domain set policies for CPU affinity
- Device number manipulation functions: `makedev()`, `major()`, `minor()` (L461-478)

## External Function Bindings (L481-525)
System call and library function declarations:
- Memory management: `mprotect()`
- IPC: `msgrcv()`
- CPU set domain management: `cpuset_getdomain()`, `cpuset_setdomain()`
- Path manipulation: `dirname()`, `basename()`
- Sorting: `qsort_r()`
- KVM library: `kvm_kerndisp()` (linked from libkvm)

## Architecture-Specific Module (L527-532)
Conditional inclusion of x86_64-specific definitions when targeting that architecture.

## Dependencies
- `crate::off_t`, `crate::prelude::*`: Core libc types
- Various system types from parent modules (pid_t, uid_t, gid_t, etc.)
- Architecture-specific conditional compilation