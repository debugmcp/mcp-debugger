# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b64/mod.rs
@source-hash: 04346a4a75b7cf20
@generated: 2026-02-09T18:02:24Z

## Purpose
Android 64-bit platform-specific libc FFI definitions module. Provides C type aliases, struct definitions, constants, and function bindings specifically for Android's 64-bit architectures (aarch64, x86_64, riscv64). Part of the libc crate's hierarchical platform-specific type system.

## Architecture Context
Definitions are correct for aarch64 and x86_64 but potentially incorrect for mips64 (L3-4). Module conditionally includes architecture-specific submodules (L279-292).

## Key Type Aliases (L6-8)
- `mode_t = u32` - File permission mode type
- `off64_t = i64` - 64-bit file offset type  
- `socklen_t = u32` - Socket address length type

## Core System Structures

### Signal Handling (L11-22)
- `sigset_t` (L11-13): Signal set with single `c_ulong` array
- `sigaction` (L17-22): Signal action handler with flags, handler function pointer, mask, and optional restorer function

### Threading Primitives
**s! macro structures (L24-118):**
- `pthread_attr_t` (L29-37): Thread attributes including stack, scheduling, and guards
- `pthread_barrier_t` (L111-113): Barrier synchronization primitive
- `pthread_spinlock_t` (L115-117): Spinlock primitive

**s_no_extra_traits! structures (L121-143):**
- `pthread_mutex_t` (L121-124): Mutex with value and reserved space
- `pthread_cond_t` (L126-129): Condition variable with similar layout
- `pthread_rwlock_t` (L131-138): Read-write lock with lock counters and thread tracking
- `sigset64_t` (L140-142): 64-bit signal set

### File System Structures (L24-109)
- `rlimit64` (L24-27): 64-bit resource limits
- `passwd` (L39-47): User account information
- `statfs` (L49-62): File system statistics
- `sysinfo` (L64-79): System information including memory and load
- `statfs64`/`statvfs64` (L81-109): 64-bit file system stat variants

## Conditional Trait Implementations (L145-215)
When "extra_traits" feature is enabled, provides manual `PartialEq`, `Eq`, and `Hash` implementations for pthread types that compare/hash both value fields and reserved padding arrays.

## Constants
- Signal action flags (L218-224): `SA_*` constants for sigaction behavior
- Dynamic linking flags (L226-228): `RTLD_*` constants  
- Pthread initializers (L230-245): Static initializers for mutex, condition variable, and rwlock
- System limits (L246-252): Stack sizes, CPU set sizes, and UT buffer sizes

## Platform Functions
- `accept4` (L260-267): Socket accept with flags, implemented via direct syscall for Android <5.0 compatibility
- `__system_property_wait` (L271-276): Android system property waiting function

## Architecture Dispatch (L279-292)
Conditionally includes and re-exports platform-specific definitions:
- x86_64 module for x86_64 targets
- aarch64 module for ARM64 targets  
- riscv64 module for RISC-V 64 targets
- No-op for unknown architectures

## Dependencies
- `crate::prelude::*` (L1): Core libc types and macros
- External crate types via `crate::` references throughout
- Architecture-specific submodules conditionally included