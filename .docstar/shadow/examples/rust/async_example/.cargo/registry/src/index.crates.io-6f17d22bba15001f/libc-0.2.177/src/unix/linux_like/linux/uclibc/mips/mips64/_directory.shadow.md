# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/mips/mips64/
@generated: 2026-02-09T18:16:07Z

## Purpose
This directory provides the complete platform-specific type definitions and data structures for MIPS64 architecture running on uClibc Linux systems. It serves as a leaf module in the libc crate's hierarchical platform abstraction, delivering the final layer of architecture-specific C ABI bindings.

## Architecture Context
- **Target Platform**: MIPS64 with uClibc on Linux
- **Position**: Terminal node in libc's unix/linux_like/linux/uclibc/mips/mips64 hierarchy
- **Scope**: 64-bit specific type aliases, struct layouts, and constants for MIPS64

## Key Components and Organization

### Core Type System
The module establishes fundamental C type mappings for MIPS64:
- **Primitive Types**: 64-bit aware aliases (`ino_t` as `u64`, `off_t`/`time_t` as `i64`)
- **Block Types**: Filesystem block counting (`blkcnt_t`, `fsblkcnt_t`)
- **Character Types**: Wide character support (`wchar_t` as `i32`)

### Data Structure Categories

**File System Interface**
- `stat`/`stat64`: File metadata with MIPS64-specific field layout and padding
- `statfs`: Filesystem statistics and capacity information

**Inter-Process Communication**
- `ipc_perm`: Permission structures for IPC objects
- `shmid_ds`: Shared memory segment descriptors
- `msqid_ds`: Message queue management structures

**Signal Handling Framework**
- `sigaction`: Signal handler configuration
- `sigset_t`: 128-bit signal masks for MIPS64
- `siginfo_t`/`stack_t`: Signal context and stack management

**Threading and Synchronization**
- `pthread_attr_t`: Thread creation attributes
- `sem_t`: Semaphore objects with architecture-specific alignment
- Size constants for pthread objects (mutex, rwlock, barrier)

**Network Communication**
- `msghdr`/`cmsghdr`: Socket message passing structures

**System Interface**
- `termios`: Terminal I/O control structures
- `sysinfo`: System resource and status information

## Public API Surface
This module exports all type definitions as public interfaces, serving as the authoritative source for MIPS64/uClibc-specific C types within the Rust ecosystem. The primary entry points are:

- **Type Aliases**: Platform-specific primitive type mappings
- **Structure Definitions**: Complete C ABI-compatible data structures
- **Constants**: Architecture-specific size definitions for threading primitives

## Internal Organization and Data Flow
The module follows libc's standard patterns:
- Uses `s!` macro for consistent struct definition syntax
- Implements careful field ordering and padding to match C ABI requirements
- Provides both 32-bit legacy (`stat`) and 64-bit native (`stat64`) variants where needed
- Maintains strict alignment requirements through conditional compilation

## Integration Patterns
- **Hierarchical Inheritance**: Inherits common definitions from parent modules while providing MIPS64-specific overrides
- **ABI Compliance**: Ensures binary compatibility with uClibc's MIPS64 implementation
- **Conditional Compilation**: Uses target-specific attributes for proper memory layout

This module represents the final specialization layer in libc's platform abstraction hierarchy, providing the precise type definitions needed for safe FFI interactions with uClibc-based MIPS64 Linux systems.