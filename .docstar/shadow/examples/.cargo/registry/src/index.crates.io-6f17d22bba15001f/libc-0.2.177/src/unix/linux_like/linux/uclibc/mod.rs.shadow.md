# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/mod.rs
@source-hash: 128d586702c6aa6f
@generated: 2026-02-09T18:02:24Z

## Purpose
This module provides uClibc-specific type definitions, constants, and function bindings for Linux systems. It serves as a compatibility layer within the libc crate hierarchy, specifically targeting uClibc (a lightweight C library for embedded systems) on Linux platforms.

## Key Components

### Type Definitions (L7-23)
- Basic system types: `shmatt_t`, `msgqnum_t`, `msglen_t`, `regoff_t`, `rlim_t` (L7-12)
- Resource limit types: `__rlimit_resource_t`, `__priority_which_t` (L12-13)
- Conditional `Ioctl` type definition with documentation visibility handling (L15-23)

### Core Data Structures (L25-156)
- `statvfs` (L26-45): File system statistics with uClibc-specific layout and endianness handling
- `regex_t` (L47-56): Regular expression compiled pattern structure
- `rtentry` (L58-77): Network routing table entry with pointer-width conditional fields
- `__exit_status` (L79-82): Process exit status representation
- `ptrace_peeksiginfo_args` (L84-88): Arguments for ptrace signal information retrieval
- `pthread_mutexattr_t` (L90-114): Mutex attributes with architecture-specific alignment
- `pthread_condattr_t` (L116-119): Condition variable attributes
- `tcp_info` (L121-155): TCP connection state information with extensive metrics

### Signal Information Extensions (L158-241)
- `siginfo_t` implementation with unsafe accessor methods:
  - `si_addr()` (L159-168): Signal fault address extraction
  - `si_value()` (L170-181): Signal value extraction
  - Signal child process information accessors (L221-239): `si_pid`, `si_uid`, `si_status`, `si_utime`, `si_stime`
- Internal union structures for signal field access: `sifields_sigchld` (L186-198), `sifields` (L202-205), `siginfo_f` (L210-214)

### Constants (L242-429)
- Memory control constants: `MCL_CURRENT`, `MCL_FUTURE`, `MCL_ONFAULT` (L242-244)
- Ptrace operation constants (L256-283)
- Locale category constants with uClibc-specific values (L289-295)
- Extensive locale item constants (L308-364)
- File operation and networking constants (L376-429)

### External Function Bindings (L431-502)
- System functions: `gettimeofday`, `ptrace`, `sendmmsg`, `recvmmsg` (L432-457)
- PTY functions: `openpty`, `forkpty` (L459-471)
- Network functions: `getnameinfo`, `preadv`, `pwritev` (L473-484)
- Resource management: `getrlimit64`, `setrlimit64`, `getpriority`, `setpriority` (L494-500)

### Architecture-Specific Modules (L504-517)
- Conditional compilation for MIPS, x86_64, ARM architectures
- Fallback to `unsupported_target` for other architectures

## Dependencies
- Imports `off64_t` and common prelude from parent crate
- References various types from parent modules (`fsblkcnt_t`, `sockaddr`, `pthread_*`, etc.)

## Notable Patterns
- Extensive use of `cfg_if!` for conditional compilation
- Architecture and pointer-width specific structure layouts
- Unsafe signal information extraction methods using pointer casting
- Union-based field access patterns for complex C structures