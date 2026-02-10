# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b32/mod.rs
@source-hash: 5b10ebe56435d868
@generated: 2026-02-09T17:57:23Z

## Primary Purpose
32-bit Android-specific libc definitions for the Rust libc crate, providing system data types, structures, and constants that interface with the Android/Linux kernel on ARM and x86 32-bit architectures.

## Key Type Definitions (L6-12)
- `mode_t = u16` - File permission mode type
- `off64_t = c_longlong` - 64-bit file offset type
- `sigset_t = c_ulong` - Signal set type
- `socklen_t = i32` - Socket length type
- `time64_t = i64` - 64-bit time type
- `__u64 = c_ulonglong`, `__s64 = c_longlong` - Kernel integer types

## Core System Structures

### Signal Handling (L17-22)
- `sigaction` struct with signal handler, mask, flags, and optional restorer function
- Contains FIXME about PartialEq implementation (L15)

### File System Operations (L24-87)
- `rlimit64` (L24-27) - Resource limits with 64-bit values
- `stat` (L29-49) - Standard file status structure with timestamps
- `stat64` (L51-71) - 64-bit version of stat structure
- `statfs64` (L73-86) - 64-bit file system statistics
- `statvfs64` (L88-100) - POSIX file system information

### Threading Primitives (L102-136)
- `pthread_attr_t` (L102-109) - Thread attributes including stack and scheduling
- `pthread_mutex_t` (L111-113) - Mutex with single integer value
- `pthread_cond_t` (L115-117) - Condition variable with integer value
- `pthread_rwlock_t` (L119-128) - Read-write lock with detailed state tracking
- `pthread_barrier_t` (L130-132) - Thread barrier with private data
- `pthread_spinlock_t` (L134-136) - Spinlock with private storage

### System Information (L138-177)
- `passwd` (L138-145) - User account information
- `statfs` (L147-160) - File system statistics (32-bit version)
- `sysinfo` (L162-177) - System information including memory and load

### Special Types (L181-183)
- `sigset64_t` with `s_no_extra_traits!` macro - 64-bit signal set without derived traits

## Constants and Initializers

### Signal Actions (L187-193)
Signal action flags matching `sigaction.sa_flags` type.

### Runtime Linking (L195-197)
RTLD constants for dynamic loading.

### Threading Constants (L202-216)
- Static initializers for pthread types (L202-213)
- Stack and CPU set size constants (L214-216)

### System Limits (L218-223)
Terminal and signal stack size constants.

## External Functions (L225-227)
- `timegm64()` - 64-bit time conversion function

## Architecture-Specific Modules (L229-239)
Conditional compilation for x86 and ARM architectures with fallback for unknown targets.

## Dependencies
- Imports from `crate::prelude::*` (L1)
- Uses various crate-level types (ino_t, uid_t, gid_t, etc.)
- Relies on cfg_if macro for conditional compilation

## Architectural Notes
- Designed specifically for 32-bit Android systems
- Structures sized for ARM/x86 compatibility with potential MIPS incompatibility (L3-4)
- Extensive use of padding fields in stat structures for alignment
- Mixed 32-bit and 64-bit types reflecting Android's transition to 64-bit support