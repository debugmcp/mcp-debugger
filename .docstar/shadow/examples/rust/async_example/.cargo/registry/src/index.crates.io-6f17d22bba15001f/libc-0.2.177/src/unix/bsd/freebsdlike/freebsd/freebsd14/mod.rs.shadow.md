# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd14/mod.rs
@source-hash: d536725067b3a85f
@generated: 2026-02-09T17:57:04Z

## FreeBSD 14 System Type Definitions and Constants

This module provides FreeBSD 14-specific system types, structures, constants, and function bindings that have changed since FreeBSD 11. It's part of the libc crate's platform-specific type definitions hierarchy.

### Primary Purpose
Defines updated data types, system structures, and function signatures for FreeBSD 14 compatibility, particularly focusing on changed APIs and data structures that differ from earlier FreeBSD versions.

### Key Type Definitions (L6-12)
- `nlink_t`, `dev_t`, `ino_t`: Now 64-bit types (changed from smaller types in earlier versions)
- `shmatt_t`: Unsigned int for shared memory attachment count
- `kpaddr_t`, `kssize_t`: 64-bit kernel pointer and size types
- `domainset_t`: Type alias for domain set structure used in CPU affinity operations

### Critical System Structures

**shmid_ds (L15-24)**: System V shared memory segment descriptor containing permissions, size, process IDs, and timestamps for shared memory operations.

**kevent (L26-34)**: Kernel event notification structure for kqueue mechanism with 64-bit data field and extended 4x64-bit extension array.

**kvm_page (L36-44)**: Kernel virtual memory page descriptor used by libkvm for memory analysis tools.

**kinfo_proc (L53-235)**: Comprehensive process information structure containing 80+ fields including process IDs, memory statistics, signal masks, credentials, timing data, and various kernel pointers. Critical for process enumeration and monitoring tools.

**stat (L238-271)**: File status structure with FreeBSD 14-specific layout including birthtime fields and architecture-specific timestamp extensions for x86.

**dirent (L275-284)**: Directory entry structure with 64-bit inode numbers and offset fields.

**statfs (L286-309)**: Filesystem statistics structure with 64-bit block counts and extended mount information arrays.

**vnstat (L311-320)**: Vnode statistics structure for file system node information.

### Domain Set Policy Constants (L452-456)
Defines NUMA domain scheduling policies: INVALID, ROUNDROBIN, FIRSTTOUCH, PREFER, INTERLEAVE for CPU/memory affinity control.

### Device Number Manipulation (L461-478)
Safe const functions for device number encoding/decoding:
- `makedev()`: Combines major/minor into dev_t with specific bit layout
- `major()`/`minor()`: Extracts major/minor numbers from dev_t

### External Function Bindings (L481-525)
- System calls for memory protection, message queues, CPU set domain operations
- File path manipulation functions (dirname, basename)
- Sorting function with context (qsort_r)
- libkvm kernel memory access function

### Architecture-Specific Modules (L528-531)
Conditional compilation includes x86_64-specific definitions when targeting that architecture.

### Notable Implementation Details
- Uses `s!` and `s_no_extra_traits!` macros for structure definitions (likely from libc crate infrastructure)
- Implements PartialEq, Eq, and Hash traits conditionally based on "extra_traits" feature
- Careful field padding and alignment for binary compatibility with kernel structures
- Architecture-conditional fields in stat structure for x86 timestamp extensions