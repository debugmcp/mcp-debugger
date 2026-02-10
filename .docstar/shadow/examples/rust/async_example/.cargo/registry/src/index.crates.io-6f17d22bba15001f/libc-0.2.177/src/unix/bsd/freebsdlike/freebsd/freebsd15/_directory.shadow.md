# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd15/
@generated: 2026-02-09T18:16:10Z

## FreeBSD 15 System Interface Module

This directory provides comprehensive FreeBSD 15-specific system interface definitions for the libc crate, serving as the lowest-level abstraction layer for FreeBSD 15 system programming. It extends the Unix BSD hierarchy with platform-specific types, structures, constants, and function bindings.

### Overall Purpose and Responsibility

The module acts as the authoritative source for FreeBSD 15 system call interfaces, data structures, and constants, enabling Rust programs to interact with the FreeBSD 15 kernel and system services. It provides type-safe bindings for IPC mechanisms, process management, filesystem operations, memory management, and architecture-specific features.

### Key Components and Organization

#### Core Module (`mod.rs`)
- **Type System**: Defines fundamental FreeBSD 15 types with 64-bit expansions (`dev_t`, `ino_t`, `nlink_t` as u64)
- **Data Structures**: Comprehensive system structures including:
  - Process information (`kinfo_proc` with 100+ fields)
  - IPC primitives (`shmid_ds` for shared memory)
  - Event handling (`kevent` with 64-bit extensions)
  - Filesystem metadata (`stat`, `dirent`, `statfs`)
  - NUMA support (`domainset_t` structures)
- **System Functions**: External bindings for memory management, locale handling, KVM operations, and NUMA CPU set management
- **Device Utilities**: Safe device number manipulation functions (`makedev`, `major`, `minor`)

#### Architecture Layer (`x86_64.rs`)
- **Security Controls**: KPTI (Kernel Page Table Isolation) management constants for Spectre/Meltdown mitigation
- **Address Space Management**: Linear address mode controls for 48-bit and 57-bit addressing modes
- **Process Control Extensions**: Machine-dependent `procctl(2)` system call constants

### Public API Surface

#### Main Entry Points
- **Type Definitions**: All FreeBSD 15 system types (`dev_t`, `ino_t`, `shmatt_t`, etc.)
- **Structure Definitions**: Complete system structures with proper field layouts
- **Function Bindings**: External function declarations for system libraries
- **Constants**: System limits, error codes, and control flags
- **Device Utilities**: `makedev()`, `major()`, `minor()` for device number manipulation

#### Architecture-Specific Interface
- **KPTI Controls**: `PROC_KPTI_*` constants for security management
- **Address Mode Controls**: `PROC_LA_*` constants for virtual address space configuration

### Internal Organization and Data Flow

The module follows FreeBSD's layered architecture:
1. **Base Types**: Fundamental system types with FreeBSD 15's 64-bit expansions
2. **Core Structures**: System data structures with proper alignment and field ordering
3. **Function Bindings**: External library interfaces (libc, libkvm)
4. **Architecture Extensions**: Platform-specific features and controls
5. **Utility Functions**: Safe wrappers for common operations

Data flows from kernel structures through these bindings to Rust applications, maintaining ABI compatibility through careful structure layout and `#[non_exhaustive]` markers for evolving interfaces.

### Important Patterns and Conventions

- **ABI Stability**: Uses `#[non_exhaustive]` on evolving structures like `kinfo_proc`
- **Large Structure Handling**: Custom trait implementations via `s_no_extra_traits!` for structures with large arrays
- **Conditional Compilation**: Architecture-specific definitions included via feature flags
- **Type Safety**: Const functions for device number operations prevent runtime errors
- **NUMA Awareness**: Architecture-dependent domain set sizing for optimal performance
- **Security Integration**: Built-in support for modern CPU security features (KPTI) and address space layouts

This module represents the evolution from earlier FreeBSD versions, particularly emphasizing 64-bit type expansions, enhanced security features, and NUMA-aware computing support while maintaining backward compatibility through careful API design.