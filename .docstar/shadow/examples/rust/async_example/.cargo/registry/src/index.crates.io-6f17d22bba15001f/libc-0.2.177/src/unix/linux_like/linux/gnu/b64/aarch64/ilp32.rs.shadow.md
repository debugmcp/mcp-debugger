# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/aarch64/ilp32.rs
@source-hash: 638b2d717dcf5b59
@generated: 2026-02-09T17:56:54Z

## Primary Purpose
Platform-specific constants and mutex initializers for aarch64 ILP32 architecture on GNU Linux systems. This file provides pthread synchronization primitive sizes and endian-aware mutex initializers as part of the libc crate's Unix bindings.

## Key Constants and Definitions

### Pthread Size Constants (L4-9)
- `__SIZEOF_PTHREAD_CONDATTR_T` (L4): Condition variable attribute size (4 bytes)
- `__SIZEOF_PTHREAD_MUTEX_T` (L5): Mutex size (32 bytes) 
- `__SIZEOF_PTHREAD_MUTEXATTR_T` (L6): Mutex attribute size (4 bytes)
- `__SIZEOF_PTHREAD_RWLOCK_T` (L7): Read-write lock size (48 bytes)
- `__SIZEOF_PTHREAD_BARRIERATTR_T` (L8): Barrier attribute size (4 bytes)
- `__SIZEOF_PTHREAD_BARRIER_T` (L9): Barrier size (20 bytes)

### Endian-Aware Mutex Initializers
#### Little Endian (L11-31)
- `PTHREAD_RECURSIVE_MUTEX_INITIALIZER_NP` (L12-17): Recursive mutex with type=1 at byte 12
- `PTHREAD_ERRORCHECK_MUTEX_INITIALIZER_NP` (L19-24): Error-checking mutex with type=2 at byte 12  
- `PTHREAD_ADAPTIVE_MUTEX_INITIALIZER_NP` (L26-31): Adaptive mutex with type=3 at byte 12

#### Big Endian (L32-52)
- `PTHREAD_RECURSIVE_MUTEX_INITIALIZER_NP` (L33-38): Recursive mutex with type=1 at byte 15
- `PTHREAD_ERRORCHECK_MUTEX_INITIALIZER_NP` (L40-45): Error-checking mutex with type=2 at byte 15
- `PTHREAD_ADAPTIVE_MUTEX_INITIALIZER_NP` (L47-52): Adaptive mutex with type=3 at byte 15

### System Call Constants
- `SYS_sync_file_range2` (L54): System call number 84 for file synchronization

## Dependencies
- `crate::prelude::*` (L1): Common type definitions
- `crate::pthread_mutex_t` (L2): Mutex type structure

## Architectural Patterns
- **Conditional compilation**: Uses `#[cfg(target_endian = "...")]` to provide endian-specific implementations
- **Static initialization**: All mutex initializers are compile-time constants with 32-byte arrays
- **Type differentiation**: Mutex types encoded in specific array positions (byte 12 for little-endian, byte 15 for big-endian)

## Critical Constraints
- All mutex initializers must match the 32-byte `pthread_mutex_t` structure size
- Endianness affects the position of the mutex type identifier within the byte array
- ILP32 model: integers, longs, and pointers are 32-bit on this aarch64 variant