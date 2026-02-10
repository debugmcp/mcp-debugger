# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/mod.rs
@source-hash: e3055a6690ed1dc6
@generated: 2026-02-09T17:56:53Z

**File: musl/b64/mod.rs**

**Primary Purpose**: Provides 64-bit platform-specific C FFI type definitions for the musl C library on Linux-like systems. This module defines data structures and constants that map to their C counterparts for system programming interfaces.

**Key Type Definitions**:
- `regoff_t` (L3): Regular expression offset type alias to `c_long`
- `stack_t` (L8-12): Signal stack structure with stack pointer, flags, and size (excluded on MIPS64)
- `pthread_attr_t` (L14-16): POSIX thread attributes as 7x u64 array
- `sigset_t` (L18-20): Signal set representation as 16x c_ulong array
- `shmid_ds` (L24-35): Shared memory segment descriptor (excluded on PowerPC64)
- `msqid_ds` (L37-49): Message queue descriptor with permissions and metadata
- `msghdr` (L51-67): Socket message header with endian-aware padding
- `cmsghdr` (L69-77): Control message header with endian-specific layout
- `sem_t` (L79-81): POSIX semaphore as 8x c_int array

**Critical Constants** (L84-86):
- `__SIZEOF_PTHREAD_RWLOCK_T`: 56 bytes
- `__SIZEOF_PTHREAD_MUTEX_T`: 40 bytes  
- `__SIZEOF_PTHREAD_BARRIER_T`: 32 bytes

**Architecture Dispatch** (L88-116): Uses `cfg_if!` macro to conditionally include architecture-specific modules:
- aarch64, mips64, powerpc64, s390x, x86_64, riscv64, loongarch64, wasm32
- Each architecture module provides specialized implementations via wildcard re-exports

**Dependencies**: 
- `crate::prelude::*` for common types
- Various crate-level types (`ipc_perm`, `time_t`, `pid_t`, etc.)

**Notable Patterns**:
- Endian-aware struct layouts with conditional padding fields
- Architecture-specific exclusions using `#[cfg(not(target_arch = "..."))]`
- Opaque handle representations using fixed-size arrays for ABI compatibility