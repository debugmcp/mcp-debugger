# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/mips/mod.rs
@source-hash: e552f579a8dc9e69
@generated: 2026-02-09T17:58:21Z

## Purpose
Platform-specific constants and type definitions for MIPS architecture running Linux with uClibc. Part of the libc crate's hierarchical platform abstraction layer (unix → linux_like → linux → uclibc → mips).

## Key Components

### Type Definitions (L1-3)
- `pthread_t` (L3): Thread identifier type mapped to `c_ulong` for MIPS/uClibc

### System Constants Categories

**File Descriptor Flags** (L5, L11, L33, L35, L207, L213)
- `SFD_CLOEXEC`, `O_CLOEXEC`, `EPOLL_CLOEXEC`, `EFD_CLOEXEC`: Close-on-exec flags
- `EFD_NONBLOCK`, `SFD_NONBLOCK`: Non-blocking operation flags

**File Operation Flags** (L7-58)
- Terminal control: `NCCS` (L7) - control character array size
- File access: `O_TRUNC`, `O_DIRECT`, `O_DIRECTORY`, `O_NOFOLLOW`, etc. (L9-57)
- Socket flags: `SOCK_NONBLOCK` (L59)

**Error Codes** (L13-143)
- Extended POSIX error codes specific to MIPS/uClibc
- Stream errors: `ENOSTR`, `ENODATA`, `ETIME` (L14-16)
- Network errors: `EADDRINUSE`, `ECONNRESET`, `ETIMEDOUT` (L109-146)
- File system errors: `ENOMEDIUM`, `EMEDIUMTYPE` (L134-135)

**Memory Mapping** (L145-154)
- `MAP_NORESERVE`, `MAP_ANON`, `MAP_GROWSDOWN`, etc.
- MIPS-specific memory mapping behavior flags

**Signal Handling** (L28-32, L162-187)
- Signal action flags: `SA_NODEFER`, `SA_RESETHAND`, `SA_RESTART` (L28-31)
- Signal numbers: `SIGEMT`, `SIGCHLD`, `SIGBUS`, etc. (L166-184)
- Signal mask operations: `SIG_SETMASK`, `SIG_BLOCK`, `SIG_UNBLOCK` (L185-187)

**Terminal I/O** (L156, L194-266)
- Line discipline: `NLDLY` (L156)
- Terminal control characters: `VEOF`, `VEOL`, `VMIN`, etc. (L194-241)
- Terminal flags: `IEXTEN`, `TOSTOP`, `FLUSHO` (L198-200)
- Baud rate constants: `B0` through `B4000000` (L270-300)

**Socket Types** (L158-160)
- `SOCK_STREAM`, `SOCK_DGRAM`, `SOCK_SEQPACKET`

### Architecture-Specific Module Loading (L302-312)
Conditional compilation using `cfg_if!` macro:
- Includes `mips32` module for 32-bit MIPS targets (L304-305)
- Includes `mips64` module for 64-bit MIPS targets (L307-308)
- Provides architecture-specific extensions to base constants

## Dependencies
- `crate::prelude::*` (L1): Core libc types and macros
- `crate::tcflag_t`, `crate::speed_t`: Terminal control types from parent modules

## Architecture Notes
- All constants are MIPS-specific values that may differ from other architectures
- Part of uClibc-specific implementation, distinct from glibc values
- Values use both decimal and octal notation for different constant categories
- Terminal baud rates follow traditional POSIX octal encoding