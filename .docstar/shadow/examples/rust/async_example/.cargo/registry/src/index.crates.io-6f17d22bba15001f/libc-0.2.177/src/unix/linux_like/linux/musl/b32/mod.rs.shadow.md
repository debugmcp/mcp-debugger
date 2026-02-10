# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b32/mod.rs
@source-hash: e0f53df7ca1dbe9b
@generated: 2026-02-09T17:56:54Z

## musl libc 32-bit Platform Type Definitions

**Primary Purpose:** Platform-specific type definitions and structures for 32-bit musl libc implementations on Linux. This module serves as an architectural abstraction layer that provides common types and structures while delegating architecture-specific details to submodules.

### Core Type Definitions (L3-7)
- `nlink_t = u32` - File link count type
- `blksize_t = c_long` - Block size type for filesystem operations
- `__u64 = c_ulonglong` - Internal 64-bit unsigned integer
- `__s64 = c_longlong` - Internal 64-bit signed integer  
- `regoff_t = c_int` - Regular expression offset type

### Key Structures (L9-37)
All structures defined within `s!` macro block:

**`pthread_attr_t` (L10-12):** POSIX thread attributes structure with 9 u32 elements totaling 36 bytes

**`sigset_t` (L14-16):** Signal set representation using 32 c_ulong elements (128 bytes on 32-bit)

**`msghdr` (L18-26):** Socket message header for sendmsg/recvmsg operations
- Contains pointers to name, iovec array, control data
- Includes lengths and flags for message handling

**`cmsghdr` (L28-32):** Control message header for ancillary socket data
- Standard cmsg_len, cmsg_level, cmsg_type fields

**`sem_t` (L34-36):** POSIX semaphore structure with 4 c_int elements

### Platform Constants (L39-41)
- `__SIZEOF_PTHREAD_RWLOCK_T: usize = 32` - Read-write lock size
- `__SIZEOF_PTHREAD_MUTEX_T: usize = 24` - Mutex size  
- `__SIZEOF_PTHREAD_BARRIER_T: usize = 20` - Barrier size

### Architecture Dispatch (L43-65)
Conditional compilation block using `cfg_if!` macro that imports architecture-specific implementations:
- x86 (L44-46)
- MIPS (L47-49) 
- ARM (L50-52)
- PowerPC (L53-55)
- Hexagon (L56-58)
- RISC-V 32-bit (L59-61)

**Dependencies:**
- `crate::prelude::*` for common libc types
- `crate::socklen_t`, `crate::iovec` for socket structures
- Architecture-specific submodules via conditional compilation

**Architectural Pattern:** This follows the libc crate's layered architecture where common 32-bit musl definitions are centralized here, while architecture-specific details are delegated to specialized modules. The structure sizes are critical for ABI compatibility.