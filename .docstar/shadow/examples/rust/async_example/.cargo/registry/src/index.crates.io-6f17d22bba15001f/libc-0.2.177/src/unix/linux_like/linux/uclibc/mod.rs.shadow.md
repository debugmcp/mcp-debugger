# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/mod.rs
@source-hash: 128d586702c6aa6f
@generated: 2026-02-09T17:57:30Z

## uClibc-specific Linux bindings

**Primary Purpose**: Provides uClibc-specific system types, structures, and constants that differ from GNU libc implementations, serving as a platform-specific layer in the libc crate's Linux hierarchy.

**Key Dependencies**: 
- `crate::prelude::*` (L5) - Common type definitions
- `crate::off64_t` (L4) - 64-bit file offset type

**Type Definitions (L7-23)**:
- System-level primitive types: `shmatt_t`, `msgqnum_t`, `msglen_t`, `regoff_t`, `rlim_t` (L7-12)
- Priority/resource control types: `__rlimit_resource_t`, `__priority_which_t` (L12-13)  
- Conditional `Ioctl` type with doc visibility handling (L15-23)

**Core Structures (L25-156)**:
- `statvfs` (L26-45): File system statistics with uClibc-specific field layout and endianness handling
- `regex_t` (L47-56): POSIX regex compilation structure
- `rtentry` (L58-77): Network routing table entry with pointer-width conditional fields
- `__exit_status` (L79-82): Process exit status information  
- `ptrace_peeksiginfo_args` (L84-88): ptrace signal inspection arguments
- `pthread_mutexattr_t`/`pthread_condattr_t` (L90-119): Thread synchronization attribute types with architecture-specific alignment
- `tcp_info` (L121-155): TCP socket state information structure

**Signal Handling Implementation (L158-240)**:
- `siginfo_t` extension methods for accessing union fields safely:
  - `si_addr()` (L159-168): Fault address extraction via cast to `siginfo_sigfault`
  - `si_value()` (L170-181): Signal value extraction via cast to `siginfo_si_value`
  - Signal child info accessors: `si_pid()`, `si_uid()`, `si_status()`, `si_utime()`, `si_stime()` (L221-239)
- Internal union structures `sifields_sigchld`, `sifields`, `siginfo_f` for memory layout management (L186-214)

**Constants (L242-429)**:
- Memory locking: `MCL_CURRENT`, `MCL_FUTURE`, `MCL_ONFAULT` (L242-244)
- File system magic numbers: `BINDERFS_SUPER_MAGIC`, `XFS_SUPER_MAGIC` (L253-254)
- ptrace operations: Complete set from `PTRACE_TRACEME` to `PTRACE_LISTEN` (L256-283)
- Locale constants with uClibc-specific values differing from GNU (L289-296, L308-364)
- Network, file, and system constants (L376-429)

**External Functions (L431-502)**:
- Time: `gettimeofday()` (L432)
- Threading: `pthread_rwlockattr_*` functions (L434-441)
- Process debugging: `ptrace()` with variadic arguments (L443)
- Network I/O: `sendmmsg()`, `recvmmsg()`, `getnameinfo()` (L445-481)  
- File I/O: `pwritev()`, `preadv()` with 64-bit offsets (L483-484)
- System control: `sethostid()`, `fanotify_mark()`, resource limit functions (L486-501)

**Architecture Selection (L504-517)**:
Conditional compilation directing to architecture-specific submodules (MIPS, x86_64, ARM) or unsupported target error.

**uClibc Differences**: Multiple comments indicate divergence from GNU libc, particularly in locale constants ordering and `statvfs` structure layout, requiring separate definitions.