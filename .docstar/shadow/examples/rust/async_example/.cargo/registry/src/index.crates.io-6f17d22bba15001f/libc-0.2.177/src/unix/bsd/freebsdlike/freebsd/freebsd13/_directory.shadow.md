# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd13/
@generated: 2026-02-09T18:16:08Z

## Overall Purpose and Responsibility

This directory provides FreeBSD 13-specific system bindings for the libc crate, containing low-level C types, structures, and function declarations that have changed since FreeBSD 11. It serves as the platform-specific layer in the BSD family hierarchy (unix → bsd → freebsdlike → freebsd → freebsd13), delivering modern 64-bit system interfaces and new kernel features specific to FreeBSD 13.

## Key Components and Architecture

### Core Module Structure
- **mod.rs**: Main module containing system types, structures, constants, and function bindings
- **x86_64/**: Architecture-specific submodule providing platform-dependent constants and features

### Major System Interface Categories

**Enhanced Data Types**: Modern 64-bit types (`nlink_t`, `dev_t`, `ino_t`) replacing smaller variants from FreeBSD 11, plus NUMA-aware types (`domainset_t`) and kernel virtual memory types (`kpaddr_t`, `kssize_t`).

**Critical System Structures**:
- `kinfo_proc`: Comprehensive 180+ field process information structure for system monitoring
- `kevent`: Kernel event notification for efficient I/O multiplexing via kqueue
- `shmid_ds`: Shared memory segment management
- `stat`/`statfs`: Enhanced file and filesystem metadata with extended timestamps
- `kvm_page`: Kernel virtual memory page descriptors

**Architecture-Specific Extensions**: Platform constants for security features like KPTI (Kernel Page Table Isolation) control on x86_64.

## Public API Surface

### Main Entry Points
- **Type definitions**: Modern 64-bit system types (`nlink_t`, `dev_t`, `ino_t`, etc.)
- **System structures**: Process info (`kinfo_proc`), file metadata (`stat`, `statfs`), event handling (`kevent`)
- **Device utilities**: Safe const functions (`makedev()`, `major()`, `minor()`)
- **System calls**: Memory management (`mprotect()`), CPU sets (`cpuset_getdomain()`), message queues (`msgrcv()`)
- **Platform constants**: KPTI control flags, system limits, NUMA policies

### Architecture Integration
- Conditional compilation for trait implementations via "extra_traits" feature
- Platform-specific submodules (x86_64 demonstrated)
- FreeBSD-specific symbol versioning for ABI compatibility

## Internal Organization and Data Flow

The module follows a layered approach:
1. **Base types and constants** provide foundation data types
2. **System structures** define kernel-userspace interfaces  
3. **Function bindings** expose system calls and library functions
4. **Architecture-specific modules** add platform-dependent features
5. **Conditional compilation** enables optional trait implementations

Data flows from kernel structures (like `kinfo_proc`, `kevent`) through safe wrapper functions to user applications, with device number utilities providing safe manipulation of kernel identifiers.

## Important Patterns and Conventions

### Conditional Compilation Pattern
Uses `cfg_if!` macros to conditionally implement traits (`PartialEq`, `Eq`, `Hash`) based on the "extra_traits" feature, with custom equality handling for variable-length arrays.

### FreeBSD Version Targeting
Specifically targets APIs that have changed since FreeBSD 11, focusing on 64-bit enhancements and new kernel features while maintaining backward compatibility through symbol versioning.

### Platform Abstraction
Integrates with libc's hierarchical platform organization, allowing architecture-specific extensions while maintaining common BSD interfaces.

The module serves as a critical bridge between Rust applications and FreeBSD 13's enhanced system interfaces, providing type-safe access to modern kernel features while preserving compatibility with the broader BSD ecosystem.