# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/haiku/mod.rs
@source-hash: a1e1ab46a354da23
@generated: 2026-02-09T18:02:30Z

This module provides Haiku-specific C bindings for the `libc` crate, implementing both POSIX and native Haiku APIs. It serves as the primary platform abstraction layer for Haiku OS support.

## Architecture Overview

Haiku maintains two co-equal API layers:
- **POSIX API**: Standard Unix compatibility (lines 18-19)
- **Native Haiku API**: BeOS-derived system calls (lines 22-23)

Both APIs reside in `libroot.so` with additional BSD/GNU compatibility in `libbsd.so`/`libgnu.so` (lines 12-15).

## Module Structure

- **Core types** (L27-82): Fundamental C type aliases (`rlim_t`, `pthread_t`, etc.)
- **ELF types** (L63-75): 32/64-bit ELF definitions for binary format support
- **Networking structs** (L110-162): Socket addresses, interface info (`sockaddr`, `ifaddrs`)
- **System structs** (L169-464): Core OS structures (`stat`, `termios`, `pthread_mutex_t`)
- **Constants** (L635-1516): System constants, flags, error codes
- **Function declarations** (L1619-2066): External C function bindings

## Key Components

### Signal Handling (L357-374)
- `siginfo_t` (L357-367): Signal information structure
- `sigaction` (L369-374): Signal handler configuration
- Signal constants (L758-787): Haiku-specific signal numbers

### Threading Support
- `pthread_mutex_t` (L297-303): Mutex implementation with owner tracking
- `pthread_cond_t` (L305-311): Condition variable with waiter count
- `pthread_rwlock_t` (L313-321): Read-write lock with separate counters

### Process Management
- `siginfo_t` accessor methods (L92-108): Safe access to signal info fields
- Wait status macros (L1585-1616): Process exit status interpretation

### File System
- `stat` structure (L260-280): Extended with Haiku-specific `st_crtime` field
- `dirent` (L480-487): Directory entries with device info

### Error Handling
Comprehensive error code mapping (L837-926):
- BeOS-style negative error codes
- POSIX compatibility layer
- Special Haiku extensions (e.g., `ENOATTR`)

## Platform-Specific Features

### Conditional Compilation (L2068-2091)
- Architecture-specific modules: `x86_64`, potential `aarch64` support
- Word-size specific: `b32`/`b64` modules
- Additional compatibility: `bsd`, `native` modules

### Memory Management
- `FD_SETSIZE` as `usize` rather than `c_int` (L1058)
- Special `MAP_FILE` constant for std compatibility (L822-823)

### Function Bindings
- Standard POSIX functions (L1619-2048)
- GNU compatibility layer (L2050-2066) via separate linking
- Haiku-specific extensions throughout

## Critical Invariants
- All pthread structures have specific initialization values (L1227-1249)
- Signal masks use 64-bit representation (L50)
- File descriptors limited to 1024 (L1058)
- Error codes follow BeOS negative convention