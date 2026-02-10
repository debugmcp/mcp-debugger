# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b64/mod.rs
@source-hash: 04346a4a75b7cf20
@generated: 2026-02-09T17:57:24Z

## Purpose
Android 64-bit platform-specific type definitions and constants for the libc crate. Provides FFI bindings for system structures, threading primitives, and filesystem operations on Android ARM64/x86_64 platforms.

## Key Type Definitions
- **Basic Types (L6-8)**: `mode_t`, `off64_t`, `socklen_t` - fundamental POSIX types
- **Signal Handling (L11-22)**: `sigset_t` and `sigaction` structures for signal management
- **System Info (L24-79)**: `rlimit64`, `sysinfo`, `statfs` structures for resource limits and filesystem info
- **Threading (L29-37, L111-117, L121-142)**: `pthread_attr_t`, `pthread_barrier_t`, `pthread_spinlock_t`, `pthread_mutex_t`, `pthread_cond_t`, `pthread_rwlock_t` - POSIX threading primitives
- **User Management (L39-47)**: `passwd` structure for user account information
- **Filesystem (L49-109)**: `statfs`, `statfs64`, `statvfs64` structures for filesystem statistics

## Architecture Dependencies
- **Multi-arch Support (L279-292)**: Conditionally includes x86_64, aarch64, or riscv64 specific definitions
- **Platform Note (L3-4)**: Definitions are verified for aarch64/x86_64 but may need validation for mips64

## Threading Implementation Details
- **Manual Trait Implementations (L145-215)**: Custom `PartialEq`, `Eq`, and `Hash` implementations for pthread types when `extra_traits` feature is enabled
- **Initializer Constants (L230-246)**: Zero-initialized constants for pthread primitives
- **Thread Stack Requirements (L246-248)**: Minimum stack size and CPU set configuration

## System Integration
- **Android Compatibility (L254-268)**: Custom `accept4` function implementation using syscalls for Android < 5.0 compatibility
- **Property System (L270-277)**: Android-specific property system function `__system_property_wait`
- **Signal Constants (L217-224)**: Signal action flags matching `sigaction.sa_flags` type
- **Runtime Linking (L226-228)**: Dynamic loader constants for shared library loading

## Dependencies
- Imports from `crate::prelude::*` (L1)
- References parent crate types via `crate::` prefix throughout
- Uses `cfg_if!` macro for conditional compilation
- Employs `s!` and `s_no_extra_traits!` macros for structure definitions