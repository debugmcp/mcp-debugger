# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b32/mod.rs
@source-hash: e0f53df7ca1dbe9b
@generated: 2026-02-09T17:58:09Z

## Purpose
Provides 32-bit musl libc type definitions and constants for Linux-like systems. This is a platform-specific configuration module within the libc crate's hierarchy for musl C library on 32-bit architectures.

## Key Type Definitions (L3-7)
- `nlink_t = u32` - File link count type
- `blksize_t = c_long` - Block size type for filesystem operations
- `__u64 = c_ulonglong`, `__s64 = c_longlong` - 64-bit unsigned/signed integer types
- `regoff_t = c_int` - Regular expression offset type

## Core Structures (L9-37)
- `pthread_attr_t` (L10-12): Thread attribute structure with 9 u32 fields (`__size`)
- `sigset_t` (L14-16): Signal set representation with 32 c_ulong values (`__val`)
- `msghdr` (L18-26): Socket message header for sendmsg/recvmsg operations
  - Contains name, iovec array, control data, and flags fields
- `cmsghdr` (L28-32): Control message header for ancillary socket data
- `sem_t` (L34-36): POSIX semaphore with 4 c_int internal storage

## Threading Constants (L39-41)
- `__SIZEOF_PTHREAD_RWLOCK_T = 32` - Reader-writer lock size
- `__SIZEOF_PTHREAD_MUTEX_T = 24` - Mutex size  
- `__SIZEOF_PTHREAD_BARRIER_T = 20` - Barrier synchronization size

## Architecture Dispatch (L43-65)
Conditional compilation block that includes architecture-specific modules:
- x86 (L44-46)
- mips (L47-49) 
- arm (L50-52)
- powerpc (L53-55)
- hexagon (L56-58)
- riscv32 (L59-61)
- Fallback case for unknown architectures (L62-64)

## Dependencies
- `crate::prelude::*` (L1) - Core libc types and macros
- `cfg_if!` macro for conditional compilation
- Architecture-specific submodules via glob imports

## Patterns
- Uses `s!` macro for structure definitions (libc crate convention)
- Follows musl libc ABI specifications for 32-bit systems
- Employs conditional compilation for multi-architecture support