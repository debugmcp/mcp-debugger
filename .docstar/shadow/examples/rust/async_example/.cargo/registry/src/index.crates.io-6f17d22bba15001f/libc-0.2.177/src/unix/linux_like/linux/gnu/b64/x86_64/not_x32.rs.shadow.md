# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/x86_64/not_x32.rs
@source-hash: 07240332eaf44996
@generated: 2026-02-09T17:56:59Z

## Purpose
Architecture-specific definitions for x86_64 GNU/Linux systems (excluding x32 ABI). Part of the libc crate's platform-specific bindings layer, providing low-level system interface constants and types.

## Key Components

### File System Structure (`statvfs`)
- **statvfs struct (L5-18)**: POSIX filesystem statistics structure
  - Contains block counts (`f_blocks`, `f_bfree`, `f_bavail`), file counts (`f_files`, `f_ffree`, `f_favail`)
  - Block and fragment sizes (`f_bsize`, `f_frsize`)
  - Filesystem ID and flags (`f_fsid`, `f_flag`)
  - Maximum filename length (`f_namemax`)
  - Reserved padding field (`__f_spare`)

### Threading Constants
- **Pthread size constants (L21-23)**: Architecture-specific sizes for pthread primitives
  - `__SIZEOF_PTHREAD_MUTEX_T: 40 bytes`
  - `__SIZEOF_PTHREAD_RWLOCK_T: 56 bytes` 
  - `__SIZEOF_PTHREAD_BARRIER_T: 32 bytes`

### Mutex Initializers
- **Endian-specific mutex initializers (L25-66)**: Pre-configured pthread mutex constants
  - Little-endian variants (L26-45): Recursive, errorcheck, and adaptive mutexes
  - Big-endian variants (L47-66): Same mutex types with different byte ordering
  - Each uses 40-byte arrays with specific values at different positions based on endianness

### System Call Table
- **Complete x86_64 syscall mapping (L70-435)**: Comprehensive syscall number definitions
  - Classic syscalls (L70-130): Basic I/O, memory, process operations
  - Signal handling (L83-85, L127-130, L197-200): Real-time signal syscalls
  - File operations (L70-89, L137-166): File/directory manipulation
  - Network syscalls (L111-125): Socket operations
  - Process management (L126-132, L172-190): Fork, exec, kill, user/group operations
  - Modern additions (L407-435): Recent kernel features like io_uring, pidfd, landlock
  - Deprecated syscalls marked with `#[deprecated]` attributes (L244-251)

### External Functions
- **sysctl function (L437-446)**: BSD-style system control interface
  - Direct kernel parameter access/modification
  - Takes name array, old/new value buffers, and size parameters

## Architecture Details
- **Target**: x86_64 GNU/Linux (not x32 ABI variant)
- **Endianness handling**: Conditional compilation for mutex initializers based on target endianness
- **ABI compatibility**: Ensures correct structure layouts and sizes for system interface

## Dependencies
- Imports from crate prelude and pthread types
- Uses crate-defined type aliases (`fsblkcnt_t`, `fsfilcnt_t`, `pthread_mutex_t`)
- Relies on C primitive types (`c_long`, `c_int`, `c_ulong`, etc.)

## Usage Context
This file provides the foundation for system calls and threading primitives on x86_64 GNU/Linux systems, enabling higher-level libc functionality to interface correctly with the kernel.