# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd13/
@generated: 2026-02-09T18:16:14Z

## Purpose
FreeBSD 13-specific libc bindings providing C ABI-compatible system definitions that changed between FreeBSD 11 and 13. This module serves as the compatibility layer for FreeBSD 13 system interfaces, particularly focusing on upgraded data types (32-bit to 64-bit migrations) and new security features.

## Key Components and Organization

### Core Module (`mod.rs`)
The main module provides comprehensive FreeBSD 13 system bindings including:
- **Type Definitions**: Upgraded fundamental types (`nlink_t`, `dev_t`, `ino_t` as `u64`) reflecting FreeBSD's transition to 64-bit file system metadata
- **System Structures**: Critical data structures like `kinfo_proc` (process information), `stat` (file metadata), `kevent` (kernel events), and shared memory descriptors
- **External Functions**: Bindings to libc functions, KVM library, and FreeBSD-specific system calls
- **Device Utilities**: Safe const functions for device number manipulation (`makedev`, `major`, `minor`)

### Architecture Extensions (`x86_64.rs`)
Platform-specific constants for x86_64, primarily focused on:
- **KPTI Control**: Kernel Page Table Isolation management constants for security hardening
- **Process Control**: Integration with FreeBSD's `procctl()` system call for per-process security settings

## Public API Surface

### Main Entry Points
- **Type Definitions**: `dev_t`, `ino_t`, `nlink_t`, `shmatt_t`, `domainset_t` - Core system types
- **Structures**: `stat`, `kinfo_proc`, `kevent`, `shmid_ds`, `statfs`, `dirent` - Essential system data structures  
- **Constants**: `RAND_MAX`, `ELAST`, domain set policies, KPTI control flags
- **Functions**: Memory management (`mprotect`), process control (`setgrent`), CPU domain management (`cpuset_*`), KVM access

### Architecture-Specific APIs
- **KPTI Constants**: `PROC_KPTI_CTL_*` flags for controlling kernel page table isolation
- **Status Queries**: `PROC_KPTI_STATUS_*` for checking security feature state

## Internal Organization and Data Flow

### Conditional Compilation Pattern
The module uses feature-gated compilation (`extra_traits`) to provide optional trait implementations (PartialEq, Eq, Hash) for structures containing arrays or complex fields.

### Architecture Delegation
Platform-specific definitions are isolated in architecture subdirectories (x86_64) and conditionally included, enabling clean separation of portable and platform-specific code.

### ABI Compatibility Focus
All definitions maintain strict C ABI compatibility with careful attention to:
- Structure padding and alignment
- Array sizes matching FreeBSD kernel expectations
- Proper handling of variable-length structures (`dirent`, `statfs`)

## Important Patterns and Conventions

### Version-Specific Upgrades
This module specifically addresses the FreeBSD 11→13 transition, particularly the filesystem metadata expansion from 32-bit to 64-bit types, ensuring applications can handle larger file systems and inode counts.

### Security Integration
The x86_64 module demonstrates the pattern for integrating new security features (KPTI) through the existing `procctl()` system call interface, providing fine-grained per-process security control.

### Memory Safety
Device number manipulation functions are implemented as `const fn` to enable compile-time evaluation while maintaining safety and C ABI compatibility.

The module serves as a critical bridge between Rust applications and FreeBSD 13's enhanced system interfaces, enabling access to modern filesystem capabilities and security features while maintaining compatibility with existing C-based system interfaces.