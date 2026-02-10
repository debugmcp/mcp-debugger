# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/sparc64/mod.rs
@source-hash: ef87054c07622d4f
@generated: 2026-02-09T17:57:10Z

## Purpose and Responsibility
This file provides SPARC64-specific architecture definitions for the libc crate on GNU Linux systems. It defines platform-specific type aliases, structures, constants, and system call numbers required for SPARC64 binary compatibility with the Linux kernel ABI.

## Key Components

### Type Aliases (L6-11)
- `wchar_t`, `nlink_t`, `blksize_t`, `suseconds_t`: Platform-specific primitive type definitions
- `__u64`, `__s64`: 64-bit unsigned/signed integer types mapped to C long long variants

### Core System Structures (L13-197)
Critical structures defined within the `s!` macro for C ABI compatibility:

- `sigaction` (L16-23): Signal handler configuration with SPARC64-specific `__reserved0` field
- `statfs`/`statfs64` (L25-39, L123-136): Filesystem statistics structures with different block count types
- `siginfo_t` (L41-54): Signal information with deprecated `_pad` field
- `flock`/`flock64` (L56-71): File locking structures using different offset types
- `stat`/`stat64` (L79-121): File metadata structures with platform-specific padding
- `statvfs`/`statvfs64` (L138-166): VFS statistics with 32-bit vs 64-bit field variations
- `pthread_attr_t` (L168-170): Thread attributes as opaque 64-bit array
- `ipc_perm`/`shmid_ds` (L172-196): System V IPC permission and shared memory structures

### Alignment-Sensitive Structure (L199-204)
- `max_align_t`: 16-byte aligned structure for maximum alignment requirements

### Platform Constants (L206-919)
Extensive constant definitions organized by functional area:
- POSIX file advisory constants (L206-207)
- Terminal I/O and runtime linker flags (L209-214) 
- File operation flags (L216-227)
- Memory management constants (L229-239)
- Comprehensive errno values (L241-318)
- Socket and signal constants (L320-349)
- Terminal control flags and speeds (L376-546)
- Complete SPARC64 system call numbers (L548-919)

### External Functions (L921-930)
- `sysctl`: System control interface function for kernel parameter access

## Dependencies and Relationships
- Imports from `crate::prelude::*` for common types
- References `crate::{off64_t, off_t, pthread_mutex_t}` for file offset and mutex types
- Uses conditional compilation `#[cfg(target_arch = "sparc64")]` for architecture-specific fields
- Integrates with broader libc crate hierarchy for GNU Linux systems

## Architecture-Specific Patterns
- SPARC64-specific structure field ordering and padding
- Platform-unique constant values differing from other architectures
- 64-bit specific variants of system structures (stat64, statfs64, etc.)
- SPARC-specific system call numbering scheme

## Critical Invariants
- All structures maintain C ABI compatibility for FFI
- Deprecated fields preserved for backward compatibility
- Platform-specific padding ensures proper memory layout
- System call numbers must match kernel expectations