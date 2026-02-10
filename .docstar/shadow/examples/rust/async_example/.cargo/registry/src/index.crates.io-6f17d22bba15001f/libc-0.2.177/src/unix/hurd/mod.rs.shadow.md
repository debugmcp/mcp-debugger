# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/hurd/mod.rs
@source-hash: b09754b468b78b64
@generated: 2026-02-09T18:02:44Z

## GNU Hurd C Library Bindings - Type Definitions and System Interface

This file provides comprehensive Rust Foreign Function Interface (FFI) bindings for GNU Hurd's C library (glibc), defining system-level types, constants, and function signatures.

### Core Type System

**Primitive Type Mappings (L7-226):**
- Basic signed/unsigned integer types (`__s16_type`, `__u16_type`, etc.)
- Platform-specific types (`__word_type`, `__uword_type`, `__quad_type`, `__uquad_type`)
- System identifier types: `__uid_t`, `__gid_t`, `__pid_t`, `__dev_t`, `__ino_t` (L34-42)
- File system types: `__off_t`, `__off64_t`, `__blkcnt_t`, `__fsblkcnt_t` (L40-50)
- Time-related types: `__time_t`, `__suseconds_t`, `__clockid_t`, `__timer_t` (L53-61)
- Networking types: `in_addr_t`, `in_port_t`, `sa_family_t` (L86, L176, L174)

**Floating Point and Wide Character Types (L88-94):**
- IEEE floating point: `_Float32`, `_Float64`, `_Float32x`, `_Float64x`
- Wide character support: `wchar_t`, `wint_t`

### System Structure Definitions

**Network Structures (L248-347):**
- Socket addressing: `sockaddr`, `sockaddr_in`, `sockaddr_in6`, `sockaddr_un` (L265-296)
- Network information: `addrinfo` (L338-347)
- Message passing: `msghdr`, `cmsghdr` (L349-363)

**File System Structures (L365-501):**
- Directory entries: `dirent`, `dirent64` (L365-379)
- File metadata: `stat`, `stat64`, `statx`, `statx_timestamp` (L461-531)
- File system information: `statfs`, `statfs64`, `statvfs`, `statvfs64` (L533-595)

**Threading and Synchronization (L633-708):**
- Thread types: `__pthread`, `pthread_t`, `__pthread_attr` (L633, L142, L680-689)
- Mutex types: `__pthread_mutex`, `__pthread_mutexattr` (L643-652, L637-642)
- Condition variables: `__pthread_cond`, `__pthread_condattr` (L672-678, L654-657)
- Read-write locks: `__pthread_rwlock`, `__pthread_rwlockattr` (L691-699, L659-661)

### System Constants

**File Operations (L2254-2332):**
- File access modes: `O_RDONLY`, `O_WRONLY`, `O_RDWR` (L2257-2259)
- File creation flags: `O_CREAT`, `O_EXCL`, `O_TRUNC` (L2262-2280)
- File descriptor flags: `FD_CLOEXEC`, `F_DUPFD`, `F_GETFD` (L2311-2313)

**Signal Handling (L1980-2034):**
- Standard signals: `SIGINT`, `SIGTERM`, `SIGSEGV` (L1981-1985)
- Real-time signals: `__SIGRTMIN`, `__SIGRTMAX` (L2016-2017)
- Signal actions: `SA_ONSTACK`, `SA_RESTART`, `SA_SIGINFO` (L2022-2027)

**Network Protocol Constants (L3177-3205):**
- IP protocols: `IPPROTO_TCP`, `IPPROTO_UDP`, `IPPROTO_ICMP` (L3181-3184)
- Socket options: `SO_DEBUG`, `SO_REUSEADDR`, `SO_KEEPALIVE` (L3157-3175)

### External Function Declarations

**File System Operations (L3540-4122):**
- File I/O: `lutimes`, `futimes`, `futimens`, `utimensat` (L3541-3551)
- Directory operations: `mkfifoat`, `mknodat`, `openat`, `openat64` (L3553-3101)
- Extended I/O: `readv`, `writev`, `preadv`, `pwritev` (L3596-3619)

**Process and Thread Management (L3903-4012):**
- Thread creation: `pthread_create`, `pthread_kill`, `pthread_cancel` (L3903-3910)
- Thread attributes: `pthread_getattr_np`, `pthread_attr_getguardsize` (L3913-3919)
- Scheduling: `sched_getparam`, `sched_setparam`, `sched_setscheduler` (L3994-4001)

**Memory Management (L4294-4383):**
- Memory mapping: `mmap64`, `mremap`, `mprotect` (L4294-4311)
- Memory allocation: `memalign`, `mallinfo`, `malloc_trim` (L4377-4384)

### Utility Macros and Functions

**Bit Manipulation Utilities (L3458-3503):**
- CPU set operations: `CPU_ZERO`, `CPU_SET`, `CPU_CLR`, `CPU_ISSET` (L3464-3485)
- File descriptor set operations: `FD_CLR`, `FD_ISSET`, `FD_SET`, `FD_ZERO` (L3513-3537)

**System Information Functions (L4528-4552):**
- Device number manipulation: `makedev`, `major`, `minor` (L4529-4544)
- Process status macros: `WIFSTOPPED`, `WIFEXITED`, `WEXITSTATUS` (L4554-4580)

### Architecture-Specific Code

**Conditional Compilation (L4615-4623):**
The file uses conditional compilation to include architecture-specific definitions based on pointer width (32-bit vs 64-bit systems).

This file serves as the foundational layer for system programming on GNU Hurd, providing type-safe Rust bindings to the underlying C library while maintaining full compatibility with the POSIX standard and GNU extensions.