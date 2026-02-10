# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/vxworks/mod.rs
@source-hash: 29474e4025c3bccc
@generated: 2026-02-09T18:06:38Z

## VxWorks C Library Interface Module

**Primary Purpose**: Provides comprehensive Rust bindings for the VxWorks real-time operating system's C library, including POSIX-compatible types, structures, constants, and function declarations.

**Architecture**: Single-file module that aggregates all VxWorks-specific definitions, with architecture-specific sub-modules included at the end (L1991-2017).

### Key Type Definitions

**Fundamental Types** (L16-96):
- Standard C integer types: `intmax_t`, `uintmax_t`, `uintptr_t`, `intptr_t`, `size_t`, etc.
- System types: `pid_t`, `uid_t`, `gid_t`, `time_t`, `off_t`, `mode_t`
- VxWorks-specific types: `_Vx_OBJ_HANDLE`, `TASK_ID`, `RTP_ID`, `SEM_ID`

**Opaque Types** (L7-14, 98-106, 1057-1072):
- `DIR` enum for directory operations 
- `_Vx_semaphore` enum for VxWorks semaphores
- `FILE` and `fpos_t` enums for C file operations

### Core Data Structures

**Threading Primitives** (L131-317):
- `pthread_mutex_t` and `pthread_mutexattr_t` - mutex synchronization
- `pthread_cond_t` and `pthread_condattr_t` - condition variables  
- `pthread_rwlock_t` and `pthread_rwlockattr_t` - reader-writer locks
- `pthread_attr_t` - thread attributes including stack, scheduling

**System Structures** (L166-404):
- `timeval`/`timespec` - time representation
- `stat` - file metadata (L219-238)
- `sockaddr` family - network addressing (L178-390)
- `sigaction`/`siginfo_t` - signal handling (L272-295)
- `addrinfo` - network name resolution (L362-371)

**VxWorks-Specific** (L422-441):
- `RTP_DESC` - Real-Time Process descriptor
- `sockaddr_storage` - generic socket address storage

### Union Types and Conditional Traits

**Signal Handling Unions** (L442-451):
- `sa_u_t` - signal handler function pointers
- `sigval` - signal value payload

**Conditional Trait Implementations** (L454-496): Hash, PartialEq, Eq traits for unions when `extra_traits` feature is enabled.

### Constants and Configuration

**System Limits** (L498-967):
- File descriptors: `STDIN_FILENO`, `STDOUT_FILENO`, `STDERR_FILENO`
- Error codes: Comprehensive errno definitions (L552-644)
- Signal numbers: POSIX and VxWorks-specific signals (L906-963)
- Socket options and protocols (L766-852)

**Threading Constants** (L521-537):
- Pthread initialization values and mutex types
- Static initializers for synchronization primitives (L973-1018)

### Function Bindings

**Standard C Library** (L1112-1203): Character classification, file I/O, string manipulation, memory management.

**System Calls** (L1205-1934):
- File operations: `open`, `read`, `write`, `stat`, `ftruncate`
- Process management: `fork`, `exec`, `wait`, `getpid`
- Threading: Complete pthread API
- Networking: BSD socket interface
- Signal handling: `sigaction`, `kill`, `sigqueue`
- VxWorks-specific: `taskDelay`, `rtpSpawn`, random number generation

### Utility Functions and Macros

**Process Status Macros** (L1939-1958): `WIFEXITED`, `WIFSIGNALED`, `WEXITSTATUS` etc. for interpreting wait status.

**Custom Implementations** (L1960-1988):
- `pread`/`pwrite` - stub implementations (always return -1)
- `posix_memalign` - aligned memory allocation using VxWorks `memalign`

### Architecture Integration

**Conditional Compilation** (L1990-2017): Includes architecture-specific modules for aarch64, arm, x86, x86_64, powerpc variants, and RISC-V, with fallback for unknown architectures.

**Dependencies**: 
- `core::ptr::null_mut` for null pointer constants
- `crate::prelude::*` for common libc types
- Architecture-specific modules for platform-specific definitions

**Critical Design Patterns**:
- Extensive use of `extern "C"` blocks for C ABI compatibility
- Opaque enum types for C structures that shouldn't be constructed in Rust
- Static initializers using `null_mut()` for thread-safe initialization
- Comprehensive constant definitions matching VxWorks headers