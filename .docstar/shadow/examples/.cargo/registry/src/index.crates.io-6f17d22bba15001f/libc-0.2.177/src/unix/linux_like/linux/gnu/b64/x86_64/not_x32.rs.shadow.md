# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/x86_64/not_x32.rs
@source-hash: 07240332eaf44996
@generated: 2026-02-09T17:57:12Z

**Purpose**: Platform-specific definitions for 64-bit x86_64 GNU Linux (non-x32 mode) within the libc crate. Provides architecture-specific system call numbers, pthread mutex initializers, and low-level system structures.

**Key Components**:

- **`statvfs` struct (L5-18)**: Filesystem statistics structure with fields for block sizes, counts, and limits. Contains private spare field for future expansion.

- **Pthread Constants (L21-23)**: Architecture-specific sizes for pthread primitives:
  - `__SIZEOF_PTHREAD_MUTEX_T`: 40 bytes
  - `__SIZEOF_PTHREAD_RWLOCK_T`: 56 bytes  
  - `__SIZEOF_PTHREAD_BARRIER_T`: 32 bytes

- **Pthread Mutex Initializers (L25-66)**: Endian-specific static initializers for specialized mutex types:
  - `PTHREAD_RECURSIVE_MUTEX_INITIALIZER_NP`: Recursive mutex (type value 1 at different positions based on endianness)
  - `PTHREAD_ERRORCHECK_MUTEX_INITIALIZER_NP`: Error-checking mutex (type value 2)
  - `PTHREAD_ADAPTIVE_MUTEX_INITIALIZER_NP`: Adaptive mutex (type value 3)
  - Little-endian stores type at position 16, big-endian at position 19

- **System Call Table (L70-435)**: Complete x86_64 Linux syscall number mappings from 0-462, including:
  - Core I/O operations (read=0, write=1, open=2, etc.)
  - Process management (fork=57, execve=59, exit=60, etc.)
  - Networking (socket=41, bind=49, listen=50, etc.)  
  - Modern syscalls (io_uring_setup=425, landlock_*=444-446, etc.)
  - Some deprecated syscalls marked with `#[deprecated]` attributes (L244, L248, L250)

- **`sysctl` function (L437-446)**: External C function declaration for BSD-style system control interface.

**Dependencies**: 
- Uses `crate::prelude::*` for common type definitions
- Imports `pthread_mutex_t` type from crate root
- References `fsblkcnt_t`, `fsfilcnt_t` filesystem count types

**Architecture Notes**:
- Specific to x86_64 architecture (not x32 mode)
- Handles both little and big-endian variants for mutex initializers
- Syscall numbers match standard Linux x86_64 ABI
- Gap in syscall numbers between 332-424 and 450-462 reflects kernel evolution