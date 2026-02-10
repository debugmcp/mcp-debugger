# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd15/
@generated: 2026-02-09T18:16:11Z

## Purpose
FreeBSD 15-specific system definitions within the libc crate's Unix BSD hierarchy. This directory provides comprehensive low-level bindings for FreeBSD version 15, including upgraded type definitions, kernel interfaces, and architecture-specific constants that reflect significant changes from earlier FreeBSD versions.

## Key Components

### Core Module (mod.rs)
The primary module defines FreeBSD 15's enhanced type system and data structures:
- **Upgraded Types**: 64-bit file system identifiers (`dev_t`, `ino_t`, `nlink_t`) representing FreeBSD 15's major architectural improvements
- **System V IPC**: Shared memory structures (`shmid_ds`) and attachment types
- **BSD Event System**: Enhanced `kevent` structure with 64-bit data fields for kqueue operations
- **Kernel Interfaces**: Virtual memory (`kvm_page`), process information (`kinfo_proc`), and CPU domain sets (`domainset_t`)
- **File System**: Modern `stat`, `dirent`, and `statfs` structures with expanded capacity

### Architecture-Specific Extensions (x86_64.rs)  
Provides x86_64-specific process control constants for:
- **KPTI (Kernel Page Table Isolation)**: Security mitigation controls for Spectre/Meltdown vulnerabilities
- **Linear Address Control**: Support for 48-bit and 57-bit virtual addressing modes

## Public API Surface

### Type Definitions
- File system types: `nlink_t`, `dev_t`, `ino_t` (all 64-bit)
- Kernel addressing: `kpaddr_t`, `kssize_t`, `domainset_t`
- Memory management: `shmatt_t`

### Data Structures
- Process information: `kinfo_proc` (comprehensive process metadata)
- File operations: `stat`, `dirent`, `statfs` (with 64-bit identifiers)
- Event handling: `kevent` (BSD kqueue interface)
- Memory management: `shmid_ds`, `kvm_page`, `vnstat`

### Constants
- System limits: `RAND_MAX`, `ELAST`, `SPECNAMELEN`
- Process control: `PROC_KPTI_*`, `PROC_LA_*` (x86_64-specific)
- Domain policies: `DOMAINSET_POLICY_*`

### Functions
- Device number manipulation: `makedev()`, `major()`, `minor()`
- Standard library bindings: `setgrent()`, `mprotect()`, `freelocale()`
- CPU domain management: `cpuset_getdomain()`, `cpuset_setdomain()`
- Kernel memory: `kvm_kerndisp()`

## Internal Organization

The module follows a layered architecture:
1. **Base Types**: Fundamental type aliases and constants
2. **Core Structures**: System data structures with C-compatible layouts
3. **Trait Implementations**: Optional `PartialEq`, `Eq`, and `Hash` for comparison operations
4. **Function Bindings**: External C library and system call interfaces
5. **Architecture Extensions**: Platform-specific constants and definitions

## Data Flow Patterns

- **Kernel Interface**: Raw pointer types in structures like `kinfo_proc` for direct kernel memory access
- **Type Safety**: C-compatible layouts with explicit padding and `#[repr(C)]`
- **Feature Gates**: Conditional trait implementations based on `extra_traits` feature
- **Architecture Dispatch**: Conditional inclusion of platform-specific modules

## Important Conventions

- **64-bit Transition**: FreeBSD 15 represents a major upgrade with expanded identifier sizes
- **Memory Safety**: Raw pointers used for kernel interfaces while maintaining type safety at boundaries
- **Compatibility**: Structures maintain C ABI compatibility for system call interfaces
- **Extensibility**: `#[non_exhaustive]` on `kinfo_proc` allows future field additions
- **Security**: KPTI constants provide modern security mitigation controls

This directory serves as the definitive FreeBSD 15 system interface layer, bridging Rust code with the operating system's enhanced capabilities while maintaining backward compatibility patterns established in the broader libc crate hierarchy.