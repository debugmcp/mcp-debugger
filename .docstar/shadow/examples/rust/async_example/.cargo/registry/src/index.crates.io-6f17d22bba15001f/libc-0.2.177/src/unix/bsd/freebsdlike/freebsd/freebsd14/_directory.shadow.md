# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd14/
@generated: 2026-02-09T18:16:12Z

## FreeBSD 14 System Interface Module

This directory provides FreeBSD 14-specific system interface definitions for the libc crate, containing updated type definitions, system structures, constants, and function bindings that reflect changes introduced in FreeBSD 14.

### Overall Purpose and Responsibility

This module serves as the FreeBSD 14 compatibility layer within the libc crate's BSD Unix hierarchy, defining platform-specific types and structures that have evolved from earlier FreeBSD versions. It bridges the gap between Rust code and FreeBSD 14's kernel interfaces, providing safe bindings for system programming.

### Key Components and Architecture

**Core Module (`mod.rs`)**
- **Updated Type Definitions**: Provides 64-bit versions of fundamental types (`nlink_t`, `dev_t`, `ino_t`) that were smaller in previous FreeBSD versions
- **Critical System Structures**: Defines essential kernel data structures including:
  - `kinfo_proc`: Comprehensive process information (80+ fields)
  - `kevent`: Kernel event notification for kqueue mechanism
  - `stat`/`statfs`: File and filesystem metadata with FreeBSD 14-specific layouts
  - `shmid_ds`: System V shared memory descriptors
- **Device Number Utilities**: Safe const functions for device number manipulation
- **External Function Bindings**: System call interfaces for memory management, message queues, and kernel memory access

**Architecture-Specific Extensions (`x86_64.rs`)**
- **Security Feature Controls**: KPTI (Kernel Page-Table Isolation) management constants
- **Memory Management**: Linear address space control (48-bit vs 57-bit addressing)
- **Process Control Interface**: Constants for `procctl()` system call operations

### Public API Surface

**Main Entry Points:**
- Type aliases for system types (`nlink_t`, `dev_t`, `ino_t`, etc.)
- System structure definitions (`kinfo_proc`, `kevent`, `stat`, `statfs`)
- Device number manipulation functions (`makedev()`, `major()`, `minor()`)
- External function declarations for system calls and library functions
- Architecture-specific process control constants

**Key Patterns:**
- Structure definitions use libc crate macros (`s!`, `s_no_extra_traits!`)
- Conditional trait implementations based on "extra_traits" feature
- Architecture-conditional compilation for platform-specific features

### Internal Organization and Data Flow

The module follows a hierarchical organization:
1. **Base type definitions** establish fundamental data types
2. **System structures** define kernel interface data layouts
3. **Constants and enums** provide symbolic names for system values
4. **Function bindings** expose system call interfaces
5. **Architecture modules** extend with platform-specific definitions

Data flow typically involves:
- User code imports types and constants from this module
- Structures are used to interface with kernel through system calls
- Architecture-specific constants control hardware-dependent features

### Important Patterns and Conventions

- **Binary Compatibility**: Careful field ordering and padding ensures ABI compatibility with FreeBSD 14 kernel structures
- **Feature Gating**: Conditional compilation allows architecture-specific optimizations
- **Safety**: Const functions for device number manipulation provide compile-time safety
- **Extensibility**: Modular architecture allows easy addition of new FreeBSD versions
- **Standard Compliance**: Follows POSIX and BSD conventions while accommodating FreeBSD-specific extensions

This module is essential for any Rust application targeting FreeBSD 14 systems, providing the foundational types and interfaces needed for system programming, process management, file operations, and hardware-specific functionality.