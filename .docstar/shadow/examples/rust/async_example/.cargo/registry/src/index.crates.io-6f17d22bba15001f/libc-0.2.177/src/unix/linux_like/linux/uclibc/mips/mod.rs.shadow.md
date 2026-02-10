# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/mips/mod.rs
@source-hash: e552f579a8dc9e69
@generated: 2026-02-09T17:57:00Z

**MIPS uClibc Platform Constants Module**

Primary purpose: Defines platform-specific constants and types for MIPS architecture running uClibc on Linux systems. Part of the libc crate's hierarchical platform abstraction layer.

## Key Components

**Type Definitions** (L1-3):
- `pthread_t` (L3): Thread identifier type as `c_ulong`

**System Constants Categories**:

**File Operations** (L5-58):
- File descriptor flags: `SFD_CLOEXEC`, `EFD_CLOEXEC`, `EPOLL_CLOEXEC` (L5, 35, 33)
- File open modes: `O_TRUNC`, `O_CLOEXEC`, `O_DIRECT`, `O_DIRECTORY`, etc. (L9-57)
- Terminal control: `NCCS` array size (L7)

**Error Constants** (L13-143):
- Extended errno values specific to MIPS/uClibc
- Network errors: `EADDRINUSE`, `ECONNRESET`, etc. (L109-146)
- System errors: `EBFONT`, `ENOSTR`, `EDEADLK`, etc. (L13-96)
- Security/key management errors: `ENOKEY`, `EKEYEXPIRED` (L137-140)

**Memory Mapping** (L145-154):
- MAP flags: `MAP_NORESERVE`, `MAP_ANON`, `MAP_GROWSDOWN`, etc.
- `MAP_HUGETLB` for huge page support (L268)

**Socket Constants** (L59, 158-160):
- Socket types: `SOCK_STREAM`, `SOCK_DGRAM`, `SOCK_SEQPACKET`
- Socket flags: `SOCK_NONBLOCK`

**Signal Handling** (L28-187):
- Signal action flags: `SA_NODEFER`, `SA_RESETHAND`, `SA_ONSTACK` (L28-164)
- Signal numbers: `SIGEMT`, `SIGCHLD`, `SIGUSR1/2`, etc. (L166-184)
- Signal mask operations: `SIG_SETMASK`, `SIG_BLOCK`, `SIG_UNBLOCK` (L185-187)

**Terminal I/O** (L156-267):
- Termios flags for character processing, baud rates, control modes
- Virtual terminal characters: `VEOF`, `VEOL`, `VMIN`, etc. (L194-241)
- Terminal control flags: `IEXTEN`, `TOSTOP`, `FLUSHO` (L198-266)

**Serial Communication** (L270-300):
- Baud rate constants from B0 to B4000000 using octal notation

**Architecture Dispatch** (L302-312):
- Conditional compilation using `cfg_if!` macro
- Imports architecture-specific modules (`mips32` or `mips64`)
- Fallback case for unknown architectures

## Dependencies
- `crate::prelude::*` (L1): Core libc types and macros
- Architecture-specific submodules for 32/64-bit MIPS variants

## Architectural Patterns
- Pure constant definitions with no runtime behavior
- Platform-specific value assignments matching MIPS/uClibc ABI
- Hierarchical module structure with arch-specific specialization
- Extensive use of C-compatible integer types (`c_int`, `c_uint`, etc.)

## Critical Invariants
- All constants must match corresponding C header definitions for MIPS/uClibc
- Values are ABI-critical and cannot be changed without breaking compatibility
- Architecture dispatch ensures correct constant selection at compile time