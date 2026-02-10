# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/mod.rs
@source-hash: 30d1286c6b53a8c1
@generated: 2026-02-09T17:56:56Z

## Purpose
Defines 64-bit specific type aliases, structures, and constants for Linux-like systems in the libc crate. This module provides platform-specific definitions that adapt to different 64-bit architectures and pointer widths.

## Key Type Aliases (L5-28)
- **Core file system types (L5-12)**: `ino_t`, `off_t`, `blkcnt_t`, `shmatt_t`, `msgqnum_t`, `msglen_t`, `fsblkcnt_t`, `fsfilcnt_t`, `rlim_t` - all mapped to unsigned 64-bit integers except `off_t` and `blkcnt_t` which are signed
- **Syscall type (L14-17)**: `__syscall_ulong_t` conditionally defined as `c_ulonglong` for x86_64 with 32-bit pointers, otherwise `c_ulong`
- **Time types (L19-29)**: `clock_t`, `time_t`, and `__fsword_t` use conditional compilation - 32-bit values for aarch64 with 32-bit pointers, otherwise 64-bit

## Key Structures (L31-179)
- **sigset_t (L32-37)**: Signal set with architecture-dependent internal representation - 32×u32 array for 32-bit pointers, 16×u64 array for 64-bit pointers
- **sysinfo (L39-54)**: System information structure containing uptime, memory statistics, load averages, and process count
- **msqid_ds (L56-68)**: Message queue descriptor with permissions, timestamps, byte counts, and process IDs
- **semid_ds (L70-99)**: Semaphore set descriptor with complex conditional fields based on target architecture - includes reserved padding fields for specific architectures
- **timex (L101-178)**: Time adjustment structure for NTP with extensive conditional compilation based on x86_64 32-bit pointer configuration - most fields alternate between `i64` and `c_long` types

## Constants (L181-183)
- `__SIZEOF_PTHREAD_RWLOCKATTR_T`: Read-write lock attribute size (8 bytes)
- `O_LARGEFILE`: Large file flag (set to 0 for 64-bit systems)

## Architecture Module Selection (L185-213)
Conditional module inclusion and re-export based on target architecture:
- aarch64, powerpc64, sparc64, mips64/mips64r6, s390x, x86_64, riscv64, loongarch64
- Each architecture gets its own submodule with specialized definitions

## Dependencies
- `crate::prelude::*` (L3)
- References to parent crate types like `crate::ipc_perm`, `crate::time_t`, `crate::timeval`

## Architectural Patterns
- Heavy use of conditional compilation (`cfg_if!`, `#[cfg(...)]`) for cross-platform compatibility
- Type size adaptation based on pointer width and specific architecture quirks
- Consistent pattern of architecture-specific submodule delegation