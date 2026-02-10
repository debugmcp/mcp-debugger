# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/aarch64/ilp32.rs
@source-hash: 638b2d717dcf5b59
@generated: 2026-02-09T17:56:53Z

## Purpose
Platform-specific constants and pthread mutex initializers for AArch64 ILP32 (32-bit pointers on 64-bit ARM) architecture on GNU/Linux systems. This file provides low-level C library bindings tailored to the specific memory layout and endianness requirements of this architecture variant.

## Key Constants

### Pthread Data Structure Sizes (L4-9)
- `__SIZEOF_PTHREAD_CONDATTR_T: usize = 4` - Size of pthread condition attribute structure
- `__SIZEOF_PTHREAD_MUTEX_T: usize = 32` - Size of pthread mutex structure  
- `__SIZEOF_PTHREAD_MUTEXATTR_T: usize = 4` - Size of pthread mutex attribute structure
- `__SIZEOF_PTHREAD_RWLOCK_T: usize = 48` - Size of pthread read-write lock structure
- `__SIZEOF_PTHREAD_BARRIERATTR_T: usize = 4` - Size of pthread barrier attribute structure
- `__SIZEOF_PTHREAD_BARRIER_T: usize = 20` - Size of pthread barrier structure

### Mutex Initializers by Endianness
**Little Endian (L11-31):**
- `PTHREAD_RECURSIVE_MUTEX_INITIALIZER_NP` (L12-17) - Recursive mutex with type value `1` at byte 12
- `PTHREAD_ERRORCHECK_MUTEX_INITIALIZER_NP` (L19-24) - Error-checking mutex with type value `2` at byte 12  
- `PTHREAD_ADAPTIVE_MUTEX_INITIALIZER_NP` (L26-31) - Adaptive mutex with type value `3` at byte 12

**Big Endian (L32-52):**
- `PTHREAD_RECURSIVE_MUTEX_INITIALIZER_NP` (L33-38) - Recursive mutex with type value `1` at byte 15
- `PTHREAD_ERRORCHECK_MUTEX_INITIALIZER_NP` (L40-45) - Error-checking mutex with type value `2` at byte 15
- `PTHREAD_ADAPTIVE_MUTEX_INITIALIZER_NP` (L47-52) - Adaptive mutex with type value `3` at byte 15

### System Call Number (L54)
- `SYS_sync_file_range2: c_long = 84` - System call number for sync_file_range2 on this architecture

## Key Dependencies
- `crate::prelude::*` (L1) - Common type definitions and imports
- `crate::pthread_mutex_t` (L2) - Pthread mutex type definition

## Architectural Notes
- **ILP32 Model**: 32-bit integers, longs, and pointers on 64-bit AArch64 hardware
- **Endian Handling**: Conditional compilation ensures correct byte ordering for mutex type fields
- **Memory Layout**: All mutex initializers use 32-byte arrays matching `__SIZEOF_PTHREAD_MUTEX_T`
- **Type Encoding**: Mutex types encoded as single bytes at different positions based on endianness (byte 12 for little-endian, byte 15 for big-endian)