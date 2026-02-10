# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/mod.rs
@source-hash: e3055a6690ed1dc6
@generated: 2026-02-09T17:58:13Z

## Purpose
Architecture-specific type definitions and constants for 64-bit Linux systems using musl libc. This file provides platform-specific implementations of POSIX and Linux system structures with proper alignment and padding for different CPU architectures.

## Key Type Definitions
- `regoff_t` (L3): Type alias for regex offset as `c_long`
- `stack_t` (L8-12): Signal stack structure with stack pointer, flags, and size (excluded for MIPS64)
- `pthread_attr_t` (L14-16): pthread attribute structure using fixed-size array of 7 u64 values
- `sigset_t` (L18-20): Signal set representation using array of 16 unsigned long values
- `shmid_ds` (L24-35): Shared memory segment descriptor (excluded for PowerPC64)
- `msqid_ds` (L37-49): Message queue descriptor with timestamps and process IDs
- `msghdr` (L51-67): Socket message header with endianness-specific padding
- `cmsghdr` (L69-77): Control message header with endianness-aware field ordering
- `sem_t` (L79-81): Semaphore type using array of 8 integers

## Architecture Constants
- `__SIZEOF_PTHREAD_RWLOCK_T` (L84): 56 bytes for pthread read-write lock
- `__SIZEOF_PTHREAD_MUTEX_T` (L85): 40 bytes for pthread mutex  
- `__SIZEOF_PTHREAD_BARRIER_T` (L86): 32 bytes for pthread barrier

## Architecture-Specific Modules
The `cfg_if!` block (L88-116) conditionally includes architecture-specific modules:
- aarch64 (L90-91)
- mips64 (L93-94) 
- powerpc64 (L96-97)
- s390x (L99-100)
- x86_64 (L102-103)
- riscv64 (L105-106)
- loongarch64 (L108-109)
- wasm32 (L111-112)

## Key Patterns
- Uses `s!` macro for struct definitions (common libc pattern)
- Conditional compilation based on target architecture and endianness
- Explicit padding fields (`__pad1`, `__pad2`) for proper memory layout
- Architecture-specific exclusions for MIPS64 and PowerPC64 structures
- Endianness-aware field ordering in network-related structures

## Dependencies
- `crate::prelude::*` (L1): Standard libc prelude types
- Various libc types: `c_void`, `c_int`, `c_long`, `c_ulong`, `size_t`, etc.
- Cross-references to other crate modules for IPC and time types