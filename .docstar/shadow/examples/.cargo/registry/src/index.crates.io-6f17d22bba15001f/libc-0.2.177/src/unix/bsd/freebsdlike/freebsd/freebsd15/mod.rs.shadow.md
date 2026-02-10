# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd15/mod.rs
@source-hash: 9835c3374c2daea2
@generated: 2026-02-09T17:58:15Z

**Purpose:** FreeBSD 15-specific type definitions and C API bindings within the libc crate's Unix BSD hierarchy. Defines platform-specific data structures, constants, and function declarations that have changed since FreeBSD 11.

**Key Type Definitions (L6-L12):**
- `nlink_t`, `dev_t`, `ino_t` - File system types upgraded to 64-bit integers
- `shmatt_t` - Shared memory attachment count as unsigned int
- `kpaddr_t`, `kssize_t` - Kernel memory addressing types
- `domainset_t` - CPU domain set type aliasing `__c_anonymous_domainset`

**Core Data Structures:**
- `shmid_ds` (L15-24) - System V shared memory segment descriptor with permissions, size, process IDs, and timestamps
- `kevent` (L26-34) - BSD kqueue event structure with 64-bit data field and 4-element extension array
- `kvm_page` (L36-44) - Kernel virtual memory page descriptor for libkvm
- `__c_anonymous_domainset` (L46-51) - CPU domain set implementation with architecture-dependent sizing (4 ulongs on 64-bit, 8 on 32-bit)
- `kinfo_proc` (L54-238) - Comprehensive process information structure marked `#[non_exhaustive]`, containing process metadata, signal masks, resource usage, and kernel pointers
- `stat` (L240-273) - File system stat structure with 64-bit device/inode numbers and x86-specific timestamp extensions
- `dirent` (L277-286) - Directory entry with 64-bit inode, 16-bit name length, and 256-character name buffer
- `statfs` (L288-311) - File system statistics with 64-bit block counts and 1KB mount path buffers
- `vnstat` (L313-322) - Virtual node statistics for file system analysis

**Trait Implementations (L325-442):**
Conditional `PartialEq`, `Eq`, and `Hash` implementations for `statfs`, `dirent`, and `vnstat` when `extra_traits` feature is enabled. Custom equality logic handles array comparisons and variable-length strings.

**Constants & Utilities:**
- `RAND_MAX` (L444), `ELAST` (L445) - Standard C library limits
- `KF_TYPE_EVENTFD` (L447), `SPECNAMELEN` (L450) - Kernel file type and device name constants
- Domain set policy constants (L454-458) for CPU scheduling
- Device number manipulation functions `makedev`, `major`, `minor` (L463-480) - Bit manipulation for major/minor device numbers

**External Function Bindings:**
- Standard C library functions (L484-522): `setgrent`, `mprotect`, `freelocale`, `msgrcv`, CPU set domain functions, path manipulation, sorting
- libkvm function (L526): `kvm_kerndisp` for kernel displacement queries
- Architecture-specific module inclusion for x86_64 (L530-533)

**Dependencies:** 
- `crate::off_t` and `crate::prelude::*` imports
- Extensive use of crate-level type aliases (pid_t, uid_t, etc.)
- Platform-specific conditional compilation for x86 and pointer width

**Architectural Notes:**
- Structures use C-compatible layouts with explicit padding
- FreeBSD 15 represents major type size increases (32→64 bit) for file system identifiers
- Memory safety handled through raw pointer types in kernel interface structures
- Link-time dependency on libkvm for kernel memory access functions