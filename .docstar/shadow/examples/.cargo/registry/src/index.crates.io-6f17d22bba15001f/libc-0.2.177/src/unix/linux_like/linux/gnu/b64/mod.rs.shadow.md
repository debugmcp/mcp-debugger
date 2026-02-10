# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/mod.rs
@source-hash: 30d1286c6b53a8c1
@generated: 2026-02-09T17:58:14Z

## Purpose
Platform-specific type definitions and structures for 64-bit GNU Linux systems within the libc crate. Provides architecture-dependent system interfaces for Unix-like operations on Linux.

## Key Type Definitions
- **Primitive Types** (L5-17): Core system types with 64-bit sizing
  - `ino_t`, `off_t`, `blkcnt_t`, `shmatt_t` - file system and shared memory types
  - `msgqnum_t`, `msglen_t` - message queue types  
  - `fsblkcnt_t`, `fsfilcnt_t` - filesystem block/file count types
  - `rlim_t` - resource limit type
  - `__syscall_ulong_t` - conditional type based on x86_64 32-bit pointer width

- **Time Types** (L19-29): Architecture-dependent time representations
  - Uses `cfg_if!` to conditionally define `clock_t`, `time_t`, `__fsword_t`
  - 32-bit types for aarch64 with 32-bit pointers, 64-bit otherwise

## Key Structures
- **sigset_t** (L32-37): Signal set with conditional field sizing based on pointer width
  - 32-bit pointers: `[u32; 32]`, 64-bit pointers: `[u64; 16]`

- **sysinfo** (L39-54): System information structure for resource monitoring
  - Contains uptime, memory usage, swap info, process counts
  - Uses u64 for most memory-related fields

- **msqid_ds** (L56-68): Message queue descriptor for IPC operations
  - References external `ipc_perm`, `time_t`, `msgqnum_t`, `pid_t` types

- **semid_ds** (L70-99): Semaphore descriptor with complex architecture conditionals
  - Reserved fields excluded on specific 64-bit architectures (aarch64, mips64, etc.)

- **timex** (L101-178): Time adjustment structure with extensive x86_64 32-bit pointer conditionals
  - Most fields switch between `i64` and `c_long` based on target configuration
  - Contains timing precision, error tracking, and PPS (Pulse Per Second) fields

## Constants & Module Organization
- **Constants** (L181-183): Platform-specific values
  - `__SIZEOF_PTHREAD_RWLOCKATTR_T = 8`
  - `O_LARGEFILE = 0` (no-op on 64-bit systems)

- **Architecture Modules** (L185-213): Conditional module inclusion using `cfg_if!`
  - Supports: aarch64, powerpc64, sparc64, mips64/mips64r6, s390x, x86_64, riscv64, loongarch64
  - Each architecture provides additional platform-specific definitions

## Dependencies
- `crate::prelude::*` for common libc types and macros
- `cfg_if!` macro for conditional compilation
- `s!` macro (likely from libc) for structure definitions
- References to external crate types: `ipc_perm`, `time_t`, `timeval`, `pid_t`

## Architectural Patterns
- Heavy use of conditional compilation for cross-platform compatibility
- Clear separation between generic 64-bit definitions and architecture-specific ones  
- Consistent naming following POSIX/GNU conventions
- Type aliasing to provide stable API while adapting to platform differences