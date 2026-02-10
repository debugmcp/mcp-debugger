# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b32/mod.rs
@source-hash: 5b10ebe56435d868
@generated: 2026-02-09T18:02:20Z

**Purpose**: Provides 32-bit architecture type definitions and constants for Android platforms in the libc crate. This module defines platform-specific types, structures, and constants that are common to ARM and i686 architectures but may differ for MIPS.

**Key Type Definitions (L6-12)**:
- `mode_t = u16`: File permission mode type
- `off64_t = c_longlong`: 64-bit file offset type
- `sigset_t = c_ulong`: Signal set type
- `socklen_t = i32`: Socket address length type
- `time64_t = i64`: 64-bit time type
- `__u64 = c_ulonglong`, `__s64 = c_longlong`: Kernel unsigned/signed 64-bit types

**Core Structures**:
- `sigaction` (L17-22): Signal handler configuration with function pointer, mask, flags, and optional restorer
- `stat`/`stat64` (L29-71): File metadata structures with device, inode, permissions, timestamps, and size information
- `statfs`/`statfs64` (L73-86, L147-160): Filesystem statistics including block counts, free space, and filesystem type
- `statvfs64` (L88-100): Extended filesystem statistics compatible with POSIX statvfs
- `rlimit64` (L24-27): 64-bit resource limit structure

**Threading Structures**:
- `pthread_attr_t` (L102-109): Thread attributes including stack configuration and scheduling policy
- `pthread_mutex_t` (L111-113): Simple mutex with single integer value
- `pthread_cond_t` (L115-117): Condition variable with single integer value
- `pthread_rwlock_t` (L119-128): Read-write lock with complex internal state tracking
- `pthread_barrier_t` (L130-132): Thread barrier with private storage
- `pthread_spinlock_t` (L134-136): Spinlock with minimal private storage

**System Structures**:
- `passwd` (L138-145): User account information structure
- `sysinfo` (L162-177): System information including uptime, memory usage, and process counts
- `sigset64_t` (L181-183): 64-bit signal set defined without extra traits

**Constants**:
- Signal action flags (L187-193): `SA_*` constants for signal handling behavior
- Runtime linking flags (L195-197): `RTLD_*` constants for dynamic loading
- Pthread constants (L202-216): Initializers and stack/CPU set sizes
- Signal stack sizes (L222-223): `SIGSTKSZ` and `MINSIGSTKSZ` definitions

**External Functions**:
- `timegm64` (L226): Converts broken-down time to 64-bit timestamp

**Architecture Dispatch (L229-239)**:
Uses `cfg_if!` to conditionally include x86 or ARM specific modules based on target architecture, with fallback for unknown architectures.

**Dependencies**: Imports from `crate::prelude::*` and references various crate-level type aliases (`ino_t`, `uid_t`, `gid_t`, etc.).